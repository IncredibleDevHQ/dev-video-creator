import type { Snapshot } from '../shared/api'
import { escape } from './ui'
import { buildPhase } from './wireframe-progress'
export const presentationProgress = (snapshot: Snapshot) => {
  if (snapshot.status === 'failed')
    return `<div class="generation-progress" role="status"><h2>${snapshot.stopping ? 'Generation stopped' : 'Your wireframes need attention'}</h2><p>${escape(snapshot.error || 'The last step could not finish.')}</p><p>Use the recovery action below to continue this notebook.</p></div>`
  if (snapshot.status === 'ready')
    return '<div class="generation-progress"><h2>Start with a wireframe</h2><p>Add a wireframe, then tell us what it should explain.</p></div>'
  const event = [...snapshot.events]
    .reverse()
    .find((event) => event.kind === 'slide')
  // The same words as the stage tab and the agent pill.
  const message = buildPhase(snapshot)?.line || 'Preparing your wireframes'
  return `<div class="generation-progress" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><h2>${escape(message)}</h2><p>Each wireframe will appear here as it is generated.</p><small data-progress-since="${escape(snapshot.progress?.startedAt || event?.time || '')}">${escape(progressElapsed(snapshot.progress?.startedAt || event?.time || ''))}</small><p class="progress-return">You can leave this notebook and return from the start screen.</p></div>`
}
export const progressElapsed = (time: string, now = Date.now()) => {
  const start = Date.parse(time)
  if (!Number.isFinite(start)) return ''
  const minutes = Math.max(0, Math.floor((now - start) / 60000))
  return minutes === 0
    ? 'This step just started.'
    : `This step started ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago.`
}
export const updateProgressTimes = (root: HTMLElement, now = Date.now()) => {
  for (const node of root.querySelectorAll<HTMLElement>(
    '[data-progress-since]'
  )) {
    node.textContent = progressElapsed(node.dataset.progressSince || '', now)
  }
}
