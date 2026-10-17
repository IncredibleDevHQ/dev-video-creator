import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8's content map, round 2 of the audit, in the engine: the segues an
// order had come back with it, a direction's cards, and Undo of a removal.
// The agent is a stand-in: these checks prove the plumbing, not what a model
// would write.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-map-round-2-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { loadProject, editSlide } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const directions = await import('./series-directions')
afterAll(async () => {
  await segues.settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

/** A gate the writer waits at, while it is shut. */
let gate: Promise<void> | null = null
/** Opens the gate (a check that failed with it shut opens it after). */
let open = () => {}
stage.mockImplementation(async (input: Record<string, unknown>) => {
  if (gate) await gate
  const reply = replies[input.route as string]
  if (!reply) throw new Error(`No stand-in for ${input.route}`)
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  const report = validate(reply(input))
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})
type Brief = {
  pages: Array<{ id: string; title: string; keep?: string }>
  keepOutro?: string
  next: { title: string } | null
}
const briefOf = (input: Record<string, unknown>): Brief =>
  JSON.parse((input.packet as Record<string, string>)['packet/EPISODE.json'])
/** The briefs the writer was given since the last clear. */
const briefs = () =>
  stage.mock.calls.map(([input]) => briefOf(input as Record<string, unknown>))

const page = (id: string, title: string): Slide => ({
  id,
  title,
  svg: `<svg><text>${title}</text></svg>`,
  idea: `${title}, in a sentence`,
  narration: `What ${title.toLowerCase()} says.`
})
/** A drawn map of so many pages, its outline and source retained. */
const drawnMap = async (id: string, count = 4) => {
  const slides = Array.from({ length: count }, (_, i) =>
    page(`${id}-${i + 1}`, `Page ${i + 1}`)
  )
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Streamline',
      source: 'Streamline runs custom video pipelines.',
      harness: { adapter: 'claude-code' },
      slides,
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await writeRow('outlines', id, {
    source: { title: 'Streamline', text: snapshot.project.source },
    brand: {},
    outline: {
      title: 'Streamline',
      scenes: slides.map((s) => ({ title: s.title }))
    },
    slideIds: slides.map((s) => s.id)
  })
  await writeRow('sources', id, {
    title: 'Streamline',
    text: snapshot.project.source
  })
  return snapshot
}

beforeEach(() => {
  open()
  gate = null
  stage.mockClear()
  for (const key of Object.keys(replies)) delete replies[key]
  // Each run words its lines anew, so a line taken again is told apart from
  // one written again.
  let take = 0
  replies['Write Segues'] = (input) => {
    const brief = briefOf(input)
    take++
    return {
      pages: brief.pages.map((p) => ({
        id: p.id,
        bridge: p.keep || `Take ${take}: into ${p.title}.`
      })),
      outro:
        brief.keepOutro ||
        `Take ${take}: ${brief.next ? `next, ${brief.next.title}` : 'the end'}.`
    }
  }
})

/** Two episodes of a four-page map: three cards, then one. */
const twoEpisodes = async (map: string) => {
  await drawnMap(map)
  const series = await episodes.startMapSeries(map, {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: [`${map}-1`, `${map}-2`, `${map}-3`]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: [`${map}-4`]
  })
  await segues.settledAllSegues()
  return {
    series,
    one: one.notebook.project.id,
    two: two.notebook.project.id
  }
}
/** An episode's lines: each page's line in, by the map page, and its out. */
const linesOf = async (id: string) => {
  const slides = (await loadProject(id))!.project.slides
  return {
    order: slides.map((s) => s.copyOf!.slide),
    bridges: Object.fromEntries(slides.map((s) => [s.copyOf!.slide, s.bridge])),
    outro: slides.at(-1)!.outro
  }
}
/** Moves an episode's card, by its map page, to a place in its lane. */
const move = async (id: string, map: string, index: number) => {
  const slides = (await loadProject(id))!.project.slides
  const card = slides.find((s) => s.copyOf?.slide === map)!
  return episodes.changeCopies(id, {
    action: 'move',
    slide: card.id,
    to: id,
    index
  }) as Promise<{ moved: boolean; rewriting?: boolean }>
}

it('puts an order back with the segues it had and writes only what is new (F15)', async () => {
  const { one, two } = await twoEpisodes('r1')
  const first = await linesOf(one)
  const opens = (await linesOf(two)).bridges['r1-4']
  // A card dragged from third to second: its lines and the next episode's
  // "last time" are written for the new order.
  stage.mockClear()
  expect(await move(one, 'r1-3', 1)).toMatchObject({ rewriting: true })
  await segues.settledAllSegues()
  const second = await linesOf(one)
  expect(second.order).toEqual(['r1-1', 'r1-3', 'r1-2'])
  expect(second.bridges['r1-3']).not.toBe(first.bridges['r1-3'])
  expect(second.outro).not.toBe(first.outro)
  expect(stage).toHaveBeenCalledTimes(2)
  const reordered = (await linesOf(two)).bridges['r1-4']
  expect(reordered).not.toBe(opens)
  // Undo: the lines that order had are back at once, the neighbour's too,
  // and nothing is written; the engine says so.
  stage.mockClear()
  expect(await move(one, 'r1-3', 2)).toMatchObject({ rewriting: false })
  expect(await linesOf(one)).toEqual(first)
  expect((await linesOf(two)).bridges['r1-4']).toBe(opens)
  await segues.settledAllSegues()
  expect(stage).not.toHaveBeenCalled()
  expect(await linesOf(one)).toEqual(first)
  const after = (await loadProject(one))!
  expect(after.project.segues).toBeUndefined()
  expect(after.events.at(-1)?.message).toBe('Put back 3 segues this order had')
  // Redo: the order it went to has its lines too.
  expect(await move(one, 'r1-3', 1)).toMatchObject({ rewriting: false })
  await segues.settledAllSegues()
  expect(stage).not.toHaveBeenCalled()
  expect(await linesOf(one)).toEqual(second)
  expect((await linesOf(two)).bridges['r1-4']).toBe(reordered)
  // A new order: a line whose pages around it it had is kept; only the
  // rest is asked for.
  await move(one, 'r1-3', 2)
  await segues.settledAllSegues()
  stage.mockClear()
  expect(await move(one, 'r1-1', 2)).toMatchObject({ rewriting: true })
  await segues.settledAllSegues()
  const third = await linesOf(one)
  expect(third.order).toEqual(['r1-2', 'r1-3', 'r1-1'])
  expect(third.bridges['r1-3']).toBe(first.bridges['r1-3'])
  const asked = briefs().find((brief) => brief.pages.length === 3)!
  expect(asked.pages.map((p) => p.keep ?? null)).toEqual([
    null,
    first.bridges['r1-3'],
    null
  ])
})

it('keeps what a run wrote for an order undone before it finished, so Redo writes nothing (F15)', async () => {
  const { one, two } = await twoEpisodes('r2')
  const first = await linesOf(one)
  const opens = await linesOf(two)
  gate = new Promise<void>((resolve) => (open = resolve))
  stage.mockClear()
  expect(await move(one, 'r2-3', 1)).toMatchObject({ rewriting: true })
  // Its writer, and the next episode's, wait.
  await vi.waitFor(() => expect(stage).toHaveBeenCalledTimes(2))
  expect((await loadProject(one))!.project.segues).toEqual({
    state: 'writing'
  })
  // Undone while the writer works: the order it had keeps its lines, and
  // it is not shown as being written.
  expect(await move(one, 'r2-3', 2)).toMatchObject({ rewriting: false })
  expect((await loadProject(one))!.project.segues).toBeUndefined()
  const asked = stage.mock.calls.length
  gate = null
  open()
  await segues.settledAllSegues()
  expect(stage).toHaveBeenCalledTimes(asked)
  expect(await linesOf(one)).toEqual(first)
  expect((await loadProject(one))!.project.segues).toBeUndefined()
  // The next episode's "last time", written for the order undone, never
  // lands on it either.
  expect(await linesOf(two)).toEqual(opens)
  expect((await loadProject(two))!.events.map((e) => e.message)).not.toContain(
    'Wrote 1 segue between the pages'
  )
  // Redo: what that run wrote for it, with no writer asked.
  expect(await move(one, 'r2-3', 1)).toMatchObject({ rewriting: false })
  await segues.settledAllSegues()
  expect(stage).toHaveBeenCalledTimes(asked)
  expect((await linesOf(one)).bridges['r2-3']).toMatch(/^Take \d+: into Page 3/)
})

it('writes a line asked to be written again anew, never the one it had (F15)', async () => {
  const { one } = await twoEpisodes('r3')
  const last = (await loadProject(one))!.project.slides.at(-1)!
  const said = last.outro
  // A flagged line, written again at the creator's word.
  const { changeProject } = await import('./projects')
  await changeProject(one, (current) => {
    current.project.segueChecks = {
      [last.id]: { outro: { line: said!, note: 'Check it' } }
    }
  })
  stage.mockClear()
  await segues.answerSegueCheck(one, { slide: last.id, line: 'outro' })
  await segues.settledAllSegues()
  expect(stage).toHaveBeenCalledTimes(1)
  expect((await loadProject(one))!.project.slides.at(-1)!.outro).not.toBe(said)
})

it('wires a direction to cards still on the map, up to twelve, and says a thirteenth is one too many', async () => {
  await drawnMap('r4', 14)
  const series = await episodes.startMapSeries('r4', {})
  const saved = await directions.saveDirection(series.id, { text: 'Pair up' })
  const id = saved.directions!.at(-1)!.id
  const cards = (n: number) =>
    Array.from({ length: n }, (_, i) => `r4-${i + 1}`)
  // A card deleted from the map is never wired again; alone, it leaves the
  // whole series.
  let now = await directions.saveDirection(series.id, {
    id,
    to: { pages: ['gone', ...cards(12)] }
  })
  expect(now.directions!.at(-1)!.to).toEqual({ pages: cards(12) })
  now = await directions.saveDirection(series.id, {
    id,
    to: { pages: ['gone'] }
  })
  expect(now.directions!.at(-1)!.to).toBeUndefined()
  await expect(
    directions.saveDirection(series.id, { id, to: { pages: cards(13) } })
  ).rejects.toThrow(
    'A direction guides up to 12 cards: wire it to an episode or the whole series'
  )
})

it('brings back the page the map removed, and refuses when another was removed since', async () => {
  const { one } = await twoEpisodes('r5')
  const [a, b] = (await loadProject(one))!.project.slides
  await episodes.changeCopies(one, { action: 'remove', slide: a.id })
  // Another page removed since, on the episode's Wireframe stage.
  await editSlide(one, { action: 'delete', slideId: b.id })
  await expect(
    episodes.changeCopies(one, { action: 'unremove', slide: a.id })
  ).rejects.toThrow('That page can no longer be brought back')
  const now = (await loadProject(one))!
  expect(now.deletedSlide?.slide.id).toBe(b.id)
  expect(now.project.slides.map((s) => s.id)).not.toContain(b.id)
  // Its own removal comes back, where it stood.
  await editSlide(one, { action: 'undo-delete' })
  await episodes.changeCopies(one, { action: 'remove', slide: b.id })
  await episodes.changeCopies(one, { action: 'unremove', slide: b.id })
  const back = (await loadProject(one))!
  expect(back.project.slides[0].id).toBe(b.id)
  expect(back.deletedSlide).toBeUndefined()
  await segues.settledAllSegues()
})
