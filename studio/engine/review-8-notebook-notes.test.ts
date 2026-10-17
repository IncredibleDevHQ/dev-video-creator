import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapNote } from '../shared/content-map'

// Review 8 (the live AI run), F02: once its wireframes are made, the Notebook
// still takes notes, says where they go, and shows where the latest landed.
// The network is a stand-in: these checks prove the page, not the engine.
// DOMPurify needs a browser window; the article's own words are not checked.
vi.mock('../app/source-markdown', () => ({
  sourceMarkdown: (text: string) => `<p>${text}</p>`
}))
vi.mock('../app/map-api', () => ({
  mapApi: { note: vi.fn(async (id: string) => notebook(id, 'ready')) }
}))
const { parseHTML } = await import('linkedom')
const { mapApi } = await import('../app/map-api')
const { notebookScreen } = await import('../app/notebook-screen')
const { submitSlides } = await import('../app/slides-controller')

const note = (text: string, state: MapNote['state'], more = {}): MapNote => ({
  id: text,
  at: '2026-10-17T00:00:00.000Z',
  text,
  state,
  ...more
})
const notebook = (
  id: string,
  status: Snapshot['status'],
  more: Record<string, unknown> = {}
): Snapshot =>
  ({
    project: {
      id,
      title: 'Payments',
      source: '# Payments\n\nRetries are safe with a key.',
      video: null,
      slides: [{ id: 'p1', title: 'A timeout is ambiguous', svg: '<svg/>' }],
      ...more
    },
    status,
    error: null,
    events: []
  }) as Snapshot
const page = (snapshot: Snapshot) =>
  parseHTML(`<main>${notebookScreen(snapshot, false)}</main>`).document

it('keeps a note field on the Notebook once its wireframes are made, with where notes go', () => {
  const doc = page(
    notebook('map', 'ready', {
      notes: [
        note('An old note', 'sorted'),
        note('The retention window bounds deduplication', 'sorted', {
          results: [
            {
              kind: 'adds',
              slideId: 'p6',
              title: 'Questions still open',
              line: ''
            },
            {
              kind: 'adds',
              slideId: 'p3',
              title: 'Retry responsibly',
              line: ''
            },
            { kind: 'covered', slideId: 'p2', title: 'A timeout', line: '' }
          ]
        }),
        note('The outbox pattern', 'sorting'),
        note('Consumers deduplicate', 'waiting')
      ]
    })
  )
  const field = doc.querySelector<HTMLTextAreaElement>(
    '#notebook-note textarea'
  )!
  expect(field.hasAttribute('disabled')).toBe(false)
  expect(doc.querySelector('#notebook-note button')?.textContent).toBe(
    'Add note'
  )
  expect(doc.querySelector('.notebook-notes-where')?.textContent).toContain(
    'Notes go to the content map'
  )
  expect(
    doc.querySelector('.notebook-notes-where [data-action="open-map"]')
  ).not.toBeNull()
  // The three latest, newest first, each saying where it is.
  expect(
    [...doc.querySelectorAll('.notebook-note-list li small')].map(
      (item) => item.textContent
    )
  ).toEqual([
    'Saved · sorted into the map once the wireframes are drawn',
    'Sorting into the map…',
    'Added to “Questions still open” · Added to “Retry responsibly” · 1 more'
  ])
})

it('keeps the note field while the wireframes are drawn, and leaves the draft its own editor', () => {
  expect(
    page(notebook('drawing', 'building')).querySelector('#notebook-note')
  ).not.toBeNull()
  // The draft is its own editor, which reads the page's document.
  vi.stubGlobal('document', parseHTML('<main></main>').document)
  const draft = notebook('draft', 'draft', { slides: [] })
  expect(page(draft).querySelector('#notebook-note')).toBeNull()
  vi.unstubAllGlobals()
})

it('sends a Notebook note to its content map, an episode’s to its series’ map', async () => {
  for (const [snapshot, map] of [
    [notebook('map', 'ready'), 'map'],
    [notebook('episode-1', 'ready', { copyOfMap: 'map' }), 'map']
  ] as const) {
    vi.mocked(mapApi.note).mockClear()
    const doc = parseHTML('<html><body><main></main></body></html>').document
    vi.stubGlobal('document', doc)
    const app = {
      snapshot,
      root: doc.querySelector('main'),
      render: vi.fn(),
      sendChat: vi.fn()
    }
    const form = { id: 'notebook-note', matches: () => false, reset: vi.fn() }
    const values = {
      get: (name: string) =>
        name === 'note' ? ' A new thing I learned ' : null
    }
    await submitSlides(app as never, form as never, values as never)
    expect(mapApi.note).toHaveBeenCalledWith(map, 'A new thing I learned')
    expect(form.reset).toHaveBeenCalled()
    expect(app.render).toHaveBeenCalled()
    vi.unstubAllGlobals()
  }
})

