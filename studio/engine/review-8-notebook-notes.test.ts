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
    const app = { snapshot, render: vi.fn(), sendChat: vi.fn() }
    const form = { id: 'notebook-note', matches: () => false, reset: vi.fn() }
    const values = {
      get: (name: string) =>
        name === 'note' ? ' A new thing I learned ' : null
    }
    await submitSlides(app as never, form as never, values as never)
    expect(mapApi.note).toHaveBeenCalledWith(map, 'A new thing I learned')
    expect(form.reset).toHaveBeenCalled()
    expect(app.render).toHaveBeenCalled()
  }
})
