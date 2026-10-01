import type { Snapshot } from '../shared/api'
import { escape, button } from './ui'
import { gear } from './camera-settings'
import { stageStatus } from './stage-status'
import { videoHeader } from './video-screen'
import incredibleLogo from './assets/incredible-logo.svg'
export const workspaceHeader = (
  snapshot: Snapshot,
  stage: string,
  liveConnected: boolean
) => {
  const { project, status } = snapshot
  return `<header>
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
        `<button data-stage="${name}" aria-current="${
          stage === name ? 'page' : 'false'
        }">${name[0].toUpperCase() + name.slice(1)}${stageStatus(
          snapshot!,
          name,
          liveConnected
        )}</button>`
    )
    .join('')}</nav>
<div class="header-actions">${
    project.video
      ? `<button type="button" data-action="video-settings" class="icon-button" aria-label="Notebook settings" title="Notebook settings">${gear}</button>`
      : button('Settings', 'settings')
  }${
    stage === 'notebook'
      ? button('View slides →', 'view-slides', true, status !== 'ready')
      : stage === 'presentation'
        ? button('Export slides', 'export', false, status !== 'ready') +
          button(
            project.video ? 'Continue video →' : 'Make the video →',
            'make-video',
            true,
            status !== 'ready'
          )
        : stage === 'video'
          ? videoHeader(snapshot)
          : ''
  }</div>
</header>`
}
