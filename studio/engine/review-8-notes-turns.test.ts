import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'

// Review 8, round 2's audit: a note written the moment the map is drawn was
// kept waiting on the drawn map until a restart, and notes sorted at once
// against the same pages made two cards of one idea. The sorting agent is a
// stand-in that reads the pages it is given: these checks prove what it is
// given and in what order, not what a model would sort.
const { stage, seen } = vi.hoisted(() => ({
  stage: vi.fn(),
  seen: [] as Array<{ note: string; pages: string[] }>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'studio-review-8-notes-turns-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { changeProject, loadProject } = await import('./projects')
const notes = await import('./map-notes')
afterAll(() => rm(root, { recursive: true, force: true }))

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Page</text></svg>'
// The sorting agent, a moment slow: a note about the outbox is a new card,
// unless a card on the outbox is among the pages it is given.
stage.mockImplementation(async (input: Record<string, unknown>) => {
  const packet = input.packet as Record<string, string>
  const pages = JSON.parse(packet['packet/PAGES.json']) as Array<{
    id: string
    title: string
  }>
  seen.push({
    note: packet['packet/NOTE.md'],
    pages: pages.map((page) => page.title)
  })
  await new Promise((resolve) => setTimeout(resolve, 60))
  const outbox = pages.find((page) => /outbox/i.test(page.title))
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  const report = validate({
    items: [
      outbox
        ? { kind: 'covered', line: 'The outbox', page: outbox.id }
        : {
            kind: 'new',
            line: 'The outbox',
            title: 'The transactional outbox',
            idea: 'Write the order and its event in one transaction'
          }
    ]
  })
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})
beforeEach(() => {
  seen.length = 0
})

const seed = async (id: string, status: Snapshot['status']) => {
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Payments',
      source: 'Payments retry safely.',
      slides: [{ id: `${id}-1`, title: 'One', svg, narration: 'One.' }],
      video: null,
      harness: { adapter: 'claude-code' }
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
    slideIds: [`${id}-1`]
  })
  await writeRow('sources', id, {
    title: 'Payments',
    text: 'Payments retry safely.'
  })
}

it('sorts a note written the moment the map is drawn, never leaving it waiting', async () => {
  await seed('race', 'building')
  // The drawing's last write, held in the notebook's queue: the note is
  // written while the map still reads as being drawn.
  let release: (() => void) | undefined
  const held = changeProject(
    'race',
    () => new Promise<void>((done) => (release = done))
  )
  const drawn = changeProject('race', (current) => {
    current.status = 'ready'
  })
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  const adding = notes.addNote('race', {
    text: 'The outbox keeps the order and its event together.'
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  release!()
  await Promise.all([held, drawn])
  expect((await adding).project.notes?.[0].state).toBe('sorting')
  await notes.settledNotes()
  const after = (await loadProject('race'))!
  expect(after.project.notes?.[0].state).toBe('sorted')
  expect(after.project.source).toContain('The outbox keeps the order')
})

it('sorts two quick notes one after another, the second seeing the card the first made', async () => {
  await seed('turns', 'ready')
  await Promise.all([
    notes.addNote('turns', {
      text: 'The outbox writes the order and its event in one transaction.'
    }),
    notes.addNote('turns', {
      text: 'Outbox: a relay publishes the event after the commit.'
    })
  ])
  await notes.settledNotes()
  expect(seen.map((item) => item.pages)).toEqual([
    ['One'],
    ['One', 'The transactional outbox']
  ])
  const after = (await loadProject('turns'))!
  expect(after.project.slides.map((slide) => slide.title)).toEqual([
    'One',
    'The transactional outbox'
  ])
  expect(
    after.project.notes?.map((note) => note.results?.map((r) => r.kind))
  ).toEqual([['new'], ['covered']])
})

it('sorts the notes that waited for the drawing one after another, in the order written', async () => {
  await seed('waited', 'ready')
  await changeProject('waited', (current) => {
    current.project.notes = [
      {
        id: 'w1',
        at: '2026-10-17T00:00:00.000Z',
        text: 'The outbox writes the order and its event together.',
        state: 'waiting'
      },
      {
        id: 'w2',
        at: '2026-10-17T00:01:00.000Z',
        text: 'Outbox relays publish after the commit.',
        state: 'waiting'
      }
    ]
  })
  // Run twice, as a restart and the drawing's end may: each note once.
  await Promise.all([
    notes.sortWaitingNotes('waited'),
    notes.sortWaitingNotes('waited')
  ])
  await notes.settledNotes()
  expect(seen.map((item) => item.note)).toEqual([
    'The outbox writes the order and its event together.',
    'Outbox relays publish after the commit.'
  ])
  const after = (await loadProject('waited'))!
  expect(after.project.slides).toHaveLength(2)
  expect(after.project.source.match(/## Note,/g)).toHaveLength(2)
})
