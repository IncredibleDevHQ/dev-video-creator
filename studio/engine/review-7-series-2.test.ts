import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 7's second look at the series: Undo and a notebook the creator took
// out, a renumbered episode whose video started, an edit carried over an
// untouched copy, and a circular placement. The agents are stand-ins: these
// checks prove the plumbing, not what a model would plan.
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

it('leaves a notebook the creator took out of the series alone when its organising run is undone', async () => {
  const map = await drawnMap('m-out')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-out', {})
  const first = await add(series.id, '', ids.slice(0, 4))
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: ids.slice(4).map((page, index) => ({
      page,
      start: `k${index}`,
      why: 'A part of its own'
    })),
    start: [started('k0', 'Part one', first), started('k1', 'Part two', first)]
  })
  await organize.organizeNewPages('m-out')
  await organize.settledOrganize(series.id)
  await segues.settledAllSegues()
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  const [renamed, left] = run.started
  // The creator names one, then takes both out of the series.
  await episodes.retitleEpisode(renamed, { title: 'Mine now' })
  await episodes.removeEpisode(series.id, { episode: renamed })
  await episodes.removeEpisode(series.id, { episode: left })
  await segues.settledAllSegues()
  await organize.undoOrganize(series.id, { run: run.id })
  await segues.settledAllSegues()
  // Both are the creator's own notebooks now: Undo deletes neither.
  expect(await readRow('projects', renamed)).not.toBeNull()
  expect(await readRow('projects', left)).not.toBeNull()
  expect(await titleOf(renamed)).toBe('Mine now')
})

it('stops an organising run when an episode it would renumber started its video meanwhile', async () => {
  const map = await drawnMap('m-renumber')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-renumber', {})
  const first = await add(series.id, '', ids.slice(0, 2))
  const second = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    // Episode 2's storyboard starts while the cards are placed.
    await startStoryboard(second)
    return {
      moves: ids
        .slice(4)
        .map((page) => ({ page, start: 'k', why: 'Between the two' })),
      start: [started('k', 'In between', first)]
    }
  }
  await organize.organizeNewPages('m-renumber')
  await organize.settledOrganize(series.id)
  const after = (await loadSeries(series.id))!
  expect(after.organizing).toMatchObject({
    state: 'failed',
    error: 'An episode’s video started; plan again'
  })
  expect(after.episodes.map((e) => [e.notebookId, e.number])).toEqual([
    [first, 1],
    [second, 2]
  ])
  await segues.settledAllSegues()
})

it('puts the creator’s edit over an untouched copy of its card in the episode a plan keeps it in', async () => {
  const map = await drawnMap('m-carry2')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-carry2', {})
  const one = await add(series.id, '', [ids[0], ids[1]])
  const two = await add(series.id, '', [ids[1], ids[2]])
  await segues.settledAllSegues()
  // The card is in both; the creator redraws it in episode 1 only.
  await changeProject(one, (current) => {
    current.project.slides[1].svg = '<svg><text>Redrawn</text></svg>'
  })
  replies['Plan Series'] = () =>
    outline([
      { episode: one, title: 'Opening', pages: [ids[0]] },
      { episode: two, title: 'Then', pages: [ids[1], ids[2]] },
      { title: 'The rest', pages: ids.slice(3) }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const kept = (await loadProject(two))!.project.slides.find(
    (slide) => slide.copyOf?.slide === ids[1]
  )
  expect(kept?.svg).toBe('<svg><text>Redrawn</text></svg>')
  await segues.settledAllSegues()
})

it('refuses new cards that follow each other in a circle while the agent can still change them', () => {
  const report = organize.validatePlacement(
    {
      moves: [
        { page: 'a', into: 'e1', after: 'b', why: 'After b' },
        { page: 'b', into: 'e1', after: 'a', why: 'After a' }
      ],
      start: []
    },
    {
      fresh: ['a', 'b'],
      episodes: [{ notebook: 'e1', made: false, pages: ['x'] }],
      gaps: [],
      lines: []
    }
  )
  expect(report.ok).toBe(false)
  expect(report.problems.filter((p) => p.includes('circle'))).toHaveLength(1)
})

it('refuses an organising Undo while new cards are being placed', async () => {
  const map = await drawnMap('m-busy')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-busy', {})
  const first = await add(series.id, '', ids.slice(0, 5))
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: [{ page: ids[5], into: first, after: ids[4], why: 'It closes it' }],
    start: []
  })
  await organize.organizeNewPages('m-busy')
  await organize.settledOrganize(series.id)
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  await changeSeries(series.id, (current) => {
    current.organizing = { state: 'organizing', at: new Date().toISOString() }
  })
  await expect(
    organize.undoOrganize(series.id, { run: run.id })
  ).rejects.toThrow('Wait until the new cards are organised, then undo')
  await segues.settledAllSegues()
})

