// The storyboard production, stage by stage: plan → the creator approves →
// voice (and takes) → shots per scene → one worker per frame → assembly and
// Hyperframes' check (a refused frame is built again with the findings) →
// render. Each stage's outcome is saved before the next starts, so a
// restart resumes where it stopped and never repeats a paid call that
// already succeeded (stage checkpoints).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import type { BuildType, Storyboard } from '../../shared/storyboard'
import { addEvent } from '../activity'
import { readAsset, storeAsset } from '../persistence'
import { changeProject, loadProject } from '../projects'
import { detectedHarness } from '../notebook-intake'
import { resolveVoice } from '../voice-library'
import { probeSeconds } from '../voice'
import { loadSeries } from '../series'
import { createWorkspace, productionDir, stageLogo } from './workspace'
import { blueprintIds, planEpisode, type SeriesContext } from './plan'
import { prepareEpisodeAudio } from './voice'
import { buildFiles, designSceneShots } from './shots'
import { buildFrame, writeFramePackets } from './frames'
import {
  assembleEpisode,
  checkEpisode,
  episodeSheet,
  renderEpisode
} from './assemble'
import {
  episodeFrames,
  planSummary,
  readInternal,
  writeInternal,
  writeProjectFiles,
  type Internal
} from './state'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const concurrency = () =>
  Math.max(
    1,
    Math.min(6, Number(process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY) || 3)
  )
/** Rounds of rebuilding frames the episode check refused. */
const MOST_ROUNDS = 2

const running = new Map<string, Promise<void>>()

/** Runs the production in the background until it waits, fails or is made. */
export const scheduleStoryboard = (projectId: string) => {
  if (running.has(projectId)) return
  const job = advance(projectId)
    .catch(() => {})
    .finally(() => running.delete(projectId))
  running.set(projectId, job)
}
/** Resolves when the production has stopped working (tests and checks). */
export const settledStoryboard = async (projectId: string) => {
  while (running.has(projectId)) await running.get(projectId)
}

const update = (
  projectId: string,
  change: (storyboard: Storyboard, snapshot: Snapshot) => void
) =>
  changeProject(projectId, (snapshot) => {
    const storyboard = snapshot.project.video?.storyboard
    if (!storyboard) return
    change(storyboard, snapshot)
    storyboard.updatedAt = new Date().toISOString()
  })

const takesOf = (storyboard: Storyboard) =>
  Object.fromEntries(
    (storyboard.plan?.scenes || [])
      .filter((scene) => scene.take !== undefined)
      .map((scene) => [scene.pageId, scene.take ?? null])
  )

const seriesContext = async (
  snapshot: Snapshot
): Promise<SeriesContext | undefined> => {
  const ref = snapshot.project.episode
  if (!ref) return undefined
  const series = await loadSeries(ref.series)
  if (!series) return undefined
  const parts = series.arc?.parts || []
  const next = ref.part
    ? parts[parts.findIndex((part) => part.title === ref.part!.title) + 1]
    : parts[ref.number]
  return {
    title: series.title,
    about: series.about,
    ...(parts.length ? { arc: parts } : {}),
    ...(ref.part ? { part: ref.part } : {}),
    number: ref.number,
    ...(ref.previously ? { previously: ref.previously } : {}),
    ...(ref.threads?.length ? { threads: ref.threads } : {}),
    ...(next ? { next: `${next.title}: ${next.carries}` } : {})
  }
}

const selectionOf = async (snapshot: Snapshot) => {
  const chosen =
    snapshot.project.video?.settings.harness || snapshot.project.harness
  const selection = chosen || (await detectedHarness())
  return {
    adapter: selection.adapter,
    ...(selection.model ? { model: selection.model } : {})
  }
}

const fail = (projectId: string, error: unknown) =>
  update(projectId, (storyboard, snapshot) => {
    storyboard.status = 'failed'
    storyboard.error = error instanceof Error ? error.message : String(error)
    addEvent(snapshot, 'video', `Stopped: ${storyboard.error}`, {
      activity: 'failed'
    })
  })

