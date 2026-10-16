import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 7's fifth look at the series: what a stopped run puts back, a
// duplicate that stays put, a gap its card still closes, and an episode that
// left the series. The agents are stand-ins: these checks prove the
// plumbing, not what a model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
// A hook on the evidence sync that follows each episode a plan changes: the
// moment between one episode and the next.
const { between } = vi.hoisted(() => ({
  between: { next: null as null | (() => Promise<unknown>), skip: 0 }
}))
vi.mock('./map-copy', async (original) => {
  const real = await original<typeof import('./map-copy')>()
  return {
    ...real,
    syncEvidence: async (...args: Parameters<typeof real.syncEvidence>) => {
      if (between.skip > 0) between.skip -= 1
      else {
        const hook = between.next
        between.next = null
        await hook?.()
      }
      return real.syncEvidence(...args)
    }
  }
})
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-7-series-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow, readRow } = await import('./persistence')
const { loadProject, changeProject } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const { changeSeries, loadSeries } = await import('./series')
const { planSeries, settledSeriesPlan } = await import('./series-plan')
const organize = await import('./series-organize')
const directions = await import('./series-directions')
const { applySeriesLength, setEpisodePages } = await import('./series-apply')
const { mapRoute } = await import('./map-routes')
const { settleSeries } = await import('./studio-recovery')
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
  // A stand-in may take its time, as an agent does, while the creator acts.
  const report = validate(await reply(input))
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})
const packetOf = (input: Record<string, unknown>, name: string) =>
  JSON.parse((input.packet as Record<string, string>)[`packet/${name}`])

const card = (id: string, title: string): Slide => ({
  id,
  title,
  svg: `<svg><text>${title}</text></svg>`,
  idea: `${title}, in a sentence`,
  evidence: [`The source on ${title.toLowerCase()}.`],
  narration: `What ${title.toLowerCase()} says, for a while.`
})
const TITLES = [
  'Why it exists',
  'Managed streaming',
  'The parts',
  'Outlives the request',
  'One config',
  'Security'
]
const drawnMap = async (id: string, count = TITLES.length) => {
  const slides = TITLES.slice(0, count).map((title, index) =>
    card(`${id}-${index + 1}`, title)
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
const makeVideo = (id: string) =>
  changeProject(id, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { objectKey: 'made.mp4' } as never
    }
  })
/** The creator starts the episode's storyboard: its video has started. */
const startStoryboard = (id: string) =>
  changeProject(id, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null,
      storyboard: {
        id: 'sb',
        pages: current.project.slides.map((slide) => slide.id),
        stage: 'plan',
        status: 'working'
      }
    } as never
  })
const pagesIn = async (notebook: string) =>
  ((await loadProject(notebook))?.project.slides || []).map(
    (slide) => slide.copyOf?.slide
  )
const titleOf = async (notebook: string) =>
  (await loadProject(notebook))!.project.title
const add = async (seriesId: string, title: string, slides: string[]) =>
  (await episodes.addMapEpisode(seriesId, { title, slides })).notebook.project
    .id
/** The planner's outline: the episodes as given, each card placed once. */
const outline = (
  groups: Array<{ episode?: string; title: string; pages: string[] }>,
  extra: Record<string, unknown> = {}
) => ({
  outcome: 'Run a pipeline',
  audience: 'Workers developers',
  lines: [{ id: 'why', name: 'Why', line: 'It fills a gap' }],
  episodes: groups.map((group, index) => ({
    ...(group.episode ? { episode: group.episode } : {}),
    title: group.title,
    about: group.title,
    win: `Win of ${group.title}`,
    teaches: [`t${index}`],
    needs: [],
    carries: 'Picks up the last; hands on the next.',
    lines: ['why'],
    pages: group.pages
  })),
  gaps: [],
  directions: [],
  flags: [],
  ...extra
})
/** A new episode the organiser starts after another. */
const started = (key: string, title: string, after: string | null) => ({
  key,
  title,
  about: title,
  win: `Win of ${title}`,
  teaches: [key],
  carries: 'Hands on',
  lines: [],
  after
})
/** Holds a stand-in, as a slow agent would, until the test lets it answer. */
const gate = () => {
  let open = () => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open: () => open(), opened }
}

beforeEach(() => {
  between.next = null
  between.skip = 0
  for (const key of Object.keys(replies)) delete replies[key]
  replies['Write Segues'] = (input) => {
    const brief = packetOf(input, 'EPISODE.json')
    return {
      pages: brief.pages.map((p: { id: string }, i: number) => ({
        id: p.id,
        bridge:
          !i && brief.previous ? `Last time: ${brief.previous.title}.` : 'So.'
      })),
      outro: brief.next
        ? `Next time: ${brief.next.title}.`
        : 'That is the series.'
    }
  }
})

/** The creator duplicates a copy on the Wireframe stage: two copies of one
 * card in the episode, the second redrawn. */
const duplicate = (notebook: string, page: string) =>
  changeProject(notebook, (current) => {
    const slides = current.project.slides
    const at = slides.findIndex((slide) => slide.copyOf?.slide === page)
    const second = structuredClone(slides[at])
    second.id = `${second.id}-2`
    second.svg = '<svg><text>Second take</text></svg>'
    slides.splice(at + 1, 0, second)
  })
const copiesOf = async (notebook: string, page: string) =>
  (await loadProject(notebook))!.project.slides
    .filter((slide) => slide.copyOf?.slide === page)
    .map((slide) => slide.svg)