it('offers a note on every stage’s More, saves it to the map, and says so', async () => {
  const { headerMore } = await import('../app/workspace-header')
  for (const stage of ['notebook', 'presentation', 'video'])
    expect(headerMore(notebook('map', 'ready'), stage)).toContain('Add a note…')
  expect(
    headerMore(notebook('draft', 'draft', { slides: [] }), 'notebook')
  ).not.toContain('Add a note…')
  const doc = parseHTML(
    '<html><body><main><textarea id="notebook-note-text">Consumers deduplicate by event id</textarea></main></body></html>'
  ).document
  vi.stubGlobal('document', doc)
  vi.mocked(mapApi.note).mockClear()
  const app = {
    snapshot: notebook('episode-2', 'ready', { copyOfMap: 'map' }),
    root: doc.querySelector('main'),
    render: vi.fn(),
    dialog: { close: vi.fn() }
  }
  const form = { id: 'note-dialog', matches: () => false, reset: vi.fn() }
  const values = { get: () => 'Consumers deduplicate by event id' }
  await submitSlides(app as never, form as never, values as never)
  expect(mapApi.note).toHaveBeenCalledWith(
    'map',
    'Consumers deduplicate by event id'
  )
  expect(app.dialog.close).toHaveBeenCalled()
  // The page drawn again while it saved keeps the sent words no more.
  expect(
    doc.querySelector<HTMLTextAreaElement>('#notebook-note-text')!.value
  ).toBe('')
  expect(doc.getElementById('download-status')?.textContent).toBe(
    'Note saved: it is sorted into the content map'
  )
  // Words typed in the Notebook's field meanwhile are not the note's: kept.
  doc.querySelector<HTMLTextAreaElement>('#notebook-note-text')!.value =
    'A half-thought'
  await submitSlides(app as never, form as never, values as never)
  expect(
    doc.querySelector<HTMLTextAreaElement>('#notebook-note-text')!.value
  ).toBe('A half-thought')
  vi.unstubAllGlobals()
})

// Round 2's audit: a double-click on Add note sent the note twice.
it('sends a note once however often its form is pressed while it saves, and again after', async () => {
  const doc = parseHTML(
    '<html><body><main><form id="notebook-note"><textarea name="note">The outbox pattern</textarea><button type="submit">Add note</button></form></main></body></html>'
  ).document
  vi.stubGlobal('document', doc)
  let land!: () => void
  vi.mocked(mapApi.note).mockClear()
  vi.mocked(mapApi.note).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        land = () => resolve(notebook('map', 'ready'))
      })
  )
  const app = {
    snapshot: notebook('map', 'ready'),
    root: doc.querySelector('main'),
    render: vi.fn()
  }
  const form = doc.querySelector<HTMLFormElement>('#notebook-note')!
  form.reset = () => {}
  const values = { get: () => 'The outbox pattern' }
  const first = submitSlides(app as never, form, values as never)
  const second = submitSlides(app as never, form, values as never)
  expect(
    form.querySelector<HTMLButtonElement>('button')!.hasAttribute('disabled')
  ).toBe(true)
  land()
  await Promise.all([first, second])
  expect(mapApi.note).toHaveBeenCalledTimes(1)
  expect(
    form.querySelector<HTMLButtonElement>('button')!.hasAttribute('disabled')
  ).toBe(false)
  await submitSlides(app as never, form, values as never)
  expect(mapApi.note).toHaveBeenCalledTimes(2)
  vi.unstubAllGlobals()
})

it('lists notes kept while no wireframes are drawn in the notebook’s editor', () => {
  vi.stubGlobal('document', parseHTML('<main></main>').document)
  const stopped = notebook('stopped', 'failed', {
    slides: [],
    notes: [note('The outbox pattern', 'waiting')]
  })
  const doc = page(stopped)
  expect(doc.querySelector('.notebook-notes-where')?.textContent).toContain(
    'A note waits: each is sorted into the map once the wireframes are drawn.'
  )
  expect(doc.querySelector('.notebook-note-list li')?.textContent).toBe(
    'The outbox pattern'
  )
  vi.unstubAllGlobals()
})