const advance = async (projectId: string) => {
  for (;;) {
    const snapshot = await loadProject(projectId)
    const storyboard = snapshot?.project.video?.storyboard
    if (!snapshot || !storyboard || storyboard.status !== 'working') return
    try {
      const dir = await createWorkspace({
        projectId,
        productionId: storyboard.id,
        title: snapshot.project.title,
        source: snapshot.project.source,
        branding: snapshot.project.branding
      })
      const internal = await readInternal(dir)
      const stage = STAGES[storyboard.stage as keyof typeof STAGES]
      // Review waits for the creator; done is done.
      if (!stage) return
      const done = await stage({ snapshot, storyboard, dir, internal })
      if (done === 'stop') return
    } catch (error) {
      await fail(projectId, error)
      return
    }
  }
}

type StageInput = {
  snapshot: Snapshot
  storyboard: Storyboard
  dir: string
  internal: Internal
}

const planStage = async ({
  snapshot,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const previous = storyboard.note ? internal.plan : undefined
  const logoKey = snapshot.project.branding?.logoKey
  const logo = await stageLogo(dir, logoKey ? await readAsset(logoKey) : null)
  const { plan, length, brief } = await planEpisode({
    snapshot,
    dir,
    productionId: storyboard.id,
    pages: storyboard.pages,
    selection: await selectionOf(snapshot),
    origin: origin(),
    series: await seriesContext(snapshot),
    note: storyboard.note,
    previous,
    builds: storyboard.builds,
    logo
  })
  const next: Internal = {
    plan,
    length,
    brief,
    statuses: {},
    problems: {},
    rounds: 0,
    ...(logo ? { logo } : {})
  }
  await writeInternal(dir, next)
  await writeFile(join(dir, 'BRIEF.md'), brief)
  await writeProjectFiles(dir, next)
  await update(snapshot.project.id, (current, ledger) => {
    current.plan = planSummary(next, takesOf(current))
    current.length = length
    delete current.note
    current.stage = 'review'
    current.status = 'waiting'
    current.waitingFor = 'approval'
    addEvent(
      ledger,
      'video',
      `The plan is ready: ${plan.scenes.reduce((n, s) => n + s.frames.length, 0)} frames in ${plan.scenes.length} scenes`,
      { activity: 'complete' }
    )
  })
}

/** The takes a stage needs and does not have: a camera scene's, or every
 * scene's when the creator speaks the whole episode. */
export const missingTakes = (storyboard: Storyboard, recordVoice: boolean) =>
  (storyboard.plan?.scenes || [])
    .filter((scene) => (scene.build === 'camera' || recordVoice) && !scene.take)
    .map((scene) => scene.pageId)

const voiceStage = async ({
  snapshot,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const settings = snapshot.project.video!.settings
  const recordVoice = settings.voice.kind === 'record'
  const missing = missingTakes(storyboard, recordVoice)
  if (missing.length) {
    await update(snapshot.project.id, (current) => {
      current.status = 'waiting'
      current.waitingFor = 'takes'
    })
    return 'stop' as const
  }
  const takes: Record<string, string> = {}
  await mkdir(join(dir, '.studio', 'takes'), { recursive: true })
  for (const scene of storyboard.plan?.scenes || [])
    if (scene.take) {
      const path = join(dir, '.studio', 'takes', `${scene.pageId}.media`)
      await writeFile(path, await readAsset(scene.take.objectKey))
      takes[scene.pageId] = path
    }
  const captures: Record<string, string> = {}
  for (const scene of storyboard.plan?.scenes || []) {
    const capture = snapshot.project.slides.find(
      (slide) => slide.id === scene.pageId
    )?.capture
    const key = capture?.objectKey || capture?.last?.objectKey
    if (scene.build === 'screen' && key) {
      const path = join(dir, '.studio', `capture-${scene.pageId}.mp4`)
      await writeFile(path, await readAsset(key))
      captures[scene.pageId] = path
    }
  }
  const frames = episodeFrames(internal.plan!)
  const voice = recordVoice ? {} : await resolveVoice(settings.voice)
  const audio = await prepareEpisodeAudio({
    dir,
    frames,
    voice,
    takes,
    captures
  })
  internal.voices = audio.meta.voices
  internal.durations = audio.durations
  internal.media = audio.media
  internal.voiceName =
    settings.voice.kind === 'record'
      ? 'The creator'
      : settings.voice.kind === 'clone'
        ? 'The creator’s voice clone'
        : `AI voice ${settings.voice.id}`
  await writeInternal(dir, internal)
  await writeProjectFiles(dir, internal)
  await update(snapshot.project.id, (current, ledger) => {
    current.plan = planSummary(internal, takesOf(current))
    current.stage = 'shots'
    addEvent(ledger, 'video', 'The voice is recorded and timed', {
      activity: 'complete'
    })
  })
}

const LAYOUTS = ['overlay.html', 'pip.html', 'split.html', 'stack.html']
const MOTION = ['motion-vocabulary.md']

const shotsStage = async ({
  snapshot,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const plan = internal.plan!
  const frames = episodeFrames(plan)
  const frameDesign = await readFile(join(dir, 'frame.md'), 'utf8')
  const blueprints = blueprintIds()
  const selection = await selectionOf(snapshot)
  internal.shots ||= {}
  const scenes = plan.scenes.map((_, index) => index)
  let cursor = 0
  const lane = async () => {
    while (cursor < scenes.length) {
      const index = scenes[cursor++]
      const shots = await designSceneShots({
        snapshot,
        productionId: storyboard.id,
        plan,
        sceneIndex: index,
        frames,
        voices: internal.voices || [],
        durations: internal.durations || {},
        frameDesign,
        blueprints,
        selection,
        origin: origin(),
        extraFiles: buildFiles(plan.scenes[index].build, LAYOUTS, MOTION)
      })
      for (const shot of shots) internal.shots![shot.number] = shot
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, scenes.length) }, lane))
  await writeInternal(dir, internal)
  await writeProjectFiles(dir, internal)
  await update(snapshot.project.id, (current, ledger) => {
    current.stage = 'frames'
    addEvent(ledger, 'video', 'Every frame has its shot', {
      activity: 'complete'
    })
  })
}

const framesStage = async ({ snapshot, dir, internal }: StageInput) => {
  const frames = episodeFrames(internal.plan!)
  internal.statuses ||= {}
  internal.problems ||= {}
  await writeProjectFiles(dir, internal)
  await writeFramePackets(dir)
  const selection = await selectionOf(snapshot)
  const todo = frames.filter(
    (frame) => internal.statuses![frame.number] !== 'animated'
  )
  let cursor = 0
  const save = async () => {
    await writeInternal(dir, internal)
    await update(snapshot.project.id, (current) => {
      current.plan = planSummary(internal, takesOf(current))
    })
  }
  const lane = async () => {
    while (cursor < todo.length) {
      const frame = todo[cursor++]
      try {
        await buildFrame({
          projectId: snapshot.project.id,
          dir,
          frameId: frame.id,
          number: frame.number,
          build: frame.build,
          duration: internal.durations?.[frame.number] ?? frame.duration,
          media: internal.media?.[frame.number],
          logo: frame.logo ? internal.logo : undefined,
          selection,
          origin: origin(),
          findings: internal.problems![frame.number],
          onAccepted: async () => {
            internal.statuses![frame.number] = 'animated'
            delete internal.problems![frame.number]
            await save()
          }
        })
      } catch (error) {
        internal.statuses![frame.number] = 'failed'
        internal.problems![frame.number] = [
          error instanceof Error ? error.message : String(error)
        ]
        await save()
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency(), todo.length) }, lane)
  )
  await writeProjectFiles(dir, internal)
  const failed = frames.filter(
    (frame) => internal.statuses![frame.number] !== 'animated'
  )
  if (failed.length)
    throw new Error(
      `${failed.length} frame${failed.length === 1 ? '' : 's'} could not be built: ${failed.map((frame) => frame.number).join(', ')}`
    )
  await update(snapshot.project.id, (current, ledger) => {
    current.stage = 'assemble'
    addEvent(ledger, 'video', 'Every frame is built', { activity: 'complete' })
  })
}

