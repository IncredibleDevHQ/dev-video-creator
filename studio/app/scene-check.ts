import type { Scene } from '../shared/model'
import { escape } from './ui'

/**
 * What stopped a scene, in plain words beside Try again, with Accept as is
 * when only the soft checks refused it; or the finding a made scene was
 * accepted with (review 6).
 */
export const sceneCheck = (scene: Scene) =>
  scene.phase === 'failed' && scene.failure === 'production' && scene.lastCheck
    ? `<div class="scene-check" role="status"><span>The last check: ${escape(scene.lastCheck)}.</span>${
        scene.acceptable
          ? `<button type="button" data-action="accept-scene" title="Only the motion and frame checks refused it">Accept as is</button>`
          : ''
      }</div>`
    : scene.notice && accepted(scene)
      ? `<div class="scene-check is-notice" role="status"><span>${escape(scene.notice)}.</span></div>`
      : ''

/** The scene still shows what was accepted: in the video, and not changed
 * since its animation or its making. */
const accepted = (scene: Scene) =>
  !['failed', 'idle'].includes(scene.phase) &&
  ((scene.produced && scene.produced.inputKey === scene.inputKey) ||
    (scene.animation && scene.animation.inputKey === scene.animationKey))
