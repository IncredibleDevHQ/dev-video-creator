// What the creator does to a storyboard video: start it with the episode's
// pages, approve the plan or ask for a change, approve the stills or leave a
// note on one, choose a scene's build, record or upload a camera scene's
// take, and try again after a stop.
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import {
  BUILD_TYPES,
  BUILD_LABELS,
  TAKE_TYPES,
  TRANSITIONS,
  TRANSITION_LABELS,
  type BuildType,
  type FrameTransition,
  type SceneSummary,
  type Storyboard,
  type StoryboardStage
} from '../../shared/storyboard'
import { addEvent } from '../activity'
import { storeAsset } from '../persistence'
import { changeProject, loadProject } from '../projects'
import { Refusal } from '../refusal'
import { hasPicture, probeSeconds } from '../voice'
import {
  missingTakes,
  scheduleStoryboard,
  settledStoryboard,
  storyboardDir
} from './pipeline'
import { readInternal, writeInternal, writeProjectFiles } from './state'
import { summaryNow, update } from './run'
import { takeRefusal } from './takes'

/** A new storyboard production for the episode's pages, in order. */
export const newStoryboard = (pages: string[]): Storyboard => ({
  id: `sb-${randomUUID().slice(0, 12)}`,
  pages,
  stage: 'plan',
  status: 'working',
  updatedAt: new Date().toISOString()
})

const storyboardOf = (snapshot: Snapshot) => {
  const storyboard = snapshot.project.video?.storyboard
  if (!storyboard) throw new Refusal('This video is not made from a storyboard')
  return storyboard
}

const noteOf = (raw: unknown) =>
  String((raw as { note?: unknown } | null)?.note ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)

/**
 * Approve what waits for the creator, or send the plan back with a change in
 * their words. The plan, approved, is posed as stills; the stills, approved,
 * are made into the video. A change asked of the board plans again, and the
 * new plan waits for approval.
 */
export const approveStoryboard = async (projectId: string, raw: unknown) => {
  const note = noteOf(raw)
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    const stage = storyboard.stage
    if (
      !['review', 'board'].includes(stage) ||
      storyboard.waitingFor !== 'approval'
    )
      throw new Refusal('Nothing is waiting for your approval')
    if (note) {
      storyboard.note = note
      storyboard.stage = 'plan'
      delete storyboard.approved
      delete storyboard.frameNotes
      addEvent(current, 'video', 'Planning again with your change')
    } else if (stage === 'review') {
      storyboard.approved = true
      storyboard.stage = 'stills'
      addEvent(current, 'video', 'Plan approved: posing the stills')
    } else {
      storyboard.stage = 'voice'
      addEvent(current, 'video', 'Stills approved: making the video')
    }
    storyboard.status = 'working'
    delete storyboard.waitingFor
    storyboard.updatedAt = new Date().toISOString()
  })
  scheduleStoryboard(projectId)
  return snapshot
}

/**
 * A note on one frame's still: that frame is posed again with it, and no
 * other. A note made while stills are posed waits for the next round.
 */
export const noteStoryboardFrame = async (
  projectId: string,
  number: number,
  raw: unknown
) => {
  const note = noteOf(raw)
  if (!note) throw new Refusal('Say what to change in this still')
  let start = false
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    const frame = storyboard.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((entry) => entry.number === number)
    if (!frame) throw new Refusal('Frame not found')
    const waiting =
      storyboard.stage === 'board' && storyboard.status === 'waiting'
    const posing =
      storyboard.stage === 'stills' && storyboard.status === 'working'
    if (!waiting && !posing)
      throw new Refusal('A still can change before you approve the stills')
    storyboard.frameNotes = { ...storyboard.frameNotes, [number]: note }
    if (waiting) {
      storyboard.stage = 'stills'
      storyboard.status = 'working'
      delete storyboard.waitingFor
      start = true
    }
    storyboard.updatedAt = new Date().toISOString()
    addEvent(current, 'video', `Posing frame ${number} again with your note`)
  })
  if (start) scheduleStoryboard(projectId)
  return snapshot
}