it('puts every episode back when one’s video starts while a plan is applied', async () => {
  const map = await drawnMap('m-rollback')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-rollback', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  const two = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  replies['Plan Series'] = () => {
    // Once episode 1 has its new cards, episode 2's storyboard starts.
    between.next = () => startStoryboard(two)
    return outline([
      { episode: one, title: 'Opening', pages: [ids[0], ids[4]] },
      { episode: two, title: 'Then', pages: [ids[2], ids[3], ids[1]] },
      { title: 'The rest', pages: [ids[5]] }
    ])
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const after = (await loadSeries(series.id))!
  expect(after.planning).toMatchObject({
    state: 'failed',
    error: 'An episode’s video started; plan again'
  })
  // Episode 1 as it was, and no episode the plan began.
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  expect(await pagesIn(two)).toEqual(ids.slice(2, 4))
  expect(after.episodes.map((e) => e.notebookId)).toEqual([one, two])
  await segues.settledAllSegues()
})

it('keeps the creator’s edited copy of a card a plan places nowhere', async () => {
  const map = await drawnMap('m-left')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-left', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  await segues.settledAllSegues()
  await changeProject(one, (current) => {
    current.project.slides[1].svg = '<svg><text>Redrawn</text></svg>'
  })
  replies['Plan Series'] = () =>
    outline(
      [
        { episode: one, title: 'Opening', pages: [ids[0]] },
        { title: 'The rest', pages: ids.slice(2) }
      ],
      { left: [{ page: ids[1], why: 'Off the subject' }] }
    )
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const kept = (await loadProject(one))!.project.slides.find(
    (slide) => slide.copyOf?.slide === ids[1]
  )
  expect(kept?.svg).toBe('<svg><text>Redrawn</text></svg>')
  await segues.settledAllSegues()
})

it('keeps an edit the creator made while a stopped plan was being applied', async () => {
  const map = await drawnMap('m-rb-edit')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-rb-edit', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  const two = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  replies['Plan Series'] = () => {
    // While the plan fills a new episode after episode 1, the creator
    // redraws a card of episode 1; then episode 2's storyboard starts.
    between.skip = 1
    between.next = async () => {
      await changeProject(one, (current) => {
        current.project.slides[0].svg = '<svg><text>Mine</text></svg>'
      })
      await startStoryboard(two)
    }
    return outline([
      { episode: one, title: 'Opening', pages: [ids[0], ids[4]] },
      { title: 'In between', pages: [ids[5]] },
      { episode: two, title: 'Then', pages: [ids[2], ids[3], ids[1]] }
    ])
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  // Not put back over the creator's edit.
  expect((await loadProject(one))!.project.slides[0].svg).toBe(
    '<svg><text>Mine</text></svg>'
  )
  await segues.settledAllSegues()
})

it('puts the episodes an organising run filled back when another one’s video starts meanwhile', async () => {
  const map = await drawnMap('m-org-rb')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-org-rb', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  const two = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  replies['Place Pages'] = () => {
    // Episode 1 gets its card first; then episode 2's storyboard starts.
    between.next = () => startStoryboard(two)
    return {
      moves: [
        { page: ids[4], into: one, after: ids[1], why: 'It builds on it' },
        { page: ids[5], into: two, after: ids[3], why: 'It closes it' }
      ],
      start: []
    }
  }
  await organize.organizeNewPages('m-org-rb')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toMatchObject({
    state: 'failed',
    error: 'An episode’s video started; plan again'
  })
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  await segues.settledAllSegues()
})

