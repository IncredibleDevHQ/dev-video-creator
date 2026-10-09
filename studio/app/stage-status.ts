import {
  presentationDisplay,
  projectViews,
  videoDisplay
} from '../shared/state'
import type { Snapshot } from '../shared/api'
import { buildPhase } from './wireframe-progress'

/**
 * The short caption after a stage's name in the header: one plain word
 * ("drawing", "stopped", "next") or a count of produced scenes. The agent pill
 * carries the run's progress, so the tab does not count it again (review 5).
 */
const caption = (
  snapshot: Snapshot,
  stage: string,
  label: string,
  active: boolean
) => {
  const { project } = snapshot
  if (label === 'Stopped') return 'stopped'
  if (stage === 'presentation') {
    const phase = buildPhase(snapshot)
    if (active || phase?.word === 'reading') return phase?.word || 'drawing'
    if (label === 'Not started') return 'next'
  }
  if (stage === 'video') {
    // Busy, the tab says the step's verb; the pill says the rest.
    if (active) return label.split(' ')[0].toLowerCase()
    const video = project.video
    if (!video) return snapshot.status === 'ready' ? 'next' : ''
    const views = snapshot.views || projectViews(project, snapshot.events)
    if (views.video.action === 'export') return 'ready'
    const made = views.video.madeScenes ?? video.scenes.length
    return made ? `${views.video.producedScenes}/${made}` : 'no scenes'
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
  // The Wireframe tab's tooltip and screen-reader words name the phase, as
  // its caption, the pill and the card do (review 6).
  const phase = stage === 'presentation' ? buildPhase(snapshot) : null
  if (phase && (active || phase.word === 'reading')) label = phase.line
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
      : label === 'Stopped'
        ? 'needs-attention'
        : 'is-idle'
  const text = overridden
    ? label.toLowerCase()
    : caption(snapshot, stage, label, active)
  if (!text) return ''
  return `<span class="stage-status ${state}" title="${label}"><span class="sr"> · ${label}</span><span class="stage-caption" aria-hidden="true">${text}</span></span>`
}
