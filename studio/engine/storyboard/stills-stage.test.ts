import { existsSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../../shared/api'
import type {
  EpisodePlan,
  PlanFrame,
  Storyboard
} from '../../shared/storyboard'
import type { Internal } from './state'

// The agents are stand-ins: these checks prove the stills step's plumbing
// (approval, notes, rounds), never what a model poses.
const { pose, schedule } = vi.hoisted(() => ({
  pose: vi.fn(),
  schedule: vi.fn()
}))
vi.mock('./stills', () => ({
  poseFrame: pose,
  sceneStandIn: async () => undefined
}))
vi.mock('./frames', () => ({ writeFramePackets: async () => [] }))
vi.mock('./pipeline', () => ({
  scheduleStoryboard: schedule,
  storyboardDir: () => ''
}))

const { writeRow } = await import('../persistence')
const { changeProject, loadProject } = await import('../projects')
const { planSummary } = await import('./state')
const { stillsStage } = await import('./stills-stage')
const { approveStoryboard, noteStoryboardFrame } = await import('./actions')

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
  message: 'A request has a timer; a stream does not',
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
    },
    {
      pageId: 'p2',
      build: 'faceless',
      buildReason: 'It explains',
      frames: [frame(3), frame(4)]
    }
  ]
}

const seed = async (id: string, change: Partial<Storyboard>) => {
  const storyboard: Storyboard = {
    id: 'sb-test',
    pages: ['p1', 'p2'],
    stage: 'stills',
    status: 'working',
    approved: true,
    plan: planSummary({ plan }),
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...change
  }
  const snapshot = {
    project: {
      id,
      title: 'Fixture',
      source: 'Fixture',
      harness: { adapter: 'claude-code' },
      slides: ['p1', 'p2'].map((page) => ({
        id: page,
        title: `Page ${page}`,
        svg: `<svg id="${page}"></svg>`
      })),
      video: {
        settings: {
          presence: 'high',
          voice: { kind: 'ai', id: 'v' },
          production: 'storyboard'
        },
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: null,
        storyboard
      }
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot
  await writeRow('projects', id, snapshot)
}

const stored = async (id: string) =>
  (await loadProject(id))!.project.video!.storyboard!

const setStoryboard = (id: string, change: Partial<Storyboard>) =>
  changeProject(id, (snapshot) => {
    Object.assign(snapshot.project.video!.storyboard!, change)
  })

it('approves the plan into stills and the stills into the video; a note poses one frame again', async () => {
  await seed('approvals', {
    stage: 'review',
    status: 'waiting',
    waitingFor: 'approval',
    approved: undefined
  })
  await approveStoryboard('approvals', {})
  let value = await stored('approvals')
  expect([value.stage, value.status, value.approved]).toEqual([
    'stills',
    'working',
    true
  ])
  expect(schedule).toHaveBeenCalledTimes(1)
  await expect(
    noteStoryboardFrame('approvals', 2, { note: '   ' })
  ).rejects.toThrow(/Say what to change/)
  // While stills are posed, a note waits for the next round.
  await noteStoryboardFrame('approvals', 3, { note: 'Put the number left' })
  expect(schedule).toHaveBeenCalledTimes(1)
  await setStoryboard('approvals', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval'
  })
  await noteStoryboardFrame('approvals', 2, { note: 'Make it  bigger' })
  value = await stored('approvals')
  expect(value.frameNotes).toEqual({
    2: 'Make it bigger',
    3: 'Put the number left'
  })
  expect([value.stage, value.status, value.waitingFor]).toEqual([
    'stills',
    'working',
    undefined
  ])
  expect(schedule).toHaveBeenCalledTimes(2)
  await setStoryboard('approvals', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval',
    frameNotes: undefined
  })
  await approveStoryboard('approvals', {})
  expect((await stored('approvals')).stage).toBe('voice')
  await expect(
    noteStoryboardFrame('approvals', 2, { note: 'Too late' })
  ).rejects.toThrow(/before you approve the stills/)
  // A change asked of the board plans again, and waits for approval again.
  await setStoryboard('approvals', {
    stage: 'board',
    status: 'waiting',
    waitingFor: 'approval',
    frameNotes: { 4: 'Smaller' }
  })
  await approveStoryboard('approvals', { note: 'Open on the numbers' })
  value = await stored('approvals')
  expect([value.stage, value.note, value.approved, value.frameNotes]).toEqual([
    'plan',
    'Open on the numbers',
    undefined,
    undefined
  ])
})

