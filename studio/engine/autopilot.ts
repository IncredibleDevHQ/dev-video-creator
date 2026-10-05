import { addEvent, type ActivityLedger } from './activity'
import type { Scene, SceneStage } from '../shared/model'

export type SceneSignal =
  | 'make'
  | 'leave-out'
  | 'start'
  | 'plan-ready'
  | 'change'
  | 'replan'
  | 'produce'
  | 'produced'
  | 'animation-ready'
  | 'recording-saved'
  | 'fail'
  | 'retry'
  | 'invalidate'
  | 'recover-plan'
  | 'recover-production'

// Input invalidation may interrupt any job. Its fingerprint guards discard late results.
const invalidate = { invalidate: 'queued' as const, fail: 'failed' as const }
const editable = {
  change: 'changing' as const,
  replan: 'replanning' as const,
  'recording-saved': 'waiting' as const
}
// The creator can leave any scene out of the video except one being rendered;
// an agent writing it is stopped, and its late result is discarded.
const leaveOut = { 'leave-out': 'idle' as const }
const transitions: Record<
  Scene['phase'],
  Partial<Record<SceneSignal, Scene['phase']>>
> = {
  idle: { invalidate: 'idle', fail: 'failed', make: 'queued' },
  queued: {
    ...invalidate,
    ...leaveOut,
    change: 'changing',
    replan: 'replanning',
    start: 'writing'
  },
  writing: {
    ...invalidate,
    ...leaveOut,
    'plan-ready': 'waiting',
    'recover-plan': 'queued'
  },
  waiting: { ...invalidate, ...editable, ...leaveOut, produce: 'producing' },
  changing: {
    ...invalidate,
    ...leaveOut,
    'plan-ready': 'waiting',
    'recover-plan': 'queued'
  },
  replanning: {
    ...invalidate,
    ...leaveOut,
    'plan-ready': 'waiting',
    'recover-plan': 'queued'
  },
  producing: {
    ...invalidate,
    produced: 'produced',
    'animation-ready': 'waiting',
    'recover-production': 'waiting'
  },
  produced: { ...invalidate, ...editable, ...leaveOut, produce: 'producing' },
  failed: {
    ...invalidate,
    ...editable,
    ...leaveOut,
    retry: 'queued',
    produce: 'producing'
  }
}
export const advanceScene = (scene: Scene, signal: SceneSignal): Scene => {
  if (
    signal === 'produce' &&
    scene.phase === 'failed' &&
    scene.failure !== 'production'
  )
    throw new Error('Write this scene first')
  const phase = transitions[scene.phase][signal]
  if (!phase) throw new Error(`Cannot ${signal} a scene that is ${scene.phase}`)
  const next = {
    ...scene,
    phase,
    error: signal === 'fail' ? scene.error : null
  }
  if (signal !== 'fail') delete next.failure
  return next
}
const messages: Record<SceneSignal, string> = {
  make: 'Making this scene',
  'leave-out': 'Left out of the video',
  start: 'Writing the scene',
  'plan-ready': 'Scene written',
  change: 'Updating this scene',
  replan: 'Re-planning this scene',
  produce: 'Producing',
  produced: 'Produced',
  'animation-ready': 'Animation ready · record your moments when you’re ready',
  'recording-saved': 'Recording updated',
  fail: 'Scene failed',
  retry: 'Trying this scene again',
  invalidate: 'Scene inputs changed',
  'recover-plan': 'Resuming this scene',
  'recover-production': 'Resuming production'
}
const stages: Partial<Record<SceneSignal, SceneStage>> = {
  make: 'artwork',
  start: 'artwork',
  change: 'artwork',
  replan: 'artwork',
  'plan-ready': 'script',
  produce: 'voice',
  produced: 'save',
  'animation-ready': 'animation-render',
  'recording-saved': 'recordings',
  retry: 'artwork',
  invalidate: 'artwork',
  'recover-plan': 'artwork',
  'recover-production': 'voice'
}
export const transitionScene = (
  scene: Scene,
  signal: SceneSignal,
  ledger: ActivityLedger,
  message?: string
) => {
  const next = advanceScene(scene, signal)
  Object.assign(scene, next)
  if (!next.failure) delete scene.failure
  addEvent(
    ledger,
    'scene',
    message || (signal === 'fail' ? scene.error : null) || messages[signal],
    {
      sceneId: scene.id,
      stage:
        signal === 'fail'
          ? [...ledger.events]
              .reverse()
              .find(
                (event) =>
                  event.sceneId === scene.id &&
                  event.activity === 'processing' &&
                  event.stage
              )?.stage ||
            (scene.failure === 'production' ? 'composition' : 'artwork')
          : signal === 'produce' &&
              scene.creativePlan &&
              scene.animation?.inputKey !== scene.animationKey
            ? 'composition'
            : stages[signal],
      activity:
        signal === 'fail'
          ? 'failed'
          : [
                'plan-ready',
                'produced',
                'animation-ready',
                'recording-saved',
                'leave-out'
              ].includes(signal)
            ? 'complete'
            : 'processing'
    }
  )
  return scene
}
export const sceneTransitions = transitions
