import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8's content map, round 2 of the audit, in the engine: Undo of a
// removal.
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
afterAll(async () => {
  await segues.settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

stage.mockImplementation(async (input: Record<string, unknown>) => {
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
  stage.mockClear()
  for (const key of Object.keys(replies)) delete replies[key]
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
