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

/**
 * The deck's run as one phase, said the same way in the stage tab, the agent
 * pill and the card on the stage (review 6): a word for the tab, a line for
 * the card, and the count, which only the pill shows.
 */
export type BuildPhase = { word: string; line: string; count: string }
export const buildPhase = (snapshot: Snapshot): BuildPhase | null => {
  if (snapshot.status === 'reading')
    return { word: 'reading', line: 'Reading the article', count: '' }
  if (snapshot.status !== 'building') return null
  if (snapshot.stopping)
    return { word: 'stopping', line: 'Stopping', count: '' }
  const total = snapshot.plannedSlides || 0
  if (total) {
    const done = doneCount(snapshot)
    if (done >= total)
      return { word: 'checking', line: 'Checking the wireframes', count: '' }
    const now = (snapshot.drawing || []).map((index) => index + 1)
    const pages =
      now.length > 1
        ? `${now.slice(0, -1).join(', ')} and ${now.at(-1)}`
        : String(now[0])
    return {
      word: 'drawing',
      line: 'Drawing the wireframes',
      count: now.length
        ? `${pages} of ${total}${done ? ` · ${done} done` : ''}`
        : `${done + 1} of ${total}`
    }
  }
  const stage =
    snapshot.progress?.label ||
    [...snapshot.events].reverse().find((event) => event.kind === 'slide')
      ?.message ||
    ''
  if (/Designing|Drawing/.test(stage))
    return { word: 'drawing', line: 'Drawing the wireframes', count: '' }
  return /Planning the story/.test(stage)
    ? { word: 'planning', line: 'Planning the story', count: '' }
    : { word: 'understanding', line: 'Understanding the source', count: '' }
}

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
