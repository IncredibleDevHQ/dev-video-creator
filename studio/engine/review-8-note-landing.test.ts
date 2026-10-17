import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8 F02, round 2's audit: a note added from an episode said only that
// it was saved; the episode listed none of its notes, and the map's named
// cards, never episodes. The sorting and segue agents are stand-ins: these
// checks prove what the studio records and reads back, not what a model
// sorts.
const { stage } = vi.hoisted(() => ({ stage: vi.fn() }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-note-landing-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const notes = await import('./map-notes')
const { mapRoute } = await import('./map-routes')
afterAll(async () => {
  await segues.settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

stage.mockImplementation(async (input: Record<string, unknown>) => {
  const packet = input.packet as Record<string, string>
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  const reply =
    input.route === 'Write Segues'
      ? {
          pages: JSON.parse(packet['packet/EPISODE.json']).pages.map(
            (page: { id: string }) => ({ id: page.id, bridge: 'So.' })
          ),
          outro: 'Next.'
        }
      : // The note adds to the key card and makes a card of its own.
        {
          items: [
            { kind: 'adds', line: 'Keys expire', page: 'm-2' },
            {
              kind: 'new',
              line: 'The retention window',
              title: 'The retention window',
              idea: 'A key is kept for a window, then forgotten'
            }
          ]
        }
  const report = validate(reply)
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})

const card = (id: string, title: string): Slide => ({
  id,
  title,
  svg: `<svg><text>${title}</text></svg>`,
  idea: `${title}, in a sentence`,
  narration: `${title}.`
})
const seed = async () => {
  const slides = [
    card('m-1', 'A timeout is ambiguous'),
    card('m-2', 'An idempotency key'),
    card('m-3', 'The database race')
  ]
  const source = 'Learning log: APIs that survive retries.'
  await writeRow('projects', 'm', {
    project: {
      id: 'm',
      title: 'APIs that survive retries',
      source,
      harness: { adapter: 'claude-code' },
      slides,
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  await writeRow('outlines', 'm', {
    source: { title: 'APIs', text: source },
    brand: {},
    outline: { title: 'APIs', scenes: slides.map((s) => ({ title: s.title })) },
    slideIds: slides.map((s) => s.id)
  })
  await writeRow('sources', 'm', { title: 'APIs', text: source })
  const series = await episodes.startMapSeries('m', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: ['m-1']
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: ['m-2', 'm-3']
  })
  await segues.settledAllSegues()
  return { one: one.notebook.project.id, two: two.notebook.project.id }
}
const read = async (id: string) =>
  (
    await mapRoute(
      new URL(`http://studio.test/api/projects/${id}/notes`),
      { method: 'GET' } as never,
      {}
    )
  )?.value as Array<{
    text: string
    from?: string
    results?: Array<{ kind: string; title: string; episodes?: number[] }>
  }>

it('lists a note where it was written, each card it made or changed with the episodes that hold it', async () => {
  const { one, two } = await seed()
  await notes.addNote('m', {
    text: 'Keys are kept for a retention window.',
    from: two
  })
  // Not an episode of this map: the note is kept, as the map's own.
  await notes.addNote('m', { text: 'A note on the map.', from: 'elsewhere' })
  await notes.settledNotes()
  await segues.settledAllSegues()
  const inTwo = await read(two)
  expect(inTwo.map((note) => note.text)).toEqual([
    'Keys are kept for a retention window.'
  ])
  expect(inTwo[0].results).toMatchObject([
    { kind: 'adds', title: 'An idempotency key', episodes: [2] },
    { kind: 'new', title: 'The retention window', episodes: [] }
  ])
  // Episode 1 wrote none; the map lists every note, the episodes named too.
  expect(await read(one)).toEqual([])
  const onMap = await read('m')
  expect(onMap.map((note) => [note.text, note.from])).toEqual([
    ['Keys are kept for a retention window.', two],
    ['A note on the map.', undefined]
  ])
  expect(onMap[0].results?.map((result) => result.episodes)).toEqual([[2], []])
})
