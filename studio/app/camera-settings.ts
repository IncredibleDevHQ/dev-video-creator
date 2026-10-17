import { html } from './ui'
import type { Presence, Scene, VideoSettings } from '../shared/model'
import { escape } from './ui'
import { presenceAt } from '../shared/orchestration'
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
  index: number,
  /** Whether the scene is in the video, from the engine's scene display. */
  inVideo = true,
  count = index + 1
) => {
  // With a template, the direction sets each scene's presence by its place.
  const following = presenceAt(settings, index, count)
  const source = settings.narrative
    ? 'the template’s direction'
    : 'notebook default'
  return html`<p class="eyebrow">SCENE ${index + 1}</p>
    ${
      // A left-out scene offers only Make this scene: changing its camera
      // there would fail (review 6).
      inVideo
        ? html`<h2>On camera</h2>
            <p class="settings-note">
              ${scene.presence
                ? 'Custom for this scene'
                : `Following ${source} · ${cameraChoices[following].title}`}
            </p>
            <div class="camera-options">
              ${(Object.keys(cameraChoices) as Presence[])
                .map(
                  (value) =>
                    html`<button
                      type="button"
                      data-presence="${value}"
                      aria-pressed="${(scene.presence || following) === value}"
                    >
                      <strong>${cameraChoices[value].title}</strong
                      ><span>${cameraChoices[value].description}</span>
                    </button>`
                )
                .join('')}
            </div>
            ${scene.presence
              ? `<button type="button" class="quiet" data-presence="inherit">Use ${source}</button>`
              : ''}`
        : ''
    }
    ${
      // Practice offers one action; making the animation is the scene's
      // (review 6).
      // Offered only when the engine would take it: written, and not
      // stopped while being written.
      inVideo &&
      scene.creativePlan &&
      scene.moments.length > 0 &&
      scene.animation?.inputKey !== scene.animationKey &&
      (['waiting', 'produced'].includes(scene.phase) ||
        (scene.phase === 'failed' && scene.failure === 'production'))
        ? html`<h2 class="scene-membership-title">Animation</h2>
            <p class="settings-note">
              Make it now to practice over it; it plays on the stage when ready.
            </p>
            <button type="button" class="quiet" data-action="make-animation">
              Make the animation
            </button>`
        : ''
    }
    <h2 class="scene-membership-title">In the video</h2>
    ${inVideo
      ? html`<p class="settings-note">
            Leave it out, and finishing the video skips it. An agent working on
            it stops; what the scene already has is kept.
          </p>
          <button type="button" class="quiet" data-action="leave-out-scene">
            Leave scene ${index + 1} out
          </button>`
      : html`<p class="settings-note">Not in the video yet.</p>
          <button
            type="button"
            class="primary"
            data-action="make-scene"
            data-scene-id="${escape(scene.id)}"
          >
            Make this scene
          </button>`}`
}