/** Choose how a scene is built. Before approval the plan is made again
 * around it. */
export const setStoryboardBuild = async (
  projectId: string,
  pageId: string,
  raw: unknown
) => {
  const build = String(raw ?? '') as BuildType
  if (!BUILD_TYPES.includes(build))
    throw new Refusal('Choose how the scene is built')
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    if (
      storyboard.stage !== 'review' &&
      !(storyboard.stage === 'plan' && storyboard.status === 'failed')
    )
      throw new Refusal(
        'A scene’s build can change while the plan waits for you'
      )
    const scene = storyboard.plan?.scenes.find(
      (entry) => entry.pageId === pageId
    )
    if (!scene && !storyboard.pages.includes(pageId))
      throw new Refusal('Scene not found')
    if (scene?.build === build && storyboard.status !== 'failed') return
    const page = current.project.slides.find((slide) => slide.id === pageId)
    if (!page) throw new Refusal('Page not found')
    if (
      build === 'screen' &&
      !page.capture?.objectKey &&
      !page.capture?.last?.objectKey
    )
      throw new Refusal('Record a product capture before choosing Screen demo')
    delete storyboard.error
    storyboard.builds = { ...storyboard.builds, [pageId]: build }
    const head = `Build the scene for “${page?.title || pageId}” as `
    const asked = `${head}${BUILD_LABELS[build].toLowerCase()}; keep the rest of the plan.`
    // A change asked for that a failed plan didn't make yet stays, with this
    // one after it (review 7); this scene's earlier build gives way to it.
    const kept =
      storyboard.status === 'failed'
        ? (storyboard.note || '')
            .split('\n')
            .filter((line) => line && !line.startsWith(head))
        : []
    storyboard.note = [...kept, asked].join('\n')
    storyboard.stage = 'plan'
    storyboard.status = 'working'
    delete storyboard.waitingFor
    storyboard.updatedAt = new Date().toISOString()
    addEvent(
      current,
      'video',
      `Planning again: ${page?.title || 'a scene'} as ${BUILD_LABELS[build].toLowerCase()}`
    )
  })
  scheduleStoryboard(projectId)
  return snapshot
}

/**
 * Change how a frame enters. Before the episode is put together the plan just
 * carries it; once it is made (or stopped putting it together), the episode is
 * assembled and rendered again with it. No agent is asked.
 */
export const setStoryboardTransition = async (
  projectId: string,
  number: number,
  raw: unknown
) => {
  const transition = String(
    (raw as { transition?: unknown } | null)?.transition ?? ''
  ) as FrameTransition
  if (!TRANSITIONS.includes(transition))
    throw new Refusal('Choose one of the transitions')
  if (number === 1) throw new Refusal('The first frame enters with a cut')
  let again = false
  const snapshot = await changeProject(projectId, async (current) => {
    const storyboard = storyboardOf(current)
    if (!storyboard?.plan) throw new Refusal('There is no plan yet')
    if (storyboard.status === 'working')
      throw new Refusal('Wait until this step finishes to change a transition')
    const dir = storyboardDir(projectId, storyboard)
    const internal = await readInternal(dir)
    const frame = internal.plan?.scenes
      .flatMap((scene) => scene.frames)
      .find((entry) => entry.number === number)
    if (!frame) throw new Refusal('Frame not found')
    frame.transition = transition
    delete frame.transitionWhy
    const value = storyboard
    again =
      value.status === 'done' ||
      (value.status === 'failed' &&
        ['assemble', 'render'].includes(value.stage))
    // Put together again, the check has its rounds afresh, as Try again
    // gives them (review 7: it stopped at once with the same findings).
    if (again) internal.rounds = 0
    await writeInternal(dir, internal)
    await writeProjectFiles(dir, internal)
    for (const scene of value.plan?.scenes || [])
      for (const entry of scene.frames)
        if (entry.number === number) {
          entry.transition = transition
          delete entry.transitionWhy
        }
    if (again) {
      value.stage = 'assemble'
      value.status = 'working'
      delete value.error
    }
    value.updatedAt = new Date().toISOString()
    addEvent(
      current,
      'video',
      `Frame ${number} now enters with ${TRANSITION_LABELS[transition].toLowerCase()}${again ? ': putting the episode together again' : ''}`
    )
  })
  if (again) scheduleStoryboard(projectId)
  return snapshot
}

