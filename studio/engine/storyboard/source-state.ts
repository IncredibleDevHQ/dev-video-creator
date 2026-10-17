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
  if (before === storyboardSources(snapshot.project)) return
  const planning = board.stage === 'plan' || board.stage === 'review'
  if (board.approved || board.produced || !planning) board.stale = true
  else if (board.status !== 'failed') board.replan = true
}
