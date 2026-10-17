import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { Snapshot } from '../shared/api'
import type { StudioSettings } from '../shared/settings'
import type { SeriesLed } from '../shared/series'
// Who presents a series, asked once when it starts, and each episode's Make
// starting from it (review 8, F05: a series told from notes opened Make on
// camera, with "I record it"). The network is a stand-in.
const { request, settings } = vi.hoisted(() => ({
  request: vi.fn(),
  settings: vi.fn()
}))
vi.mock('../app/studio-api', () => ({ studioApi: { request } }))
vi.mock('../app/api', () => ({ api: { settings } }))
vi.mock('../app/notebook-editor', () => ({ saveBeforeLeaving: vi.fn() }))
const { newSeriesDialog } = await import('../app/series-view')
const { makeVideoDialog } = await import('../app/video-screen')
const { syncMakeDialog } = await import('../app/make-dialog-sync')
const { clickVideo } = await import('../app/video-controller')
afterEach(() => {
  request.mockReset()
  settings.mockReset()
  vi.unstubAllGlobals()
})

/** A form's fields as FormData reads them: a checked radio's value, and
 * nothing from a disabled fieldset or a disabled field. */
class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) => {
    const fields = [
      ...this.form.querySelectorAll<HTMLInputElement>(`[name="${name}"]`)
    ].filter(
      (field) =>
        !field.closest('fieldset[disabled]') &&
        !field.hasAttribute('disabled') &&
        (field.type !== 'radio' || field.hasAttribute('checked'))
    )
    return fields[0]?.value ?? null
  }
}

const voices = (
  selected: StudioSettings['voice']['selected'],
  choices = [
    { id: 'system:Aman', name: 'Aman', language: 'en-IN' },
    { id: 'system:Samantha', name: 'Samantha', language: 'en-US' }
  ]
) =>
  ({
    voice: { hasKey: false, selected, clones: [], choices, error: null }
  }) as unknown as StudioSettings
const slides = [{ id: 'a', title: 'Why cache' }] as never
const opened = (
  studio: StudioSettings,
  planned?: Parameters<typeof makeVideoDialog>[4]
) => {
  vi.stubGlobal('FormData', FormShim)
  const { document } = parseHTML(
    `<div>${makeVideoDialog(studio, undefined, { slides, selected: null, only: false }, undefined, planned)}</div>`
  )
  syncMakeDialog(document)
  return document
}
const chosen = (document: Document, name: string) =>
  document.querySelector<HTMLInputElement>(
    `input[name="${name}"][checked]:not([disabled])`
  )?.value
const said = (document: Document) => {
  const line = document.querySelector<HTMLElement>('.make-records')!
  return line.hidden ? '' : line.textContent
}
const record = { kind: 'record' } as const

it('asks once who presents the series, a generated voice unless they say', () => {
  for (const html of [
    newSeriesDialog(),
    newSeriesDialog([
      {
        id: 'n',
        title: 'Notes',
        status: 'ready',
        hasVideo: false,
        updatedAt: null,
        site: null,
        preview: '<svg/>',
        slides: 2
      }
    ])
  ]) {
    const { document } = parseHTML(`<div>${html}</div>`)
    expect(chosen(document, 'led')).toBe('notes')
    // A mode that asks for recording says so before anything is made.
    const presenter = document.querySelector(
      'input[name="led"][value="presenter"]'
    )!.parentElement!
    expect(presenter.querySelector('small')?.textContent).toBe(
      'You record your camera and voice for each episode.'
    )
  }
})

