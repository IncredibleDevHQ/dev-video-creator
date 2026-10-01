import { html } from './ui'
import type { Presence, Scene, VideoSettings } from '../shared/model'
import { escape } from './ui'
export const gear =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9.5 3-.6 2.1-2 .9-2-.6-2.4 4.2L4 11.2v2L2.5 15l2.4 4.1 2-.6 2 .9.6 2.1h5l.6-2.1 2-.9 2 .6 2.4-4.1-1.5-1.8v-2l1.5-1.6L19.1 5l-2 .6-2-.9-.6-1.7z"/><circle cx="12" cy="12" r="3"/></svg>'
export const cameraChoices: Record<
  Presence,
  { title: string; description: string }
> = {
  off: { title: 'Off', description: 'Graphics only. You stay off camera.' },
  low: { title: 'Low', description: 'Appear at the close of each scene.' },
  high: {
    title: 'High',
    description: 'Open, close, and step in where it helps.'
  }
}
export const sceneSettings = (
  scene: Scene,
  settings: VideoSettings,
  index: number
) =>
  html`<p class="eyebrow">SCENE ${index + 1}</p>
    <h2>On camera</h2>
    <p class="settings-note">
      ${scene.presence
        ? 'Custom for this scene'
        : `Following notebook default · ${cameraChoices[settings.presence].title}`}
    </p>
    <div class="camera-options">
      ${(Object.keys(cameraChoices) as Presence[])
        .map(
          (value) =>
            html`<button
              type="button"
              data-presence="${value}"
              aria-pressed="${(scene.presence || settings.presence) === value}"
            >
              <strong>${cameraChoices[value].title}</strong
              ><span>${cameraChoices[value].description}</span>
            </button>`
        )
        .join('')}
    </div>
    ${scene.presence
      ? '<button type="button" class="quiet" data-presence="inherit">Use notebook default</button>'
      : ''}`
