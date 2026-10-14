// What the creator does to a storyboard video: start it with the episode's
// pages, approve the plan or ask for a change, choose a scene's build,
// record or upload a camera scene's take, and try again after a stop.
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Snapshot } from '../../shared/api'
import {
  BUILD_TYPES,
  BUILD_LABELS,
  type BuildType,
  type Storyboard
} from '../../shared/storyboard'
import { addEvent } from '../activity'
import { storeAsset } from '../persistence'
import { changeProject } from '../projects'
import { Refusal } from '../refusal'
import { probeSeconds } from '../voice'
import { scheduleStoryboard } from './pipeline'

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

/** Approve the plan, or send it back with a change in the creator's words. */
export const approveStoryboard = async (projectId: string, raw: unknown) => {
  const note = String((raw as { note?: unknown } | null)?.note ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    if (storyboard.stage !== 'review' || storyboard.waitingFor !== 'approval')
      throw new Refusal('The plan is not waiting for you')
    if (note) {
      storyboard.note = note
      storyboard.stage = 'plan'
      addEvent(current, 'video', 'Planning again with your change')
    } else {
      storyboard.approved = true
      storyboard.stage = 'voice'
      addEvent(current, 'video', 'Plan approved: making the video')
    }
    storyboard.status = 'working'
    delete storyboard.waitingFor
    storyboard.updatedAt = new Date().toISOString()
  })
  scheduleStoryboard(projectId)
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
    if (storyboard.stage !== 'review')
      throw new Refusal(
        'A scene’s build can change while the plan waits for you'
      )
    const scene = storyboard.plan?.scenes.find(
      (entry) => entry.pageId === pageId
    )
    if (!scene) throw new Refusal('Scene not found')
    if (scene.build === build) return
    const page = current.project.slides.find((slide) => slide.id === pageId)
    storyboard.builds = { ...storyboard.builds, [pageId]: build }
    storyboard.note = `Build the scene for “${page?.title || pageId}” as ${BUILD_LABELS[build].toLowerCase()}; keep the rest of the plan.`
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

const TAKE_TYPES: Record<string, string> = {
  'video/webm': '.webm',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav'
}

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
  try {
    const path = join(dir, `take${extension}`)
    await writeFile(path, body)
    duration = Math.round((await probeSeconds(path)) * 100) / 100
  } catch {
    throw new Refusal(
      'The take could not be read. Record it again, or upload an MP4 or WebM file'
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  if (duration < 0.5) throw new Refusal('The take is too short')
  const stored = await storeAsset({
    body,
    contentType: type,
    kind: 'storyboard-take',
    extension,
    projectId
  })
  let resume = false
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    const scene = storyboard.plan?.scenes.find(
      (entry) => entry.pageId === pageId
    )
    if (!scene) throw new Refusal('Scene not found')
    if (
      ['shots', 'frames', 'assemble', 'render'].includes(storyboard.stage) &&
      storyboard.status === 'working'
    )
      throw new Refusal('Wait until this step finishes to change a take')
    const replaced = Boolean(scene.take)
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

/** Carry on after a stop, from the stage that stopped. */
export const retryStoryboard = async (projectId: string) => {
  const snapshot = await changeProject(projectId, (current) => {
    const storyboard = storyboardOf(current)
    if (storyboard.status !== 'failed')
      throw new Refusal('Nothing to try again')
    storyboard.status = 'working'
    delete storyboard.error
    storyboard.updatedAt = new Date().toISOString()
    addEvent(current, 'video', 'Trying again')
  })
  scheduleStoryboard(projectId)
  return snapshot
}

/** On startup: carry on with productions that were working. */
export const resumeStoryboards = (snapshots: Snapshot[]) => {
  for (const snapshot of snapshots)
    if (snapshot.project.video?.storyboard?.status === 'working')
      scheduleStoryboard(snapshot.project.id)
}