describe('an episode’s Make starts as its series is presented', () => {
  it('told from notes: off camera, in a generated voice, nothing to record', () => {
    const document = opened(voices(record), { led: 'notes' })
    expect(chosen(document, 'presence')).toBe('off')
    expect(chosen(document, 'voice')).toBe('ai:system:Aman')
    expect(said(document)).toBe('Nothing for you to record.')
    expect(document.querySelector<HTMLElement>('.two-voices')!.hidden).toBe(
      true
    )
    // The voice chosen in Settings, when it is a generated one.
    const kept = opened(voices({ kind: 'ai', id: 'system:Samantha' }), {
      led: 'notes'
    })
    expect(chosen(kept, 'voice')).toBe('ai:system:Samantha')
    // No voice to generate here: the creator's own, and what that asks.
    const none = opened(voices(record, []), { led: 'notes' })
    expect(chosen(none, 'voice')).toBe('record')
    expect(said(none)).toBe('You record the narration for each scene.')
  })

  it('presented by the creator: on camera, in their own voice, and said', () => {
    const document = opened(voices({ kind: 'ai', id: 'system:Samantha' }), {
      led: 'presenter'
    })
    expect(chosen(document, 'presence')).toBe('high')
    expect(chosen(document, 'voice')).toBe('record')
    expect(said(document)).toBe(
      'You record yourself on camera, and the narration.'
    )
  })

  it('a notebook in no series starts as Make always did', () => {
    const document = opened(voices({ kind: 'ai', id: 'system:Samantha' }))
    expect(chosen(document, 'presence')).toBe('high')
    expect(chosen(document, 'voice')).toBe('ai:system:Samantha')
    expect(said(document)).toBe('You record yourself on camera.')
  })

  it('an episode’s template starts off camera too, unless its direction says', () => {
    // Its preset puts the creator on camera as a guide.
    const planned = (led: SeriesLed, onCamera?: 'leads') => ({
      narrative: 'how-it-works',
      direction: {
        preset: 'explainer' as const,
        ...(onCamera && { onCamera })
      },
      led
    })
    expect(chosen(opened(voices(record), planned('notes')), 'oncamera')).toBe(
      'none'
    )
    expect(
      chosen(opened(voices(record), planned('notes', 'leads')), 'oncamera')
    ).toBe('leads')
    expect(
      chosen(opened(voices(record), planned('presenter')), 'oncamera')
    ).toBe('guide')
  })
})

it('says what the camera and voice chosen ask the creator to record', () => {
  const document = opened(voices(record), { led: 'notes' })
  const pick = (name: string, value: string) => {
    for (const input of document.querySelectorAll<HTMLInputElement>(
      `input[name="${name}"]`
    ))
      input.toggleAttribute('checked', input.value === value)
    syncMakeDialog(document)
    return said(document)
  }
  expect(pick('presence', 'low')).toBe('You record yourself on camera.')
  expect(pick('voice', 'record')).toBe(
    'You record yourself on camera, and the narration.'
  )
  expect(pick('presence', 'off')).toBe(
    'You record the narration for each scene.'
  )
  expect(pick('voice', 'ai:system:Samantha')).toBe('Nothing for you to record.')
})

it('opening Make on an episode reads who presents its series', async () => {
  const { document, window } = parseHTML(
    '<html><body><div id="app"></div><dialog></dialog></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.stubGlobal('FormData', FormShim)
  window.HTMLElement.prototype.getBoundingClientRect = () =>
    ({ top: 0, height: 0 }) as DOMRect
  const dialog = document.querySelector('dialog')!
  settings.mockResolvedValue(voices(record))
  request.mockImplementation(async (path: string) =>
    path === '/series/s-map'
      ? {
          // A content map's series, started before it was asked: told from
          // its notes.
          series: { id: 's-map', title: 'Caching', map: 'n-map' },
          episodes: []
        }
      : null
  )
  const episode = {
    project: {
      id: 'ep1',
      title: 'Why cache',
      source: '',
      slides: [{ id: 'a', title: 'Why cache', svg: '<svg><rect/></svg>' }],
      video: null,
      copyOfMap: 'n-map',
      episode: { series: 's-map', number: 1 }
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot
  const app = {
    snapshot: episode,
    stage: 'notebook',
    selected: 0,
    dialog,
    showDialog: (html: string) => {
      dialog.innerHTML = html
    }
  }
  const button = document.createElement('button')
  await clickVideo(app as never, button as never, 'make-video')
  expect(request).toHaveBeenCalledWith('/series/s-map')
  expect(chosen(document, 'presence')).toBe('off')
  expect(chosen(document, 'voice')).toBe('ai:system:Aman')
  expect(said(document)).toBe('Nothing for you to record.')
  // A series that cannot be read leaves Make as it always started.
  request.mockRejectedValue(new Error('The studio is restarting'))
  await clickVideo(app as never, button as never, 'make-video')
  expect(chosen(document, 'presence')).toBe('high')
})
