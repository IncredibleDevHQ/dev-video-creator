import { sceneActivityDisplay } from '../shared/scene-activity'
export { sceneActivity } from '../shared/scene-activity'
import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
import { escape } from './ui'
export const sceneActivityRail = (
  snapshot: Snapshot,
  scene: Scene,
  connected: boolean
) => {
  const { intro, rows, progress, frontier } = sceneActivityDisplay(
    snapshot,
    scene,
    connected
  )
  return `<div class="scene-activity"><p class="activity-intro">${intro}</p><ol class="activity-log" aria-label="Scene activity">${rows
    .map((step, index) => {
      const { state, awaiting, event, openRecordings } = step
      const detail =
        progress &&
        index === frontier &&
        ((state === 'current' && progress.active) || state === 'stopped') &&
        ((progress.stage === 'composition' && step.stage === 'composition') ||
          (progress.stage === 'planning' &&
            ['planning', 'script'].includes(step.stage)))
          ? `<span class="activity-detail">${escape(
              progress.label
            )}</span><time datetime="${escape(
              progress.updatedAt
            )}">Last update ${escape(
              new Date(progress.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            )}</time>`
          : ''
      return `<li class="${state}"><span class="activity-marker" aria-hidden="true">${
        state === 'completed'
          ? '✓'
          : state === 'current' && connected && progress?.active !== false
            ? '<i class="activity-orbit"></i>'
            : ''
      }</span><div><p>${step.label}</p>${
        state === 'stopped'
          ? '<span class="activity-stopped-label">Stalled</span>'
          : ''
      }${
        awaiting
          ? `<span class="activity-detail">${openRecordings} ${
              openRecordings === 1 ? 'moment needs' : 'moments need'
            } your recording</span>`
          : detail ||
            (event
              ? `<time datetime="${escape(event.time)}">${escape(
                  new Date(event.time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                )}</time>`
              : '')
      }</div></li>`
    })
    .join('')}</ol></div>`
}
