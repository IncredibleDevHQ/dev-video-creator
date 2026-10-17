import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { EpisodePlan, PlanFrame, Storyboard } from '../shared/storyboard'

// Review 8 (the live AI run), the first video build: a plan never goes stale
// before a video exists, and a production at work can be stopped. The
// agents, the voice and Hyperframes are stand-ins: these checks prove the
// production's plumbing, never what a model plans or builds.
const { planned, posed, built, rendered, segued, voiced } = vi.hoisted(() => ({
  planned: vi.fn(),
  posed: vi.fn(),
  built: vi.fn(),
  rendered: vi.fn(),
  segued: vi.fn(),
  voiced: vi.fn()
}))
vi.mock('./map-segues', async (original) => ({
  ...(await original<typeof import('./map-segues')>()),
  settledSegues: segued
}))
vi.mock('./storyboard/plan', async (original) => ({
  ...(await original<typeof import('./storyboard/plan')>()),
  planEpisode: planned,
  blueprintIds: () => []
}))
vi.mock('./storyboard/voice', () => ({ prepareEpisodeAudio: voiced }))
vi.mock('./storyboard/shots', () => ({
  designSceneShots: vi.fn(),
  buildFiles: () => []
}))
vi.mock('./storyboard/frames', () => ({
  buildFrame: built,
  writeFramePackets: async () => []
}))
vi.mock('./storyboard/stills-stage', () => ({ stillsStage: posed }))
vi.mock('./storyboard/assemble', () => ({
  assembleEpisode: async () => {},
  checkEpisode: vi.fn(),
  episodeSheet: async () => null,
  episodePoster: async () => null,
  renderEpisode: rendered
}))

const { writeRow } = await import('./persistence')
const { changeProject, loadProject } = await import('./projects')
const { planSummary, writeInternal } = await import('./storyboard/state')
const { scheduleStoryboard, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const {
  approveStoryboard,
  remakeStoryboard,
  replanStoryboard,
  retryStoryboard,
  stopStoryboard
} = await import('./storyboard/actions')
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
  segued.mockReset()
  segued.mockResolvedValue(undefined)
  planned.mockResolvedValue({
    plan,
    length: { min: 10, max: 60, strict: false },
    brief: '# Brief\n'
  })
  posed.mockResolvedValue('stop')
})

it('says when its lines changed while the first plan was made, never stale, and plans again when asked (F04)', async () => {
  await seed('mid-plan', {})
  // The episode's segue lands while the planner works on the old lines.
  planned.mockImplementationOnce(async () => {
    await rewrite('mid-plan', 'The new outro.')
    return { plan, length: { min: 10, max: 60, strict: false }, brief: '#\n' }
  })
  scheduleStoryboard('mid-plan')
  await settledStoryboard('mid-plan')
  const board = await stored('mid-plan')
  expect([board.stage, board.status, board.stale, board.replan]).toEqual([
    'review',
    'waiting',
    undefined,
    true
  ])
  // No paid run started by itself: the page says why and offers Plan again.
  expect(heard()).toEqual(['The first outro.'])
  const page = await screen('mid-plan')
  expect(page).toContain('The wireframes changed.')
  expect(page).not.toMatch(/Approve the plan|Changed since|previous cut/)
  expect(await header('mid-plan')).toMatch(
    /data-action="sb-replan"[^>]*>Plan again</
  )
  await expect(approveStoryboard('mid-plan', {})).rejects.toThrow(/plan again/)
  await replanStoryboard('mid-plan')
  await settledStoryboard('mid-plan')
  expect(heard()).toEqual(['The first outro.', 'The new outro.'])
  expect((await stored('mid-plan')).replan).toBeUndefined()
  expect(await header('mid-plan')).toContain('Approve the plan')
})

