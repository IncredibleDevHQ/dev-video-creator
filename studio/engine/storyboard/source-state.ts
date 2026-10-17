import { createHash } from 'node:crypto'
import type { Snapshot } from '../../shared/api'
import type { Project } from '../../shared/model'

/** Inputs that a storyboard production took from its wireframes. A product
 * capture counts once it is made, not while it is planned or recorded. */
export const storyboardSources = (project: Project) => {
  const board = project.video?.storyboard
  if (!board) return ''
  return JSON.stringify({
    branding: project.branding,
    pages: board.pages.map((id) => {
      const slide = project.slides.find((page) => page.id === id)
      return (
        slide && {
          id,
          title: slide.title,
          svg: slide.svg,
          narration: slide.narration,
          idea: slide.idea,
          capture: slide.capture?.objectKey ?? slide.capture?.last?.objectKey
        }
      )
    })
  })
}

/**
 * After a change: a production whose wireframes changed under it goes stale.
 * Before its plan is approved there is no cut to go stale: the plan is marked
 * to be made again, and the creator plans again when ready, so a change
 * never starts a paid run by itself (review 8 F04: a segue rewritten mid-plan
 * showed "Changed since build" on a first build).
 */
export const sourcesChanged = (
  snapshot: Snapshot,
  boardId: string | undefined,
  before: string
) => {
  const board = snapshot.project.video?.storyboard
  if (!board || board.id !== boardId) return
  const now = storyboardSources(snapshot.project)
  if (before === now) return
  const print = (sources: string) =>
    createHash('sha1').update(sources).digest('hex')
  // Back to what it was made from (an Undo put the lines back): nothing in
  // it is old any more (review 8, round 3: it stayed stale).
  if ((board.stale || board.replan) && board.changedFrom === print(now)) {
    delete board.stale
    delete board.replan
    delete board.changedFrom
    return
  }
  if (!board.stale && !board.replan) board.changedFrom = print(before)
  const planning = board.stage === 'plan' || board.stage === 'review'
  if (board.approved || board.produced || !planning) board.stale = true
  else if (board.status !== 'failed') board.replan = true
}
