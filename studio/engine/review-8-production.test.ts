import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { EpisodePlan, PlanFrame, Storyboard } from '../shared/storyboard'

// Review 8 (the live AI run), the first video build: a plan never goes stale
// before a video exists, and a production at work can be stopped. The
// agents, the voice and Hyperframes are stand-ins: these checks prove the
// production's plumbing, never what a model plans or builds.
const { planned, posed } = vi.hoisted(() => ({
  planned: vi.fn(),
  posed: vi.fn()
}))
vi.mock('./storyboard/plan', async (original) => ({
  ...(await original<typeof import('./storyboard/plan')>()),
  planEpisode: planned,
  blueprintIds: () => []
}))
vi.mock('./storyboard/voice', () => ({ prepareEpisodeAudio: vi.fn() }))
vi.mock('./storyboard/shots', () => ({
  designSceneShots: vi.fn(),
  buildFiles: () => []
}))
vi.mock('./storyboard/frames', () => ({
  buildFrame: vi.fn(),
  writeFramePackets: async () => []
}))
vi.mock('./storyboard/stills-stage', () => ({ stillsStage: posed }))
vi.mock('./storyboard/assemble', () => ({
  assembleEpisode: async () => {},
  checkEpisode: vi.fn(),
  episodeSheet: async () => null,
  episodePoster: async () => null,
  renderEpisode: vi.fn()
}))

const { writeRow } = await import('./persistence')
const { changeProject, loadProject } = await import('./projects')
const { planSummary } = await import('./storyboard/state')
const { scheduleStoryboard, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const { approveStoryboard, retryStoryboard, stopStoryboard } =
  await import('./storyboard/actions')
const { generationStops } = await import('./generation-errors')
const { runEngineStage } = await import('./harness/runtime')
const { storyboardHeader, storyboardScreen } =
  await import('../app/storyboard-view')
const { Recording } = await import('../app/recording')

const frame = (number: number): PlanFrame => ({
  number,
  title: `Frame ${number}`,
  scene: `What frame ${number} shows`,
  voiceover: `Line ${number}.`,
  duration: 3,
  transition: 'cut',
  type: 'hook',
  persuasion: 'Before/after',
  beat: 'tension',
  narrativeRole: 'Shows it',
  keyMessage: 'It is so'
})
const plan: EpisodePlan = {
  message: 'A timeout is ambiguous',
  audience: 'developers',
  structure: 'story-explainer',
  hook: 'Stakes / consequence',
  direction: { palette: 'ink', motion: 'reveal', held: 'none', never: 'none' },
  scenes: [
    {
      pageId: 'p1',
      build: 'faceless',
      buildReason: 'It explains',
      frames: [frame(1), frame(2)]
    }
  ]
}

const seed = async (
  id: string,
  storyboard: Partial<Storyboard>,
  project: Record<string, unknown> = {}
) => {
  const board: Storyboard = {
    id: `sb-${id}`,
    pages: ['p1'],
    stage: 'plan',
    status: 'working',
    updatedAt: '2026-10-17T00:00:00.000Z',
    ...storyboard
  }
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Fixture',
      source: 'Fixture',
      harness: { adapter: 'claude-code' },
      slides: [
        {
          id: 'p1',
          title: 'A timeout is ambiguous',
          svg: '<svg id="p1"></svg>',
          narration: 'The first outro.'
        }
      ],
      video: {
        settings: {
          presence: 'off',
          voice: { kind: 'ai', id: 'default' },
          production: 'storyboard'
        },
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: null,
        storyboard: board
      },
      ...project
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot)
  const dir = storyboardDir(id, board)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'frame.md'), '# Frame\n')
}
const stored = async (id: string) =>
  (await loadProject(id))!.project.video!.storyboard!
// What a segue writer does when it lands: the page's lines change.
const rewrite = (id: string, narration: string, more = {}) =>
  changeProject(id, (snapshot) => {
    snapshot.project.slides[0].narration = narration
    Object.assign(snapshot.project, more)
  })
const heard = () =>
  planned.mock.calls.map(
    ([input]) =>
      (input as { snapshot: Snapshot }).snapshot.project.slides[0].narration
  )
const screen = async (id: string) =>
  storyboardScreen(
    (await loadProject(id))!,
    { projectId: id, scene: 0, frame: null },
    new Recording(
      () => {},
      () => {}
    ),
    null
  )
const header = async (id: string) => {
  const snapshot = (await loadProject(id))!
  return storyboardHeader(snapshot, snapshot.project.video!.storyboard!)
}

beforeEach(() => {
  planned.mockReset()
  posed.mockReset()
  planned.mockResolvedValue({
    plan,
    length: { min: 10, max: 60, strict: false },
    brief: '# Brief\n'
  })
  posed.mockResolvedValue('stop')
})

