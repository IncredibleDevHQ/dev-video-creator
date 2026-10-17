import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { AppContext } from '../app/app-context'
vi.mock('../app/api', () => ({ api: { create: vi.fn(), archive: vi.fn() } }))
vi.mock('../app/notebook-editor', () => ({
  installNotebookEditor: vi.fn(),
  saveBeforeLeaving: vi.fn()
}))
vi.mock('../app/brand-story', () => ({ installBrandStory: vi.fn() }))
import { api } from '../app/api'
import { installStartController, submitStart } from '../app/start-controller'
import { sourceComposer, updateSourceComposer } from '../app/source-composer'
import { downloadVideo } from '../app/download'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('Enter is a newline, explicit submit is single-flight and preserves the full draft', async () => {
  const { document, window } = parseHTML(
    '<html><body><div id="app"><form id="source"><textarea id="source-input"></textarea></form></div></body></html>'
  )
  vi.stubGlobal('document', document)
  const root = document.getElementById('app')!
  const form = document.querySelector('form')!
  const field = document.querySelector('textarea')!
  const submit = vi.fn()
  form.requestSubmit = submit
  const app = {
    root,
    pending: false,
    pendingSource: '',
    fitSource: vi.fn(),
    render: vi.fn(),
    attach: vi.fn()
  } as unknown as AppContext
  installStartController(app)
  const event = new window.Event('keydown', { bubbles: true, cancelable: true })
  Object.assign(event, {
    key: 'Enter',
    metaKey: false,
    ctrlKey: false,
    isComposing: false
  })
  field.dispatchEvent(event)
  expect(submit).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
  let resolve!: (value: never) => void
  vi.mocked(api.create).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      })
  )
  const values = new FormData()
  values.set('source', '# Notes\nA full paragraph.\nAnother line.')
  const first = submitStart(app, form as never, values)
  await submitStart(app, form as never, values)
  expect(app.pending).toBe(true)
  expect(api.create).toHaveBeenCalledTimes(1)
  expect(api.create).toHaveBeenCalledWith({
    source: values.get('source'),
    sourceOnly: true
  })
  resolve({ project: { id: 'new' } } as never)
  await first
  expect(app.pending).toBe(false)
})

it('empty and whitespace-only drafts keep Submit disabled', () => {
  const { document } = parseHTML('<html><body><form></form></body></html>')
  vi.stubGlobal('document', document)
  document.querySelector('form')!.innerHTML = sourceComposer(false)
  const field = document.querySelector('textarea')!
  const button = document.querySelector('button')!
  Object.defineProperty(field, 'form', {
    value: document.querySelector('form')
  })
  expect(button.hasAttribute('disabled')).toBe(true)
  field.value = '   '
  updateSourceComposer(field as never, false)
  expect(button.disabled).toBe(true)
  field.value = 'Notes'
  updateSourceComposer(field as never, false)
  expect(button.disabled).toBe(false)
})

it('an MP4 download uses one request and keeps progress and completion feedback', async () => {
  vi.useFakeTimers()
  const { document, window } = parseHTML(
    '<html><body><button>Export MP4</button></body></html>'
  )
  vi.stubGlobal('document', document)
  vi.spyOn(window.HTMLElement.prototype, 'click').mockImplementation(() => {})
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  let release!: (response: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve
      })
  )
  vi.stubGlobal('fetch', fetch)
  const button = document.querySelector('button')!
  const first = downloadVideo('n', button as never)
  await downloadVideo('n', button as never)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(button.disabled).toBe(true)
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Downloading…'
  )
  release(
    new Response('fixture bytes', {
      headers: {
        'content-type': 'video/mp4',
        'content-disposition': 'attachment; filename="Episode one.mp4"'
      }
    })
  )
  await first
  expect(button.disabled).toBe(false)
  expect(document.querySelector('[role=status]')?.textContent).toContain(
    'Episode one.mp4 is ready'
  )
  vi.runAllTimers()
})

it('dialogs keep one named close affordance and retain Cancel for forms', async () => {
  const { document } = parseHTML('<html><body></body></html>')
  vi.stubGlobal('document', document)
  const { dialogContent } = await import('../app/dialog-content')
  const passive = document.createElement('div')
  passive.innerHTML = dialogContent(
    '<h2>Info</h2><div class="dialog-actions"><button data-action="close">Close</button></div>'
  )
  expect(passive.querySelectorAll('[data-action="close"]')).toHaveLength(1)
  expect(
    passive.querySelector('[data-action="close"]')?.getAttribute('aria-label')
  ).toBe('Close dialog')
  const form = document.createElement('div')
  form.innerHTML = dialogContent(
    '<form><button data-action="close">Cancel</button><button>Save</button></form>'
  )
  expect(form.querySelectorAll('[data-action="close"]')).toHaveLength(1)
  expect(form.querySelector('[data-action="close"]')?.textContent).toBe(
    'Cancel'
  )
})

it('series titles navigate directly and episode template labels are explicit', async () => {
  const { seriesSection, seriesPageView } = await import('../app/series-view')
  const summary = {
    id: 's',
    title: 'Series',
    episodes: 1,
    members: [{ notebookId: 'e', number: 1 }]
  }
  expect(seriesSection([summary as never])).toContain(
    'data-action="open-series-page"'
  )
  expect(seriesSection([{ ...summary, map: 'm' } as never])).toContain(
    'data-action="open-map-of"'
  )
  const page = {
    series: {
      id: 's',
      title: 'Series',
      about: 'An explanation',
      repos: [],
      threads: [],
      episodes: [],
      growth: 'one'
    },
    episodes: [
      {
        notebookId: 'e',
        number: 1,
        title: 'Episode one',
        status: 'ready',
        narrative: null
      }
    ]
  }
  const html = seriesPageView(page as never, true)
  expect(html).toContain('Open episode 1: Episode one')
  expect(html).toContain('Template: Not selected')
  expect(html).toContain('Save threads')
  expect(html).not.toContain('data-action="close"')
})
