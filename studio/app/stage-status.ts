import {
  presentationDisplay,
  projectViews,
  videoDisplay
} from '../shared/state'
import type { Snapshot } from '../shared/api'
import { wireframeProgress } from './wireframe-progress'

/**
 * The short caption after a stage's name in the header: a count while the
 * stage works ("3/9"), "next" before it
 * starts, and "needs you" when something failed. The full status stays in the
 * title and for screen readers.
 */
const caption = (
  snapshot: Snapshot,
  stage: string,
  label: string,
  active: boolean
) => {
  const { project } = snapshot
  if (label === 'Needs attention') return 'needs you'
  if (stage === 'presentation') {
    if (active) {
      const progress = wireframeProgress(snapshot)
      return progress.checking
        ? 'checking'
        : progress.total
          ? `${progress.saved}/${progress.total}`
          : 'working'
    }
  }
  if (stage === 'video') {
    const video = project.video
    if (!video) return 'next'
    const views = snapshot.views || projectViews(project, snapshot.events)
    if (views.video.action === 'export') return 'ready'
    return `${views.video.producedScenes}/${video.scenes.length}`
  }
  return label.toLowerCase()
}

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
  let overridden = false
  if (active && snapshot.readOnly) {
    label = 'Saved'
    active = false
    overridden = true
  } else if (active && !connected) {
    label = 'Reconnecting'
    active = false
    overridden = true
  }
  if (!label) return ''
  // The sidebar already shows the count; a completed tab needs only its name.
  if (stage === 'presentation' && label === 'Ready')
    return '<span class="sr"> · Ready</span>'
  const state = active
    ? 'is-processing'
    : label === 'Ready'
      ? 'is-ready'
      : label === 'Needs attention'
        ? 'needs-attention'
        : 'is-idle'
  const text = overridden
    ? label.toLowerCase()
    : caption(snapshot, stage, label, active)
  return `<span class="stage-status ${state}" title="${label}"><span class="sr"> · ${label}</span><span class="stage-caption" aria-hidden="true">${text}</span></span>`
}
