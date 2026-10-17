// The storyboard production, stage by stage: plan → the creator approves →
// a still of every frame → the creator approves the board (a note poses one
// frame again) → voice (and takes) → shots per scene → one worker per frame,
// starting from its approved still → assembly and Hyperframes' check (a
// refused frame is built again with the findings) → render. Each stage's
// outcome is saved before the next starts, so a restart resumes where it
// stopped and never repeats a paid call that already succeeded (stage
// checkpoints).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import { fitOf, lengthLabel, windowLabel } from '../../shared/length'
import type { BuildType, Storyboard } from '../../shared/storyboard'
import { addEvent } from '../activity'
import { readAsset, storeAsset } from '../persistence'
import { generationStops } from '../generation-errors'
import { loadProject } from '../projects'
import { resolveVoice } from '../voice-library'
import { probeSeconds } from '../voice'
import { loadSeries, previouslyOf } from '../series'
import { settledSegues } from '../map-segues'
import { createWorkspace, productionDir, stageLogo } from './workspace'
import { blueprintIds, planEpisode, type SeriesContext } from './plan'
import { prepareEpisodeAudio } from './voice'
import { buildFiles, designSceneShots } from './shots'
import { buildFrame, writeFramePackets } from './frames'
import { stillFile, writeBoard } from './board'
import { stillsStage } from './stills-stage'
import {
  LAYOUTS,
  MOTION,
  concurrency,
  origin,
  pageTitles,
  selectionOf,
  summaryNow,
  takesOf,
  update,
  type StageInput
} from './run'
import {
  assembleEpisode,
  checkEpisode,
  episodePoster,
  episodeSheet,
  renderEpisode
} from './assemble'
import { stoppedByCheck } from './check'
import {
  episodeFrames,
  readInternal,
  writeInternal,
  writeProjectFiles,
  type Internal
} from './state'
import { afterFrames, needsTake } from './takes'

/** Rounds of rebuilding frames the episode check refused. */
const MOST_ROUNDS = 2

const running = new Map<string, Promise<void>>()
/** What a Stop aborts that is no agent run: the render (review 8 F11). */
const aborts = new Map<string, AbortController>()
/** Ends the work in this process that a Stop can end at once. */
export const abortStoryboard = (projectId: string) =>
  aborts.get(projectId)?.abort()

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
/** Whether the production is running in this process now. */
export const storyboardRunning = (projectId: string) => running.has(projectId)

/** Stopped by the creator: what is made stays, and Try again carries on. */
export const stopNow = (projectId: string) =>
  update(projectId, (storyboard, snapshot) => {
    if (storyboard.status !== 'working') return
    storyboard.status = 'failed'
    storyboard.error = generationStops.user
    delete storyboard.stopping
    addEvent(snapshot, 'video', generationStops.user, { activity: 'failed' })
  })

/** The most a plan waits for its episode's segues to be written. */
const SEGUE_WAIT_MS = 5 * 60_000
/** A plan starts once its episode's segues are written: they change its
 * lines, and a plan of the old ones would be stale at once (review 8 F04).
 * What changed before it starts is in the lines it plans from. */
const linesToPlan = async (snapshot: Snapshot) => {
  const id = snapshot.project.id
  await Promise.race([
    settledSegues(id),
    new Promise((resolve) => setTimeout(resolve, SEGUE_WAIT_MS))
  ])
  let current = (await loadProject(id)) || snapshot
  const until = Date.now() + SEGUE_WAIT_MS
  while (
    current.project.segues?.state === 'writing' &&
    !current.project.video?.storyboard?.stopping &&
    Date.now() < until
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    current = (await loadProject(id)) || current
  }
  await update(id, (storyboard) => {
    delete storyboard.replan
  })
  return (await loadProject(id)) || current
}

