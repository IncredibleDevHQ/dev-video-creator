import { afterEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { NotebookSummary } from '../shared/api'
import type { SeriesSummary } from '../shared/series'
// Starting a series from home (review 8, F03): what it is about leads, then
// the creator's notes; the studio plans the episodes, and a repo is asked
// for only by a series that follows code. The network is a stand-in.
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../app/studio-api', () => ({ studioApi: { request } }))
vi.mock('../app/api', () => ({ api: {} }))
vi.mock('../app/notebook-editor', () => ({ saveBeforeLeaving: vi.fn() }))
const { clickSeries, submitSeries } = await import('../app/series-controller')
const { newSeriesDialog, syncSeriesForm } = await import('../app/series-view')
const { installAppActions } = await import('../app/app-actions')
afterEach(() => {
  request.mockReset()
  vi.unstubAllGlobals()
})

const notebook = (
  id: string,
  title: string,
  change: Partial<NotebookSummary> = {}
): NotebookSummary => ({
  id,
  title,
  status: 'ready',
  hasVideo: false,
  updatedAt: null,
  site: null,
  preview: '<svg/>',
  slides: 4,
  ...change
})
const learning = notebook('n-new', 'Learning log: APIs that survive retries')
const older = notebook('n-old', 'Rate limits: a starter')
const drawing = notebook('n-drawing', 'Learning log: queues', {
  status: 'building',
  preview: null
})
const formOf = (html: string) =>
  parseHTML(`<div>${html}</div>`).document.querySelector('form')!
const checked = (form: HTMLFormElement, name: string) =>
  form.querySelector<HTMLInputElement>(`input[name="${name}"][checked]`)?.value
const titleOf = (form: HTMLFormElement) =>
  form.querySelector<HTMLInputElement>('#series-title')!
const codeOf = (form: HTMLFormElement) =>
  form.querySelector<HTMLElement>('details.series-code')!

it('asks what the series is about first, then starts from the notebook just made', () => {
  const form = formOf(newSeriesDialog([learning, older]))
  const names = [
    ...form.querySelectorAll<HTMLInputElement>('[name]:not(button)')
  ].map((field) => field.getAttribute('name'))
  expect(names[0]).toBe('about')
  expect(names.indexOf('from')).toBeLessThan(names.indexOf('title'))
  // Its title names the series unless the creator gives one.
  expect(checked(form, 'from')).toBe('n-new')
  expect(titleOf(form).hasAttribute('required')).toBe(false)
  expect(titleOf(form).getAttribute('placeholder')).toBe(learning.title)
  // The studio proposes the episodes; nothing asks for a structure first.
  expect(checked(form, 'growth')).toBe('arc')
  // No repo in sight: a series from notes takes its notebook's.
  expect(codeOf(form).hidden).toBe(true)
  expect(codeOf(form).querySelector('[name="path"]')).not.toBeNull()
  expect(codeOf(form).querySelector('[name="branch"]')).not.toBeNull()
})

it('a notebook still drawn waits; a code series opens its repo when asked', () => {
  const form = formOf(newSeriesDialog([drawing, older]))
  expect(
    [...form.querySelectorAll<HTMLInputElement>('input[name="from"]')].map(
      (row) => [row.value, row.hasAttribute('disabled')]
    )
  ).toEqual([
    ['n-drawing', true],
    ['n-old', false],
    ['', false]
  ])
  // Nothing older is chosen in its place.
  expect(checked(form, 'from')).toBe('')
  expect(form.querySelector('.is-waiting small')?.textContent).toBe(
    'Wireframes in progress'
  )
  expect(form.querySelector('.series-from p')?.textContent).toBe(
    'A notebook can start a series once its wireframes are drawn.'
  )
  expect(titleOf(form).hasAttribute('required')).toBe(true)
  // The repo is one choice away, shut until asked for.
  expect(codeOf(form).hidden).toBe(false)
  expect(codeOf(form).hasAttribute('open')).toBe(false)
  // No notebooks at all: no notes to offer.
  expect(formOf(newSeriesDialog()).querySelector('.series-from')).toBeNull()
})

it('keeps the title and the repo in step with the notes chosen', () => {
  const { document } = parseHTML(`<div>${newSeriesDialog([learning])}</div>`)
  const form = document.querySelector('form')!
  const choose = (value: string) => {
    for (const row of form.querySelectorAll<HTMLInputElement>(
      'input[name="from"]'
    ))
      row.toggleAttribute('checked', row.value === value)
    syncSeriesForm(document)
  }
  choose('')
  expect(titleOf(form).hasAttribute('required')).toBe(true)
  expect(titleOf(form).getAttribute('placeholder')).toBe('')
  expect(codeOf(form).hidden).toBe(false)
  choose('n-new')
  expect(titleOf(form).hasAttribute('required')).toBe(false)
  expect(titleOf(form).getAttribute('placeholder')).toBe(learning.title)
  expect(codeOf(form).hidden).toBe(true)
})

it('the open dialog follows a change of notes as the creator makes it', () => {
  const { document, window } = parseHTML(
    '<html><body><div id="app"></div><dialog open></dialog></body></html>'
  )
  vi.stubGlobal('document', document)
  const dialog = document.querySelector('dialog')!
  installAppActions({
    root: document.getElementById('app'),
    dialog,
    settingsScreen: { isOpen: false }
  } as never)
  dialog.innerHTML = newSeriesDialog([learning])
  const form = dialog.querySelector('form')!
  const nothing = form.querySelector<HTMLInputElement>(
    'input[name="from"][value=""]'
  )!
  for (const row of form.querySelectorAll('input[name="from"]'))
    row.toggleAttribute('checked', row === nothing)
  nothing.dispatchEvent(new window.Event('change', { bubbles: true }))
  expect(titleOf(form).hasAttribute('required')).toBe(true)
  expect(codeOf(form).hidden).toBe(false)
})

const appWith = (notebooks: NotebookSummary[], series: SeriesSummary[]) => ({
  notebooks,
  series,
  showDialog: vi.fn(),
  dialog: { close: vi.fn(), dataset: {} as Record<string, string> },
  mapCanvas: { open: vi.fn(async () => {}) },
  render: vi.fn()
})
const press = (app: ReturnType<typeof appWith>, html = '<button></button>') =>
  clickSeries(
    app as never,
    parseHTML(html).document.querySelector('button') as never,
    'new-series'
  )

it('offers only the notebooks no series uses, and opens the map it starts', async () => {
  const episode = notebook('n-ep', 'Episode one')
  const app = appWith(
    [learning, older, episode, notebook('n-gone', 'Old', { archived: true })],
    [
      {
        id: 's0',
        title: 'Earlier',
        episodes: 1,
        planned: null,
        updatedAt: '',
        members: [{ notebookId: 'n-ep', number: 1 }]
      }
    ]
  )
  await press(app)
  const shown = formOf(app.showDialog.mock.calls[0][0])
  expect(
    [...shown.querySelectorAll<HTMLInputElement>('input[name="from"]')].map(
      (row) => row.value
    )
  ).toEqual(['n-new', 'n-old', ''])
  request.mockImplementation(async (path: string, method?: string) =>
    path === '/series' && method === 'POST' ? { id: 's1' } : []
  )
  const values = new FormData()
  values.set('about', 'What I learn about retries')
  values.set('from', 'n-new')
  values.set('title', '')
  values.set('growth', 'arc')
  values.set('path', '/code/limiter')
  await submitSeries(app as never, shown as never, values)
  // Its notebook's repos are the series': none is sent from the form.
  expect(request).toHaveBeenCalledWith('/series', 'POST', {
    title: '',
    about: 'What I learn about retries',
    growth: 'arc',
    from: 'n-new'
  })
  expect(app.dialog.close).toHaveBeenCalled()
  expect(app.mapCanvas.open).toHaveBeenCalledWith('n-new')
})

it('a series from nothing yet sends its repo and opens its page', async () => {
  const app = appWith([], [])
  const page = {
    series: {
      id: 's2',
      title: 'Limits',
      about: 'How we limit requests',
      createdAt: '',
      growth: 'one',
      episodes: [],
      repos: [],
      threads: []
    },
    episodes: []
  }
  request.mockImplementation(async (path: string, method?: string) =>
    path === '/series' && method === 'POST'
      ? page.series
      : path === '/series/s2'
        ? page
        : []
  )
  const values = new FormData()
  values.set('about', 'How we limit requests')
  values.set('from', '')
  values.set('title', 'Limits')
  values.set('growth', 'one')
  values.set('path', '/code/limiter')
  values.set('branch', 'fix-burst')
  await submitSeries(app as never, formOf(newSeriesDialog()) as never, values)
  expect(request).toHaveBeenCalledWith('/series', 'POST', {
    title: 'Limits',
    about: 'How we limit requests',
    growth: 'one',
    repos: [{ path: '/code/limiter', branch: 'fix-burst' }]
  })
  expect(app.mapCanvas.open).not.toHaveBeenCalled()
  expect(app.showDialog.mock.calls[0][0]).toContain('<h2>Limits</h2>')
})