it('poses every frame, keeps a failed one for a retry, then takes notes round by round', async () => {
  await seed('stills', {})
  const dir = await mkdtemp(join(tmpdir(), 'stills-stage-'))
  const internal: Internal = { plan }
  const run = async () => {
    const snapshot = (await loadProject('stills'))!
    return stillsStage({
      snapshot,
      storyboard: snapshot.project.video!.storyboard!,
      dir,
      internal
    })
  }
  type PoseInput = {
    number: number
    note?: string
    onAccepted: () => Promise<void>
  }
  pose.mockImplementation(async (input: PoseInput) => {
    if (input.number === 3) throw new Error('The still was not posed')
    await input.onAccepted()
  })
  await expect(run()).rejects.toThrow('1 still could not be posed: 3')
  expect(internal.statuses).toEqual({
    1: 'built',
    2: 'built',
    3: 'failed',
    4: 'built'
  })
  let value = await stored('stills')
  expect(value.stage).toBe('stills')
  const frames = value.plan!.scenes.flatMap((scene) => scene.frames)
  expect(frames.map((entry) => Boolean(entry.still))).toEqual([
    true,
    true,
    false,
    true
  ])
  expect(frames[2].problem).toBe('The still was not posed')
  // The board is written with every frame, its stills landing beside it.
  const board = await readFile(join(dir, 'boards', 'storyboard.html'), 'utf8')
  expect(board.match(/class="frame"/g)).toHaveLength(4)
  expect(existsSync(join(dir, 'STORYBOARD.md'))).toBe(true)
  // Tried again: only the frame that failed is posed, and while it is it
  // reads as being posed, its old error gone (round 2).
  pose.mockReset()
  const during: unknown[] = []
  pose.mockImplementation(async (input: PoseInput) => {
    const now = (await stored('stills'))
      .plan!.scenes.flatMap((scene) => scene.frames)
      .find((entry) => entry.number === input.number)!
    during.push([now.status, now.problem])
    return input.onAccepted()
  })
  await run()
  expect(pose.mock.calls.map(([input]) => input.number)).toEqual([3])
  expect(during).toEqual([['outline', undefined]])
  value = await stored('stills')
  expect([value.stage, value.status, value.waitingFor]).toEqual([
    'board',
    'waiting',
    'approval'
  ])
  expect((await loadProject('stills'))!.events.at(-1)?.message).toBe(
    'The stills are ready: 4 frames'
  )
  expect(await readFile(join(dir, 'STORYBOARD.md'), 'utf8')).toMatch(
    /- status: built/
  )
  // A note poses its frame again; a note that comes in meanwhile waits for
  // the next round, and the board waits until it is done.
  await setStoryboard('stills', {
    stage: 'stills',
    status: 'working',
    waitingFor: undefined,
    frameNotes: { 2: 'Make it bigger' }
  })
  pose.mockReset()
  pose.mockImplementation(async (input: PoseInput) => {
    if (input.number === 2)
      await setStoryboard('stills', {
        frameNotes: { 2: 'Make it bigger', 4: 'Put the number left' }
      })
    await input.onAccepted()
  })
  await run()
  expect(pose.mock.calls.map(([input]) => [input.number, input.note])).toEqual([
    [2, 'Make it bigger']
  ])
  value = await stored('stills')
  expect(value.frameNotes).toEqual({ 4: 'Put the number left' })
  expect(value.stage).toBe('stills')
  pose.mockClear()
  await run()
  expect(pose.mock.calls.map(([input]) => [input.number, input.note])).toEqual([
    [4, 'Put the number left']
  ])
  value = await stored('stills')
  expect([value.stage, value.frameNotes]).toEqual(['board', undefined])
  expect((await loadProject('stills'))!.events.at(-1)?.message).toBe(
    'Posed again with your note: frame 4'
  )
})

it('leaves the stills it did not reach alone when the creator stops, with no error under a frame it cut short (review 8 F11)', async () => {
  await seed('stop-stills', {})
  const dir = await mkdtemp(join(tmpdir(), 'stills-stop-'))
  const internal: Internal = { plan }
  const snapshot = (await loadProject('stop-stills'))!
  process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY = '1'
  try {
    pose.mockReset()
    pose.mockImplementation(
      async (input: { number: number; onAccepted: () => Promise<void> }) => {
        if (input.number === 1) return input.onAccepted()
        // Frame 2 is at work when the creator presses Stop.
        await setStoryboard('stop-stills', { stopping: true })
        throw new Error('The engine run was interrupted')
      }
    )
    await expect(
      stillsStage({
        snapshot,
        storyboard: snapshot.project.video!.storyboard!,
        dir,
        internal
      })
    ).rejects.toThrow(/could not be posed/)
  } finally {
    delete process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY
  }
  expect(pose.mock.calls.map(([input]) => input.number)).toEqual([1, 2])
  expect(internal.statuses).toEqual({ 1: 'built' })
  const frames = (await stored('stop-stills')).plan!.scenes.flatMap(
    (scene) => scene.frames
  )
  expect(frames.map((entry) => [entry.status, entry.problem])).toEqual([
    ['built', undefined],
    ['outline', undefined],
    ['outline', undefined],
    ['outline', undefined]
  ])
})
