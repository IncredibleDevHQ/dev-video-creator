import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
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

// Review 7, the storyboard production. The agents, the voice and Hyperframes
// are stand-ins: these checks prove the production's plumbing, never what a
// model plans, voices or builds.
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

const { dataRoot, storeAsset, writeRow } = await import('./persistence')
const { changeProject, editSlide, loadProject } = await import('./projects')
const { changeCopies } = await import('./map-episodes')
const { planSummary, readInternal, writeInternal } =
  await import('./storyboard/state')
const { missingTakes, scheduleStoryboard, settledStoryboard, storyboardDir } =
  await import('./storyboard/pipeline')
const {
  retryStoryboard,
  saveStoryboardTake,
  setStoryboardBuild,
  setStoryboardTransition
} = await import('./storyboard/actions')
const { storyboardScreen } = await import('../app/storyboard-view')
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

// Made, with the camera scene's take in.
const madeStoryboard = async (
  id: string,
  change: Partial<Storyboard> = {}
): Promise<Partial<Storyboard>> => ({
  stage: 'done',
  status: 'done',
  waitingFor: undefined,
  approved: true,
  plan: planSummary(made(), {
    p2: { objectKey: await keyOf(id, 'take A'), duration: 4 }
  }),
  ...change
})

const stored = async (id: string) =>
  (await loadProject(id))!.project.video!.storyboard!
const state = async (dir: string) =>
  JSON.parse(
    await readFile(join(dir, '.studio', 'state.json'), 'utf8')
  ) as Internal
const setStoryboard = (id: string, change: Partial<Storyboard>) =>
  changeProject(id, (snapshot) => {
    Object.assign(snapshot.project.video!.storyboard!, change)
  })
const saveTake = (id: string, page: string, body: string) =>
  saveStoryboardTake(id, page, Buffer.from(body), 'video/webm')
const run = async (id: string) => {
  scheduleStoryboard(id)
  await settledStoryboard(id)
}
const screen = async (id: string, scene: number) =>
  storyboardScreen(
    (await loadProject(id))!,
    { projectId: id, scene, frame: null },
    new Recording(
      () => {},
      () => {}
    ),
    null
  )
const transitions = (value: {
  plan?: { scenes: Array<{ frames: Array<{ transition: string }> }> }
}) =>
  value
    .plan!.scenes.flatMap((scene) => scene.frames)
    .map((entry) => entry.transition)

type Audio = { frames: PlanFrame[]; takes: Record<string, string> }
const voicedFrames = () =>
  voiced.mock.calls.map(([input]) =>
    (input as Audio).frames.map((entry) => entry.number)
  )
const builtFrames = () =>
  built.mock.calls.map(([input]) => [input.number, input.findings])

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

// SB-1: a voice the creator records asks for every take it waits for.
it('asks for every scene’s take when the creator records the voice, with Record and Upload on each', async () => {
  await seed('record', {
    record: true,
    storyboard: {
      stage: 'plan',
      status: 'working',
      waitingFor: undefined,
      plan: undefined
    }
  })
  await run('record')
  let value = await stored('record')
  expect([value.stage, value.status]).toEqual(['review', 'waiting'])
  expect(value.plan!.scenes.map((scene) => scene.take)).toEqual([null, null])
  // Approved and posed: the voice waits for both takes, and asks for each.
  await setStoryboard('record', {
    stage: 'voice',
    status: 'working',
    waitingFor: undefined,
    approved: true
  })
  await run('record')
  value = await stored('record')
  expect([value.status, value.waitingFor]).toEqual(['waiting', 'takes'])
  expect(missingTakes(value, true)).toEqual(['p1', 'p2'])
  const html = await screen('record', 0)
  expect(html).toContain('Waiting for your takes')
  expect(html).toContain('data-action="sb-upload" data-page="p1"')
  expect(html).toContain(
    'data-action="sb-record" data-page="p1" class="primary"'
  )
  expect(html).toContain('2 scenes wait for your take')
  // The faceless scene's take voices and builds it; the other keeps its slot.
  await saveTake('record', 'p1', 'take p1')
  await settledStoryboard('record')
  value = await stored('record')
  expect([value.stage, value.status, value.waitingFor]).toEqual([
    'voice',
    'waiting',
    'takes'
  ])
  expect(value.plan!.scenes[0].take).toMatchObject({ duration: 4 })
  expect(value.plan!.scenes[1].take).toBeNull()
  expect(voicedFrames()).toEqual([[1, 2]])
  expect(heard).toEqual([{ p1: 'take p1' }])
})

