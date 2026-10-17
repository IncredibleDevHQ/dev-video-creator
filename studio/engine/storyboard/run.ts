// What every stage of a storyboard production shares: where the harness
// reaches the studio, how many frames are made at once, the notebook's
// storyboard changed in place, and the harness the notebook chose.
import type { Snapshot } from '../../shared/api'
import type { Storyboard } from '../../shared/storyboard'
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
export const leaveAsWas = (internal: Internal, number: number) => {
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
