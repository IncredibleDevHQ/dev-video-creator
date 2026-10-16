import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// The agent is a stand-in: these checks prove the plumbing and the
// validators, not what a model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-series-build-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow, readRow } = await import('./persistence')
const { loadProject, changeProject } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const { loadSeries } = await import('./series')
const { planSeries, settledSeriesPlan } = await import('./series-plan')
const { validateOutline } = await import('./series-outline')
const organize = await import('./series-organize')
const directions = await import('./series-directions')
const { placeEpisodeAfter } = await import('./series-apply')
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
const pagesIn = async (notebook: string) =>
  ((await loadProject(notebook))?.project.slides || []).map(
    (slide) => slide.copyOf?.slide
  )

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key]
  replies['Write Segues'] = (input) => {
    const brief = packetOf(input, 'EPISODE.json')
    return {
      pages: brief.pages.map((p: { id: string }) => ({
        id: p.id,
        bridge: 'So.'
      })),
      outro: 'Next.'
    }
  }
})

it('checks that each episode builds only on earlier ones, made ones stay, and every card is placed', () => {
  const pages = ['a', 'b', 'c', 'd'].map((id) => ({ id, seconds: 30 }))
  const rules = {
    pages,
    existing: [{ notebook: 'e1', made: true, pages: ['a'] }],
    directions: ['d1'],
    given: { outcome: false, audience: true }
  }
  const episode = (extra: Record<string, unknown>) => ({
    title: 'T',
    about: 'A',
    win: 'W',
    teaches: ['t'],
    carries: 'C',
    lines: ['why'],
    ...extra
  })
  const good = {
    outcome: 'Run a pipeline',
    lines: [{ id: 'why', name: 'Why build', line: 'It fills a gap' }],
    episodes: [
      episode({ episode: 'e1', pages: ['a'], needs: [] }),
      episode({ pages: ['b', 'c'], needs: [{ what: 'why', from: 1 }] }),
      episode({ pages: ['d'], needs: [{ what: 'objects', gap: 'g1' }] })
    ],
    gaps: [
      {
        id: 'g1',
        missing: 'Objects',
        episode: 3,
        why: 'Needed',
        ask: 'What are they?'
      }
    ],
    directions: [{ id: 'd1', state: 'partly', why: 'Kept the order' }]
  }
  expect(validateOutline(good, rules).problems).toEqual([])
  const bad = {
    lines: good.lines,
    episodes: [
      episode({ episode: 'e1', pages: ['a', 'b'], needs: [] }),
      episode({
        pages: ['c'],
        needs: [{ what: 'later', from: 3 }, { what: 'loose' }]
      }),
      episode({ pages: ['c'], needs: [] })
    ]
  }
  const problems = validateOutline(bad, rules).problems.join(' | ')
  expect(problems).toMatch(/Propose the outcome/)
  expect(problems).toMatch(/is made: keep its cards/)
  expect(problems).toMatch(/can only build on one before it/)
  expect(problems).toMatch(/say which earlier episode teaches it/)
  expect(problems).toMatch(/c is already in episode 2/)
  expect(problems).toMatch(/Place every card.*d/)
  expect(problems).toMatch(/Answer direction d1/)
})