it('gives every scene a take slot when the voice becomes the creator’s after the plan', async () => {
  await seed('record-later', {
    storyboard: {
      stage: 'plan',
      status: 'working',
      waitingFor: undefined,
      plan: undefined
    }
  })
  await run('record-later')
  // Saved in the notebook settings; then the plan and its stills approved.
  await changeProject('record-later', (snapshot) => {
    snapshot.project.video!.settings.voice = { kind: 'record' }
    Object.assign(snapshot.project.video!.storyboard!, {
      stage: 'voice',
      status: 'working',
      waitingFor: undefined,
      approved: true
    })
  })
  await run('record-later')
  const value = await stored('record-later')
  expect([value.status, value.waitingFor]).toEqual(['waiting', 'takes'])
  expect(missingTakes(value, true)).toEqual(['p1', 'p2'])
  expect(value.plan!.scenes.map((scene) => scene.take)).toEqual([null, null])
  expect(await screen('record-later', 0)).toContain(
    'data-action="sb-record" data-page="p1"'
  )
})

it('drops the take slot of a scene that no longer needs a take when the plan is made again', async () => {
  // An AI voice: the camera scene, made faceless, needs no take.
  await seed('stale-slot')
  await setStoryboardBuild('stale-slot', 'p2', 'faceless')
  await settledStoryboard('stale-slot')
  const value = await stored('stale-slot')
  expect(value.plan!.scenes.map((scene) => [scene.build, scene.take])).toEqual([
    ['faceless', undefined],
    ['faceless', undefined]
  ])
  expect(missingTakes(value, false)).toEqual([])
})

// SB-2: Screen demo needs a capture; a failed plan can change a build.
const capture = {
  url: 'https://example.com/app',
  steps: [],
  state: 'ready',
  objectKey: 'demo.mp4',
  seconds: 9,
  at: '2026-10-16T00:00:00.000Z'
}

it('refuses a screen demo for a page with no capture, and offers it only where a capture exists', async () => {
  await seed('screen-demo', { slides: { p2: { capture } } })
  await expect(
    setStoryboardBuild('screen-demo', 'p1', 'screen')
  ).rejects.toThrow('Record a product capture before choosing Screen demo')
  let value = await stored('screen-demo')
  expect([value.stage, value.status, value.builds]).toEqual([
    'review',
    'waiting',
    undefined
  ])
  expect(planned).not.toHaveBeenCalled()
  const first = await screen('screen-demo', 0)
  expect(first).toContain('<select data-sb-build data-page="p1">')
  expect(first).toContain('<option value="motion"')
  expect(first).not.toContain('<option value="screen"')
  expect(await screen('screen-demo', 1)).toContain('<option value="screen"')
  // Captured, it is taken, and the plan is made again around it.
  await setStoryboardBuild('screen-demo', 'p2', 'screen')
  await settledStoryboard('screen-demo')
  value = await stored('screen-demo')
  expect([value.stage, value.status, value.builds]).toEqual([
    'review',
    'waiting',
    { p2: 'screen' }
  ])
  expect(value.plan!.scenes[1].build).toBe('screen')
})

