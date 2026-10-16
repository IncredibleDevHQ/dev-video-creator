import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: {
    view: vi.fn(),
    note: vi.fn(async () => ({})),
    direction: vi.fn(async () => ({ directions: [] })),
    removeDirection: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
const { openMic } = await import('../app/voice-audio')
// The independent audit's look at the map and its voice: a direction saved
// twice, comments on a draft and on a gap, the call's microphone. The
// browser's media is a stand-in: these checks prove the map's plumbing.

const slide = (id: string) => ({ id, title: `Page ${id}`, svg: '<svg/>' })
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    video: null,
    slides: ['a', 'b'].map(slide)
  },
  status: 'ready',
  error: null,
  events: []
})
const episode = (notebook: string, number: number): MapEpisode =>
  ({
    made: false,
    video: null,
    teasers: [],
    posts: null,
    notebook,
    number,
    title: `Episode ${number}`,
    status: 'ready',
    copies: [
      {
        svg: '<svg/>',
        stale: false,
        orphan: false,
        id: `x${number}`,
        title: 'Copy of a',
        copyOf: { notebook: 'map', slide: 'a', hash: 'h' }
      }
    ]
  }) as MapEpisode
const view = (): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    lines: [],
    gaps: [
      {
        id: 'do',
        missing: 'What a Durable Object is',
        episode: 'e1',
        why: 'The orchestrator is one',
        ask: 'What is it?',
        state: 'open'
      }
    ],
    flags: [],
    left: [],
    held: [],
    id: 's',
    title: 'Streamline',
    organize: true,
    directions: [{ id: 'd1', text: 'Lead with the problem', at: 'now' }]
  },
  episodes: [episode('e1', 1)],
  usage: { a: ['e1'] },
  comments: [
    {
      id: 'k1',
      at: new Date().toISOString(),
      by: 'creator',
      text: 'Say what a Durable Object is',
      target: { kind: 'gap', id: 'do' },
      kind: 'material',
      state: 'open',
      replies: []
    }
  ]
})

/** A form's fields, read the way FormData reads a real one. */
class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) =>
    this.form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? null
}

let win = parseHTML('')
const maps: Canvas[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const openMap = async (shown = view()) => {
  win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4194/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('FormData', FormShim)
  // linkedom's textarea has no select(); the browser's does.
  Object.defineProperty(win.HTMLTextAreaElement.prototype, 'select', {
    value: () => {},
    configurable: true
  })
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => snapshot())
  vi.mocked(mapApi.view).mockImplementation(async () => structuredClone(shown))
  vi.mocked(mapApi.comments).mockImplementation(async () => ({
    comments: []
  }))
  await map.open('map')
  return { map, hooks, root: map.root }
}
const fire = (target: EventTarget, type: string, extra: object = {}) => {
  const event = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, extra)
  target.dispatchEvent(event)
}
const click = (target: Element | null) => (target as HTMLElement).click()
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
/** Add → Direction: the draft being written. */
const draft = (root: HTMLElement) => {
  click(root.querySelector('[data-map="add"]'))
  click(root.querySelector('[data-map="flow-direction"]'))
  return root.querySelector<HTMLFormElement>(
    '[data-map-form="direction"][data-direction="__draft__"]'
  )!
}

describe('a direction and comments on the map (independent audit)', () => {
  it('saves a new direction once when Save is clicked twice, and never says it is gone', async () => {
    const { root, hooks } = await openMap()
    let release = () => {}
    vi.mocked(mapApi.direction).mockImplementation(async (_series, body) => {
      if ((body as { id?: string }).id === '__draft__')
        throw new Error('That direction is gone')
      await new Promise<void>((resolve) => (release = resolve))
      return { directions: [] } as never
    })
    const form = draft(root)
    form.querySelector('textarea')!.value = 'Open on the outage'
    // Twice before the map redraws: the form is still there.
    fire(form, 'submit')
    fire(form, 'submit')
    await settle()
    release()
    await settle()
    const calls = vi.mocked(mapApi.direction).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({ text: 'Open on the outage' })
    expect(calls[0][1]).not.toHaveProperty('id')
    expect(hooks.error).not.toHaveBeenCalled()
  })

  it('brings a refused new direction back with its words, and its Save works again', async () => {
    const { map, root, hooks } = await openMap()
    vi.mocked(mapApi.direction).mockRejectedValueOnce(
      new Error('A series takes up to 30 directions')
    )
    const form = draft(root)
    form.querySelector('textarea')!.value = 'Open on the outage'
    fire(form, 'submit')
    await settle()
    expect(hooks.error).toHaveBeenCalledOnce()
    expect(map.editingDirection).toBe('__draft__')
    const again = root.querySelector<HTMLFormElement>(
      '[data-map-form="direction"][data-direction="__draft__"]'
    )!
    expect(again.querySelector('textarea')!.value).toBe('Open on the outage')
    fire(again, 'submit')
    await settle()
    const calls = vi.mocked(mapApi.direction).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][1]).toMatchObject({ text: 'Open on the outage' })
  })

  it('pins a comment on a direction being written to its spot, never to the unsaved draft', async () => {
    const { map, root } = await openMap()
    draft(root)
    click(root.querySelector('[data-comment="tool"]'))
    const label = root.querySelector('[data-k="d:__draft__"] .map-node-label')!
    fire(label, 'pointerdown', { button: 0, clientX: 30, clientY: 40 })
    expect(map.comments.composer?.target.kind).toBe('spot')
    const form = root.querySelector<HTMLFormElement>(
      '[data-comment-form="new"]'
    )!
    form.querySelector('input')!.value = 'Say why first'
    fire(form, 'submit')
    await settle()
    const [sent] = vi.mocked(mapApi.comments).mock.calls.map((call) => call[1])
    expect(sent).toMatchObject({ action: 'add', text: 'Say why first' })
    expect((sent as { target: { kind: string } }).target.kind).toBe('spot')
  })

  it('adds a note made from a comment on an open gap to that gap, as the gap’s own note does', async () => {
    const { root } = await openMap()
    click(root.querySelector('[data-pin="k1"]'))
    click(root.querySelector('[data-comment="note:k1"]'))
    await settle()
    expect(mapApi.note).toHaveBeenCalledWith(
      'map',
      'Say what a Durable Object is',
      'do'
    )
  })

  it('adds the note without the gap once that gap is set aside', async () => {
    const shown = view()
    shown.series!.gaps[0].state = 'ignored'
    const { map, root } = await openMap(shown)
    // Its pin went with the gap; the thread can still be open.
    map.comments.thread = 'k1'
    map.comments.paint()
    click(root.querySelector('[data-comment="note:k1"]'))
    await settle()
    expect(mapApi.note).toHaveBeenCalledWith(
      'map',
      'Say what a Durable Object is',
      undefined
    )
  })
})

describe('the call’s microphone (independent audit)', () => {
  it('lets go of the microphone when the call’s sound cannot be set up', async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const close = vi.fn(async () => {})
    vi.stubGlobal(
      'AudioContext',
      class {
        audioWorklet = {
          addModule: async () => {
            throw new Error('The tap did not load')
          }
        }
        close = close
      }
    )
    await expect(openMic(() => {})).rejects.toThrow('The tap did not load')
    expect(stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
