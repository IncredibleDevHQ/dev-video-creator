import { themeControl } from './appearance'
import { agentNames, foundAgent } from './agent-setup'
import type { Snapshot } from '../shared/api'
import { buildPhase } from './wireframe-progress'
import { videoOpens } from '../shared/state'
import { escape, button } from './ui'
import { gear } from './camera-settings'
import { stageStatus } from './stage-status'
import { notebookNextAction } from './notebook-next-step'
import { videoHeader } from './video-screen'
import incredibleLogo from './assets/incredible-logo.svg'

const chevron =
  '<svg class="agent-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
const exportIcon =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>'
const palette =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>'

const play =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'
const mapIcon =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><rect x="14" y="9" width="7" height="6" rx="1.5"/><path d="M10 7h2a2 2 0 0 1 2 2v1M10 17h2a2 2 0 0 0 2-2v-1"/></svg>'
const dots =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>'
// Narrower, the tools keep their icons and name themselves in the tooltip.
const wireframeTools = (snapshot: Snapshot) => {
  const { status } = snapshot
  const drawn = snapshot.project.slides.some((slide) => slide.svg)
  return (
    `<button type="button" data-action="open-map" class="header-look" aria-label="Map" title="The content map: notes, episodes, and where each page is used" ${status !== 'ready' && status !== 'building' ? 'disabled' : ''}>${mapIcon}<span>Map</span></button>` +
    `<button type="button" data-action="look-panel" class="header-look" aria-label="Look" title="Colours and fonts">${palette}<span>Look</span></button>` +
    `<button type="button" data-action="rehearse" class="header-look" aria-label="Rehearse" title="${drawn ? 'Rehearse with the script: ← → P F Esc' : 'Rehearse once a wireframe is drawn'}" ${drawn ? '' : 'disabled'}>${play}<span>Rehearse</span></button>`
  )
}

/** What waits behind ••• in the header: the theme, and the wireframes'
 * export on the Wireframe stage. */
export const headerMore = (snapshot: Snapshot, stage: string) =>
  `<div class="header-more-list" role="menu" aria-label="More">${
    stage === 'presentation'
      ? `<button type="button" role="menuitem" data-action="export" ${snapshot.status !== 'ready' ? 'disabled' : ''}>${exportIcon}<span>Export wireframes (PDF)</span></button>`
      : ''
  }<div class="header-more-row"><span>Appearance</span>${themeControl()}</div></div>`

/**
 * What the agent is doing, in a few words, for the header pill — the one
 * place the run's progress is counted (review 5: one status, said once).
 */
export const agentActivity = (snapshot: Snapshot) => {
  const { project } = snapshot
  // The same phase as the tab and the card; only the pill counts pages.
  const phase = buildPhase(snapshot)
  if (phase)
    return phase.count
      ? `${phase.word} ${phase.count}`
      : phase.line.toLowerCase()
  const working = snapshot.changes?.find((change) => change.state === 'working')
  if (working) {
    const index = project.slides.findIndex(
      (slide) => slide.id === working.slideId
    )
    return `changing wireframe ${index + 1}`
  }
  const waiting =
    snapshot.changes?.filter((change) => change.state === 'queued').length || 0
  if (waiting)
    return `${waiting} ${waiting === 1 ? 'change' : 'changes'} waiting`
  const video = snapshot.views?.video.display
  return video?.active && video.label ? video.label.toLowerCase() : ''
}

const agentPill = (snapshot: Snapshot, connected: boolean) => {
  const harness = snapshot.project.harness
  // Unchosen, the pill names the agent Create would use, as the row does.
  const found = foundAgent()
  if (!harness && !found)
    return `<button type="button" class="agent-pill" data-action="agent-menu" data-popover="agent">Choose agent${chevron}</button>`
  const name = agentNames[harness ? harness.adapter : found!]
  const activity = connected
    ? snapshot.readOnly
      ? ''
      : agentActivity(snapshot)
    : 'reconnecting'
  const working = connected && Boolean(activity)
  return `<button type="button" class="agent-pill${working ? ' is-working' : ''}${connected ? '' : ' is-offline'}" data-action="agent-menu" data-popover="agent" aria-label="Agent: ${escape(name)}${activity ? `, ${escape(activity)}` : ''}. Change agent or model"><i class="agent-dot" aria-hidden="true"></i><span class="agent-name">${escape(name)}</span>${activity ? `<span class="agent-activity">${escape(activity)}</span>` : ''}${chevron}</button>`
}

const lockedReason = (snapshot: Snapshot, name: string) => {
  const { status } = snapshot
  if (name === 'notebook') return ''
  if (status === 'reading') return 'Waiting for the article'
  if (snapshot.sourceOnly && status === 'failed')
    return 'The article needs another try'
  // While the deck is drawn, the video opens once every page has a draft.
  if (name === 'video' && !videoOpens(snapshot))
    return status === 'building'
      ? 'The video opens once every wireframe has a first draft'
      : 'Make the wireframes first'
  return ''
}

export const workspaceHeader = (
  snapshot: Snapshot,
  stage: string,
  liveConnected: boolean,
  pending = false
) => {
  const { project, status } = snapshot
  const title = project.title.replace(/ \| [^|]+$/, '')
  return `<header class="workspace-header">
<a class="brand" href="/" aria-label="Incredible Studio: all notebooks" title="All notebooks">
<img src="${incredibleLogo}" alt=""></a>
<div class="notebook-identity"><span class="header-sep" aria-hidden="true">/</span><a class="header-project-title" href="/?notebook=${encodeURIComponent(
    project.id
  )}" title="${escape(title)}">${escape(title)}</a></div>
<nav aria-label="Stages">${(['notebook', 'presentation', 'video'] as const)
    .map((name) => {
      const locked = lockedReason(snapshot, name)
      return `<button data-stage="${name}" ${locked ? `disabled title="${escape(locked)}"` : ''} aria-current="${
        stage === name ? 'page' : 'false'
      }">${name === 'presentation' ? 'Wireframe' : name[0].toUpperCase() + name.slice(1)}${stageStatus(
        snapshot!,
        name,
        liveConnected
      )}</button>`
    })
    .join('')}</nav>
<div class="header-actions">${agentPill(snapshot, liveConnected)}<div class="header-utilities">${
    project.video
      ? `<button type="button" data-action="video-settings" class="icon-button" aria-label="Notebook settings" title="Notebook settings">${gear}</button>`
      : `<button type="button" data-action="settings" class="icon-button" aria-label="Settings" title="Settings">${gear}</button>`
  }<button type="button" data-action="header-more" data-popover="header-more" class="icon-button" aria-label="More" title="More">${dots}</button></div><div class="header-stage-actions">${
    stage === 'notebook'
      ? notebookNextAction(snapshot, pending)
      : stage === 'presentation'
        ? wireframeTools(snapshot) +
          button(
            project.video ? 'Continue video →' : 'Make the video →',
            'make-video',
            true,
            !videoOpens(snapshot)
          )
        : stage === 'video'
          ? videoHeader(snapshot)
          : ''
  }</div></div>
</header>`
}
