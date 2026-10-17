import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'

// Review 8 (the live AI run), F01: a note written while the first map is
// drawn is kept at once, and sorted into the map once its wireframes are
// drawn. The drawing and sorting agents are stand-ins: these checks prove the
// plumbing, never what a model would draw or sort.
const { pages, stage } = vi.hoisted(() => ({
  pages: vi.fn(),
  stage: vi.fn()
}))
vi.mock('./creative/pages', () => ({ prepareCreativePages: pages }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'studio-review-8-capture-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow, readRow } = await import('./persistence')
const { scheduleSlides, loadProject } = await import('./projects')
const notes = await import('./map-notes')
const { settleInterruptedWork } = await import('./studio-recovery')
const { mapNotes } = await import('../app/map-view')
afterAll(() => rm(root, { recursive: true, force: true }))

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Page</text></svg>'
const NOTE = 'Deduplication lasts as long as the key is kept: never promise it.'
// The sorting agent: the note is covered by the map's one page.
stage.mockImplementation(async (input: Record<string, unknown>) => {
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  const report = validate({
    items: [{ kind: 'covered', line: 'The key is kept', page: 'slide-one' }]
  })
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})

const seed = async (id: string, status: Snapshot['status'], more = {}) => {
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Payments',
      source: 'Payments retry safely.',
      slides:
        status === 'ready'
          ? [{ id: 'slide-one', title: 'One', svg, narration: 'One.' }]
          : [],
      video: null,
      harness: { adapter: 'claude-code' },
      ...more
    },
    status,
    error: null,
    events: []
  } as Snapshot)
  await writeRow('outlines', id, {
    source: { title: 'Payments', text: 'Payments retry safely.' },
    outline: {
      title: 'Payments',
      scenes: [{ title: 'One', narration: 'One.', idea: 'One', source: [] }]
    },
    brand: {},
    slideIds: ['slide-one']
  })
  await writeRow('sources', id, {
    title: 'Payments',
    text: 'Payments retry safely.'
  })
}

it('keeps a note written while the first map is drawn and sorts it once the wireframes are drawn', async () => {
  await seed('drawing', 'building')
  let finish!: (value: string[]) => void
  pages.mockImplementationOnce(
    () => new Promise<string[]>((resolve) => (finish = resolve))
  )
  scheduleSlides('drawing')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  const saved = await notes.addNote('drawing', { text: NOTE })
  const note = saved.project.notes![0]
  expect(note.state).toBe('waiting')
  // Kept apart from the source the map is being drawn from.
  expect(saved.project.source).not.toContain('## Note,')
  expect(saved.events.at(-1)?.message).toBe(
    'Note saved: it is sorted into the map once the wireframes are drawn'
  )
  expect(mapNotes(saved)).toContain(
    'Saved · sorted into the map once the wireframes are drawn'
  )
  finish([svg])
  await vi.waitFor(async () =>
    expect((await loadProject('drawing'))?.project.notes?.[0].state).toBe(
      'sorted'
    )
  )
  const after = (await loadProject('drawing'))!
  expect(after.project.source).toContain(NOTE)
  expect(
    (await readRow<{ source: { text: string } }>('outlines', 'drawing'))!.source
      .text
  ).toContain(NOTE)
  expect(after.project.notes![0].results!.map((r) => r.kind)).toEqual([
    'covered'
  ])
})

it('sorts the notes that waited for a map drawn before the studio restarted', async () => {
  await seed('restarted', 'ready', {
    notes: [
      { id: 'n1', at: '2026-10-17T00:00:00.000Z', text: NOTE, state: 'waiting' }
    ]
  })
  await settleInterruptedWork()
  await notes.settledNotes()
  const after = (await loadProject('restarted'))!
  expect(after.project.notes![0].state).toBe('sorted')
  expect(after.project.source).toContain(NOTE)
})

it('says notes are kept until the map is drawn when there are none yet', async () => {
  await seed('empty', 'building')
  expect(mapNotes((await loadProject('empty'))!)).toContain(
    'They are kept, and sorted into the map once the wireframes are drawn.'
  )
})