it('keeps each edited copy when the episode a plan keeps the card in has its own, or the card is in a made episode', async () => {
  const map = await drawnMap('m-two-edits')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-two-edits', {})
  const one = await add(series.id, '', [ids[0], ids[1]])
  const two = await add(series.id, '', [ids[1], ids[2]])
  const three = await add(series.id, '', [ids[3], ids[4]])
  const made = await add(series.id, '', [ids[3]])
  await segues.settledAllSegues()
  // Card 2 is redrawn in episodes 1 and 2; card 4 in episode 3, and it is
  // also in an episode whose video is made.
  const redraw = (notebook: string, at: number, words: string) =>
    changeProject(notebook, (current) => {
      current.project.slides[at].svg = `<svg><text>${words}</text></svg>`
    })
  await redraw(one, 1, 'Edit in one')
  await redraw(two, 0, 'Edit in two')
  await redraw(three, 0, 'Edit in three')
  await makeVideo(made)
  replies['Plan Series'] = () =>
    outline([
      { episode: one, title: 'Opening', pages: [ids[0]] },
      { episode: two, title: 'Then', pages: [ids[1], ids[2]] },
      { episode: three, title: 'After', pages: [ids[4], ids[5]] },
      { episode: made, title: 'Made', pages: [ids[3]] }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const svgs = async (notebook: string) =>
    (await loadProject(notebook))!.project.slides.map((slide) => slide.svg)
  // Episode 2 keeps its own edit; episode 1's stays in episode 1.
  expect(await svgs(two)).toContain('<svg><text>Edit in two</text></svg>')
  expect(await svgs(one)).toContain('<svg><text>Edit in one</text></svg>')
  // The card is the made episode's now; episode 3's edit of it stays.
  expect(await svgs(three)).toContain('<svg><text>Edit in three</text></svg>')
  await segues.settledAllSegues()
})

it('takes a started episode the creator trimmed out of the series on Undo, rather than deleting it', async () => {
  const map = await drawnMap('m-trim')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-trim', {})
  const first = await add(series.id, '', ids.slice(0, 3))
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: ids
      .slice(3)
      .map((page) => ({ page, start: 'k', why: 'A part of its own' })),
    start: [started('k', 'Three more', first)]
  })
  await organize.organizeNewPages('m-trim')
  await organize.settledOrganize(series.id)
  await segues.settledAllSegues()
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  const [trimmed] = run.started
  // The creator takes one of its cards out: not exactly the run's any more.
  await changeProject(trimmed, (current) => {
    current.project.slides = current.project.slides.slice(1)
  })
  const undone = await organize.undoOrganize(series.id, { run: run.id })
  await segues.settledAllSegues()
  expect(await readRow('projects', trimmed)).not.toBeNull()
  expect(undone.episodes.map((e) => e.notebookId)).toEqual([first])
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

it('keeps a duplicated copy of a card when a plan or an organising run sets the episode’s cards', async () => {
  const map = await drawnMap('m-dup')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-dup', {})
  const one = await add(series.id, '', ids.slice(0, 4))
  await segues.settledAllSegues()
  await duplicate(one, ids[1])
  // Organising adds a card to it: the duplicate stays, each slide once.
  replies['Place Pages'] = () => ({
    moves: ids
      .slice(4)
      .map((page) => ({ page, into: one, after: ids[3], why: 'It goes on' })),
    start: []
  })
  await organize.organizeNewPages('m-dup')
  await organize.settledOrganize(series.id)
  expect(await copiesOf(one, ids[1])).toHaveLength(2)
  const slideIds = (await loadProject(one))!.project.slides.map((s) => s.id)
  expect(new Set(slideIds).size).toBe(slideIds.length)
  // A plan that keeps the card keeps the duplicate too.
  replies['Plan Series'] = () =>
    outline([{ episode: one, title: 'All of it', pages: ids }])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect(await copiesOf(one, ids[1])).toContain(
    '<svg><text>Second take</text></svg>'
  )
  await segues.settledAllSegues()
})

it('brings a moved edit back to its episode when a stopped plan cannot put that episode back', async () => {
  const map = await drawnMap('m-moved')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-moved', {})
  const a = await add(series.id, '', [ids[0], ids[1]])
  const b = await add(series.id, '', [ids[2]])
  const d = await add(series.id, '', [ids[3]])
  await segues.settledAllSegues()
  await changeProject(a, (current) => {
    current.project.slides[1].svg = '<svg><text>Edit in A</text></svg>'
  })
  replies['Plan Series'] = () => {
    // Card 2 and its edit go to B. While a new episode is filled, the
    // creator retitles a page of A; then D's storyboard starts.
    between.skip = 2
    between.next = async () => {
      await changeProject(a, (current) => {
        current.project.slides[0].title = 'Renamed by me'
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
  // B went back; A kept the creator's retitle, and the edit came home.
  expect(await pagesIn(b)).toEqual([ids[2]])
  expect(await copiesOf(a, ids[1])).toEqual([
    '<svg><text>Edit in A</text></svg>'
  ])
  expect((await loadProject(a))!.project.slides[0].title).toBe('Renamed by me')
  await segues.settledAllSegues()
})

it('puts everything back when a new episode an organising run starts cannot be made', async () => {
  const map = await drawnMap('m-org-fail')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-org-fail', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    // The card the new episode would hold leaves the map meanwhile.
    await changeProject('m-org-fail', (current) => {
      current.project.slides = current.project.slides.filter(
        (slide) => slide.id !== ids[5]
      )
    })
    return {
      moves: [
        { page: ids[2], left: true, why: 'Not yet' },
        { page: ids[3], left: true, why: 'Not yet' },
        { page: ids[4], into: one, after: ids[1], why: 'It goes on' },
        { page: ids[5], start: 'k', why: 'A part of its own' }
      ],
      start: [started('k', 'New part', one)]
    }
  }
  await organize.organizeNewPages('m-org-fail')
  await organize.settledOrganize(series.id)
  const after = (await loadSeries(series.id))!
  expect(after.organizing?.state).toBe('failed')
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  expect(after.episodes.map((e) => e.notebookId)).toEqual([one])
  await segues.settledAllSegues()
})