it('lets a scene’s build change while the plan stage has failed', async () => {
  // Locked as before the fix: Screen demo chosen for a page with no capture.
  await seed('plan-failed', {
    storyboard: {
      stage: 'plan',
      status: 'failed',
      waitingFor: undefined,
      builds: { p1: 'screen' },
      error:
        'Scene 1 (Page p1): no product capture exists for this page, so it cannot be a screen scene'
    }
  })
  await expect(
    setStoryboardBuild('plan-failed', 'p1', 'screen')
  ).rejects.toThrow('Record a product capture')
  const html = await screen('plan-failed', 0)
  expect(html).toContain('<select data-sb-build data-page="p1">')
  expect(html).not.toContain('<option value="screen"')
  const value = (await setStoryboardBuild('plan-failed', 'p1', 'motion'))
    .project.video!.storyboard!
  expect([value.stage, value.status, value.error, value.builds]).toEqual([
    'plan',
    'working',
    undefined,
    { p1: 'motion' }
  ])
  await settledStoryboard('plan-failed')
  const after = await stored('plan-failed')
  expect([after.stage, after.status, after.plan!.scenes[0].build]).toEqual([
    'review',
    'waiting',
    'motion'
  ])
  expect(planned.mock.calls.map(([input]) => input.builds)).toEqual([
    { p1: 'motion' }
  ])
})

// SB-3: refused frames get their rounds of rebuilding again.
it('rebuilds the frames the check refused when Try again follows rounds that ran out', async () => {
  const dir = await seed('rounds-retry', {
    storyboard: await madeStoryboard('rounds-retry', {
      stage: 'assemble',
      status: 'failed',
      error: 'Hyperframes’ check still finds: Text runs off the frame'
    }),
    internal: made({ rounds: 2 })
  })
  checked.mockResolvedValueOnce({
    byFrame: { [frameId(frame(2))]: ['Text runs off the frame'] },
    other: [],
    warnings: []
  })
  await retryStoryboard('rounds-retry')
  await settledStoryboard('rounds-retry')
  expect(builtFrames()).toEqual([[2, ['Text runs off the frame']]])
  expect((await stored('rounds-retry')).status).toBe('done')
  expect((await state(dir)).rounds).toBe(1)
})

it('gives the frames of a remade take their rounds of rebuilding again', async () => {
  const dir = await seed('rounds-take', {
    storyboard: await madeStoryboard('rounds-take', {
      produced: { objectKey: 'old.mp4', duration: 12 }
    }),
    internal: made({ rounds: 2 })
  })
  checked.mockResolvedValueOnce({
    byFrame: { [frameId(frame(3))]: ['The caption covers the face'] },
    other: [],
    warnings: []
  })
  await saveTake('rounds-take', 'p2', 'take B')
  await settledStoryboard('rounds-take')
  expect(heard).toEqual([{ p2: 'take B' }])
  expect(builtFrames()).toEqual([
    [3, undefined],
    [4, undefined],
    [3, ['The caption covers the face']]
  ])
  expect((await stored('rounds-take')).status).toBe('done')
  expect((await state(dir)).rounds).toBe(1)
})

// SB-4: a replaced take is voiced again, never dropped.
it('voices a take replaced while the voice is made again, from the new take', async () => {
  const take = { objectKey: await keyOf('redo-voice', 'take A'), duration: 4 }
  await seed('redo-voice', {
    storyboard: {
      stage: 'voice',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary({ plan }, { p2: take })
    },
    internal: { plan, statuses: {}, problems: {}, rounds: 0 }
  })
  voiced.mockImplementationOnce(async (input: Audio) => {
    const audio = await listen(input)
    await saveTake('redo-voice', 'p2', 'take C')
    return audio
  })
  await run('redo-voice')
  expect(voicedFrames()).toEqual([
    [1, 2, 3, 4],
    [3, 4]
  ])
  expect(heard).toEqual([{ p2: 'take A' }, { p2: 'take C' }])
  const value = await stored('redo-voice')
  expect([value.status, value.redo ?? []]).toEqual(['done', []])
})