const NO_PICTURE =
  'This scene is on camera: record its take, or upload a video, not sound alone'

/** A scene's take, recorded or uploaded: once every take the plan needs is
 * in, the production carries on. */
export const saveStoryboardTake = async (
  projectId: string,
  pageId: string,
  body: Buffer,
  contentType: string
) => {
  const type = contentType.split(';')[0].trim().toLowerCase()
  const extension = TAKE_TYPES[type]
  if (!extension) throw new Refusal('Record or upload a video or audio file')
  if (!body.length || body.length > 2_000_000_000)
    throw new Refusal('The take is empty or too large')
  const dir = await mkdtemp(join(tmpdir(), 'storyboard-take-'))
  let duration = 0
  // Sound alone has no picture; a file ffprobe can't tell about is let
  // through, as before.
  let picture = !type.startsWith('audio/')
  try {
    const path = join(dir, `take${extension}`)
    await writeFile(path, body)
    duration = Math.round((await probeSeconds(path)) * 100) / 100
    if (picture) picture = await hasPicture(path).catch(() => true)
  } catch {
    throw new Refusal(
      'The take could not be read. Record it again, or upload an MP4 or WebM file'
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  if (duration < 0.5) throw new Refusal('The take is too short')
  // A camera scene is cut from its take's picture: sound alone would stop
  // the voice every time (review 7).
  const unseen = (scene: SceneSummary | undefined) =>
    scene?.build === 'camera' && !picture
  const board = (await loadProject(projectId))?.project.video?.storyboard
  if (unseen(board?.plan?.scenes.find((entry) => entry.pageId === pageId)))
    throw new Refusal(NO_PICTURE)
  const stored = await storeAsset({
    body,
    contentType: type,
    kind: 'storyboard-take',
    extension,
    projectId
  })
  let resume = false
  const snapshot = await changeProject(projectId, async (current) => {
    const storyboard = storyboardOf(current)
    const scene = storyboard.plan?.scenes.find(
      (entry) => entry.pageId === pageId
    )
    if (!scene) throw new Refusal('Scene not found')
    if (unseen(scene)) throw new Refusal(NO_PICTURE)
    const refusal = takeRefusal(storyboard, scene)
    if (refusal) throw new Refusal(refusal)
    // A first take for a scene already voiced without one (the voice became
    // the creator's afterwards) is voiced again from it, as a replaced take
    // is (review 7).
    const voiced =
      Boolean(storyboard.approved && !scene.take) &&
      (await readInternal(storyboardDir(projectId, storyboard))
        .then((internal) => Boolean(internal.voiced?.includes(pageId)))
        .catch(() => false))
    const replaced = Boolean(scene.take) || voiced
    scene.take = { objectKey: stored.objectKey, duration }
    const page = current.project.slides.find((slide) => slide.id === pageId)
    addEvent(current, 'video', `Take saved for “${page?.title || 'a scene'}”`, {
      activity: 'complete'
    })
    // Once the plan is approved, a take carries the production on: the
    // scene is voiced, designed and built from it (again, when replaced).
    if (storyboard.approved) {
      if (replaced)
        storyboard.redo = [...new Set([...(storyboard.redo || []), pageId])]
      if (storyboard.waitingFor === 'takes' || storyboard.status === 'done') {
        storyboard.stage = 'voice'
        storyboard.status = 'working'
        delete storyboard.waitingFor
        delete storyboard.produced
        resume = true
      }
    }
    storyboard.updatedAt = new Date().toISOString()
  })
  if (resume) scheduleStoryboard(projectId)
  return snapshot
}

/** The stages that come after the voice, the voice among them. */
const VOICED: StoryboardStage[] = [
  'voice',
  'shots',
  'frames',
  'assemble',
  'render'
]

/** Carry on after a stop, from the stage that stopped. */
export const retryStoryboard = async (projectId: string) => {
  const snapshot = await changeProject(projectId, async (current) => {
    const storyboard = storyboardOf(current)
    if (storyboard.status !== 'failed')
      throw new Refusal('Nothing to try again')
    // A replaced take is voiced again, from the voice on: before it, the
    // stills and their approval come first (review 7).
    if (storyboard.redo?.length && VOICED.includes(storyboard.stage))
      storyboard.stage = 'voice'
    if (storyboard.stage === 'assemble' || storyboard.stage === 'voice') {
      const dir = storyboardDir(projectId, storyboard)
      const internal = await readInternal(dir)
      internal.rounds = 0
      await writeInternal(dir, internal)
    }
    storyboard.status = 'working'
    delete storyboard.error
    storyboard.updatedAt = new Date().toISOString()
    addEvent(current, 'video', 'Trying again')
  })
  scheduleStoryboard(projectId)
  return snapshot
}

/** On startup: carry on with productions that were working. */
/** A plan summarised before frames showed their transition gets them from
 * its production's own plan (run once at start-up). */
export const showTransitions = async (snapshot: Snapshot) => {
  const storyboard = snapshot.project.video?.storyboard
  const frames = storyboard?.plan?.scenes.flatMap((scene) => scene.frames)
  if (!storyboard || !frames?.some((frame) => !frame.transition)) return
  const internal = await readInternal(
    storyboardDir(snapshot.project.id, storyboard)
  )
  const planned = new Map(
    (internal.plan?.scenes || [])
      .flatMap((scene) => scene.frames)
      .map((frame) => [frame.number, frame])
  )
  await changeProject(snapshot.project.id, (current) => {
    for (const scene of current.project.video?.storyboard?.plan?.scenes || [])
      for (const frame of scene.frames) {
        const from = planned.get(frame.number)
        if (frame.transition || !from) continue
        frame.transition = from.transition
        if (from.transitionWhy) frame.transitionWhy = from.transitionWhy
      }
  })
}

/** A production that stopped to wait for takes before every scene needing
 * one had its place shows those places now, so Record and Upload are there
 * (run once at start-up; review 7). */
export const showTakeSlots = async (snapshot: Snapshot) => {
  const storyboard = snapshot.project.video?.storyboard
  if (storyboard?.status !== 'waiting' || storyboard.waitingFor !== 'takes')
    return
  const internal = await readInternal(
    storyboardDir(snapshot.project.id, storyboard)
  )
  if (!internal.plan) return
  let resume = false
  await update(snapshot.project.id, (current, ledger) => {
    current.plan = summaryNow(internal, current, ledger)
    // Nothing left to wait for (the voice is no longer the creator's): it
    // carries on, never waits on a take it can't ask for (review 7).
    const recordVoice = ledger.project.video?.settings.voice.kind === 'record'
    if (missingTakes(current, recordVoice).length) return
    current.stage = 'voice'
    current.status = 'working'
    delete current.waitingFor
    resume = true
  })
  if (resume) scheduleStoryboard(snapshot.project.id)
}

/** Replan edited wireframes in a fresh workspace, keeping the creator's takes. */
export const remakeStoryboard = async (projectId: string) => {
  if (
    (await loadProject(projectId))?.project.video?.storyboard?.status ===
    'working'
  )
    throw new Refusal(
      'Wait for the current production to stop before remaking it'
    )
  await settledStoryboard(projectId)
  const snapshot = await changeProject(projectId, (current) => {
    const old = storyboardOf(current)
    if (old.status === 'working')
      throw new Refusal(
        'Wait for the current production to stop before remaking it'
      )
    current.project.video!.storyboard = {
      ...newStoryboard(old.pages),
      plan: old.plan && {
        ...old.plan,
        scenes: old.plan.scenes.map((scene) => ({
          ...scene,
          frames: scene.frames.map(({ still: _still, ...frame }) => ({
            ...frame,
            status: 'outline'
          }))
        }))
      },
      builds: old.builds
    }
    current.project.video!.produced = null
    addEvent(current, 'video', 'Remaking the video from the current wireframes')
  })
  scheduleStoryboard(projectId)
  return snapshot
}
