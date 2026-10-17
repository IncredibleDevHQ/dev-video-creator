import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// Review 8, F10, round 1: the storyboard planner writes its own words too:
// a call-back, a hand-off, a line it restructured. Those words are checked
// against the creator's like a segue's: sent back once through the plan's
// own check, and flagged on the frame when still past them, where the
// creator approves the plan, to write again or keep. The planner is a
// stand-in that answers a refusal as an agent does.
const { stage, replies, asked } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (problems: string[]) => unknown>,
  asked: [] as string[][]
}))
vi.mock('./creative/stage', async (original) => ({
  ...(await original<typeof import('./creative/stage')>()),
  runValidatedJsonStage: stage
}))
vi.mock('../app/api', () => ({ api: {} }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-board-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { materialOf } = await import('./claims')
const { planEpisode, frameClaims } = await import('./storyboard/plan')
const { planSummary } = await import('./storyboard/state')
const { keepStoryboardClaim } = await import('./storyboard/actions')
const { storyboardScreen } = await import('../app/storyboard-view')
afterAll(() => rm(root, { recursive: true, force: true }))

stage.mockImplementation(async (input: Record<string, unknown>) => {
  const reply = replies[input.route as string]
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  let problems: string[] = []
  for (let attempt = 0; attempt < 6; attempt++) {
    const report = validate(reply(problems))
    if (report.ok) return report.value
    problems = report.problems
    asked.push(problems)
  }
  throw new Error('This stage reached its submission budget')
})
beforeEach(() => {
  asked.length = 0
})

const NOTE =
  'New learning: the retention window is part of the idempotency contract. Keep a key long enough to cover the documented client retry window. After expiry, the same key may be treated as a new request. Do not promise that an old retry will be deduplicated forever.'
const SOURCE = `The client reuses one key for every retry of an order.\n\n## Note, 17 October 2026\n\n${NOTE}`
const TIMEOUT =
  'Our client sends POST /orders for one latte and waits. The server commits the order, but its response gets lost on the way back, and the client only sees a timeout.'
const KEY =
  'Our first tool is an idempotency key. The client creates a unique key for the order and reuses that same key on every retry of that order.'
const OWN =
  'Next time, an idempotency key means a retry can never pour a second latte.'
const SCOPED =
  'Next time, an idempotency key, within the key’s retention window.'
const slides = [
  {
    id: 'p1',
    title: 'A timeout is ambiguous',
    svg: '<svg/>',
    narration: TIMEOUT
  },
  {
    id: 'p2',
    title: 'First tool: an idempotency key',
    svg: '<svg/>',
    narration: KEY
  }
]
const snapshot = {
  project: {
    id: 'board',
    title: 'One click, two lattes',
    source: SOURCE,
    slides,
    video: {
      settings: {
        presence: 'off',
        voice: { kind: 'ai', id: 'v' },
        // Strict and short: the planner restructures, in words of its own.
        length: { min: 8, max: 12, strict: true }
      },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null
    }
  },
  status: 'ready',
  error: null,
  events: []
} as unknown as Snapshot
const frame = (over: Record<string, unknown>) => ({
  title: 'A frame',
  scene: 'One clear picture',
  voiceover: '',
  duration: 3,
  transition: 'crossfade',
  type: 'feature_showcase',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Moves the story on.',
  keyMessage: 'One idea.',
  ...over
})
const plan = (handOff: string) => ({
  message: 'A timeout proves nothing; a key names the order',
  audience: 'developers',
  structure: 'story-explainer',
  hook: 'Stakes / consequence',
  direction: {
    palette: 'ink on paper',
    motion: 'reveal on cue',
    held: 'frame 2',
    never: 'no slideshow'
  },
  scenes: [
    {
      pageId: 'p1',
      build: 'faceless',
      buildReason: 'A mechanism to show',
      frames: [
        frame({
          title: 'One click',
          voiceover: 'One click, and the response gets lost.',
          type: 'hook',
          transition: 'cut'
        }),
        frame({
          title: 'The timeout',
          voiceover: 'The client only sees a timeout.'
        })
      ]
    },
    {
      pageId: 'p2',
      build: 'faceless',
      buildReason: 'A mechanism to show',
      frames: [frame({ title: 'Next time', voiceover: handOff, duration: 6 })]
    }
  ]
})
const material = materialOf(SOURCE, slides as never)

it('checks only the words a frame adds, against the creator’s', async () => {
  const pages = slides.map((slide) => ({
    id: slide.id,
    title: slide.title,
    script: slide.narration,
    capture: false
  }))
  const { checkEpisodePlan } = await import('./storyboard/plan-check')
  const value = checkEpisodePlan(plan(OWN), {
    pages,
    camera: false,
    blueprints: [],
    voMode: 'restructure'
  }).value
  expect(frameClaims(value, pages, material)).toMatchObject([
    {
      number: 3,
      claim: {
        word: 'never',
        limit: {
          says: 'Do not promise that an old retry will be deduplicated forever.'
        }
      }
    }
  ])
  // The page's own words are the segues' check, not the plan's.
  const spoken = { ...pages[1], script: `${KEY} ${OWN}` }
  expect(frameClaims(value, [pages[0], spoken], material)).toEqual([])
})

it('never sends back a frame that says the creator’s caveat (round 3’s audit)', async () => {
  const pages = slides.map((slide) => ({
    id: slide.id,
    title: slide.title,
    script: slide.narration,
    capture: false
  }))
  const { checkEpisodePlan } = await import('./storyboard/plan-check')
  const options = {
    pages,
    camera: false,
    blueprints: [],
    voMode: 'restructure' as const
  }
  const caveat = checkEpisodePlan(
    plan('After expiry, an old retry won’t be deduplicated.'),
    options
  ).value
  expect(frameClaims(caveat, pages, material)).toEqual([])
  // A scope of its own is no limit of the creator's.
  const launch = checkEpisodePlan(
    plan('During the launch period, a retry can never pour a second latte.'),
    options
  ).value
  expect(frameClaims(launch, pages, material)).toMatchObject([
    { number: 3, claim: { word: 'never' } }
  ])
})

it('sends a frame’s own words past the creator’s back once through the plan’s check, and flags them when still past', async () => {
  const dir = await mkdtemp(join(root, 'production-'))
  await writeFile(join(dir, 'frame.md'), '# Frame\n')
  const input = {
    snapshot,
    dir,
    productionId: 'sb',
    pages: ['p1', 'p2'],
    selection: { adapter: 'claude-code' as const },
    origin: 'http://127.0.0.1:1',
    material
  }
  replies['Plan Episode'] = (problems) => plan(problems.length ? SCOPED : OWN)
  const fixed = await planEpisode(input)
  expect(asked).toEqual([
    [
      'Frame 3 says “never”, which the pages and the creator’s notes don’t promise; the note of 17 October 2026 says: “Do not promise that an old retry will be deduplicated forever.”. Keep to what they say, within its limit, or leave the promise out'
    ]
  ])
  expect(fixed.plan.scenes[1].frames[0].voiceover).toBe(SCOPED)
  expect(fixed.claims).toEqual([])
  // Still past them after the rewrite: kept, and flagged on frame 3.
  asked.length = 0
  replies['Plan Episode'] = () => plan(OWN)
  const stubborn = await planEpisode({ ...input, productionId: 'sb-2' })
  expect(asked).toHaveLength(1)
  expect(stubborn.claims.map((item) => item.number)).toEqual([3])
  const summary = planSummary({
    plan: stubborn.plan,
    claims: { 3: 'It says “never”; the note says “Do not promise…”' }
  })!
  expect(summary.scenes[1].frames[0].claim).toBe(
    'It says “never”; the note says “Do not promise…”'
  )
  // Kept frames are flagged no more.
  expect(
    planSummary({ plan: stubborn.plan, claims: { 3: 'x' } }, {}, false, [3])!
      .scenes[1].frames[0].claim
  ).toBeUndefined()
})

// Round 2's audit: the planner's brief carried no limits, and a frame that
// spoke the page's outro went unchecked, the outro being in its script.
it('gives the planner the creator’s limits, and checks a segue a frame speaks unless the creator kept it', async () => {
  const dir = await mkdtemp(join(root, 'production-'))
  await writeFile(join(dir, 'frame.md'), '# Frame\n')
  // In an episode, the page's script holds its line out: the outro is the
  // studio's, its own script the page's.
  const episode = (kept: boolean) =>
    ({
      ...snapshot,
      project: {
        ...snapshot.project,
        slides: [
          slides[0],
          { ...slides[1], base: KEY, outro: OWN, narration: `${KEY} ${OWN}` }
        ],
        ...(kept
          ? {
              segueChecks: {
                p2: { outro: { line: OWN, note: 'It says never', kept: true } }
              }
            }
          : {})
      }
    }) as unknown as Snapshot
  const input = {
    dir,
    pages: ['p1', 'p2'],
    selection: { adapter: 'claude-code' as const },
    origin: 'http://127.0.0.1:1',
    material
  }
  replies['Plan Episode'] = () => plan(OWN)
  stage.mockClear()
  const spoken = await planEpisode({
    ...input,
    snapshot: episode(false),
    productionId: 'sb-outro'
  })
  const brief = (stage.mock.calls[0][0].packet as Record<string, string>)[
    'packet/BRIEF.md'
  ]
  expect(brief).toContain(
    "## The creator's limits\n\nPromise no more than these allow"
  )
  expect(brief).toContain(
    '- “Do not promise that an old retry will be deduplicated forever.” (the note of 17 October 2026)'
  )
  expect(spoken.claims.map((item) => item.number)).toEqual([3])
  // The creator kept that outro as it is: its frame is not flagged again.
  const kept = await planEpisode({
    ...input,
    snapshot: episode(true),
    productionId: 'sb-kept'
  })
  expect(kept.claims).toEqual([])
})

it('shows a flagged frame in the plan with its two answers, and keeps it when asked', async () => {
  const claimed = {
    number: 3,
    title: 'Next time',
    scene: 'One clear picture',
    voiceover: OWN,
    duration: 4,
    transition: 'crossfade',
    type: 'feature_showcase',
    beat: 'tension',
    narrativeRole: 'Hands on.',
    keyMessage: 'One idea.',
    status: 'outline',
    claim: 'It says “never”; the note says “Do not promise…”'
  }
  const waiting = {
    ...snapshot,
    project: {
      ...snapshot.project,
      video: {
        ...snapshot.project.video!,
        storyboard: {
          id: 'sb',
          pages: ['p2'],
          stage: 'review',
          status: 'waiting',
          waitingFor: 'approval',
          plan: {
            message: 'm',
            audience: 'a',
            structure: 'story-explainer',
            hook: 'h',
            scenes: [
              {
                pageId: 'p2',
                build: 'faceless',
                buildReason: 'r',
                frames: [claimed]
              }
            ]
          },
          updatedAt: new Date().toISOString()
        }
      }
    }
  } as unknown as Snapshot
  await writeRow('projects', 'board', waiting)
  const view = { projectId: 'board', scene: 0, frame: 3 } as never
  const idle = { phase: 'idle', current: 0 } as never
  const html = storyboardScreen(waiting, view, idle, null)
  expect(html).toContain(
    '<p class="page-check">Check these words <small>It says “never”; the note says “Do not promise…”</small> <button type="button" class="quiet" data-action="sb-claim-again" data-number="3">Write it again</button><button type="button" class="quiet" data-action="sb-claim-keep" data-number="3">Keep it</button></p>'
  )
  expect(html).toContain('check its words')
  const kept = await keepStoryboardClaim('board', 3)
  const board = kept.project.video!.storyboard!
  expect(board.keptClaims).toEqual([3])
  expect(board.plan!.scenes[0].frames[0].claim).toBeUndefined()
  expect(storyboardScreen(kept, view, idle, null)).not.toContain(
    'Check these words'
  )
  await expect(keepStoryboardClaim('board', 3)).rejects.toThrow(
    'Nothing is flagged in this frame'
  )
})