it('outlines the series from every card, keeping the made episode and following the directions', async () => {
  const map = await drawnMap('m1')
  const ids = map.project.slides.map((s) => s.id)
  const series = await episodes.startMapSeries('m1', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'Why',
    slides: [ids[0], ids[1]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Parts',
    slides: [ids[2]]
  })
  const e1 = one.notebook.project.id
  const e2 = two.notebook.project.id
  await makeVideo(e1)
  await directions.saveDirection(series.id, { text: 'End on security' })
  const wired = await directions.saveDirection(series.id, {
    text: 'Keep this one short',
    to: { episode: e2 }
  })
  const wiredId = wired.directions!.at(-1)!.id
  let seen: Record<string, unknown> = {}
  replies['Plan Series'] = (input) => {
    seen = packetOf(input, 'SERIES.json')
    const cards = packetOf(input, 'PAGES.json')
    expect(cards[0].evidence).toEqual(['The source on why it exists.'])
    const all = (seen.directions as Array<{ id: string; about: string }>).map(
      (d) => d.id
    )
    return {
      outcome: 'Run a video pipeline on Cloudflare',
      audience: 'Workers developers',
      lines: [
        {
          id: 'life',
          name: 'The long session',
          line: 'It outlives the request'
        }
      ],
      episodes: [
        {
          episode: e1,
          title: 'Why',
          about: 'A',
          win: 'See the gap',
          teaches: ['the gap'],
          needs: [],
          carries: 'Opens',
          lines: ['life'],
          pages: [ids[0], ids[1]]
        },
        {
          title: 'Three parts',
          about: 'B',
          win: 'Name the parts',
          teaches: ['parts'],
          needs: [{ what: 'the gap', from: 1 }],
          carries: 'Hands on',
          lines: ['life'],
          pages: [ids[2], ids[3]]
        },
        {
          episode: e2,
          title: 'Config and safety',
          about: 'C',
          win: 'Write a config',
          teaches: ['config'],
          needs: [
            { what: 'parts', from: 2 },
            { what: 'Durable Objects', gap: 'do' }
          ],
          carries: 'Closes',
          lines: ['life'],
          pages: [ids[4], ids[5]]
        }
      ],
      gaps: [
        {
          id: 'do',
          missing: 'Durable Objects',
          episode: 3,
          why: 'The orchestrator is one',
          ask: 'What is a Durable Object?'
        }
      ],
      directions: all.map((id) => ({ id, state: 'followed', why: 'Done' })),
      flags: [{ episode: 2, kind: 'overloaded', line: 'Many parts' }]
    }
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  expect(seen.episodes).toMatchObject([
    { episode: e1, made: true },
    { episode: e2, made: false }
  ])
  expect(seen.directions).toMatchObject([
    { text: 'End on security', about: 'the whole series' },
    { id: wiredId, about: 'episode 2, “Parts”' }
  ])
  const after = (await loadSeries(series.id))!
  expect(after.planning).toBeUndefined()
  const order = after.episodes.map((e) => e.notebookId)
  expect(order[0]).toBe(e1)
  expect(order[2]).toBe(e2)
  // The made episode is untouched; the open one has its new cards.
  expect(await pagesIn(e1)).toEqual([ids[0], ids[1]])
  expect(await pagesIn(order[1])).toEqual([ids[2], ids[3]])
  expect(await pagesIn(e2)).toEqual([ids[4], ids[5]])
  expect((await loadProject(e2))!.project.episode).toMatchObject({
    number: 3,
    previously: expect.stringContaining('Three parts')
  })
  expect(after.episodes[2].outline).toEqual({
    win: 'Write a config',
    teaches: ['config'],
    needs: [
      { what: 'parts', from: order[1] },
      { what: 'Durable Objects', gap: 'do' }
    ],
    lines: ['life']
  })
  expect(after).toMatchObject({
    outcome: 'Run a video pipeline on Cloudflare',
    suggested: ['outcome', 'audience'],
    gaps: [{ id: 'do', episode: e2, state: 'open' }],
    flags: [{ episode: order[1], kind: 'overloaded' }]
  })
  expect(after.directions!.every((d) => d.answer?.state === 'followed')).toBe(
    true
  )
  // The creator's own outcome is theirs from now on.
  const edited = await directions.updateBrief(series.id, {
    outcome: 'Ship a pipeline'
  })
  expect(edited.suggested).toEqual(['audience'])
})

it('organises new cards into the series, and Undo takes them out again', async () => {
  const map = await drawnMap('m2')
  const ids = map.project.slides.map((s) => s.id)
  const series = await episodes.startMapSeries('m2', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'Why',
    slides: [ids[0]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Parts',
    slides: [ids[1], ids[2]]
  })
  const e1 = one.notebook.project.id
  const e2 = two.notebook.project.id
  await makeVideo(e1)
  await changeProject(series.map!, (current) => {
    // Three cards stay out of the episodes for now; two arrive as new.
    current.project.slides = current.project.slides.slice(0, 3)
  })
  const { changeSeries } = await import('./series')
  await changeSeries(series.id, (current) => {
    current.gaps = [
      {
        id: 'cfg',
        missing: 'The config',
        episode: e2,
        why: 'w',
        ask: 'a',
        state: 'open'
      }
    ]
  })
  await changeProject('m2', (current) => {
    current.project.slides.push(
      card('m2-7', 'The config'),
      card('m2-8', 'Pricing')
    )
  })
  replies['Place Pages'] = (input) => {
    const eps = packetOf(input, 'EPISODES.json')
    expect(eps.map((e: { made: boolean }) => e.made)).toEqual([true, false])
    expect(
      packetOf(input, 'NEW.json').map((c: { id: string }) => c.id)
    ).toEqual(['m2-7', 'm2-8'])
    return {
      moves: [
        {
          page: 'm2-7',
          into: e2,
          after: ids[1],
          closes: 'cfg',
          why: 'It is the config episode 2 needs'
        },
        { page: 'm2-8', start: 'k1', why: 'Pricing is a part of its own' }
      ],
      start: [
        {
          key: 'k1',
          title: 'What it costs',
          about: 'A price',
          win: 'Estimate the cost',
          teaches: ['pricing'],
          carries: 'Closes',
          lines: [],
          after: e2
        }
      ]
    }
  }
  await organize.organizeNewPages('m2')
  await organize.settledOrganize(series.id)
  const after = (await loadSeries(series.id))!
  expect(after.organizing).toBeUndefined()
  expect(await pagesIn(e2)).toEqual([ids[1], 'm2-7', ids[2]])
  expect(await pagesIn(e1)).toEqual([ids[0]])
  const started = after.episodes[2].notebookId
  expect(await pagesIn(started)).toEqual(['m2-8'])
  expect(after.episodes[2].outline?.win).toBe('Estimate the cost')
  expect(after.gaps![0]).toMatchObject({ state: 'closed', closedBy: 'm2-7' })
  const run = after.organized!.at(-1)!
  expect(run.moves.map((m) => [m.page, m.kind])).toEqual([
    ['m2-7', 'closes'],
    ['m2-8', 'new']
  ])
  expect((await episodes.mapView('m2')).series?.organized?.id).toBe(run.id)
  const undone = await organize.undoOrganize(series.id, { run: run.id })
  expect(await pagesIn(e2)).toEqual([ids[1], ids[2]])
  expect(undone.episodes.map((e) => e.notebookId)).toEqual([e1, e2])
  expect(await readRow('projects', started)).toBeNull()
  expect(undone.held).toEqual(['m2-7', 'm2-8'])
  expect(undone.gaps![0].state).toBe('open')
  // Held back, they wait: organising again places nothing.
  replies['Place Pages'] = () => {
    throw new Error('should not run')
  }
  await organize.organizeNewPages('m2')
  await organize.settledOrganize(series.id)
  expect((await loadSeries(series.id))!.organizing).toBeUndefined()
})

it('refuses a placement into a made episode, before the last made one, or twice', () => {
  const rules = {
    fresh: ['n1', 'n2'],
    episodes: [
      { notebook: 'e1', made: false, pages: ['a'] },
      { notebook: 'e2', made: true, pages: ['b'] }
    ],
    gaps: ['g'],
    lines: []
  }
  const problems = organize
    .validatePlacement(
      {
        moves: [
          { page: 'n1', into: 'e2', why: 'x' },
          { page: 'n1', into: 'e1', after: 'zz', why: 'x' },
          { page: 'n2', start: 'k', closes: 'nope', why: 'x' }
        ],
        start: [{ key: 'k', title: 'T', about: 'A', win: 'W', after: 'e1' }]
      },
      rules
    )
    .problems.join(' | ')
  expect(problems).toMatch(/episode 2 is made/)
  expect(problems).toMatch(/zz is not a card of that episode/)
  expect(problems).toMatch(/nope is not an open gap/)
  expect(problems).toMatch(/must come after episode 2/)
  expect(problems).toMatch(/Place n1 exactly once/)
})

it('keeps the creator’s directions: wired, reworded, answered again, removed', async () => {
  await drawnMap('m3')
  const series = await episodes.startMapSeries('m3', {})
  const ep = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: ['m3-1']
  })
  let saved = await directions.saveDirection(series.id, {
    text: 'Lead with the why',
    spot: { x: 10.4, y: 20 }
  })
  const id = saved.directions![0].id
  expect(saved.directions![0]).toMatchObject({
    text: 'Lead with the why',
    spot: { x: 10, y: 20 }
  })
  const { changeSeries } = await import('./series')
  await changeSeries(series.id, (current) => {
    current.directions![0].answer = { state: 'followed', why: 'y', at: 'now' }
  })
  saved = await directions.saveDirection(series.id, {
    id,
    spot: { x: 50, y: 60 }
  })
  expect(saved.directions![0].answer?.state).toBe('followed')
  saved = await directions.saveDirection(series.id, {
    id,
    to: { episode: ep.notebook.project.id }
  })
  expect(saved.directions![0].answer).toBeUndefined()
  await expect(
    directions.saveDirection(series.id, { id, to: { episode: 'elsewhere' } })
  ).rejects.toThrow(/episode of this series/)
  saved = await directions.removeDirection(series.id, { id })
  expect(saved.directions).toEqual([])
  await changeSeries(series.id, (current) => {
    current.gaps = [
      { id: 'g', missing: 'm', why: 'w', ask: 'a', state: 'open' }
    ]
  })
  expect(
    (await directions.setGap(series.id, { id: 'g', state: 'ignored' })).gaps![0]
      .state
  ).toBe('ignored')
})

it('puts an episode after another, as wiring them does, and says what came before', async () => {
  await drawnMap('m4')
  const series = await episodes.startMapSeries('m4', {})
  const made = []
  for (const [index, title] of ['A', 'B', 'C'].entries())
    made.push(
      (
        await episodes.addMapEpisode(series.id, {
          title,
          slides: [`m4-${index + 1}`]
        })
      ).notebook.project.id
    )
  const saved = await placeEpisodeAfter(series.id, {
    episode: made[2],
    after: made[0]
  })
  expect(saved.episodes.map((e) => e.notebookId)).toEqual([
    made[0],
    made[2],
    made[1]
  ])
  expect((await loadProject(made[1]))!.project.episode).toMatchObject({
    number: 3,
    previously: expect.stringContaining('“C”')
  })
})