const seriesContext = async (
  snapshot: Snapshot
): Promise<SeriesContext | undefined> => {
  const ref = snapshot.project.episode
  if (!ref) return undefined
  const series = await loadSeries(ref.series)
  if (!series) return undefined
  const parts = series.arc?.parts || []
  // Before and after in the series as it is ordered now, not as it was
  // when the episode was made.
  const at = series.episodes.findIndex(
    (item) => item.notebookId === snapshot.project.id
  )
  const neighbour = async (index: number) =>
    index >= 0 && index < series.episodes.length
      ? loadProject(series.episodes[index].notebookId)
      : null
  const before = at >= 0 ? await neighbour(at - 1) : null
  const after = at >= 0 ? await neighbour(at + 1) : null
  const nextPart = after?.project.episode?.part
  const fallback = ref.part
    ? parts[parts.findIndex((part) => part.title === ref.part!.title) + 1]
    : parts[ref.number]
  const next = after
    ? `${after.project.title}${nextPart?.carries ? `: ${nextPart.carries}` : ''}`
    : at < 0 && fallback
      ? `${fallback.title}: ${fallback.carries}`
      : undefined
  const previously = at >= 0 ? previouslyOf(before) : ref.previously
  const outline = at >= 0 ? series.episodes[at].outline : undefined
  const titleOf = new Map<string, string>()
  for (const need of outline?.needs || [])
    if (need.from && !titleOf.has(need.from))
      titleOf.set(
        need.from,
        (await loadProject(need.from))?.project.title || ''
      )
  return {
    title: series.title,
    about: series.about,
    ...(parts.length ? { arc: parts } : {}),
    ...(ref.part ? { part: ref.part } : {}),
    number: ref.number,
    ...(previously ? { previously } : {}),
    ...(ref.threads?.length ? { threads: ref.threads } : {}),
    ...(next ? { next } : {}),
    ...(series.outcome ? { outcome: series.outcome } : {}),
    ...(series.audience ? { audience: series.audience } : {}),
    ...(outline
      ? {
          explain: (series.gaps || [])
            .filter(
              (gap) =>
                gap.state === 'explained' && gap.episode === snapshot.project.id
            )
            .map((gap) => gap.missing),
          win: outline.win,
          teaches: outline.teaches,
          needs: outline.needs.map((need) =>
            need.from && titleOf.get(need.from)
              ? `${need.what} (from “${titleOf.get(need.from)}”)`
              : need.what
          )
        }
      : {})
  }
}

const fail = (projectId: string, error: unknown) =>
  update(projectId, (storyboard, snapshot) => {
    storyboard.status = 'failed'
    // A run the creator stopped ends in a refusal: it says it was stopped.
    storyboard.error = storyboard.stopping
      ? generationStops.user
      : error instanceof Error
        ? error.message
        : String(error)
    delete storyboard.stopping
    // The activity says why in one line; the details stay with the error.
    addEvent(snapshot, 'video', `Stopped: ${storyboard.error.split('\n')[0]}`, {
      activity: 'failed'
    })
  })

