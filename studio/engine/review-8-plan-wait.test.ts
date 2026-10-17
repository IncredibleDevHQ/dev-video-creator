import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8, round 2's live run: a series plan began while a note's new card
// was still being drawn, read the map without it, and named the card's
// subject as a gap. The planner is a stand-in: these checks prove what it is
// given, not what a model would plan.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-plan-wait-'))
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
const drawnMap = async (id: string, slides = cards(id)) => {
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

it('plans a series once the cards being drawn on its map have landed', async () => {
  const outbox = card(
    'w-4',
    'The transactional outbox',
    'Write the order and an outbox row in one transaction.'
  )
  const ids = await drawnMap('w', [
    ...cards('w'),
    { ...outbox, svg: null } as unknown as ReturnType<typeof card>
  ])
  // The note's new card waits to be drawn.
  await changeProject('w', (snapshot) => {
    snapshot.changes = [
      {
        id: 'c-outbox',
        slideId: 'w-4',
        instruction: 'Draw it',
        state: 'queued',
        at: '2026-10-17T00:00:00.000Z'
      }
    ]
  })
  const series = await episodes.startMapSeries('w', {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: [ids[0]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: [ids[1], ids[2]]
  })
  await segues.settledAllSegues()
  let pages: Array<Record<string, unknown>> = []
  replies['Plan Series'] = (input) => {
    pages = packetOf(input, 'PAGES.json')
    return outline(ids, one.notebook.project.id, two.notebook.project.id)
  }
  await planSeries(series.id, {})
  await new Promise((resolve) => setTimeout(resolve, 1200))
  expect(
    stage.mock.calls.some(([input]) => input.route === 'Plan Series')
  ).toBe(false)
  // It says what it waits for, on the map as in the series (round 2).
  expect((await loadSeries(series.id))!.planning?.waiting).toBe(
    'waiting for 1 card being drawn'
  )
  expect((await episodes.mapView('w')).series?.planning?.waiting).toBe(
    'waiting for 1 card being drawn'
  )
  // The card is drawn, and its change leaves the queue.
  await changeProject('w', (snapshot) => {
    snapshot.project.slides[3].svg =
      '<svg><text>The transactional outbox</text></svg>'
    snapshot.changes = []
  })
  await settledSeriesPlan(series.id)
  expect(pages.map((page) => page.id)).toContain('w-4')
})

/** The two episodes the stand-in plan names, on a map. */
const seriesOn = async (id: string, ids: string[]) => {
  const series = await episodes.startMapSeries(id, {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One',
    slides: [ids[0]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Two',
    slides: [ids[1], ids[2]]
  })
  await segues.settledAllSegues()
  return { series, one: one.notebook.project.id, two: two.notebook.project.id }
}
const planned = () =>
  stage.mock.calls.some(([input]) => input.route === 'Plan Series')

// Round 2's audit: a failed change stays until its wireframe gets a new
// request, and a restart fails a working one; counted as work, either held
// every plan five minutes, saying nothing.
it('plans at once past a failed change, which waits for the creator, not the plan', async () => {
  const ids = await drawnMap('f')
  const { series, one, two } = await seriesOn('f', ids)
  await changeProject('f', (snapshot) => {
    snapshot.changes = [
      {
        id: 'c-failed',
        slideId: 'f-2',
        instruction: 'Show the stored result',
        state: 'failed',
        message:
          'The studio restarted before this change finished. Send it again.',
        at: '2026-10-17T00:00:00.000Z'
      }
    ]
  })
  stage.mockClear()
  replies['Plan Series'] = () => outline(ids, one, two)
  await planSeries(series.id, {})
  const done = await Promise.race([
    settledSeriesPlan(series.id).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 3000))
  ])
  expect(done).toBe(true)
  expect(planned()).toBe(true)
})

// Round 2's audit: once the map is drawn, the notes written meanwhile are
// sorted as the waiting series starts; the plan read the map before the
// note's card was there.
it('plans once the notes waiting on the drawn map are sorted and their cards are in', async () => {
  const ids = await drawnMap('n')
  const { series, one, two } = await seriesOn('n', ids)
  const note = {
    id: 'n-outbox',
    at: '2026-10-17T00:00:00.000Z',
    text: 'The transactional outbox writes the order and its event together.'
  }
  await changeProject('n', (snapshot) => {
    snapshot.project.notes = [{ ...note, state: 'waiting' }]
  })
  stage.mockClear()
  let pages: Array<Record<string, unknown>> = []
  replies['Plan Series'] = (input) => {
    pages = packetOf(input, 'PAGES.json')
    return outline(ids, one, two)
  }
  await planSeries(series.id, {})
  await new Promise((resolve) => setTimeout(resolve, 1200))
  expect(planned()).toBe(false)
  // Being sorted: the plan still waits.
  await changeProject('n', (snapshot) => {
    snapshot.project.notes = [{ ...note, state: 'sorting' }]
  })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  expect(planned()).toBe(false)
  // Sorted into a new card, drawn: the plan reads it.
  await changeProject('n', (snapshot) => {
    snapshot.project.slides.push(
      card('n-4', 'The transactional outbox', note.text)
    )
    snapshot.project.notes = [{ ...note, state: 'sorted', results: [] }]
  })
  await settledSeriesPlan(series.id)
  expect(pages.map((page) => page.id)).toContain('n-4')
}, 15_000)
