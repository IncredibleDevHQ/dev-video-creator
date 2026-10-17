import type { Snapshot } from '../shared/api'
import { escape } from './ui'
import { buildPhase } from './wireframe-progress'
/**
 * Whether the notebook keeps to its notes: only while its article is read,
 * or failed to read. A draft's Wireframe tab opens the empty stage, whose
 * Create starts the run (review 6: every render sent it back to the notes).
 */
export const notesOnly = (snapshot: Snapshot) =>
  Boolean(snapshot.sourceOnly) &&
  !snapshot.project.slides.length &&
  (snapshot.status === 'reading' || snapshot.status === 'failed')

export const presentationProgress = (snapshot: Snapshot, pending = false) => {
  if (snapshot.status === 'failed')
    return `<div class="generation-progress" role="status"><h2>${snapshot.stopping ? 'Generation stopped' : 'Wireframes stopped'}</h2><p>${escape(snapshot.error || 'The last step could not finish.')}</p><p>Use the recovery action below to continue this notebook.</p></div>`
  // A tab only changes the view: the run starts from this button (review 6).
  if (snapshot.status === 'draft')
    return `<div class="generation-progress"><h2>No wireframes yet</h2><p>Your agent reads the notes, plans the story and draws each wireframe. For a long article that takes about fifteen minutes.</p>${
      // Pressed, it says so at once, as the header's Create does (review 6).
      pending
        ? '<button type="button" class="primary" data-action="create-presentation" disabled aria-busy="true">Creating…</button>'
        : `<button type="button" class="primary" data-action="create-presentation" ${snapshot.readOnly ? 'disabled' : ''}>Create wireframes →</button>`
    }</div>`
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