const advance = async (projectId: string) => {
  for (;;) {
    const snapshot = await loadProject(projectId)
    const storyboard = snapshot?.project.video?.storyboard
    if (!snapshot || !storyboard || storyboard.status !== 'working') return
    if (storyboard.stopping) {
      await stopNow(projectId)
      return
    }
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

const planStage = async ({
  snapshot: started,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const snapshot = await linesToPlan(started)
  if (snapshot.project.video?.storyboard?.stopping) return
  const previous = storyboard.note ? internal.plan : undefined
  // The site's logo, when chosen, goes as its drawing: crisp at any size.
  const branding = snapshot.project.branding
  const siteLogo = branding?.site?.logo
  const logoKey =
    siteLogo?.svgKey && branding?.logoKey === siteLogo.pngKey
      ? siteLogo.svgKey
      : branding?.logoKey
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
  // A new plan is posed afresh: the stills of the last one go.
  await rm(join(dir, 'boards'), { recursive: true, force: true })
  await writeInternal(dir, next)
  await writeFile(join(dir, 'BRIEF.md'), brief)
  await writeProjectFiles(dir, next)
  await update(snapshot.project.id, (current, ledger) => {
    current.plan = summaryNow(next, current, ledger)
    current.length = length
    // The wireframes changed while it planned: it plans again with them
    // before a plan of the old lines waits for approval (review 8 F04).
    // The wireframes changed while it planned: it waits with that said, and
    // the creator plans again when ready (review 8 F04).
    if (current.replan)
      addEvent(
        ledger,
        'video',
        'The wireframes changed while planning: plan again to use them'
      )
    delete current.note
    current.stage = 'review'
    current.status = 'waiting'
    current.waitingFor = 'approval'
    addEvent(
      ledger,
      'video',
      `The plan is ready: ${plan.scenes.reduce((n, s) => n + s.frames.length, 0)} frames in ${plan.scenes.length === 1 ? 'one scene' : `${plan.scenes.length} scenes`}`,
      { activity: 'complete' }
    )
  })
}

/** The takes a stage needs and does not have: a camera scene's, or every
 * scene's with words to say when the creator speaks the whole episode. */
export const missingTakes = (storyboard: Storyboard, recordVoice: boolean) =>
  (storyboard.plan?.scenes || [])
    .filter((scene) => needsTake(scene, recordVoice) && !scene.take)
    .map((scene) => scene.pageId)

/**
 * Voices every scene that can be voiced now: those with no take to wait for,
 * and those whose take has come. A scene still waiting for its take is left
 * for later; the others go on to their shots and frames meanwhile.
 */
const voiceStage = async ({
  snapshot,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const settings = snapshot.project.video!.settings
  const recordVoice = settings.voice.kind === 'record'
  const plan = internal.plan!
  const frames = episodeFrames(plan)
  // A take replaced: its scene is voiced, designed and built again.
  const redo = storyboard.redo || []
  if (redo.length) internal.rounds = 0
  internal.voiced = (internal.voiced || []).filter(
    (page) => !redo.includes(page)
  )
  for (const frame of frames.filter((entry) => redo.includes(entry.pageId))) {
    delete internal.shots?.[frame.number]
    // Its still holds: the take changes the timing, not the layout.
    if (internal.statuses)
      internal.statuses[frame.number] = internal.stills?.[frame.number]
        ? 'built'
        : 'outline'
  }
  const summary = new Map(
    (storyboard.plan?.scenes || []).map((scene) => [scene.pageId, scene])
  )
  const ready = plan.scenes.filter(
    (scene) =>
      !internal.voiced!.includes(scene.pageId) &&
      (!needsTake(scene, recordVoice) || summary.get(scene.pageId)?.take)
  )
  if (!ready.length) {
    await writeInternal(dir, internal)
    let waiting = false
    await update(snapshot.project.id, (current, ledger) => {
      // Every scene that waits for a take shows its place for one, also
      // when the voice became the creator's after the plan.
      current.plan = summaryNow(internal, current, ledger)
      current.redo = (current.redo || []).filter(
        (page) =>
          !redo.includes(page) ||
          takesOf(current)[page]?.objectKey !==
            takesOf(storyboard)[page]?.objectKey
      )
      // Decided on the storyboard as it is now: a take or a voice that
      // changed since this stage began is not missed (review 7).
      const speaks = ledger.project.video?.settings.voice.kind === 'record'
      waiting = missingTakes(current, speaks).length > 0
      const unvoiced = (current.plan?.scenes || []).some(
        (scene) => !internal.voiced!.includes(scene.pageId)
      )
      if (waiting) {
        current.status = 'waiting'
        current.waitingFor = 'takes'
      } else current.stage = current.redo.length || unvoiced ? 'voice' : 'shots'
    })
    return waiting ? ('stop' as const) : undefined
  }
  const takes: Record<string, string> = {}
  const captures: Record<string, string> = {}
  await mkdir(join(dir, '.studio', 'takes'), { recursive: true })
  for (const scene of ready) {
    const take = summary.get(scene.pageId)?.take
    if (take) {
      const path = join(dir, '.studio', 'takes', `${scene.pageId}.media`)
      await writeFile(path, await readAsset(take.objectKey))
      takes[scene.pageId] = path
    }
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
  const pages = ready.map((scene) => scene.pageId)
  const voice =
    recordVoice || ready.every((scene) => takes[scene.pageId])
      ? {}
      : await resolveVoice(settings.voice)
  const audio = await prepareEpisodeAudio({
    dir,
    frames: frames.filter((frame) => pages.includes(frame.pageId)),
    voice,
    takes,
    captures,
    previous: {
      voices: internal.voices,
      durations: internal.durations,
      media: internal.media
    }
  })
  internal.voices = audio.meta.voices
  internal.durations = audio.durations
  internal.media = audio.media
  internal.voiced = [...internal.voiced!, ...pages]
  internal.voiceName =
    settings.voice.kind === 'record'
      ? 'The creator'
      : settings.voice.kind === 'clone'
        ? 'The creator’s voice clone'
        : `AI voice ${settings.voice.id}`
  await writeInternal(dir, internal)
  await writeProjectFiles(dir, internal)
  await writeBoard(dir, internal, pageTitles(snapshot))
  await update(snapshot.project.id, (current, ledger) => {
    current.plan = summaryNow(internal, current, ledger)
    current.redo = (current.redo || []).filter(
      (page) =>
        !pages.includes(page) ||
        takesOf(current)[page]?.objectKey !==
          takesOf(storyboard)[page]?.objectKey
    )
    current.stage = current.redo.length ? 'voice' : 'shots'
    addEvent(
      ledger,
      'video',
      `Voiced and timed: ${ready.length} ${ready.length === 1 ? 'scene' : 'scenes'}`,
      { activity: 'complete' }
    )
    // Voiced in full, its real length against the window, said before a
    // frame is built: the voice wins over the plan's estimate.
    const goal = internal.length
    const voiced = current.pages.every((page) =>
      internal.voiced!.includes(page)
    )
    const total = (current.plan?.scenes || []).reduce(
      (sum, scene) =>
        sum + scene.frames.reduce((run, frame) => run + frame.duration, 0),
      0
    )
    if (goal && voiced && total && fitOf(total, goal) !== 'within')
      addEvent(
        ledger,
        'video',
        `Voiced, it runs ${lengthLabel(total)}; the episode asks for ${windowLabel(goal)}`
      )
  })
}

/** Designs the shots of every voiced scene that has none yet. */
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
  const scenes = plan.scenes
    .map((scene, index) => ({ scene, index }))
    .filter(
      ({ scene }) =>
        (internal.voiced || []).includes(scene.pageId) &&
        scene.frames.some((frame) => !internal.shots![frame.number])
    )
    .map(({ index }) => index)
  let cursor = 0
  // A lane that fails stops the others before their next paid call.
  let stopped = false
  const lane = async () => {
    while (!stopped && cursor < scenes.length) {
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
        extraFiles: buildFiles(plan.scenes[index].build, LAYOUTS, MOTION),
        stills: Object.fromEntries(
          frames
            .filter((frame) => internal.stills?.[frame.number])
            .map((frame) => [frame.number, join(dir, stillFile(frame.id))])
        )
      }).catch((error: unknown) => {
        stopped = true
        throw error
      })
      for (const shot of shots) internal.shots![shot.number] = shot
      await writeInternal(dir, internal)
    }
  }
  // The stage stops once every lane has: a call in flight is saved, so Try
  // again never pays for it twice, and nothing writes after the stop.
  const lanes = await Promise.allSettled(
    Array.from({ length: Math.min(3, scenes.length) }, lane)
  )
  const failed = lanes.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (failed) throw failed.reason
  await writeInternal(dir, internal)
  await writeProjectFiles(dir, internal)
  await update(snapshot.project.id, (current, ledger) => {
    current.stage = 'frames'
    if (scenes.length)
      addEvent(
        ledger,
        'video',
        `Shots designed: ${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}`,
        { activity: 'complete' }
      )
  })
}

/** Builds every designed frame not built yet; then assembles, or waits for
 * the takes still to come. */
const framesStage = async ({ snapshot, dir, internal }: StageInput) => {
  const frames = episodeFrames(internal.plan!)
  internal.statuses ||= {}
  internal.problems ||= {}
  await writeProjectFiles(dir, internal)
  await writeFramePackets(dir)
  const selection = await selectionOf(snapshot)
  const todo = frames.filter(
    (frame) =>
      internal.shots?.[frame.number] &&
      internal.statuses![frame.number] !== 'animated'
  )
  let cursor = 0
  const save = async () => {
    await writeInternal(dir, internal)
    await update(snapshot.project.id, (current, ledger) => {
      current.plan = summaryNow(internal, current, ledger)
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
          sketch: Boolean(internal.stills?.[frame.number]),
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
        // A run the creator stopped is no finding for the frame's next try.
        if (
          (await loadProject(snapshot.project.id))?.project.video?.storyboard
            ?.stopping
        )
          delete internal.problems![frame.number]
        else
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
  const failed = todo.filter(
    (frame) => internal.statuses![frame.number] !== 'animated'
  )
  if (failed.length)
    throw new Error(
      `${failed.length} frame${failed.length === 1 ? '' : 's'} could not be built: ${failed.map((frame) => frame.number).join(', ')}`
    )
  await update(snapshot.project.id, (current, ledger) => {
    const next = afterFrames(
      current.plan?.scenes || [],
      internal.voiced || [],
      ledger.project.video?.settings.voice.kind === 'record'
    )
    // A take that came in while these frames were built is voiced next: a
    // new one, or one for a scene voiced before it (review 7).
    if (next === 'voice' || current.redo?.length) {
      current.stage = 'voice'
      return
    }
    if (next === 'wait') {
      const waiting = (current.plan?.scenes || []).filter(
        (scene) => !(internal.voiced || []).includes(scene.pageId)
      ).length
      // Made as far as it can be: the rest waits for its takes.
      current.stage = 'voice'
      current.status = 'waiting'
      current.waitingFor = 'takes'
      addEvent(
        ledger,
        'video',
        `Built what can be built; ${waiting} ${waiting === 1 ? 'scene waits' : 'scenes wait'} for your take`
      )
      return
    }
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
      internal.statuses![frame.number] = internal.stills?.[frame.number]
        ? 'built'
        : 'outline'
      internal.problems![frame.number] = checked.byFrame[frame.id]
    }
    await writeInternal(dir, internal)
    await update(snapshot.project.id, (current, ledger) => {
      current.plan = summaryNow(internal, current, ledger)
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
  if (left.length) throw new Error(stoppedByCheck(left))
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
    // A take that came in meanwhile is voiced before anything is rendered.
    if (current.redo?.length) {
      current.stage = 'voice'
      return
    }
    current.stage = 'render'
    addEvent(ledger, 'video', 'Assembled and checked: rendering', {
      activity: 'complete'
    })
  })
}

const renderStage = async ({ snapshot, dir, internal }: StageInput) => {
  const stop = new AbortController()
  aborts.set(snapshot.project.id, stop)
  const output = await renderEpisode(dir, stop.signal).finally(() =>
    aborts.delete(snapshot.project.id)
  )
  const duration = Math.round((await probeSeconds(output)) * 100) / 100
  const stored = await storeAsset({
    body: await readFile(output),
    contentType: 'video/mp4',
    kind: 'produced-video',
    extension: '.mp4',
    projectId: snapshot.project.id
  })
  const first = episodeFrames(internal.plan!)[0]
  const poster = await episodePoster(
    output,
    Math.max(0.5, (internal.durations?.[first.number] ?? first.duration) - 0.3)
  ).catch(() => null)
  const posterStored = poster
    ? await storeAsset({
        body: await readFile(poster),
        contentType: 'image/jpeg',
        kind: 'storyboard-poster',
        extension: '.jpg',
        projectId: snapshot.project.id
      })
    : null
  const goal = internal.length
  await update(snapshot.project.id, (current, ledger) => {
    // A take that came in while rendering: this cut is already old.
    if (current.redo?.length) {
      current.stage = 'voice'
      return
    }
    current.produced = { objectKey: stored.objectKey, duration }
    if (posterStored) current.posterKey = posterStored.objectKey
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
  stills: stillsStage,
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
