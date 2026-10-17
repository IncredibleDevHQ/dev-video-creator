import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 7's series fixes: planning, organising and applying. The agents are
// stand-ins: these checks prove the plumbing, not what a model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
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

it('refuses to set the pages of an episode whose video started', async () => {
  const map = await drawnMap('m-made')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-made', {})
  const one = await add(series.id, '', [ids[0]])
  await segues.settledAllSegues()
  await startStoryboard(one)
  await expect(setEpisodePages(one, map, [ids[0], ids[1]])).rejects.toThrow(
    'An episode’s video started; plan again'
  )
  expect(await pagesIn(one)).toEqual([ids[0]])
})

it('stops a plan when an episode’s video started while the agent wrote it, and changes no episode', async () => {
  const map = await drawnMap('m-midplan')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-midplan', {})
  const one = await add(series.id, '', ids.slice(0, 2))
  const two = await add(series.id, '', ids.slice(2, 4))
  await segues.settledAllSegues()
  const before = await titleOf(two)
  replies['Plan Series'] = async () => {
    // The creator starts episode 2's storyboard while the plan is written.
    await startStoryboard(two)
    return outline([
      { episode: one, title: 'Opening', pages: [ids[0]] },
      { episode: two, title: 'Renamed by the plan', pages: ids.slice(1) }
    ])
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning).toMatchObject({
    state: 'failed',
    error: 'An episode’s video started; plan again'
  })
  expect(await pagesIn(two)).toEqual(ids.slice(2, 4))
  expect(await titleOf(two)).toBe(before)
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  await segues.settledAllSegues()
})

it('stops an organising run when the episode it fills started its video meanwhile', async () => {
  const map = await drawnMap('m-midplace')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-midplace', {})
  const one = await add(series.id, '', ids.slice(0, 5))
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    await startStoryboard(one)
    return {
      moves: [{ page: ids[5], into: one, after: ids[4], why: 'It closes it' }],
      start: []
    }
  }
  await organize.organizeNewPages('m-midplace')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toMatchObject({
    state: 'failed',
    error: 'An episode’s video started; plan again'
  })
  expect(await pagesIn(one)).toEqual(ids.slice(0, 5))
  await segues.settledAllSegues()
})

it('refuses a plan while new cards are being organised', async () => {
  const map = await drawnMap('m-busy')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-busy', {})
  const one = await add(series.id, '', ids.slice(0, 5))
  await segues.settledAllSegues()
  const slow = gate()
  replies['Place Pages'] = async () => {
    await slow.opened
    return {
      moves: [{ page: ids[5], into: one, after: ids[4], why: 'It closes it' }],
      start: []
    }
  }
  replies['Plan Series'] = () =>
    outline([{ episode: one, title: 'All of it', pages: ids }])
  await organize.organizeNewPages('m-busy')
  const refused = await planSeries(series.id, {}).then(
    () => '',
    (error: Error) => error.message
  )
  slow.open()
  await organize.settledOrganize(series.id)
  await settledSeriesPlan(series.id)
  expect(refused).toBe('Wait until the new cards are organised')
  expect(await pagesIn(one)).toEqual(ids)
  expect((await loadSeries(series.id))!.organizing).toBeUndefined()
  await segues.settledAllSegues()
})

it('organises once when two organising calls arrive together', async () => {
  const map = await drawnMap('m-twice')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-twice', {})
  const one = await add(series.id, '', ids.slice(0, 5))
  await segues.settledAllSegues()
  let runs = 0
  replies['Place Pages'] = () => {
    runs += 1
    return {
      moves: [{ page: ids[5], start: 'k', why: 'A part of its own' }],
      start: [started('k', 'The last part', one)]
    }
  }
  await Promise.all([
    organize.organizeNewPages('m-twice'),
    organize.organizeNewPages('m-twice')
  ])
  await organize.settledOrganize(series.id)
  expect(runs).toBe(1)
  const after = (await loadSeries(series.id))!
  expect(after.organized).toHaveLength(1)
  // The new card is in one episode, once.
  expect(after.episodes).toHaveLength(2)
  expect(await pagesIn(after.episodes[1].notebookId)).toEqual([ids[5]])
  await segues.settledAllSegues()
})

