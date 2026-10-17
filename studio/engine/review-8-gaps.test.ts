import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8, F09: a learning gap asked for what the idempotency card already
// said ("Reject: don't reuse the first result", and its script). The planner
// is a stand-in: these checks prove what it is given and what the studio
// does with its gaps, not what a model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-gaps-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { changeProject } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const { loadSeries } = await import('./series')
const { planSeries, settledSeriesPlan } = await import('./series-plan')
const { setGap } = await import('./series-directions')
const { coveredBy } = await import('./series-gaps')
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

// The live run's card, as the reviewer saw it: the rejection is drawn on it
// and said past the first 300 characters of its script.
const KEY_SCRIPT =
  'Our first tool is an idempotency key. Before sending the latte order, the client creates a unique key for it and reuses that same key on every retry of that order. The server stores the key with a fingerprint of the request and the result. A retry with the same key and the same request gets the original result back, while the same key carrying a different order is rejected, and a genuinely new purchase gets a new key.'
const KEY_SVG = `<svg viewBox="0 0 1280 720"><g data-role="header"><text id="s03-title">First tool: an idempotency key</text></g><g data-role="node"><text>Same key, same order</text><text>Return the original result</text></g><g data-role="node"><text>Same key, new order</text><text><tspan>Reject: don&apos;t reuse</tspan><tspan dy="22">the first result</tspan></text></g></svg>`
const card = (id: string, title: string, narration: string, svg = '') =>
  ({
    id,
    title,
    svg: svg || `<svg><text>${title}</text></svg>`,
    idea: `${title}, in a sentence`,
    narration
  }) satisfies Slide
const cards = (id: string) => [
  card(
    `${id}-1`,
    'A timeout is ambiguous',
    'Our client sends POST /orders for one latte and waits. The server commits the order, but its response gets lost on the way back.'
  ),
  card(`${id}-2`, 'First tool: an idempotency key', KEY_SCRIPT, KEY_SVG),
  card(
    `${id}-3`,
    'The database race',
    'Two copies of the same order hit the database at once, and a check-then-insert lets both through.'
  )
]
const drawnMap = async (id: string) => {
  const slides = cards(id)
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'APIs that survive retries',
      source: 'Learning log: APIs that survive retries.',
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
    source: { title: 'APIs', text: snapshot.project.source },
    brand: {},
    outline: { title: 'APIs', scenes: slides.map((s) => ({ title: s.title })) },
    slideIds: slides.map((s) => s.id)
  })
  await writeRow('sources', id, {
    title: 'APIs',
    text: snapshot.project.source
  })
  return slides.map((slide) => slide.id)
}
const SAME_KEY =
  'What the server does when the same key arrives with a different order'
const CLIENT_KEY =
  'How the client generates the key and sends it with the request'
/** The live run's plan: two episodes, the two gaps Episode 2 showed. */
const outline = (ids: string[], first: string, second: string) => ({
  outcome: 'Make an order API safe to retry',
  audience: 'Developers building their first production API',
  lines: [{ id: 'latte', name: 'One latte', line: 'One click, one latte' }],
  episodes: [
    {
      episode: first,
      title: 'One click, two lattes',
      about: 'A timeout is ambiguous',
      win: 'Explain why a blind retry doubles an order',
      teaches: ['ambiguous timeouts'],
      needs: [],
      carries: 'Opens the series',
      lines: ['latte'],
      pages: [ids[0]]
    },
    {
      episode: second,
      title: 'Give the latte a name',
      about: 'A client-made key turns a retry into a replay',
      win: 'Describe how a key, a fingerprint and a stored result work',
      teaches: ['idempotency keys'],
      needs: [
        { what: 'ambiguous timeouts', from: 1 },
        { what: 'the key on the wire', gap: 'client-key' },
        { what: 'a reused key', gap: 'same-key' }
      ],
      carries: 'Hands off the race',
      lines: ['latte'],
      pages: [ids[1], ids[2]]
    }
  ],
  gaps: [
    {
      id: 'client-key',
      missing: CLIENT_KEY,
      episode: 2,
      why: 'The card says the client makes a key, not how it travels',
      ask: 'How does your client make the key and send it?'
    },
    {
      id: 'same-key',
      missing: SAME_KEY,
      episode: 2,
      why: 'The card idea does not show it',
      ask: 'What should the server do with a reused key?'
    }
  ],
  directions: [],
  flags: []
})

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

