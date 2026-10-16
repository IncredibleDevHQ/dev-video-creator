import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 7's eighth recheck of the series: an edit a stopped plan can't send
// home, a made home that still holds it, its home made while it is put back,
// Undo after an episode left the series, and organising around one that
// left. The agents are stand-ins: these checks prove the plumbing, not what a
// model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
// A hook on the evidence sync that follows each episode a plan changes: the
// moment between one episode and the next.
const { between, loads } = vi.hoisted(() => ({
  between: { next: null as null | (() => Promise<unknown>), skip: 0 },
  // A hook on the nth read of one notebook once armed: the moment between
  // two steps of a stopped plan putting things back.
  loads: { id: '', nth: 0, seen: 0, hook: null as null | (() => unknown) }
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
vi.mock('./projects', async (original) => {
  const real = await original<typeof import('./projects')>()
  return {
    ...real,
    loadProject: async (id: string) => {
      const value = await real.loadProject(id)
      if (loads.hook && id === loads.id && ++loads.seen === loads.nth) {
        const hook = loads.hook
        loads.hook = null
        await hook()
      }
      return value
    }
  }
})
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-7-recheck-8-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { loadProject, changeProject } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const { loadSeries } = await import('./series')
const { planSeries, settledSeriesPlan } = await import('./series-plan')
const organize = await import('./series-organize')
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
  'Security',
  'Pricing'
]
const drawnMap = async (id: string) => {
  const slides = TITLES.map((title, index) => card(`${id}-${index + 1}`, title))
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
  return slides.map((slide) => slide.id)
}
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
const add = async (seriesId: string, slides: string[]) =>
  (await episodes.addMapEpisode(seriesId, { title: '', slides })).notebook
    .project.id
const membersOf = async (seriesId: string) =>
  (await loadSeries(seriesId))!.episodes.map((item) => item.notebookId)
/** The planner's outline: the episodes as given, each card placed once. */
const outline = (
  groups: Array<{ episode?: string; title: string; pages: string[] }>,
  left: string[] = []
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
  left: left.map((page) => ({ page, why: 'Not yet' }))
})
const EDIT = '<svg><text>Edit in A</text></svg>'
/** Every copy of the creator's edit, by the notebook that holds it. */
const editsIn = async (notebooks: string[]) => {
  const found: Array<{ notebook: string; id: string }> = []
  for (const notebook of new Set(notebooks))
    for (const slide of (await loadProject(notebook))?.project.slides || [])
      if (slide.svg === EDIT) found.push({ notebook, id: slide.id })
  return found
}

beforeEach(() => {
  between.next = null
  between.skip = 0
  Object.assign(loads, { id: '', nth: 0, seen: 0, hook: null })
  for (const key of Object.keys(replies)) delete replies[key]
  replies['Write Segues'] = (input) => {
    const brief = packetOf(input, 'EPISODE.json')
    return {
      pages: brief.pages.map((p: { id: string }) => ({
        id: p.id,
        bridge: 'So.'
      })),
      outro: brief.next ? `Next time: ${brief.next.title}.` : 'That is all.'
    }
  }
})

/** Episode A holds two cards, the second redrawn by the creator. */
const editedA = async (map: string, ids: string[]) => {
  const series = await episodes.startMapSeries(map, {})
  const a = await add(series.id, [ids[0], ids[1]])
  return { series, a }
}
const edit = (a: string) =>
  changeProject(a, (current) => {
    current.project.slides[1].svg = EDIT
  })

it('keeps a new episode holding an edit that can’t go home when a stopped plan discards the rest', async () => {
  const ids = await drawnMap('m-new-home')
  const { series, a } = await editedA('m-new-home', ids)
  const x = await add(series.id, [ids[3]])
  await segues.settledAllSegues()
  await edit(a)
  replies['Plan Series'] = () => {
    // A is set first and its edit leaves for the new episode; then A's
    // video starts, and X's, which stops the plan after the new one.
    between.next = async () => {
      await startStoryboard(a)
      await startStoryboard(x)
    }
    return outline(
      [
        { episode: a, title: 'Opening', pages: [ids[0]] },
        { title: 'New', pages: [ids[1], ids[4]] },
        { episode: x, title: 'Later', pages: [ids[3]] }
      ],
      [ids[2], ids[5], ids[6]]
    )
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  // The new episode stays, with the edit alone; nothing else of the plan.
  const members = await membersOf(series.id)
  const fresh = members.filter((id) => id !== a && id !== x)
  expect(fresh).toHaveLength(1)
  expect(await pagesIn(fresh[0])).toEqual([ids[1]])
  expect((await editsIn(members)).map((hit) => hit.notebook)).toEqual(fresh)
  await segues.settledAllSegues()
})

it('sends an edit carried into a new episode home when a stopped plan discards that episode', async () => {
  const ids = await drawnMap('m-new-back')
  const { series, a } = await editedA('m-new-back', ids)
  const x = await add(series.id, [ids[3]])
  await segues.settledAllSegues()
  await edit(a)
  replies['Plan Series'] = () => {
    // A is set first and its edit leaves for the new episode; X's video
    // starts, which stops the plan; A is still open.
    between.next = () => startStoryboard(x)
    return outline(
      [
        { episode: a, title: 'Opening', pages: [ids[0]] },
        { title: 'New', pages: [ids[1], ids[4]] },
        { episode: x, title: 'Later', pages: [ids[3]] }
      ],
      [ids[2], ids[5], ids[6]]
    )
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  expect(await membersOf(series.id)).toEqual([a, x])
  expect(await pagesIn(a)).toEqual([ids[0], ids[1]])
  expect((await editsIn([a])).map((hit) => hit.notebook)).toEqual([a])
  await segues.settledAllSegues()
})

it('sends a moved edit back to the made episode still holding it, leaving no copy where it went', async () => {
  const ids = await drawnMap('m-made-holds')
  const { series, a } = await editedA('m-made-holds', ids)
  const b = await add(series.id, [ids[2]])
  await segues.settledAllSegues()
  await edit(a)
  replies['Plan Series'] = () => {
    // B takes A's edit first; right after, A's video starts, so A's own
    // write is refused and the plan stops before A gave the edit up.
    between.next = () => startStoryboard(a)
    return outline(
      [
        { episode: b, title: 'Then', pages: [ids[2], ids[1]] },
        { episode: a, title: 'Opening', pages: [ids[0]] }
      ],
      ids.slice(3)
    )
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  expect(await pagesIn(b)).toEqual([ids[2]])
  expect(await pagesIn(a)).toEqual([ids[0], ids[1]])
  // In one episode only: A, which never let it go.
  expect((await editsIn([a, b])).map((hit) => hit.notebook)).toEqual([a])
  await segues.settledAllSegues()
})

for (const nth of [1, 2, 3])
  it(`keeps a moved edit when its home’s video starts while a stopped plan puts it back (read ${nth})`, async () => {
    const map = `m-race-${nth}`
    const ids = await drawnMap(map)
    const { series, a } = await editedA(map, ids)
    const b = await add(series.id, [ids[2]])
    const x = await add(series.id, [ids[3]])
    await segues.settledAllSegues()
    await edit(a)
    replies['Plan Series'] = () => {
      // A, then B, which takes A's edit; X's video starts, which stops the
      // plan; A's starts as the plan puts things back, at its nth read.
      between.skip = 1
      between.next = async () => {
        await startStoryboard(x)
        Object.assign(loads, { id: a, nth, seen: 0 })
        loads.hook = () => startStoryboard(a)
      }
      return outline(
        [
          { episode: a, title: 'Opening', pages: [ids[0]] },
          { episode: b, title: 'Then', pages: [ids[2], ids[1]] },
          { episode: x, title: 'Later', pages: [ids[3]] },
          { title: 'New', pages: [ids[4], ids[5]] }
        ],
        [ids[6]]
      )
    }
    await planSeries(series.id, {})
    await settledSeriesPlan(series.id)
    expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
    expect(loads.hook).toBeNull()
    // Never lost, and in one episode: home if it got back, else in B.
    const hits = await editsIn([a, b, x])
    expect(hits).toHaveLength(1)
    await segues.settledAllSegues()
  })

it('undoes an organising run though an episode it filled left the series since', async () => {
  const ids = await drawnMap('m-undo-left')
  const series = await episodes.startMapSeries('m-undo-left', {})
  const one = await add(series.id, ids.slice(0, 2))
  const two = await add(series.id, ids.slice(2, 4))
  await changeProject('m-undo-left', (current) => {
    current.project.slides = current.project.slides.slice(0, 6)
  })
  await segues.settledAllSegues()
  replies['Place Pages'] = () => ({
    moves: [
      { page: ids[4], into: one, after: ids[1], why: 'It builds on it' },
      { page: ids[5], into: two, after: ids[3], why: 'It closes it' }
    ],
    start: []
  })
  await organize.organizeNewPages('m-undo-left')
  await organize.settledOrganize(series.id)
  const run = (await loadSeries(series.id))!.organized!.at(-1)!
  await segues.settledAllSegues()
  await episodes.removeEpisode(series.id, { episode: two })
  const undone = await organize.undoOrganize(series.id, { run: run.id })
  expect(undone.organized!.find((item) => item.id === run.id)!.undone).toBe(
    true
  )
  // The episode still in the series gives its card back; the one taken out
  // is the creator's now, and keeps what it holds.
  expect(await pagesIn(one)).toEqual(ids.slice(0, 2))
  expect(await pagesIn(two)).toEqual([ids[2], ids[3], ids[5]])
  expect(undone.held).toEqual([ids[4], ids[5]])
  // Undo again is done already, not refused.
  await expect(
    organize.undoOrganize(series.id, { run: run.id })
  ).resolves.toBeTruthy()
  await segues.settledAllSegues()
})

it('puts a new episode after the last one when the episode it follows left the series', async () => {
  const ids = await drawnMap('m-after-left')
  const series = await episodes.startMapSeries('m-after-left', {})
  const one = await add(series.id, ids.slice(0, 2))
  const two = await add(series.id, ids.slice(2, 4))
  const three = await add(series.id, [ids[4]])
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    await episodes.removeEpisode(series.id, { episode: two })
    return {
      moves: [
        { page: ids[5], start: 'k0', why: 'A part of its own' },
        { page: ids[6], left: true, why: 'Not yet' }
      ],
      start: [
        {
          key: 'k0',
          title: 'After two',
          about: 'After two',
          win: 'Win of after two',
          teaches: ['k0'],
          carries: 'Hands on',
          lines: [],
          after: two
        }
      ]
    }
  }
  await organize.organizeNewPages('m-after-left')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toBeUndefined()
  const order = await membersOf(series.id)
  expect(order.slice(0, 2)).toEqual([one, three])
  expect(await pagesIn(order[2])).toEqual([ids[5]])
  await segues.settledAllSegues()
})

it('puts an episode back when a step after its new cards fails', async () => {
  const ids = await drawnMap('m-after-write')
  const series = await episodes.startMapSeries('m-after-write', {})
  const a = await add(series.id, [ids[0], ids[1]])
  await segues.settledAllSegues()
  replies['Plan Series'] = () => {
    // A gets its new cards, then reading their evidence fails.
    between.next = async () => {
      throw new Error('The evidence could not be read')
    }
    return outline(
      [{ episode: a, title: 'Opening', pages: [ids[0], ids[3]] }],
      [ids[1], ids[2], ids[4], ids[5], ids[6]]
    )
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  expect(await pagesIn(a)).toEqual([ids[0], ids[1]])
  await segues.settledAllSegues()
})

it('puts an episode back though its segues were written while the plan went', async () => {
  const ids = await drawnMap('m-segue-mid')
  const series = await episodes.startMapSeries('m-segue-mid', {})
  const a = await add(series.id, [ids[0], ids[1]])
  const b = await add(series.id, [ids[2]])
  const x = await add(series.id, [ids[4]])
  await segues.settledAllSegues()
  replies['Plan Series'] = () => {
    // After A is set, its lines are written again as B is; then X's video
    // starts, which stops the plan.
    between.skip = 1
    between.next = async () => {
      await changeProject(a, (current) => {
        const first = current.project.slides[0]
        first.bridge = 'A new line into it.'
        first.bridgeFor = 'mid-run'
        first.narration = [first.bridge, first.base, first.outro]
          .filter(Boolean)
          .join(' ')
      })
      await startStoryboard(x)
    }
    return outline(
      [
        { episode: a, title: 'Opening', pages: [ids[0], ids[1], ids[3]] },
        { episode: b, title: 'Middle', pages: [ids[2], ids[5]] },
        { episode: x, title: 'Later', pages: [ids[4]] }
      ],
      [ids[6]]
    )
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect((await loadSeries(series.id))!.planning?.state).toBe('failed')
  expect(await pagesIn(a)).toEqual([ids[0], ids[1]])
  expect(await pagesIn(b)).toEqual([ids[2]])
  await segues.settledAllSegues()
})

it('keeps two new episodes after the same one in the plan’s order', async () => {
  const ids = await drawnMap('m-two-after')
  const series = await episodes.startMapSeries('m-two-after', {})
  const one = await add(series.id, ids.slice(0, 2))
  const two = await add(series.id, ids.slice(2, 4))
  await segues.settledAllSegues()
  const part = (key: string) => ({
    key,
    title: `Part ${key}`,
    about: `Part ${key}`,
    win: `Win of ${key}`,
    teaches: [key],
    carries: 'Hands on',
    lines: [],
    after: one
  })
  replies['Place Pages'] = async () => ({
    moves: [
      { page: ids[4], start: 'k0', why: 'A part of its own' },
      { page: ids[5], start: 'k1', why: 'The part after it' },
      { page: ids[6], left: true, why: 'Not yet' }
    ],
    start: [part('k0'), part('k1')]
  })
  await organize.organizeNewPages('m-two-after')
  await organize.settledOrganize(series.id)
  const order = await membersOf(series.id)
  expect(order[0]).toBe(one)
  expect(await pagesIn(order[1])).toEqual([ids[4]])
  expect(await pagesIn(order[2])).toEqual([ids[5]])
  expect(order[3]).toBe(two)
  await segues.settledAllSegues()
})

it('organises on while an episode that left the series, and isn’t filled, starts its video', async () => {
  const ids = await drawnMap('m-left-made')
  const series = await episodes.startMapSeries('m-left-made', {})
  const one = await add(series.id, ids.slice(0, 2))
  const two = await add(series.id, ids.slice(2, 4))
  await changeProject('m-left-made', (current) => {
    current.project.slides = current.project.slides.slice(0, 6)
  })
  await segues.settledAllSegues()
  replies['Place Pages'] = async () => {
    await episodes.removeEpisode(series.id, { episode: two })
    await startStoryboard(two)
    return {
      moves: [
        { page: ids[4], into: one, after: ids[1], why: 'It builds on it' },
        { page: ids[5], left: true, why: 'Not yet' }
      ],
      start: []
    }
  }
  await organize.organizeNewPages('m-left-made')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toBeUndefined()
  expect(await pagesIn(one)).toEqual([ids[0], ids[1], ids[4]])
  await segues.settledAllSegues()
})