it('marks a plan waiting for approval when its lines change, and starts nothing by itself (F04)', async () => {
  await seed('waiting-plan', {
    stage: 'review',
    status: 'waiting',
    waitingFor: 'approval',
    plan: planSummary({ plan })
  })
  const changed = await rewrite('waiting-plan', 'The new outro.')
  const board = changed.project.video!.storyboard!
  expect([board.stage, board.status, board.stale, board.replan]).toEqual([
    'review',
    'waiting',
    undefined,
    true
  ])
  await settledStoryboard('waiting-plan')
  expect(planned).not.toHaveBeenCalled()
  await replanStoryboard('waiting-plan')
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

it('plans a stale production again with a note from the wireframes as they are, and lets that plan be approved (round 2)', async () => {
  await seed('stale-note', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval',
    approved: true,
    plan: planSummary({ plan })
  })
  await rewrite('stale-note', 'The new outro.')
  expect((await stored('stale-note')).stale).toBe(true)
  await approveStoryboard('stale-note', { note: 'Open on the numbers' })
  await settledStoryboard('stale-note')
  expect(heard()).toEqual(['The new outro.'])
  const board = await stored('stale-note')
  expect([board.stage, board.status, board.stale]).toEqual([
    'review',
    'waiting',
    undefined
  ])
  await approveStoryboard('stale-note', {})
  expect((await stored('stale-note')).stage).toBe('stills')
})

it('is no longer stale once its lines are put back as they were, by an Undo (F15, round 3)', async () => {
  await seed('put-back', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval',
    approved: true,
    plan: planSummary({ plan })
  })
  await rewrite('put-back', 'A line a reorder wrote.')
  expect((await stored('put-back')).stale).toBe(true)
  // Another change keeps it stale; the lines it was made from clear it.
  await rewrite('put-back', 'Another line.')
  expect((await stored('put-back')).stale).toBe(true)
  await rewrite('put-back', 'The first outro.')
  const board = await stored('put-back')
  expect([board.stale, board.replan]).toEqual([undefined, undefined])
  await approveStoryboard('put-back', {})
  expect((await stored('put-back')).stage).toBe('voice')
})

it('stops at once while the first plan waits for its segues (F11, round 2)', async () => {
  await seed('segue-stop', {})
  // The episode's segues are still being written, and take long.
  segued.mockReturnValue(new Promise(() => {}))
  scheduleStoryboard('segue-stop')
  await new Promise((resolve) => setTimeout(resolve, 300))
  await stopStoryboard('segue-stop')
  const settled = await Promise.race([
    settledStoryboard('segue-stop').then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2000))
  ])
  expect(settled).toBe(true)
  const board = await stored('segue-stop')
  expect([board.status, board.error, board.stopping]).toEqual([
    'failed',
    generationStops.user,
    undefined
  ])
  expect(planned).not.toHaveBeenCalled()
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
  // The page says what the stop kept and what Try again makes (round 2),
  // and so does the activity (round 3).
  expect(await screen('stop')).toContain(
    'Stopped before any still was posed. Try again poses all 2.'
  )
  expect((await loadProject('stop'))!.events.at(-1)?.message).toBe(
    'Stopped before any still was posed. Try again poses all 2.'
  )
  // A note on a still not posed yet is counted once, with the others.
  await changeProject('stop', (snapshot) => {
    const kept = snapshot.project.video!.storyboard!
    kept.plan!.scenes[0].frames[0].still = 'now'
    kept.frameNotes = { 2: 'Left' }
  })
  expect(await screen('stop')).toContain(
    'Stopped with 1 of 2 stills posed, all kept. Try again poses the other 1.'
  )
  await changeProject('stop', (snapshot) => {
    const kept = snapshot.project.video!.storyboard!
    kept.plan!.scenes[0].frames[0].still = 'now'
    kept.frameNotes = { 1: 'Bigger' }
  })
  expect(await screen('stop')).toContain(
    'Stopped with 1 of 2 stills posed, all kept. Try again poses the other 1 and 1 again with your note.'
  )
  await retryStoryboard('stop')
  expect((await stored('stop')).status).toBe('working')
  await settledStoryboard('stop')
  expect(posed).toHaveBeenCalledTimes(2)
})

