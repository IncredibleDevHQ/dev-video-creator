import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import {
  frameId,
  type BuildType,
  type EpisodePlan,
  type PlanFrame,
  type Storyboard
} from '../shared/storyboard'
import type { Internal } from './storyboard/state'

// Review 7's second look at the storyboard production: productions waiting
// for takes from before the fix, a first take on a voiced scene, and a build
// change after a failed plan; then its eighth recheck: shots lanes that stop
// together, a take that lands while the voice decides, a scene with nothing
// to say, a capture not made yet, sound alone for a camera scene, the check's
// rounds after a transition change, and one build line a scene. The agents,
// the voice and Hyperframes are stand-ins: these checks prove the plumbing,
// never what a model makes.
const { planned, voiced, designed, built, checked, rendered, posed, hooks } =
  vi.hoisted(() => ({
    planned: vi.fn(),
    voiced: vi.fn(),
    designed: vi.fn(),
    built: vi.fn(),
    checked: vi.fn(),
    rendered: vi.fn(),
    posed: vi.fn(),
    hooks: { workspace: null as null | (() => Promise<unknown>) }
  }))
vi.mock('./storyboard/plan', async (original) => ({
  ...(await original<typeof import('./storyboard/plan')>()),
  planEpisode: planned,
  blueprintIds: () => []
}))
vi.mock('./storyboard/voice', () => ({ prepareEpisodeAudio: voiced }))
vi.mock('./storyboard/shots', () => ({
  designSceneShots: designed,
  buildFiles: () => []
}))
vi.mock('./storyboard/frames', () => ({
  buildFrame: built,
  writeFramePackets: async () => []
}))
vi.mock('./storyboard/stills-stage', () => ({ stillsStage: posed }))
vi.mock('./storyboard/assemble', () => ({
  assembleEpisode: async () => {},
  checkEpisode: checked,
  episodeSheet: async () => null,
  episodePoster: async () => null,
  renderEpisode: rendered
}))
// The real folder, with a hook first: a click that lands between two steps.
vi.mock('./storyboard/workspace', async (original) => {
  const real = await original<typeof import('./storyboard/workspace')>()
  return {
    ...real,
    createWorkspace: async (
      input: Parameters<typeof real.createWorkspace>[0]
    ) => {
      const hook = hooks.workspace
      hooks.workspace = null
      await hook?.()
      return real.createWorkspace(input)
    }
  }
})
vi.mock('./voice', async (original) => ({
  ...(await original<typeof import('./voice')>()),
  probeSeconds: async () => 4
}))

const { storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { planSummary, readInternal, writeInternal } =
  await import('./storyboard/state')
const { missingTakes, scheduleStoryboard, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const {
  retryStoryboard,
  saveStoryboardTake,
  setStoryboardBuild,
  setStoryboardTransition,
  showTakeSlots
} = await import('./storyboard/actions')
const { planPages } = await import('./storyboard/plan')
const { runCommand } = await import('./voice')

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

// Scene 1 explains with no face; scene 2 is the creator on camera.
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
      build: 'camera',
      buildReason: 'It is a verdict',
      frames: [frame(3), frame(4)]
    }
  ]
}

const shot = (number: number) => ({
  number,
  blueprint: 'compose',
  focal: 'The number',
  roles: 'One focal point',
  windows: []
})

// A production made in full: every scene voiced, every frame built.
const made = (change: Internal = {}): Internal => ({
  plan,
  statuses: { 1: 'animated', 2: 'animated', 3: 'animated', 4: 'animated' },
  problems: {},
  rounds: 0,
  voiced: ['p1', 'p2'],
  durations: { 1: 3, 2: 3, 3: 3, 4: 3 },
  shots: { 1: shot(1), 2: shot(2), 3: shot(3), 4: shot(4) },
  ...change
})