it('rewrites the last episode’s “next time” when a stopped organising run discards the episode it started', async () => {
  const map = await drawnMap('m-org-lines')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-org-lines', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    // The second new episode's card leaves the map meanwhile.
    await changeProject('m-org-lines', (current) => {
      current.project.slides = current.project.slides.filter(
        (slide) => slide.id !== ids[5]
      )
    })
    return {
      moves: [
        { page: ids[2], left: true, why: 'Not yet' },
        { page: ids[3], left: true, why: 'Not yet' },
        { page: ids[4], start: 'k0', why: 'A part of its own' },
        { page: ids[5], start: 'k1', why: 'Another' }
      ],
      start: [started('k0', 'Part one', one), started('k1', 'Part two', one)]
    }
  }
  await organize.organizeNewPages('m-org-lines')
  await organize.settledOrganize(series.id)
  await segues.settledAllSegues()
  expect(
    (await loadSeries(series.id))!.episodes.map((e) => e.notebookId)
  ).toEqual([one])
  const last = (await loadProject(one))!.project.slides.at(-1)!
  expect(last.outro).toBe('That is the series.')
})

it('keeps a moved edit in the episode it went to when that one changed and can’t be put back', async () => {
  const map = await drawnMap('m-away')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-away', {})
  const a = await add(series.id, '', [ids[0], ids[1]])
  const b = await add(series.id, '', [ids[2]])
  const d = await add(series.id, '', [ids[3]])
  await segues.settledAllSegues()
  await changeProject(a, (current) => {
    current.project.slides[1].svg = '<svg><text>Edit in A</text></svg>'
  })
  replies['Plan Series'] = () => {
    // The edit goes to B; while a new episode is filled the creator edits B,
    // then D's storyboard starts.
    between.skip = 2
    between.next = async () => {
      await changeProject(b, (current) => {
        current.project.slides[0].title = 'Renamed in B'
      })
      await startStoryboard(d)
    }
    return outline([
      { episode: a, title: 'Opening', pages: [ids[0]] },
      { episode: b, title: 'Then', pages: [ids[2], ids[1]] },
      { title: 'New', pages: [ids[4], ids[5]] },
      { episode: d, title: 'Last', pages: [ids[3]] }
    ])
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  // In B, where it went; A went back without it: in one episode, not two.
  expect(await copiesOf(b, ids[1])).toEqual([
    '<svg><text>Edit in A</text></svg>'
  ])
  expect(await copiesOf(a, ids[1])).toEqual([])
  await segues.settledAllSegues()
})

it('leaves an edited duplicate where it is when a plan moves its card, never in two episodes', async () => {
  const map = await drawnMap('m-dup-move')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-dup-move', {})
  const one = await add(series.id, '', [ids[0], ids[1]])
  const two = await add(series.id, '', [ids[2]])
  await segues.settledAllSegues()
  // The card's own copy as it came; its duplicate redrawn.
  await duplicate(one, ids[1])
  replies['Plan Series'] = () =>
    outline([
      { episode: one, title: 'Opening', pages: [ids[0]] },
      { episode: two, title: 'Then', pages: [ids[2], ids[1]] },
      { title: 'The rest', pages: ids.slice(3) }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  // The card goes to episode 2 as itself; the duplicate stays in episode 1.
  expect(await copiesOf(two, ids[1])).toEqual([
    '<svg><text>Managed streaming</text></svg>'
  ])
  expect(await copiesOf(one, ids[1])).toEqual([
    '<svg><text>Second take</text></svg>'
  ])
  const all = [
    ...(await loadProject(one))!.project.slides,
    ...(await loadProject(two))!.project.slides
  ].map((slide) => slide.id)
  expect(new Set(all).size).toBe(all.length)
  await segues.settledAllSegues()
})

it('keeps a gap closed on Undo while the card that closed it stays, its copy edited', async () => {
  const map = await drawnMap('m-gap-stays')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-gap-stays', {})
  const one = await add(series.id, '', ids.slice(0, 5))
  await changeSeries(series.id, (current) => {
    current.gaps = [
      {
        id: 'g1',
        missing: 'Security',
        why: 'Not said yet',
        ask: 'How?',
        state: 'open'
      }
    ]
  })
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: [
      {
        page: ids[5],
        into: one,
        after: ids[4],
        closes: 'g1',
        why: 'It says it'
      }
    ],
    start: []
  })
  await organize.organizeNewPages('m-gap-stays')
  await organize.settledOrganize(series.id)
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  expect((await loadSeries(series.id))!.gaps![0].state).toBe('closed')
  // The creator redraws the new copy: Undo leaves it, so the gap stays shut.
  await changeProject(one, (current) => {
    current.project.slides.at(-1)!.svg = '<svg><text>Mine</text></svg>'
  })
  const undone = await organize.undoOrganize(series.id, { run: run.id })
  expect(undone.gaps![0].state).toBe('closed')
  expect(undone.held || []).not.toContain(ids[5])
  await segues.settledAllSegues()
})

it('stops a plan when an episode left the series while it was written', async () => {
  const map = await drawnMap('m-left-series')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-left-series', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  const two = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  replies['Plan Series'] = async () => {
    await episodes.removeEpisode(series.id, { episode: two })
    return outline([
      { episode: one, title: 'Opening', pages: ids.slice(0, 3) },
      { episode: two, title: 'Then', pages: ids.slice(3) }
    ])
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning).toMatchObject({
    state: 'failed',
    error: 'An episode left the series meanwhile; plan again'
  })
  expect(await pagesIn(two)).toEqual(ids.slice(2, 4))
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  await segues.settledAllSegues()
})
