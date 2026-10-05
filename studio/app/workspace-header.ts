import { themeControl } from './appearance'
import { agentNames } from './agent-setup'
import type { Snapshot } from '../shared/api'
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
const wireframeTools = (status: Snapshot['status']) =>
  `<button type="button" data-action="look-panel" class="header-look" title="Colours and fonts">${palette}<span>Look</span></button>` +
  `<button type="button" data-action="rehearse" class="header-look" title="Rehearse with the script: ← → P F Esc" ${status === 'reading' ? 'disabled' : ''}>${play}<span>Rehearse</span></button>` +
  `<button type="button" data-action="export" class="header-export icon-button" aria-label="Export wireframes" title="Export wireframes" ${status !== 'ready' ? 'disabled' : ''}>${exportIcon}</button>`

/**
 * What the agent is doing, in a few words, for the header pill — the one
 * place the run's progress is counted (review 5: one status, said once).
 */
export const agentActivity = (snapshot: Snapshot) => {
  const { project } = snapshot
  if (snapshot.status === 'reading') return 'reading the article'
  if (snapshot.status === 'building') {
    if (snapshot.stopping) return 'stopping'
    const total = snapshot.plannedSlides || 0
    const drawn = project.slides.filter((slide) => slide.svg).length
    if (!total) {
      const last = [...snapshot.events]
        .reverse()
        .find((event) => event.kind === 'slide')?.message
      return last && /Planning the story/.test(last)
        ? 'planning the story'
        : 'reading the article'
    }
    const now = (snapshot.drawing || []).map((index) => index + 1)
    if (now.length)
      return `drawing ${now.length > 1 ? `${now.slice(0, -1).join(', ')} and ${now.at(-1)}` : now[0]} of ${total}`
    return drawn >= total
      ? 'checking the wireframes'
      : `drawing ${drawn + 1} of ${total}`
  }
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
  if (!harness)
    return `<button type="button" class="agent-pill" data-action="agent-menu" data-popover="agent">Choose agent${chevron}</button>`
  const name = agentNames[harness.adapter]
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
  if (name === 'video' && status !== 'ready') return 'Make the wireframes first'
  return ''
}

export const workspaceHeader = (
  snapshot: Snapshot,
  stage: string,
  liveConnected: boolean
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
<div class="header-actions">${agentPill(snapshot, liveConnected)}<div class="header-utilities">${themeControl()}${
    project.video
      ? `<button type="button" data-action="video-settings" class="icon-button" aria-label="Notebook settings" title="Notebook settings">${gear}</button>`
      : `<button type="button" data-action="settings" class="icon-button" aria-label="Settings" title="Settings">${gear}</button>`
  }</div><div class="header-stage-actions">${
    stage === 'notebook'
      ? notebookNextAction(snapshot)
      : stage === 'presentation'
        ? wireframeTools(status) +
          button(
            project.video ? 'Continue video →' : 'Make the video →',
            'make-video',
            true,
            status !== 'ready'
          )
        : stage === 'video'
          ? videoHeader(snapshot)
          : ''
  }</div></div>
</header>`
}
