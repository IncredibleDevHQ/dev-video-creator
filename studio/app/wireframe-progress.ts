import type { Snapshot } from '../shared/api'
import { wireframeStatus } from './wireframe-copy'

/**
 * Where one wireframe stands while the deck is drawn: being drawn now, a
 * draft waiting its turn, or done (the checks kept it). Null once the deck
 * is ready, and for a page with no picture yet.
 */
export type PageWork = 'drawing' | 'draft' | 'done'
export const pageWork = (
  snapshot: Snapshot,
  slideId: string
): PageWork | null => {
  if (snapshot.status !== 'building' && snapshot.status !== 'failed')
    return null
  const index = snapshot.plan?.findIndex((entry) => entry.id === slideId) ?? -1
  if (index >= 0 && snapshot.status === 'building')
    if (snapshot.drawing?.includes(index)) return 'drawing'
  if (index >= 0 && snapshot.kept?.includes(index)) return 'done'
  const slide = snapshot.project.slides.find((page) => page.id === slideId)
  return slide?.svg?.trim() ? (slide.draft ? 'draft' : 'done') : null
}
/** How many wireframes are done: kept by the checks, or final. */
export const doneCount = (snapshot: Snapshot) =>
  snapshot.kept?.length ??
  snapshot.project.slides.filter((page) => page.svg?.trim() && !page.draft)
    .length

/** Done pages are progress; a draft is not, until the checks keep it. */
export const wireframeProgress = (snapshot: Snapshot, connected = true) => {
  const saved = doneCount(snapshot)
  const total = Math.max(
    snapshot.plannedSlides || 0,
    snapshot.project.slides.length
  )
  const working = snapshot.status === 'building'
  const active =
    working && !snapshot.stopping && !snapshot.readOnly && connected
  const checking = working && total > 0 && saved >= total
  const label =
    snapshot.readOnly && working
      ? 'Saved progress'
      : !connected && working
        ? 'Reconnecting'
        : snapshot.stopping
          ? working
            ? 'Stopping generation'
            : 'Generation stopped'
          : snapshot.status === 'failed'
            ? 'Generation needs attention'
            : snapshot.status === 'ready'
              ? 'Wireframes ready'
              : checking
                ? 'Checking wireframes'
                : total
                  ? 'Generating wireframes'
                  : wireframeStatus(
                      snapshot.progress?.label || 'Preparing wireframes'
                    )
  return { saved, total, active, checking, label }
}
