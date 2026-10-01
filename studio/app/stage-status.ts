import { presentationDisplay, videoDisplay } from '../shared/state'
import type { Snapshot } from '../shared/api'
export const stageStatus = (
  snapshot: Snapshot,
  stage: string,
  connected = true
) => {
  const display =
    stage === 'presentation'
      ? presentationDisplay(snapshot)
      : stage === 'video'
        ? snapshot.views?.video.display || videoDisplay(snapshot)
        : { label: '', active: false }
  let { label, active } = display
  if (active && snapshot.readOnly) {
    label = 'Saved'
    active = false
  } else if (active && !connected) {
    label = 'Reconnecting'
    active = false
  }
  const state = active
    ? 'is-processing'
    : label === 'Ready'
      ? 'is-ready'
      : label === 'Needs attention'
        ? 'needs-attention'
        : 'is-idle'
  const icon =
    label === 'Ready'
      ? '<path d="m3 7 2.5 2.5L11 4"/>'
      : label === 'Needs attention'
        ? '<circle cx="7" cy="7" r="5.25"/><path d="M7 4v3M7 9.5v.1"/>'
        : '<circle cx="7" cy="7" r="2" fill="currentColor" stroke="none"/>'
  return label
    ? `<span class="stage-status ${state}" title="${label}"><span class="sr"> · ${label}</span>${
        active
          ? ''
          : `<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`
      }</span>`
    : ''
}
