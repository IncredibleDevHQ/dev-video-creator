import { addEvent, type ActivityLedger } from './activity'
import type { Scene } from '../shared/model'

export type SceneSignal =
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
const transitions: Record<
  Scene['phase'],
  Partial<Record<SceneSignal, Scene['phase']>>
> = {
  queued: {
    ...invalidate,
    change: 'changing',
    replan: 'replanning',
    start: 'writing'
  },
  writing: { ...invalidate, 'plan-ready': 'waiting', 'recover-plan': 'queued' },
  waiting: { ...invalidate, ...editable, produce: 'producing' },
  changing: {
    ...invalidate,
    'plan-ready': 'waiting',
    'recover-plan': 'queued'
  },
  replanning: {
    ...invalidate,
    'plan-ready': 'waiting',
    'recover-plan': 'queued'
  },
  producing: {
    ...invalidate,
    produced: 'produced',
    'animation-ready': 'waiting',
    'recover-production': 'waiting'
  },
  produced: { ...invalidate, ...editable, produce: 'producing' },
  failed: { ...invalidate, ...editable, retry: 'queued', produce: 'producing' }
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
      activity:
        signal === 'fail'
          ? 'failed'
          : [
                'plan-ready',
                'produced',
                'animation-ready',
                'recording-saved'
              ].includes(signal)
            ? 'complete'
            : 'processing'
    }
  )
  return scene
}
export const sceneTransitions = transitions