it('stops while the voice is recorded, and says so (F11, round 3)', async () => {
  await seed('voice-stop', {
    stage: 'voice',
    status: 'working',
    approved: true,
    plan: planSummary({ plan })
  })
  await writeInternal(storyboardDir('voice-stop', await stored('voice-stop')), {
    plan,
    statuses: {},
    problems: {},
    rounds: 0,
    voiced: []
  })
  // The creator presses Stop between two lines.
  voiced.mockImplementationOnce(
    async (input: { stopped?: () => Promise<boolean> }) => {
      await stopStoryboard('voice-stop')
      if (await input.stopped?.())
        throw new Error('Stopped while the voice was recorded')
      // Not told of the stop, the voice would finish every line.
      return {
        meta: { bgm: null, bgm_pending: false, voices: [], sfx: [] },
        durations: { 1: 3, 2: 3 },
        media: {}
      }
    }
  )
  scheduleStoryboard('voice-stop')
  await settledStoryboard('voice-stop')
  const board = await stored('voice-stop')
  expect([board.stage, board.status, board.stopping]).toEqual([
    'voice',
    'failed',
    undefined
  ])
  expect(await screen('voice-stop')).toContain(
    'Stopped while the voice was recorded. The stills are kept; Try again records the voice.'
  )
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

it('clears a stop once the production leaves working, and stops the render at once (F11)', async () => {
  await seed('render', {
    stage: 'render',
    status: 'working',
    approved: true,
    plan: planSummary({ plan })
  })
  // The render ends when its signal is aborted, as Hyperframes' does.
  rendered.mockImplementationOnce(
    (_dir: string, signal: AbortSignal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
  )
  scheduleStoryboard('render')
  await vi.waitFor(() => expect(rendered).toHaveBeenCalled())
  await stopStoryboard('render')
  await settledStoryboard('render')
  const board = await stored('render')
  expect([board.status, board.error, board.stopping]).toEqual([
    'failed',
    generationStops.user,
    undefined
  ])
  // A stop that lands as a stage finishes never stays set.
  await changeProject('render', (snapshot) => {
    Object.assign(snapshot.project.video!.storyboard!, {
      status: 'working',
      stopping: true
    })
  })
  const { update } = await import('./storyboard/run')
  await update('render', (storyboard) => {
    storyboard.status = 'done'
  })
  expect((await stored('render')).stopping).toBeUndefined()
})

it('gives a frame stopped by the creator no finding to fix on its next try (F11)', async () => {
  await seed('frames-stop', {
    stage: 'frames',
    status: 'working',
    approved: true,
    plan: planSummary({ plan })
  })
  // Voiced and shot, ready for its frames to be built.
  const shot = (number: number) => ({
    number,
    blueprint: 'compose',
    focal: 'The key',
    roles: 'One focal point',
    windows: []
  })
  await writeInternal(
    storyboardDir('frames-stop', await stored('frames-stop')),
    {
      plan,
      statuses: {},
      problems: {},
      rounds: 0,
      voiced: ['p1'],
      durations: { 1: 3, 2: 3 },
      shots: { 1: shot(1), 2: shot(2) }
    }
  )
  let release = () => {}
  const stopped = new Promise<void>((resolve) => (release = resolve))
  built.mockImplementation(async () => {
    await stopped
    throw new Error('The engine run was interrupted')
  })
  scheduleStoryboard('frames-stop')
  await vi.waitFor(() => expect(built).toHaveBeenCalled())
  await stopStoryboard('frames-stop')
  release()
  await settledStoryboard('frames-stop')
  // The board says Stopped once; no frame says it again, or shows an error.
  const frames = (await stored('frames-stop')).plan!.scenes[0].frames
  expect(frames.map((entry) => [entry.status, entry.problem])).toEqual([
    ['outline', undefined],
    ['outline', undefined]
  ])
  built.mockReset()
  built.mockResolvedValue(undefined)
  await retryStoryboard('frames-stop')
  await settledStoryboard('frames-stop')
  for (const [input] of built.mock.calls)
    expect((input as { findings?: string[] }).findings).toBeUndefined()
})

it('builds a frame that failed again with what its last try found, and it reads as being built meanwhile (round 2)', async () => {
  const failed = {
    statuses: { 1: 'failed', 2: 'animated' } as const,
    problems: { 1: ['Text runs off the frame'] }
  }
  await seed('frames-again', {
    stage: 'frames',
    status: 'working',
    approved: true,
    plan: planSummary({ plan, ...failed })
  })
  const shot = (number: number) => ({
    number,
    blueprint: 'compose',
    focal: 'The key',
    roles: 'One focal point',
    windows: []
  })
  await writeInternal(
    storyboardDir('frames-again', await stored('frames-again')),
    {
      plan,
      ...failed,
      rounds: 0,
      voiced: ['p1'],
      durations: { 1: 3, 2: 3 },
      shots: { 1: shot(1), 2: shot(2) }
    }
  )
  const during: unknown[] = []
  built.mockReset()
  built.mockImplementation(
    async (input: { number: number; findings?: string[] }) => {
      const now = (await stored('frames-again')).plan!.scenes[0].frames.find(
        (entry) => entry.number === input.number
      )!
      during.push([input.findings, now.status, now.problem])
    }
  )
  scheduleStoryboard('frames-again')
  await settledStoryboard('frames-again')
  expect(during).toEqual([[['Text runs off the frame'], 'outline', undefined]])
})

it('offers Remake, not Try again, on a stopped production that went stale, and Stop beside Remake while it works (F04, F11)', async () => {
  await seed('stale-stop', {
    stage: 'stills',
    status: 'failed',
    error: generationStops.user,
    approved: true,
    plan: planSummary({ plan })
  })
  await rewrite('stale-stop', 'The new outro.')
  const page = await screen('stale-stop')
  expect(page).toContain('Changed since the plan.')
  expect(page).not.toMatch(/data-action="sb-retry"|Try again continues/)
  await changeProject('stale-stop', (snapshot) => {
    snapshot.project.video!.storyboard!.status = 'working'
  })
  const top = await header('stale-stop')
  expect(top).toMatch(/data-action="sb-stop"[^>]*>Stop</)
  expect(top).toMatch(/data-action="sb-remake"/)
  // Remake stops what is at work first, then plans afresh.
  await remakeStoryboard('stale-stop')
  await settledStoryboard('stale-stop')
  expect((await stored('stale-stop')).stale).toBeUndefined()
})