it('keeps a take replaced while the voice waits for takes, and voices it when they come', async () => {
  const take = { objectKey: await keyOf('redo-wait', 'take A'), duration: 4 }
  // The creator speaks every scene: scene 1 is made, scene 2 waits.
  const internal = made({
    voiced: ['p1'],
    statuses: { 1: 'animated', 2: 'animated' },
    shots: { 1: shot(1), 2: shot(2) }
  })
  await seed('redo-wait', {
    record: true,
    storyboard: {
      stage: 'voice',
      status: 'working',
      waitingFor: undefined,
      approved: true,
      plan: planSummary(internal, { p1: take, p2: null }, true)
    },
    internal
  })
  hooks.workspace = () => saveTake('redo-wait', 'p1', 'take C')
  await run('redo-wait')
  let value = await stored('redo-wait')
  expect([value.status, value.waitingFor, value.redo]).toEqual([
    'waiting',
    'takes',
    ['p1']
  ])
  await saveTake('redo-wait', 'p2', 'take p2')
  await settledStoryboard('redo-wait')
  expect(voicedFrames()).toEqual([[1, 2, 3, 4]])
  expect(heard).toEqual([{ p1: 'take C', p2: 'take p2' }])
  value = await stored('redo-wait')
  expect([value.status, value.redo ?? []]).toEqual(['done', []])
})

it('goes back to the voice on Try again when a take was replaced after a stop', async () => {
  await seed('redo-retry', {
    storyboard: await madeStoryboard('redo-retry', {
      stage: 'frames',
      status: 'failed',
      error: '1 frame could not be built: 4'
    }),
    internal: made({
      statuses: { 1: 'animated', 2: 'animated', 3: 'animated', 4: 'failed' },
      problems: { 4: ['The worker stopped'] }
    })
  })
  // Replaced while stopped: the stage stays, and the page waits to be made.
  let value = (await saveTake('redo-retry', 'p2', 'take C')).project.video!
    .storyboard!
  expect([value.stage, value.status, value.redo]).toEqual([
    'frames',
    'failed',
    ['p2']
  ])
  value = (await retryStoryboard('redo-retry')).project.video!.storyboard!
  expect([value.stage, value.status]).toEqual(['voice', 'working'])
  await settledStoryboard('redo-retry')
  expect(heard).toEqual([{ p2: 'take C' }])
  expect(builtFrames().map(([number]) => number)).toEqual([3, 4])
  value = await stored('redo-retry')
  expect([value.status, value.redo ?? []]).toEqual(['done', []])
})

it('carries on posing the stills on Try again, though a take was replaced before the voice', async () => {
  const take = { objectKey: await keyOf('redo-stills', 'take A'), duration: 4 }
  await seed('redo-stills', {
    storyboard: {
      stage: 'stills',
      status: 'failed',
      waitingFor: undefined,
      approved: true,
      error: '1 still could not be posed: 2',
      plan: planSummary({ plan }, { p2: take })
    },
    internal: {
      plan,
      statuses: { 1: 'built', 2: 'failed', 3: 'built', 4: 'built' },
      problems: { 2: ['The still was not posed'] },
      rounds: 0
    }
  })
  await saveTake('redo-stills', 'p2', 'take B')
  const value = (await retryStoryboard('redo-stills')).project.video!
    .storyboard!
  await settledStoryboard('redo-stills')
  expect(value.stage).toBe('stills')
  expect(posed).toHaveBeenCalledTimes(1)
  expect(voiced).not.toHaveBeenCalled()
})

// SB-5: one whole write at a time per production; transitions in the queue.
it('writes a production’s state whole and in order, however many write it at once', async () => {
  const dir = join(dataRoot, 'state-probe')
  const states = Array.from({ length: 200 }, (_, index) => ({
    plan,
    rounds: index,
    brief: 'x'.repeat((index * 7919) % 20000)
  }))
  const writes = states.map((internal) => writeInternal(dir, internal))
  let done = false
  const all = Promise.all(writes).finally(() => {
    done = true
  })
  await writes[0]
  // Read while the rest land: never a torn file, never an older state.
  const seen: number[] = []
  while (!done) seen.push((await readInternal(dir)).rounds!)
  await all
  expect(seen).toEqual([...seen].sort((a, b) => a - b))
  expect(await state(dir)).toEqual(states.at(-1))
  expect(await readdir(join(dir, '.studio'))).toEqual(['state.json'])
})

