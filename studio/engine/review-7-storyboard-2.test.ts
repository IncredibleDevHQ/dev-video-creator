import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import {
  type BuildType,
  type EpisodePlan,
  type PlanFrame,
  type Storyboard
} from '../shared/storyboard'
import type { Internal } from './storyboard/state'

// Review 7's second look at the storyboard production: productions waiting
// for takes from before the fix, a first take on a voiced scene, and a build
// change after a failed plan. The agents, the voice and Hyperframes are
// stand-ins: these checks prove the plumbing, never what a model makes.
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

const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { planSummary, writeInternal } = await import('./storyboard/state')
const { missingTakes, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const { saveStoryboardTake, setStoryboardBuild, showTakeSlots } =
  await import('./storyboard/actions')

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
