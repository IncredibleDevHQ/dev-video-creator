import type { Snapshot } from '../shared/api'
import { wireframeStatus } from './wireframe-copy'

/** Saved artwork is progress, not final acceptance of the whole deck. */
export const wireframeProgress = (snapshot: Snapshot, connected = true) => {
  const saved = snapshot.project.slides.filter((page) =>
    page.svg?.trim()
  ).length
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
