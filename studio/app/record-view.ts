// Recording in place, the way practice runs: getting ready with the camera
// and microphone live, a countdown on the stage, and the controls to move
// on or stop. No form stands between Record and the take.
import type { Moment, Scene } from '../shared/model'
import type { Recording } from './recording'
import { button } from './ui'

/** A Record button's words for what it will record. */
export const recordLabel = (scene: Scene, plan: Moment[]) =>
  plan.length > 1
    ? plan.length === scene.moments.length
      ? 'Record scene'
      : `Record ${plan.length} moments`
    : plan[0]
      ? `Record moment ${scene.moments.indexOf(plan[0]) + 1}`
      : 'Record'

/** Recording, getting ready or not: the studio's heading. */
export const recordTitle = (capture: Recording) =>
  capture.phase === 'recording' ? 'Recording' : 'Get ready to record'

/** Which moment is being recorded, and how far through the plan. */
export const recordPlace = (
  capture: Recording,
  scene: number,
  moment: number
) =>
  `Scene ${scene} · Moment ${moment}${
    capture.moments.length > 1
      ? ` · ${capture.current + 1} of ${capture.moments.length}`
      : ''
  }`

/** The recording light and its clock, beside the heading. */
export const recordLight = (capture: Recording) =>
  capture.phase === 'recording'
    ? '<span class="rec-light"><i aria-hidden="true"></i>REC <time class="recording-clock">0:00.0</time></span>'
    : ''

/** Three, two, one, large on the stage. */
export const countdownOverlay = (capture: Recording) =>
  capture.phase === 'countdown'
    ? `<div class="record-countdown" role="status" aria-live="assertive"><b>${capture.countdown}</b></div>`
    : ''

const meter =
  '<span class="mic-meter" data-mic-meter role="img" aria-label="Microphone level"><i></i></span>'
const dot = '<span class="rec-dot" aria-hidden="true"></span>'

/** The controls under the stage, for where recording stands. */
export function recordActions(capture: Recording) {
  const many = capture.moments.length > 1,
    devices = capture.moments.some((moment) => moment.camera !== 'none')
      ? 'camera and microphone'
      : 'microphone'
  if (capture.phase === 'preparing')
    return `${button(`${dot} Start recording`, 'record-begin', true, true)}${button(
      'Cancel',
      'discard-take'
    )}<span class="practice-action-hint">Allow ${devices} access in your browser</span>`
  if (capture.phase === 'ready')
    return `${meter}${button(`${dot} Start recording`, 'record-begin', true)}${button(
      'Cancel',
      'discard-take'
    )}<span class="practice-action-hint">${
      many ? `${capture.moments.length} moments · ` : ''
    }3-second countdown · Enter to start</span>`
  if (capture.phase === 'countdown')
    return `${meter}${button('Cancel', 'discard-take')}<span class="practice-action-hint">Recording starts in ${capture.countdown}…</span>`
  if (capture.phase === 'recording')
    return `${meter}${
      many
        ? button(
            capture.current + 1 < capture.moments.length
              ? 'Next moment'
              : 'Finish',
            'record-next',
            true
          )
        : ''
    }${button(
      '<span class="stop-square" aria-hidden="true"></span> Stop',
      'record-stop',
      !many
    )}<span class="practice-action-hint">${
      many ? 'Enter for the next moment · ' : ''
    }Esc to stop</span>`
  return ''
}