const assembleStage = async ({ snapshot, dir, internal }: StageInput) => {
  const frames = episodeFrames(internal.plan!)
  await writeProjectFiles(dir, internal)
  await assembleEpisode(dir)
  const checked = await checkEpisode(
    dir,
    frames.map((frame) => frame.id)
  )
  const refused = frames.filter((frame) => checked.byFrame[frame.id]?.length)
  if (refused.length && (internal.rounds || 0) < MOST_ROUNDS) {
    internal.rounds = (internal.rounds || 0) + 1
    for (const frame of refused) {
      internal.statuses![frame.number] = 'outline'
      internal.problems![frame.number] = checked.byFrame[frame.id]
    }
    await writeInternal(dir, internal)
    await update(snapshot.project.id, (current, ledger) => {
      current.plan = planSummary(internal, takesOf(current))
      current.stage = 'frames'
      addEvent(
        ledger,
        'video',
        `The check sent ${refused.length} frame${refused.length === 1 ? '' : 's'} back to be built again`
      )
    })
    return
  }
  const left = [
    ...refused.flatMap((frame) => checked.byFrame[frame.id]),
    ...checked.other
  ]
  if (left.length)
    throw new Error(
      `Hyperframes' check still finds: ${left.slice(0, 3).join(' · ')}`
    )
  let at = 0
  const middles = frames.map((frame) => {
    const length = internal.durations?.[frame.number] ?? frame.duration
    const middle = at + length / 2
    at += length
    return middle
  })
  const sheet = await episodeSheet(dir, middles)
  const stored = sheet
    ? await storeAsset({
        body: await readFile(sheet),
        contentType: 'image/jpeg',
        kind: 'storyboard-sheet',
        extension: '.jpg',
        projectId: snapshot.project.id
      })
    : null
  await update(snapshot.project.id, (current, ledger) => {
    if (stored) current.contactSheetKey = stored.objectKey
    current.stage = 'render'
    addEvent(ledger, 'video', 'Assembled and checked: rendering', {
      activity: 'complete'
    })
  })
}

