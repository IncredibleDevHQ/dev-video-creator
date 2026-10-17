import type { Snapshot } from '../../shared/api'
import type { Project } from '../../shared/model'
import { addEvent } from '../activity'

/** Inputs that a storyboard production took from its wireframes. */
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
          capture: slide.capture
        }
      )
    })
  })
}

/**
 * After a change: a production whose wireframes changed under it goes stale,
 * but before its plan is approved there is no cut to go stale, so the plan is
 * made again with the new wireframes (a segue rewritten mid-plan showed
 * "Changed since build" on a first build, review 8 F04). True when a plan
 * waiting for approval went back to planning and must be run again.
 */
export const sourcesChanged = (
  snapshot: Snapshot,
  boardId: string | undefined,
  before: string
) => {
  const board = snapshot.project.video?.storyboard
  if (!board || board.id !== boardId) return false
  if (before === storyboardSources(snapshot.project)) return false
  const planning = board.stage === 'plan' || board.stage === 'review'
  if (board.approved || board.produced || !planning) {
    board.stale = true
    return false
  }
  if (board.status === 'working') board.replan = true
  if (board.status !== 'waiting') return false
  board.stage = 'plan'
  board.status = 'working'
  delete board.waitingFor
  addEvent(
    snapshot,
    'video',
    'The wireframes changed: planning again with them'
  )
  return true
}
