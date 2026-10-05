import type { Snapshot } from '../shared/api'
import { escape } from './ui'
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

export const wireframeRunBar = (snapshot: Snapshot, connected = true) => {
  if (!['building', 'failed', 'ready'].includes(snapshot.status)) return ''
  // Video work has its own activity surface.
  if (snapshot.project.video && snapshot.status === 'ready') return ''
  const state = wireframeProgress(snapshot, connected)
  const tone = state.active
    ? 'working'
    : snapshot.status === 'failed'
      ? 'attention'
      : 'settled'
  const count = state.total
    ? `${state.saved} of ${state.total} saved`
    : 'Preparing the story'
  return `<div class="wireframe-run-bar ${tone}" aria-label="Wireframe generation">
    <div class="wireframe-run-summary" role="status" aria-live="polite">
      <span class="${state.active ? 'activity-orbit' : 'run-state-dot'}" aria-hidden="true"></span>
      <strong>${escape(state.label)}</strong><span class="run-count">${count}</span>
    </div>
    <div class="wireframe-run-actions">
      ${state.total ? `<progress max="${state.total}" value="${state.saved}" aria-label="Saved wireframes" aria-valuetext="${count}${snapshot.status !== 'ready' ? '; final checks still required' : ''}"></progress>` : ''}
      ${state.active && snapshot.progress?.startedAt ? `<small data-progress-since="${escape(snapshot.progress.startedAt)}"></small>` : ''}
      <button type="button" data-action="history" class="run-details">Activity <span aria-hidden="true">↗</span></button>
    </div>
  </div>`
}

export const wireframeCanvasStatus = (
  snapshot: Snapshot,
  selected: number,
  pendingEdit: boolean,
  connected: boolean
) => {
  const page = snapshot.project.slides[selected]
  if (snapshot.status !== 'building' && !pendingEdit) return ''
  const state = wireframeProgress(snapshot, connected)
  const active = pendingEdit ? connected && !snapshot.readOnly : state.active
  const label = !connected
    ? 'Reconnecting'
    : snapshot.readOnly
      ? 'Saved preview'
      : pendingEdit
        ? 'Updating this wireframe'
        : snapshot.stopping
          ? 'Stopping generation'
          : state.checking
            ? 'Final checks in progress'
            : 'Generation in progress'
  return `<div class="wireframe-canvas-status" role="status">
    <span>${page?.svg ? `Wireframe ${selected + 1} · ${page.draft ? 'Draft saved' : 'Saved'}` : 'Building your wireframes'}</span>
    <span>${active ? '<i class="activity-orbit" aria-hidden="true"></i>' : ''}${label}</span>
  </div>`
}