const renderStage = async ({ snapshot, dir, internal }: StageInput) => {
  const output = await renderEpisode(dir)
  const duration = Math.round((await probeSeconds(output)) * 100) / 100
  const stored = await storeAsset({
    body: await readFile(output),
    contentType: 'video/mp4',
    kind: 'produced-video',
    extension: '.mp4',
    projectId: snapshot.project.id
  })
  const goal = internal.length
  await update(snapshot.project.id, (current, ledger) => {
    current.produced = { objectKey: stored.objectKey, duration }
    current.stage = 'done'
    current.status = 'done'
    delete current.waitingFor
    delete current.error
    if (goal)
      current.lengthNote =
        duration > goal.max || duration < goal.min
          ? `It runs ${Math.round(duration)} s; you asked for ${goal.min}–${goal.max} s.`
          : `It runs ${Math.round(duration)} s, within ${goal.min}–${goal.max} s.`
    const video = ledger.project.video!
    video.produced = { inputKey: current.id, objectKey: stored.objectKey }
    addEvent(ledger, 'video', 'Your video is made', { activity: 'complete' })
  })
}

const STAGES = {
  plan: planStage,
  voice: voiceStage,
  shots: shotsStage,
  frames: framesStage,
  assemble: assembleStage,
  render: renderStage
}

export const storyboardDir = (projectId: string, storyboard: Storyboard) =>
  productionDir(projectId, storyboard.id)

/** Seconds a take runs, read once when it is saved. */
export const takeSeconds = (path: string) => probeSeconds(path)

export type { BuildType }