it('plans again, never stale, when its lines change while the first plan is made (F04)', async () => {
  await seed('mid-plan', {})
  // The episode's segue lands while the planner works on the old lines.
  planned.mockImplementationOnce(async () => {
    await rewrite('mid-plan', 'The new outro.')
    return { plan, length: { min: 10, max: 60, strict: false }, brief: '#\n' }
  })
  scheduleStoryboard('mid-plan')
  await settledStoryboard('mid-plan')
  const board = await stored('mid-plan')
  expect(board.stale).toBeFalsy()
  expect(board.replan).toBeFalsy()
  expect([board.stage, board.status, board.waitingFor]).toEqual([
    'review',
    'waiting',
    'approval'
  ])
  // The plan that waits was made from the new lines.
  expect(heard()).toEqual(['The first outro.', 'The new outro.'])
  // The page offers the plan's approval and nothing that calls it stale.
  const page = await screen('mid-plan')
  expect(page).toContain('Approve the plan')
  expect(page).not.toMatch(/Changed since|previous cut/)
  expect(await header('mid-plan')).toContain('Approve the plan')
  const events = (await loadProject('mid-plan'))!.events.map((e) => e.message)
  expect(events).toContain(
    'The wireframes changed while planning: planning again with them'
  )
})

it('sends a plan waiting for approval back to planning when its lines change (F04)', async () => {
  await seed('waiting-plan', {
    stage: 'review',
    status: 'waiting',
    waitingFor: 'approval',
    plan: planSummary({ plan })
  })
  const changed = await rewrite('waiting-plan', 'The new outro.')
  const board = changed.project.video!.storyboard!
  expect([board.stage, board.status, board.stale]).toEqual([
    'plan',
    'working',
    undefined
  ])
  await settledStoryboard('waiting-plan')
  expect(heard()).toEqual(['The new outro.'])
  expect((await stored('waiting-plan')).waitingFor).toBe('approval')
})

it('starts the first plan once the episode’s own segues are written (F04)', async () => {
  await seed('segues', {}, { segues: { state: 'writing' } })
  scheduleStoryboard('segues')
  await new Promise((resolve) => setTimeout(resolve, 700))
  expect(planned).not.toHaveBeenCalled()
  // The segue lands: the outro changes and the episode is no longer writing.
  await rewrite('segues', 'The new outro.', { segues: undefined })
  await settledStoryboard('segues')
  expect(heard()).toEqual(['The new outro.'])
  const board = await stored('segues')
  expect([board.stage, board.stale, board.replan]).toEqual([
    'review',
    undefined,
    undefined
  ])
})

it('goes stale only after the plan is approved, refuses approval then, and offers Remake (F04)', async () => {
  await seed('approved', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval',
    approved: true,
    plan: planSummary({ plan })
  })
  await rewrite('approved', 'The new outro.')
  expect((await stored('approved')).stale).toBe(true)
  await expect(approveStoryboard('approved', {})).rejects.toThrow(
    /remake the video/
  )
  const page = await screen('approved')
  expect(page).toContain('Changed since the plan.')
  expect(page).not.toContain('previous cut')
  expect(page).not.toContain('Approve the stills')
  // Remake is offered, enabled, even while the production is at work.
  await changeProject('approved', (snapshot) => {
    snapshot.project.video!.storyboard!.status = 'working'
    snapshot.project.video!.storyboard!.stage = 'stills'
  })
  const remake = (await header('approved')).match(
    /<button[^>]*data-action="sb-remake"[^>]*>/
  )![0]
  expect(remake).not.toContain('disabled')
})

it('stops the stills when asked, keeps what is made, and carries on with Try again (F11)', async () => {
  await seed('stop', {
    stage: 'stills',
    status: 'working',
    approved: true,
    plan: planSummary({ plan })
  })
  let release = () => {}
  const stopped = new Promise<void>((resolve) => (release = resolve))
  // The stills at work end once their agents are cancelled.
  posed.mockImplementationOnce(async () => {
    await stopped
    throw new Error('Frame 2’s still was not posed')
  })
  scheduleStoryboard('stop')
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(await header('stop')).toMatch(/data-action="sb-stop"[^>]*>Stop</)
  const asked = await stopStoryboard('stop')
  expect(asked.project.video!.storyboard!.stopping).toBe(true)
  expect(await header('stop')).toMatch(
    /data-action="sb-stop"[^>]*disabled[^>]*>Stopping…</
  )
  release()
  await settledStoryboard('stop')
  const board = await stored('stop')
  expect([board.status, board.error, board.stopping]).toEqual([
    'failed',
    generationStops.user,
    undefined
  ])
  await retryStoryboard('stop')
  expect((await stored('stop')).status).toBe('working')
  await settledStoryboard('stop')
  expect(posed).toHaveBeenCalledTimes(2)
})

it('stops at once when nothing is at work, and refuses when nothing is being made (F11)', async () => {
  await seed('idle-stop', {
    stage: 'stills',
    status: 'working',
    approved: true,
    plan: planSummary({ plan })
  })
  const board = (await stopStoryboard('idle-stop')).project.video!.storyboard!
  expect([board.status, board.error]).toEqual(['failed', generationStops.user])
  await expect(stopStoryboard('idle-stop')).rejects.toThrow(
    'Nothing is being made now'
  )
})

it('refuses a storyboard agent run once the production is stopping (F11)', async () => {
  await seed('runs', { stage: 'stills', status: 'working', stopping: true })
  await expect(
    runEngineStage({
      projectId: 'runs',
      stage: 'frame',
      adapter: 'claude-code',
      task: 'Pose a frame',
      packet: {},
      context: {} as never,
      accept: async () => {}
    })
  ).rejects.toThrow(generationStops.user)
})