it('lands two quick transition changes on the plan, one after the other', async () => {
  const dir = await seed('two-changes', {
    internal: { plan, statuses: {}, problems: {}, rounds: 0 }
  })
  await Promise.all([
    setStoryboardTransition('two-changes', 2, { transition: 'crossfade' }),
    setStoryboardTransition('two-changes', 3, { transition: 'squeeze' })
  ])
  const expected = ['cut', 'crossfade', 'squeeze', 'cut']
  expect(transitions(await state(dir))).toEqual(expected)
  expect(transitions(await stored('two-changes'))).toEqual(expected)
})

it('refuses a transition change queued behind one that puts the episode together again', async () => {
  const dir = await seed('reassemble', {
    storyboard: await madeStoryboard('reassemble', {
      produced: { objectKey: 'old.mp4', duration: 12 }
    }),
    internal: made()
  })
  const [first, second] = await Promise.allSettled([
    setStoryboardTransition('reassemble', 2, { transition: 'crossfade' }),
    setStoryboardTransition('reassemble', 3, { transition: 'squeeze' })
  ])
  expect(first.status).toBe('fulfilled')
  expect(second).toMatchObject({
    status: 'rejected',
    reason: { message: 'Wait until this step finishes to change a transition' }
  })
  await settledStoryboard('reassemble')
  // Put together again with the first change only, its state whole.
  expect(transitions(await state(dir))).toEqual([
    'cut',
    'crossfade',
    'cut',
    'cut'
  ])
  expect((await stored('reassemble')).status).toBe('done')
})

// SB-7: a page the storyboard is planned from cannot be deleted.
it('refuses to delete or move away a page the storyboard uses, on the Wireframe stage and from the map', async () => {
  const reason = 'This page is used by the storyboard and cannot be deleted'
  await seed('delete')
  await expect(
    editSlide('delete', { action: 'delete', slideId: 'p1' })
  ).rejects.toThrow(reason)
  // A page it does not use still goes.
  const saved = await editSlide('delete', { action: 'delete', slideId: 'p3' })
  expect(saved.project.slides.map((slide) => slide.id)).toEqual(['p1', 'p2'])
  // An episode copied from a map refuses the same in the map's remove.
  await seed('episode')
  await changeProject('episode', (snapshot) => {
    snapshot.project.copyOfMap = 'map'
  })
  await expect(
    changeCopies('episode', { action: 'remove', slide: 'p2' })
  ).rejects.toThrow(reason)
  const episode = (await loadProject('episode'))!
  expect(episode.project.slides.map((slide) => slide.id)).toEqual([
    'p1',
    'p2',
    'p3'
  ])
  expect(episode.deletedSlide).toBeUndefined()
  expect(episode.project.video!.storyboard!.status).toBe('waiting')
  // Nor does it move to another episode of the map, which would take it out.
  await seed('other')
  await changeProject('other', (snapshot) => {
    snapshot.project.copyOfMap = 'map'
    snapshot.project.slides = []
  })
  await expect(
    changeCopies('episode', { action: 'move', slide: 'p2', to: 'other' })
  ).rejects.toThrow('cannot move to another episode')
  expect(
    (await loadProject('episode'))!.project.slides.map((slide) => slide.id)
  ).toEqual(['p1', 'p2', 'p3'])
  expect((await loadProject('other'))!.project.slides).toEqual([])
  // Its pages changed under a plan waiting for approval: it plans again
  // (review 8 F04), and the check waits for that before the store goes.
  await settledStoryboard('other')
})