const seed = async (
  id: string,
  options: {
    storyboard?: Partial<Storyboard>
    internal?: Internal
    record?: boolean
    slides?: Record<string, object>
  } = {}
) => {
  const storyboard: Storyboard = {
    id: `sb-${id}`,
    pages: ['p1', 'p2'],
    stage: 'review',
    status: 'waiting',
    waitingFor: 'approval',
    plan: planSummary({ plan }),
    updatedAt: '2026-10-16T00:00:00.000Z',
    ...options.storyboard
  }
  const snapshot = {
    project: {
      id,
      title: 'Fixture',
      source: 'Fixture',
      harness: { adapter: 'claude-code' },
      slides: ['p1', 'p2', 'p3'].map((page) => ({
        id: page,
        title: `Page ${page}`,
        svg: `<svg id="${page}"></svg>`,
        narration: `What page ${page} says.`,
        ...options.slides?.[page]
      })),
      video: {
        settings: {
          presence: 'high',
          voice: options.record
            ? { kind: 'record' }
            : { kind: 'ai', id: 'default' },
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
  // Its Hyperframes project is made already: no CLI runs.
  const dir = storyboardDir(id, storyboard)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'frame.md'), '# Frame\n')
  if (options.internal) await writeInternal(dir, options.internal)
  return dir
}

const keyOf = async (id: string, body: string) =>
  (
    await storeAsset({
      body: Buffer.from(body),
      contentType: 'video/webm',
      kind: 'storyboard-take',
      extension: '.webm',
      projectId: id
    })
  ).objectKey

const stored = async (id: string) =>
  (await loadProject(id))!.project.video!.storyboard!
type Audio = { frames: PlanFrame[]; takes: Record<string, string> }
// Each voice pass: the takes it was given, as it heard them.
const heard: Record<string, string>[] = []
const listen = async (input: Audio) => {
  const takes = Object.entries(input.takes)
  heard.push(
    Object.fromEntries(
      await Promise.all(
        takes.map(async ([page, path]) => [page, await readFile(path, 'utf8')])
      )
    )
  )
  return {
    meta: { bgm: null, bgm_pending: false, voices: [], sfx: [] },
    durations: Object.fromEntries(
      input.frames.map((entry) => [entry.number, entry.duration])
    ),
    media: {}
  }
}

beforeEach(() => {
  for (const stand of [planned, voiced, designed, built, checked, rendered])
    stand.mockReset()
  posed.mockReset()
  heard.length = 0
  hooks.workspace = null
  planned.mockImplementation(
    async (input: { builds?: Record<string, BuildType> }) => ({
      plan: {
        ...plan,
        scenes: plan.scenes.map((scene) => ({
          ...scene,
          build: input.builds?.[scene.pageId] ?? scene.build
        }))
      },
      length: { min: 10, max: 60, strict: false },
      brief: '# Brief\n'
    })
  )
  voiced.mockImplementation(listen)
  designed.mockImplementation(
    async (input: { plan: EpisodePlan; sceneIndex: number }) =>
      input.plan.scenes[input.sceneIndex].frames.map((entry) =>
        shot(entry.number)
      )
  )
  built.mockImplementation(
    async (input: { onAccepted?: () => Promise<void> }) => input.onAccepted?.()
  )
  checked.mockResolvedValue({ byFrame: {}, other: [], warnings: [] })
  rendered.mockImplementation(async (dir: string) => {
    await mkdir(join(dir, 'renders'), { recursive: true })
    await writeFile(join(dir, 'renders', 'video.mp4'), 'mp4')
    return join(dir, 'renders', 'video.mp4')
  })
  // The stills would wait for the creator's go.
  posed.mockResolvedValue('stop')
})

it('gives a production that waited for takes before the fix its take places at start-up', async () => {
  // Saved by the earlier code: the creator records, but only the camera
  // scene had a place for its take, so nothing offered Record on scene 1.
  await seed('old-wait', {
    record: true,
    storyboard: {
      stage: 'voice',
      status: 'waiting',
      waitingFor: 'takes',
      approved: true,
      plan: planSummary(made({ voiced: [] }))
    },
    internal: made({ voiced: [] })
  })
  expect((await stored('old-wait')).plan!.scenes[0].take).toBeUndefined()
  await showTakeSlots((await loadProject('old-wait'))!)
  const value = await stored('old-wait')
  expect(value.plan!.scenes.map((scene) => scene.take)).toEqual([null, null])
  expect(missingTakes(value, true)).toEqual(['p1', 'p2'])
})

it('voices a scene again from its first take when it was voiced before the creator chose to record', async () => {
  // Voiced with the AI voice, then the voice became the creator's: scene 1
  // now waits for a take while the frames are built.
  await seed('first-take', {
    record: true,
    storyboard: {
      stage: 'frames',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(made(), {}, true)
    },
    internal: made()
  })
  await saveStoryboardTake(
    'first-take',
    'p1',
    Buffer.from('take'),
    'video/webm'
  )
  const value = await stored('first-take')
  expect(value.redo).toEqual(['p1'])
  expect(value.plan!.scenes[0].take?.duration).toBe(4)
})

it('keeps the change the creator asked for when a build changes after a failed plan', async () => {
  await seed('kept-note', {
    storyboard: {
      stage: 'plan',
      status: 'failed',
      waitingFor: undefined,
      note: 'Merge scenes 1 and 2',
      error: 'The planner stopped'
    }
  })
  const value = (await setStoryboardBuild('kept-note', 'p1', 'motion')).project
    .video!.storyboard!
  expect(value.note).toContain('Merge scenes 1 and 2')
  expect(value.note).toContain('Build the scene for “Page p1”')
  await settledStoryboard('kept-note')
  // The planner was asked for both.
  const asked = planned.mock.calls.map(([input]) => input.note)
  expect(asked[0]).toContain('Merge scenes 1 and 2')
  expect(asked[0]).toContain('Page p1')
})

it('carries on at start-up when the voice stopped being the creator’s while it waited for takes', async () => {
  // Waiting for scene 1's take, saved by the earlier code; then the voice
  // became an AI voice, so no scene waits for a take any more.
  const take = { objectKey: await keyOf('no-wait', 'camera'), duration: 4 }
  await seed('no-wait', {
    storyboard: {
      stage: 'voice',
      status: 'waiting',
      waitingFor: 'takes',
      approved: true,
      plan: planSummary(made({ voiced: [] }), { p2: take }, true)
    },
    internal: made({ voiced: [] })
  })
  expect((await stored('no-wait')).plan!.scenes[0].take).toBeNull()
  await showTakeSlots((await loadProject('no-wait'))!)
  await settledStoryboard('no-wait')
  const value = await stored('no-wait')
  // Not stuck: it went on and made the video.
  expect([value.stage, value.status, value.waitingFor]).toEqual([
    'done',
    'done',
    undefined
  ])
})

it('voices a first take that came in while the frames were built before the episode is put together', async () => {
  // Voiced with the AI voice, then the creator chose to record: both
  // scenes' takes come in while the frames are being built.
  await seed('mid-build', {
    record: true,
    storyboard: {
      stage: 'frames',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(made(), {}, true)
    },
    internal: made()
  })
  await saveStoryboardTake('mid-build', 'p1', Buffer.from('one'), 'video/webm')
  await saveStoryboardTake('mid-build', 'p2', Buffer.from('two'), 'video/webm')
  expect((await stored('mid-build')).redo).toEqual(['p1', 'p2'])
  scheduleStoryboard('mid-build')
  await settledStoryboard('mid-build')
  const value = await stored('mid-build')
  expect([value.status, value.redo ?? []]).toEqual(['done', []])
  // Both takes were voiced before the video was made.
  expect(heard.at(-1)).toEqual({ p1: 'one', p2: 'two' })
})

const design = async (input: { plan: EpisodePlan; sceneIndex: number }) =>
  input.plan.scenes[input.sceneIndex].frames.map((entry) => shot(entry.number))

it('stops the shots once every lane has, keeping what a lane still at work designed', async () => {
  const dir = await seed('lanes', {
    storyboard: {
      stage: 'shots',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(made())
    },
    internal: made({ shots: {}, statuses: {} })
  })
  // Scene 1's agent stops; scene 2's is still at work.
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  designed.mockImplementation(
    async (input: { plan: EpisodePlan; sceneIndex: number }) => {
      if (input.sceneIndex === 0) throw new Error('The shots agent stopped')
      await held
      return design(input)
    }
  )
  scheduleStoryboard('lanes')
  await vi.waitFor(() => expect(designed).toHaveBeenCalledTimes(2))
  // Not stopped while a lane works: Try again can't pay for it twice.
  const early = await Promise.race([
    settledStoryboard('lanes').then(() => 'stopped'),
    new Promise((resolve) => setTimeout(() => resolve('working'), 100))
  ])
  release()
  await settledStoryboard('lanes')
  expect(early).toBe('working')
  const value = await stored('lanes')
  expect([value.stage, value.status]).toEqual(['shots', 'failed'])
  expect(Object.keys((await readInternal(dir)).shots || {})).toEqual(['3', '4'])
  // Try again designs scene 1 alone, and makes the video.
  designed.mockClear()
  designed.mockImplementation(design)
  await retryStoryboard('lanes')
  await settledStoryboard('lanes')
  expect(designed.mock.calls.map(([input]) => input.sceneIndex)).toEqual([0])
  expect((await stored('lanes')).status).toBe('done')
})

it('voices a take that came in while the voice stage decided whether to wait', async () => {
  // Scene 1 is voiced and built; scene 2, on camera, waits for its take.
  const internal = made({
    voiced: ['p1'],
    statuses: { 1: 'animated', 2: 'animated' },
    shots: { 1: shot(1), 2: shot(2) },
    durations: { 1: 3, 2: 3 }
  })
  await seed('late-take', {
    storyboard: {
      stage: 'voice',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(internal)
    },
    internal
  })
  // The take lands after the production read the storyboard.
  hooks.workspace = () =>
    saveStoryboardTake('late-take', 'p2', Buffer.from('camera'), 'video/webm')
  scheduleStoryboard('late-take')
  await settledStoryboard('late-take')
  const value = await stored('late-take')
  expect([value.stage, value.status, value.waitingFor]).toEqual([
    'done',
    'done',
    undefined
  ])
  expect(heard.at(-1)).toEqual({ p2: 'camera' })
})

it('asks no take of a scene with nothing to say while the creator speaks', async () => {
  const quiet: EpisodePlan = {
    ...plan,
    scenes: [
      plan.scenes[0],
      {
        pageId: 'p2',
        build: 'motion',
        buildReason: 'It shows',
        frames: [frame(3), frame(4)].map((entry) => ({
          ...entry,
          voiceover: ''
        }))
      }
    ]
  }
  const internal = made({ plan: quiet, voiced: [] })
  await seed('quiet', {
    record: true,
    storyboard: {
      stage: 'voice',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(internal, {}, true)
    },
    internal
  })
  // Scene 1 has a place for the creator's take; scene 2 has none to give.
  expect((await stored('quiet')).plan!.scenes.map((s) => s.take)).toEqual([
    null,
    undefined
  ])
  scheduleStoryboard('quiet')
  await settledStoryboard('quiet')
  expect(missingTakes(await stored('quiet'), true)).toEqual(['p1'])
  await saveStoryboardTake('quiet', 'p1', Buffer.from('one'), 'audio/webm')
  await settledStoryboard('quiet')
  const value = await stored('quiet')
  expect([value.stage, value.status]).toEqual(['done', 'done'])
})

it('tells the planner a page has a capture only once one is made', () => {
  const at = '2026-10-16T00:00:00.000Z'
  const capture = (state: string, more: object = {}) => ({
    url: 'https://example.com',
    steps: [],
    state,
    at,
    ...more
  })
  const last = {
    url: 'https://example.com',
    steps: [],
    objectKey: 'demo.mp4',
    seconds: 9,
    at
  }
  const snapshot = {
    project: {
      slides: [
        capture('failed', { error: 'It stopped' }),
        capture('capturing'),
        capture('failed', { last }),
        capture('ready', { objectKey: 'demo.mp4', seconds: 9 })
      ].map((entry, index) => ({
        id: `c${index}`,
        title: `Page ${index}`,
        narration: 'What it says.',
        capture: entry
      }))
    }
  } as unknown as Snapshot
  const pages = planPages(snapshot, ['c0', 'c1', 'c2', 'c3'])
  expect(pages.map((page) => page.capture)).toEqual([false, false, true, true])
})

it('refuses sound alone for a camera scene’s take, and takes it for a spoken one', async () => {
  await seed('sound-only', {
    record: true,
    storyboard: {
      stage: 'voice',
      status: 'waiting',
      waitingFor: 'takes',
      approved: true,
      plan: planSummary(made({ voiced: [] }), {}, true)
    },
    internal: made({ voiced: [] })
  })
  const refused = 'This scene is on camera'
  await expect(
    saveStoryboardTake('sound-only', 'p2', Buffer.from('voice'), 'audio/webm')
  ).rejects.toThrow(refused)
  // Sound alone sent as a video is heard for what it is.
  const dir = await mkdtemp(join(tmpdir(), 'sound-only-'))
  const path = join(dir, 'voice.mp4')
  await runCommand('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1',
    '-c:a',
    'aac',
    path
  ])
  await expect(
    saveStoryboardTake('sound-only', 'p2', await readFile(path), 'video/mp4')
  ).rejects.toThrow(refused)
  await rm(dir, { recursive: true, force: true })
  expect((await stored('sound-only')).plan!.scenes[1].take).toBeNull()
  // The faceless scene, which the creator speaks: their voice is its take.
  await saveStoryboardTake('sound-only', 'p1', Buffer.from('one'), 'audio/webm')
  expect((await stored('sound-only')).plan!.scenes[0].take?.duration).toBe(4)
  await settledStoryboard('sound-only')
})

it('gives the check its rounds afresh when a transition change puts a stopped episode together again', async () => {
  await seed('fresh-rounds', {
    storyboard: {
      stage: 'assemble',
      status: 'failed',
      waitingFor: undefined,
      approved: true,
      error: 'Hyperframes’ check still finds: Text runs off the frame',
      plan: planSummary(made({ rounds: 2 }))
    },
    internal: made({ rounds: 2 })
  })
  checked.mockResolvedValueOnce({
    byFrame: { [frameId(frame(2))]: ['Text runs off the frame'] },
    other: [],
    warnings: []
  })
  await setStoryboardTransition('fresh-rounds', 3, { transition: 'crossfade' })
  await settledStoryboard('fresh-rounds')
  const value = await stored('fresh-rounds')
  expect([value.stage, value.status]).toEqual(['done', 'done'])
  // Frame 2 was built again with what the check found.
  expect(
    built.mock.calls.map(([input]) => [input.number, input.findings])
  ).toEqual([[2, ['Text runs off the frame']]])
})

it('keeps one build line a scene in the change a failed plan still owes', async () => {
  await seed('one-build', {
    storyboard: {
      stage: 'plan',
      status: 'failed',
      waitingFor: undefined,
      note: 'Merge scenes 1 and 2',
      error: 'The planner stopped'
    }
  })
  // Scene 1 as motion: the planner stops again; then on camera instead.
  planned.mockRejectedValueOnce(new Error('The planner stopped'))
  await setStoryboardBuild('one-build', 'p1', 'motion')
  await settledStoryboard('one-build')
  expect((await stored('one-build')).status).toBe('failed')
  const value = (await setStoryboardBuild('one-build', 'p1', 'camera')).project
    .video!.storyboard!
  expect(value.note!.split('\n')).toEqual([
    'Merge scenes 1 and 2',
    'Build the scene for “Page p1” as on camera; keep the rest of the plan.'
  ])
  await settledStoryboard('one-build')
})
