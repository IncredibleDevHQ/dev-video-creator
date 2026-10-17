import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import type { NotebookSummary } from '../shared/api'
import type { SeriesSummary } from '../shared/series'
// Starting a series from home (review 8, F03): what it is about leads, then
// the creator's notes, the notebook just made chosen even while it is drawn;
// the studio plans the episodes, and a repo is asked for only by a series
// that follows code. The network is a stand-in.
const { request, notebooks, retrySlides } = vi.hoisted(() => ({
  retrySlides: vi.fn(),
  request: vi.fn(),
  notebooks: vi.fn()
}))
vi.mock('../app/studio-api', () => ({ studioApi: { request } }))
vi.mock('../app/api', () => ({ api: { notebooks, retrySlides } }))
vi.mock('../app/notebook-editor', () => ({ saveBeforeLeaving: vi.fn() }))
const { clickSeries, submitSeries } = await import('../app/series-controller')
const {
  looseNotebooks,
  newSeriesDialog,
  refreshSeriesFrom,
  seriesSection,
  syncSeriesForm
} = await import('../app/series-view')
const { installAppActions } = await import('../app/app-actions')
/** The studio as the dialog reads it: these notebooks and series, and what
 * starting a series answers. */
const serve = (
  home: NotebookSummary[],
  series: SeriesSummary[] = [],
  answers: Record<string, unknown> = {}
) => {
  notebooks.mockResolvedValue(home)
  request.mockImplementation(async (path: string, method?: string) =>
    method === 'POST'
      ? answers[path]
      : path === '/series'
        ? series
        : answers[path]
  )
}
beforeEach(() => serve([]))
afterEach(() => {
  request.mockReset()
  notebooks.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
const drawn = { ...drawing, status: 'ready' as const, preview: '<svg/>' }
const draft = notebook('n-draft', 'Queues, not drawn', {
  status: 'draft',
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
const laterOf = (form: ParentNode) =>
  form.querySelector<HTMLElement>('.series-later')!
const rows = (form: ParentNode) =>
  [...form.querySelectorAll<HTMLInputElement>('input[name="from"]')].map(
    (row) => [row.value, row.hasAttribute('disabled')]
  )
const choose = (root: ParentNode, value: string) => {
  for (const row of root.querySelectorAll<HTMLInputElement>(
    'input[name="from"]'
  ))
    row.toggleAttribute('checked', row.value === value)
  syncSeriesForm(root)
}

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

it('chooses the notebook just made while it is drawn, and says when the series starts', () => {
  const form = formOf(newSeriesDialog([drawing, draft, older]))
  expect(rows(form)).toEqual([
    ['n-drawing', false],
    ['n-draft', true],
    ['n-old', false],
    ['', false]
  ])
  // Never nothing yet in its place: the notes come first.
  expect(checked(form, 'from')).toBe('n-drawing')
  expect(titleOf(form).getAttribute('placeholder')).toBe(drawing.title)
  expect(codeOf(form).hidden).toBe(true)
  expect(laterOf(form).hidden).toBe(false)
  expect(laterOf(form).textContent).toBe(
    'The series starts once its wireframes are drawn.'
  )
  expect(form.querySelector('label small')?.textContent).toBe(
    'Wireframes in progress'
  )
  expect(form.querySelector('.is-waiting small')?.textContent).toBe(
    'Ready to create wireframes'
  )
  // A drawn notebook chosen starts the series now: no such line.
  expect(laterOf(formOf(newSeriesDialog([older]))).hidden).toBe(true)
})

it('a series from nothing yet opens its repo when asked', () => {
  const form = formOf(newSeriesDialog([draft, older]))
  // Notes with no wireframes coming are not chosen, nor anything older.
  expect(checked(form, 'from')).toBe('')
  expect(titleOf(form).hasAttribute('required')).toBe(true)
  expect(codeOf(form).hidden).toBe(false)
  expect(codeOf(form).hasAttribute('open')).toBe(false)
  // No notebooks at all: no notes to offer.
  expect(formOf(newSeriesDialog()).querySelector('.series-from')).toBeNull()
})

it('keeps the title, the line and the repo in step with the notes chosen', () => {
  const { document } = parseHTML(
    `<div>${newSeriesDialog([learning, drawing])}</div>`
  )
  const form = document.querySelector('form')!
  choose(document, '')
  expect(titleOf(form).hasAttribute('required')).toBe(true)
  expect(titleOf(form).getAttribute('placeholder')).toBe('')
  expect(codeOf(form).hidden).toBe(false)
  choose(document, 'n-new')
  expect(titleOf(form).hasAttribute('required')).toBe(false)
  expect(titleOf(form).getAttribute('placeholder')).toBe(learning.title)
  expect(codeOf(form).hidden).toBe(true)
  expect(laterOf(form).hidden).toBe(true)
  choose(document, 'n-drawing')
  expect(laterOf(form).hidden).toBe(false)
  expect(titleOf(form).getAttribute('placeholder')).toBe(drawing.title)
})

it('the list follows a notebook drawn meanwhile, in place, the choice kept', () => {
  const { document } = parseHTML(
    `<div>${newSeriesDialog([drawing, older])}</div>`
  )
  const form = document.querySelector('form')!
  titleOf(form).value = 'Queues, my way'
  refreshSeriesFrom(document, [drawn, older])
  expect(checked(form, 'from')).toBe('n-drawing')
  expect(form.querySelector('.series-from small')).toBeNull()
  expect(laterOf(form).hidden).toBe(true)
  expect(titleOf(form).value).toBe('Queues, my way')
  // Another notebook the creator chose stays chosen.
  choose(document, 'n-old')
  refreshSeriesFrom(document, [drawn, older])
  expect(checked(form, 'from')).toBe('n-old')
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

const appWith = (home: NotebookSummary[], series: SeriesSummary[]) => ({
  notebooks: home,
  series,
  showDialog: vi.fn(),
  dialog: { close: vi.fn(), dataset: {} as Record<string, string> },
  mapCanvas: { open: vi.fn(async () => {}), toast: vi.fn() },
  render: vi.fn()
})
const press = (app: object, html = '<button></button>') =>
  clickSeries(
    app as never,
    parseHTML(html).document.querySelector('button') as never,
    'new-series'
  )

it('offers only the notebooks no series uses, and opens the map it starts', async () => {
  const episode = notebook('n-ep', 'Episode one')
  const home = [
    learning,
    older,
    episode,
    notebook('n-gone', 'Old', { archived: true })
  ]
  const series = [
    {
      id: 's0',
      title: 'Earlier',
      episodes: 1,
      planned: null,
      updatedAt: '',
      members: [{ notebookId: 'n-ep', number: 1 }]
    }
  ]
  // What the page last read is out of date: the dialog reads it again.
  const app = appWith([], [])
  serve(home, series, { '/series': { id: 's1' } })
  await press(app)
  const shown = formOf(app.showDialog.mock.calls[0][0])
  expect(
    [...shown.querySelectorAll<HTMLInputElement>('input[name="from"]')].map(
      (row) => row.value
    )
  ).toEqual(['n-new', 'n-old', ''])
  const values = new FormData()
  values.set('about', 'What I learn about retries')
  values.set('from', 'n-new')
  values.set('title', '')
  values.set('growth', 'arc')
  values.set('led', 'notes')
  values.set('path', '/code/limiter')
  await submitSeries(app as never, shown as never, values)
  // Its notebook's repos are the series': none is sent from the form.
  expect(request).toHaveBeenCalledWith('/series', 'POST', {
    title: '',
    about: 'What I learn about retries',
    growth: 'arc',
    led: 'notes',
    from: 'n-new'
  })
  expect(app.dialog.close).toHaveBeenCalled()
  expect(app.mapCanvas.open).toHaveBeenCalledWith('n-new')
  expect(app.mapCanvas.toast).not.toHaveBeenCalled()
})

it('a start from a notebook being drawn opens its map and says when the series starts', async () => {
  const app = appWith([drawing], [])
  serve([{ ...drawing, waitingSeries: drawing.title }], [], {
    '/series': { waiting: 'n-drawing' }
  })
  const values = new FormData()
  values.set('about', 'What I learn about queues')
  values.set('from', 'n-drawing')
  values.set('title', '')
  values.set('growth', 'arc')
  values.set('led', 'notes')
  await submitSeries(
    app as never,
    formOf(newSeriesDialog([drawing])) as never,
    values
  )
  expect(app.mapCanvas.open).toHaveBeenCalledWith('n-drawing')
  expect(app.mapCanvas.toast).toHaveBeenCalledWith(
    'The series starts once the wireframes are drawn.'
  )
  // Home shows the series waiting, and offers its notebook no more.
  const home = parseHTML(
    `<div>${seriesSection(app.series, app.notebooks)}</div>`
  ).document
  const row = home.querySelector('.series-row.is-waiting')!
  expect(row.querySelector('.series-row-title')?.textContent).toBe(
    drawing.title
  )
  expect(row.querySelector('.series-row-head small')?.textContent).toBe(
    'Starts once its wireframes are drawn'
  )
  expect(looseNotebooks(app.notebooks, app.series)).toEqual([])
})

it('the open start follows the drawing; opened again, it shows the notes as they are', async () => {
  vi.useFakeTimers()
  const { document } = parseHTML('<html><body><dialog></dialog></body></html>')
  const dialog = document.querySelector('dialog')!
  Object.defineProperty(dialog, 'open', { value: true, writable: true })
  const app = {
    ...appWith([], []),
    dialog,
    showDialog: (html: string) => {
      dialog.innerHTML = html
    }
  }
  serve([drawing, older])
  await press(app)
  expect(checked(dialog.querySelector('form')!, 'from')).toBe('n-drawing')
  expect(laterOf(dialog).hidden).toBe(false)
  // The drawing finishes while the dialog is open: it says so in place.
  serve([drawn, older])
  await vi.advanceTimersByTimeAsync(3000)
  expect(checked(dialog.querySelector('form')!, 'from')).toBe('n-drawing')
  expect(laterOf(dialog).hidden).toBe(true)
  expect(dialog.querySelector('.series-from small')).toBeNull()
  // Shut and opened again: what the studio says now, not what home read.
  dialog.innerHTML = ''
  serve([drawn, draft, older])
  await press(app)
  expect(rows(dialog)).toEqual([
    ['n-drawing', false],
    ['n-draft', true],
    ['n-old', false],
    ['', false]
  ])
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
  serve([], [], { '/series': page.series, '/series/s2': page })
  const values = new FormData()
  values.set('about', 'How we limit requests')
  values.set('from', '')
  values.set('title', 'Limits')
  values.set('growth', 'one')
  values.set('led', 'presenter')
  values.set('path', '/code/limiter')
  values.set('branch', 'fix-burst')
  await submitSeries(app as never, formOf(newSeriesDialog()) as never, values)
  expect(request).toHaveBeenCalledWith('/series', 'POST', {
    title: 'Limits',
    about: 'How we limit requests',
    growth: 'one',
    led: 'presenter',
    repos: [{ path: '/code/limiter', branch: 'fix-burst' }]
  })
  expect(app.mapCanvas.open).not.toHaveBeenCalled()
  expect(app.showDialog.mock.calls[0][0]).toContain('<h2>Limits</h2>')
})

// Round 2's audit: a drawing that failed or was stopped left its series
// waiting, the notebook off home's lists, and no way out.
it('says a series waiting on a stopped drawing has not started, lists its notebook, and offers Try again or Cancel', async () => {
  const why =
    'Stopped. Saved work is kept; Try again continues where it stopped.'
  const stopped = notebook('n-stopped', 'Learning log: queues', {
    status: 'failed',
    preview: null,
    waitingSeries: 'Queues, from my log',
    waitingStopped: why
  })
  const home = parseHTML(`<div>${seriesSection([], [stopped])}</div>`).document
  const row = home.querySelector('.series-row.is-stopped')!
  expect(row.querySelector('.series-row-title')?.textContent).toBe(
    'Queues, from my log'
  )
  expect(
    row.querySelector('.series-row-title')?.getAttribute('data-notebook')
  ).toBe('n-stopped')
  const line = row.querySelector('.series-row-head small')!
  expect(line.textContent).toBe('Not started: its wireframes stopped')
  expect(line.getAttribute('title')).toBe(why)
  expect(
    [...row.querySelectorAll('button[data-action]')].map((b) => b.textContent)
  ).toEqual(['Try again', 'Cancel'])
  // Not hidden: one of the notebooks again; being drawn, the series'.
  expect(looseNotebooks([stopped], [])).toEqual([stopped])
  expect(looseNotebooks([{ ...stopped, status: 'building' }], []).length).toBe(
    0
  )
  // A draft (its notes edited since) has no drawing to try: only Cancel.
  const edited = parseHTML(
    `<div>${seriesSection([], [{ ...stopped, status: 'draft' }])}</div>`
  ).document
  expect(
    [...edited.querySelectorAll('.is-stopped button[data-action]')].map(
      (b) => b.textContent
    )
  ).toEqual(['Cancel'])
  // Each answer reaches the studio, and home is read again.
  const app = { ...appWith([stopped], []), refreshNotebooks: vi.fn() }
  for (const button of row.querySelectorAll<HTMLButtonElement>(
    'button[data-action]'
  ))
    expect(await clickSeries(app as never, button, button.dataset.action)).toBe(
      true
    )
  expect(retrySlides).toHaveBeenCalledWith('n-stopped')
  expect(request).toHaveBeenCalledWith(
    '/projects/n-stopped/waiting-series',
    'POST',
    { cancel: true }
  )
  expect(app.refreshNotebooks).toHaveBeenCalledTimes(2)
})
