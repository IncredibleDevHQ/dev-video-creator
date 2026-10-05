import { themeControl } from './appearance'
import { agentNames } from './agent-setup'
import type { Snapshot } from '../shared/api'
import { escape, button } from './ui'
import { gear } from './camera-settings'
import { stageStatus } from './stage-status'
import { wireframeRunBar } from './wireframe-progress'
import { notebookNextAction } from './notebook-next-step'
import { videoHeader } from './video-screen'
import incredibleLogo from './assets/incredible-logo.svg'
export const workspaceHeader = (
  snapshot: Snapshot,
  stage: string,
  liveConnected: boolean
) => {
  const { project, status } = snapshot
  return `<header class="workspace-header">
<a class="brand" href="/" aria-label="Incredible Studio">
<img src="${incredibleLogo}" alt="">Incredible</a>
<div class="notebook-identity">
<a class="header-project-title" href="/?notebook=${encodeURIComponent(
    project.id
  )}" title="Permanent notebook link">${escape(project.title)}</a>
</div>
<nav aria-label="Stages">${(['notebook', 'presentation', 'video'] as const)
    .map(
      (name) =>
        `<button data-stage="${name}" ${((status === 'reading' || (snapshot.sourceOnly && status === 'failed')) && name !== 'notebook') || (name === 'video' && status !== 'ready') ? 'disabled' : ''} aria-current="${
          stage === name ? 'page' : 'false'
        }">${name === 'presentation' ? 'Wireframe' : name[0].toUpperCase() + name.slice(1)}${stageStatus(
          snapshot!,
          name,
          liveConnected
        )}</button>`
    )
    .join('')}</nav>
<div class="header-actions">${
    project.harness
      ? `<button type="button" data-action="agent-settings" class="header-agent" title="Change harness and model" aria-label="Agent settings: ${escape(agentNames[project.harness.adapter])}, ${escape(project.harness.model || 'default model')}"><span>${escape(agentNames[project.harness.adapter])}</span><span class="header-model">${escape(project.harness.model || 'Default model')}</span><span aria-hidden="true">⌄</span></button>`
      : button('Choose agent', 'agent-settings')
  }<div class="header-utilities">${themeControl()}${
    project.video
      ? `<button type="button" data-action="video-settings" class="icon-button" aria-label="Notebook settings" title="Notebook settings">${gear}</button>`
      : `<button type="button" data-action="settings" class="icon-button" aria-label="Settings" title="Settings">${gear}</button>`
  }</div><div class="header-stage-actions">${
    stage === 'notebook'
      ? notebookNextAction(snapshot)
      : stage === 'presentation'
        ? `<button type="button" data-action="export" class="header-export icon-button" aria-label="Export wireframes" title="Export wireframes" ${status !== 'ready' ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg></button>` +
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
</header>${wireframeRunBar(snapshot, liveConnected)}`
}