it('marks a gap a card already says with that card and its words, and leaves an open one alone', () => {
  const planned = cards('u').map((slide) => ({
    id: slide.id,
    idea: slide.idea,
    script: slide.narration,
    shows: ['Same key, new order', 'Reject: don’t reuse the first result']
  }))
  expect(coveredBy(SAME_KEY, planned)).toEqual({
    page: 'u-2',
    says: 'the same key carrying a different order is rejected'
  })
  // The card says the client makes a key; how it makes and sends it, no.
  expect(coveredBy(CLIENT_KEY, planned)).toBeNull()
  expect(
    coveredBy(
      'Which status code the server returns for a reused key with a different body',
      planned
    )
  ).toBeNull()
  // A gap that only names a thing is the planner's to judge.
  expect(coveredBy('What a Durable Object is', planned)).toBeNull()
})

it('gives the planner every card whole, then marks the gap the idempotency card already covers', async () => {
  const ids = await drawnMap('m-gaps')
  const series = await episodes.startMapSeries('m-gaps', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: [ids[0]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: [ids[1], ids[2]]
  })
  const first = one.notebook.project.id
  const second = two.notebook.project.id
  await segues.settledAllSegues()
  let pages: Array<Record<string, unknown>> = []
  replies['Plan Series'] = (input) => {
    pages = packetOf(input, 'PAGES.json')
    return outline(ids, first, second)
  }
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  // The whole script, past its first 300 characters, and what is drawn.
  const key = pages.find((page) => page.id === ids[1])!
  expect(key.script).toBe(KEY_SCRIPT)
  expect(key.shows).toEqual([
    'First tool: an idempotency key',
    'Same key, same order',
    'Return the original result',
    'Same key, new order',
    "Reject: don't reuse the first result"
  ])
  const planned = (await loadSeries(series.id))!
  expect(planned.planning).toBeUndefined()
  const gap = (id: string) => planned.gaps!.find((item) => item.id === id)!
  expect(gap('same-key')).toMatchObject({
    state: 'open',
    episode: second,
    covered: {
      page: ids[1],
      says: 'the same key carrying a different order is rejected'
    }
  })
  expect(gap('client-key').state).toBe('open')
  expect(gap('client-key').covered).toBeUndefined()

  // The creator closes it with the card, in one step; the open one has no
  // card to close with.
  await expect(
    setGap(series.id, { id: 'client-key', state: 'covered' })
  ).rejects.toThrow('No card says this yet')
  const closed = await setGap(series.id, { id: 'same-key', state: 'covered' })
  expect(closed.gaps!.find((item) => item.id === 'same-key')).toMatchObject({
    state: 'closed',
    closedBy: ids[1]
  })
  // A later plan naming it again keeps it closed by that card.
  replies['Plan Series'] = () => outline(ids, first, second)
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  const again = (await loadSeries(series.id))!
  expect(again.gaps!.find((item) => item.id === 'same-key')).toMatchObject({
    state: 'closed',
    closedBy: ids[1]
  })
  expect(again.gaps!.find((item) => item.id === 'client-key')!.state).toBe(
    'open'
  )
})

it('refuses to close a gap with a card that left the map', async () => {
  const ids = await drawnMap('m-gone')
  const series = await episodes.startMapSeries('m-gone', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: [ids[0]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: [ids[1], ids[2]]
  })
  await segues.settledAllSegues()
  replies['Plan Series'] = () =>
    outline(ids, one.notebook.project.id, two.notebook.project.id)
  await planSeries(series.id, {})
  await settledSeriesPlan(series.id)
  await changeProject('m-gone', (current) => {
    current.project.slides = current.project.slides.filter(
      (slide) => slide.id !== ids[1]
    )
  })
  await expect(
    setGap(series.id, { id: 'same-key', state: 'covered' })
  ).rejects.toThrow('That card is no longer on the map')
  expect(
    (await loadSeries(series.id))!.gaps!.find((item) => item.id === 'same-key')!
      .state
  ).toBe('open')
})