it('lets a series the studio stopped while organising be planned after a restart', async () => {
  const map = await drawnMap('m-restart')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-restart', {})
  const one = await add(series.id, '', ids.slice(0, 5))
  await segues.settledAllSegues()
  // The studio stopped while the new cards were organised; startup settles
  // what was cut off.
  await changeSeries(series.id, (current) => {
    current.organizing = { state: 'organizing', at: new Date().toISOString() }
  })
  const saved = (await loadSeries(series.id))!
  settleSeries(saved)
  await writeRow('series', series.id, saved)
  replies['Plan Series'] = () =>
    outline([{ episode: one, title: 'All of it', pages: ids }])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning).toBeUndefined()
  expect(await pagesIn(one)).toEqual(ids)
  await segues.settledAllSegues()
})

it('carries an edited or kept copy into the episode a plan moves its card to, without the lines around it', async () => {
  const map = await drawnMap('m-carry')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-carry', {})
  const one = await add(series.id, '', [ids[0], ids[2], ids[1]])
  const two = await add(series.id, '', [ids[3]])
  await segues.settledAllSegues()
  const [kept, , edited] = (await loadProject(one))!.project.slides
  expect(kept.bridge).toBeTruthy()
  expect(edited.outro).toBe('Next time: Streamline, episode 2.')
  // The creator redraws one copy; the map's first card changes, and they
  // keep their copy of it as it was.
  await changeProject(one, (current) => {
    current.project.slides[2].title = 'In my words'
    current.project.slides[2].svg = '<svg><text>Mine</text></svg>'
  })
  await changeProject('m-carry', (current) => {
    current.project.slides[0].narration = 'The map says it anew.'
  })
  await episodes.changeCopies(one, { action: 'keep', slide: kept.id })
  // The new lines wait, so the copies are read as the plan left them.
  const slow = gate()
  const write = replies['Write Segues']
  replies['Write Segues'] = async (input) => {
    await slow.opened
    return write(input)
  }
  replies['Plan Series'] = () =>
    outline([
      { episode: one, title: 'One', pages: [ids[2]] },
      { episode: two, title: 'Two', pages: [ids[0], ids[1], ids[3]] },
      { title: 'Three', pages: ids.slice(4) }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const moved = (await loadProject(two))!.project.slides
  const left = await pagesIn(one)
  slow.open()
  await segues.settledAllSegues()
  expect(left).toEqual([ids[2]])
  expect(moved.map((copy) => copy.copyOf?.slide)).toEqual([
    ids[0],
    ids[1],
    ids[3]
  ])
  // The kept copy says what it said, not the map's new words.
  expect(moved[0].base).toBe(kept.base)
  expect(moved[0].copyOf?.kept).toBeTruthy()
  // The edited copy is as the creator left it.
  expect(moved[1]).toMatchObject({
    title: 'In my words',
    svg: '<svg><text>Mine</text></svg>',
    base: edited.base
  })
  // Neither keeps the lines written around it in episode 1.
  for (const copy of moved.slice(0, 2)) {
    expect(copy.bridge).toBeUndefined()
    expect(copy.outro).toBeUndefined()
    expect(copy.narration).toBe(copy.base)
  }
})

it('names an episode titled when it is added on the map, and not one the plan or the organiser adds', async () => {
  await drawnMap('m-named', 4)
  const ids = ['m-named-1', 'm-named-2', 'm-named-3', 'm-named-4']
  const series = await episodes.startMapSeries('m-named', {})
  const route = async (body: Record<string, unknown>) => {
    const reply = await mapRoute(
      new URL(`http://studio.test/api/series/${series.id}/map-episodes`),
      { method: 'POST' } as never,
      body
    )
    return (reply!.value as { notebook: Snapshot }).notebook.project
  }
  const typed = await route({ title: 'Typed in the bar', slides: [ids[0]] })
  const blank = await route({ slides: [ids[1]] })
  expect(typed.episode?.named).toBe(true)
  expect(blank.episode?.named).toBeUndefined()
  await segues.settledAllSegues()
  replies['Plan Series'] = () =>
    outline([
      { episode: typed.id, title: 'The plan’s first', pages: [ids[0]] },
      { episode: blank.id, title: 'The plan’s second', pages: [ids[1]] },
      { title: 'The plan’s third', pages: ids.slice(2) }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const third = (await loadSeries(series.id))!.episodes[2].notebookId
  expect(await titleOf(typed.id)).toBe('Typed in the bar')
  expect(await titleOf(blank.id)).toBe('The plan’s second')
  expect((await loadProject(third))!.project.episode?.named).toBeUndefined()
  // A card drawn later starts an episode of the organiser's.
  await changeProject('m-named', (current) => {
    current.project.slides.push(card('m-named-7', 'Pricing'))
  })
  replies['Place Pages'] = () => ({
    moves: [{ page: 'm-named-7', start: 'k', why: 'A part of its own' }],
    start: [started('k', 'The organiser’s', third)]
  })
  await organize.organizeNewPages('m-named')
  await organize.settledOrganize(series.id)
  const fourth = (await loadSeries(series.id))!.organized!.at(-1)!.started[0]
  expect(await titleOf(fourth)).toBe('The organiser’s')
  expect((await loadProject(fourth))!.project.episode?.named).toBeUndefined()
  await segues.settledAllSegues()
  // The next plan renames the plan's and the organiser's, not the typed one.
  replies['Plan Series'] = () =>
    outline([
      { episode: typed.id, title: 'Another first', pages: [ids[0]] },
      { episode: blank.id, title: 'Another second', pages: [ids[1]] },
      { episode: third, title: 'Another third', pages: ids.slice(2) },
      { episode: fourth, title: 'Another fourth', pages: ['m-named-7'] }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect(
    await Promise.all([typed.id, blank.id, third, fourth].map(titleOf))
  ).toEqual([
    'Typed in the bar',
    'Another second',
    'Another third',
    'Another fourth'
  ])
  await segues.settledAllSegues()
})

it('writes the series window as it is when the plan applies, and leaves a made episode’s alone', async () => {
  const map = await drawnMap('m-window')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-window', {})
  const made = await add(series.id, '', [ids[0]])
  const open = await add(series.id, '', ids.slice(1, 3))
  await makeVideo(made)
  await segues.settledAllSegues()
  const first = { min: 60, max: 90, strict: false }
  const moved = { min: 120, max: 180, strict: false }
  replies['Plan Series'] = async () => {
    // The creator moves the slider while the plan is written.
    await directions.updateBrief(series.id, { length: moved })
    await applySeriesLength(series.id)
    return outline([
      { episode: made, title: 'Made', pages: [ids[0]] },
      { episode: open, title: 'Open', pages: ids.slice(1, 3) },
      { title: 'New', pages: ids.slice(3) }
    ])
  }
  await planSeries(series.id, { length: first })
  await settledSeriesPlan(series.id)
  const after = (await loadSeries(series.id))!
  expect(after.planning).toBeUndefined()
  expect(after.length).toEqual(moved)
  const lengthOf = async (id: string) =>
    (await loadProject(id))!.project.episode?.length
  expect(await lengthOf(open)).toEqual(moved)
  expect(await lengthOf(after.episodes[2].notebookId)).toEqual(moved)
  expect(await lengthOf(made)).toBeUndefined()
  await segues.settledAllSegues()
})

it('keeps a gap a card closed closed, with its card, when a new plan names it again', async () => {
  const map = await drawnMap('m-closed')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-closed', {})
  const one = await add(series.id, '', ids)
  await segues.settledAllSegues()
  const closed = (id: string, missing: string, closedBy: string) => ({
    id,
    missing,
    why: 'Needed',
    ask: 'What is it?',
    state: 'closed' as const,
    closedBy
  })
  await changeSeries(series.id, (current) => {
    current.lines = [{ id: 'why', name: 'Why', line: 'It fills a gap' }]
    current.gaps = [
      closed('cfg', 'The config', ids[5]),
      closed('auth', 'Access control', ids[4])
    ]
  })
  const gap = (id: string, missing: string) => ({
    id,
    missing,
    episode: 1,
    why: 'Still needed',
    ask: 'What is it?'
  })
  let shown: unknown
  replies['Plan Series'] = (input) => {
    shown = packetOf(input, 'SERIES.json').last.gaps
    // Named again: one by its id, one by what it misses.
    return outline([{ episode: one, title: 'All of it', pages: ids }], {
      gaps: [gap('cfg', 'The config'), gap('access', 'access control')]
    })
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect(shown).toEqual([
    { id: 'cfg', missing: 'The config', state: 'closed' },
    { id: 'auth', missing: 'Access control', state: 'closed' }
  ])
  expect((await loadSeries(series.id))!.gaps).toMatchObject([
    { id: 'cfg', state: 'closed', closedBy: ids[5] },
    { id: 'access', state: 'closed', closedBy: ids[4] }
  ])
  await segues.settledAllSegues()
})

it('places a new card that follows another new card after it, even when it is listed first', async () => {
  await drawnMap('m-order', 4)
  const series = await episodes.startMapSeries('m-order', {})
  const one = await add(series.id, '', ['m-order-1', 'm-order-2'])
  await add(series.id, '', ['m-order-3', 'm-order-4'])
  await segues.settledAllSegues()
  await changeProject('m-order', (current) => {
    current.project.slides.push(
      card('m-order-7', 'The second step'),
      card('m-order-8', 'The first step')
    )
  })
  replies['Place Pages'] = () => ({
    moves: [
      {
        page: 'm-order-7',
        into: one,
        after: 'm-order-8',
        why: 'It follows the first step'
      },
      {
        page: 'm-order-8',
        into: one,
        after: 'm-order-1',
        why: 'It follows the opening'
      }
    ],
    start: []
  })
  await organize.organizeNewPages('m-order')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toBeUndefined()
  expect(await pagesIn(one)).toEqual([
    'm-order-1',
    'm-order-8',
    'm-order-7',
    'm-order-2'
  ])
  await segues.settledAllSegues()
})

it('Undo deletes an episode it started only while it holds just the run’s untouched copies; one the creator worked on leaves the series and stays', async () => {
  const map = await drawnMap('m-undo')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-undo', {})
  const first = await add(series.id, '', [ids[0]])
  await segues.settledAllSegues()
  // Five new cards, each starting an episode of its own.
  const fresh = ids.slice(1)
  replies['Place Pages'] = () => ({
    moves: fresh.map((page, index) => ({
      page,
      start: `k${index}`,
      why: 'A part of its own'
    })),
    start: fresh.map((_, index) =>
      started(`k${index}`, `Part ${index + 1}`, first)
    )
  })
  await organize.organizeNewPages('m-undo')
  await organize.settledOrganize(series.id)
  await segues.settledAllSegues()
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  const [named, own, added, edited, untouched] = fresh.map(
    (page) => run.moves.find((move) => move.page === page)!.episode!
  )
  // The creator names one, gives one a page of their own, copies another
  // map card into one and redraws one's copy; one stays as it came.
  await episodes.retitleEpisode(named, { title: 'Named by me' })
  await changeProject(own, (current) => {
    current.project.slides.push({
      id: 'own-page',
      title: 'My own page',
      svg: '<svg><text>Mine</text></svg>',
      narration: 'My own words.'
    })
  })
  await episodes.changeCopies(added, { action: 'add', slide: ids[0] })
  await changeProject(edited, (current) => {
    current.project.slides[0].svg = '<svg><text>Redrawn</text></svg>'
  })
  await segues.settledAllSegues()
  const undone = await organize.undoOrganize(series.id, { run: run.id })
  await segues.settledAllSegues()
  expect(await readRow('projects', untouched)).toBeNull()
  // The creator's work stays, in notebooks of their own...
  for (const worked of [named, own, added, edited])
    expect(await readRow('projects', worked)).not.toBeNull()
  expect(await titleOf(named)).toBe('Named by me')
  expect(
    (await loadProject(own))!.project.slides.map((slide) => slide.id)
  ).toContain('own-page')
  expect(await pagesIn(added)).toEqual([ids[3], ids[0]])
  expect((await loadProject(edited))!.project.slides[0].svg).toBe(
    '<svg><text>Redrawn</text></svg>'
  )
  // ...taken out of the series, which keeps only the episode it had.
  expect(undone.episodes.map((e) => e.notebookId)).toEqual([first])
})

it('retires the organising runs when a plan applies, so their Undo takes nothing out', async () => {
  const map = await drawnMap('m-retire')
  const ids = map.project.slides.map((slide) => slide.id)
  const series = await episodes.startMapSeries('m-retire', {})
  const first = await add(series.id, '', ids.slice(0, 3))
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: ids
      .slice(3)
      .map((page) => ({ page, start: 'k', why: 'One more part' })),
    start: [started('k', 'Three more', first)]
  })
  await organize.organizeNewPages('m-retire')
  await organize.settledOrganize(series.id)
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  const more = run.started[0]
  expect((await episodes.mapView('m-retire')).series?.organized?.id).toBe(
    run.id
  )
  // The plan gives the started episode a card of the first one.
  replies['Plan Series'] = () =>
    outline([
      { episode: first, title: 'Opening', pages: ids.slice(0, 2) },
      { episode: more, title: 'The rest', pages: ids.slice(2) }
    ])
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  // The map offers no Undo, nor Studio AI's undo_organize, which reads it.
  expect((await episodes.mapView('m-retire')).series?.organized).toBeUndefined()
  await organize.undoOrganize(series.id, { run: run.id }).catch(() => {})
  expect(
    (await loadSeries(series.id))!.episodes.map((e) => e.notebookId)
  ).toEqual([first, more])
  expect(await pagesIn(more)).toEqual(ids.slice(2))
  await segues.settledAllSegues()
})

it('writes the neighbours’ lines again when Undo takes out an episode it started', async () => {
  await drawnMap('m-segue', 2)
  const series = await episodes.startMapSeries('m-segue', {})
  const first = await add(series.id, 'First', ['m-segue-1'])
  const second = await add(series.id, 'Second', ['m-segue-2'])
  await segues.settledAllSegues()
  await changeProject('m-segue', (current) => {
    current.project.slides.push(card('m-segue-7', 'In between'))
  })
  replies['Place Pages'] = () => ({
    moves: [{ page: 'm-segue-7', start: 'k', why: 'It bridges the two' }],
    start: [started('k', 'In between', first)]
  })
  await organize.organizeNewPages('m-segue')
  await organize.settledOrganize(series.id)
  await segues.settledAllSegues()
  // The episode before says "next time"; the one after, "last time".
  const lines = async () => [
    (await loadProject(first))!.project.slides.at(-1)!.outro,
    (await loadProject(second))!.project.slides[0].bridge
  ]
  expect(await lines()).toEqual([
    'Next time: In between.',
    'Last time: In between.'
  ])
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  await organize.undoOrganize(series.id, { run: run.id })
  await segues.settledAllSegues()
  expect(await lines()).toEqual(['Next time: Second.', 'Last time: First.'])
})
