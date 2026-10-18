// What every stage of a storyboard production shares: where the harness
// reaches the studio, how many frames are made at once, the notebook's
// storyboard changed in place, and the harness the notebook chose.
import type { Snapshot } from '../../shared/api'
import { stoppedLine, type Storyboard } from '../../shared/storyboard'
import { addEvent } from '../activity'
import { generationFailure, generationStops } from '../generation-errors'
import { changeProject, loadProject } from '../projects'
import { detectedHarness } from '../notebook-intake'
import { planSummary, type Internal } from './state'

export const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
export const concurrency = () =>
  Math.max(
    1,
    Math.min(6, Number(process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY) || 3)
  )

export const update = (
  projectId: string,
  change: (storyboard: Storyboard, snapshot: Snapshot) => void
) =>
  changeProject(projectId, (snapshot) => {
    const storyboard = snapshot.project.video?.storyboard
    if (!storyboard) return
    change(storyboard, snapshot)
    // A stop only means something while it works (review 8 F11).
    if (storyboard.status !== 'working') delete storyboard.stopping
    storyboard.updatedAt = new Date().toISOString()
  })

/** The creator pressed Stop: the frames still to make are left alone, and
 * the ones it cut short go back as they were, with nothing said against
 * them; the board says Stopped once (review 8 F11, round 2). */
export const stopAsked = async (projectId: string) =>
  Boolean((await loadProject(projectId))?.project.video?.storyboard?.stopping)
/** A frame's failure taken back, as Stop cut it short or as it is tried
 * again: posed if its still is, else an outline. A frame tried again read
 * Stopped, its old error under it, while it was posed (review 8, round 2). */
export const clearFailure = (internal: Internal, number: number) => {
  delete internal.problems?.[number]
  if (internal.stills?.[number]) internal.statuses![number] = 'built'
  else delete internal.statuses![number]
}

export const takesOf = (storyboard: Storyboard) =>
  Object.fromEntries(
    (storyboard.plan?.scenes || [])
      .filter((scene) => scene.take !== undefined)
      .map((scene) => [scene.pageId, scene.take ?? null])
  )

/** The plan as the creator sees it now: a take's place for each scene that
 * needs one (a camera scene, or every scene while the creator speaks), and
 * every take given so far (review 7). */
export const summaryNow = (
  internal: Internal,
  storyboard: Storyboard,
  snapshot: Snapshot
) =>
  planSummary(
    internal,
    takesOf(storyboard),
    snapshot.project.video?.settings.voice.kind === 'record',
    storyboard.keptClaims
  )

export const selectionOf = async (snapshot: Snapshot) => {
  const chosen =
    snapshot.project.video?.settings.harness || snapshot.project.harness
  const selection = chosen || (await detectedHarness())
  return {
    adapter: selection.adapter,
    ...(selection.model ? { model: selection.model } : {})
  }
}

/** The scenes' page titles, for the board's headings. */
export const pageTitles = (snapshot: Snapshot) =>
  Object.fromEntries(
    snapshot.project.slides.map((slide) => [slide.id, slide.title])
  )

export type StageInput = {
  snapshot: Snapshot
  storyboard: Storyboard
  dir: string
  internal: Internal
}

/** The skill files a camera or motion scene's shots, stills and frames read. */
export const LAYOUTS = ['overlay.html', 'pip.html', 'split.html', 'stack.html']
export const MOTION = ['motion-vocabulary.md']

/** Stopped by the creator: what is made stays, and Try again carries on. */
export const stopNow = (projectId: string) =>
  update(projectId, (storyboard, snapshot) => {
    if (storyboard.status !== 'working') return
    storyboard.status = 'failed'
    storyboard.error = generationStops.user
    delete storyboard.stopping
    addEvent(snapshot, 'video', stoppedLine(storyboard), { activity: 'failed' })
  })

/** A stage that threw: the production stops with why, in a line. */
export const fail = (projectId: string, error: unknown) =>
  update(projectId, (storyboard, snapshot) => {
    storyboard.status = 'failed'
    // A run the creator stopped ends in a refusal: it says it was stopped.
    storyboard.error = storyboard.stopping
      ? generationStops.user
      : generationFailure(
          error,
          error instanceof Error ? error.message : String(error)
        )
    // The activity says why in one line; the details stay with the error.
    // Stopped by the creator, it says what was kept (review 8, round 3).
    const said = storyboard.stopping
      ? stoppedLine(storyboard)
      : `Stopped: ${storyboard.error.split('\n')[0]}`
    delete storyboard.stopping
    addEvent(snapshot, 'video', said, { activity: 'failed' })
  })
