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
export const transitionScene = (scene: Scene, signal: SceneSignal) => {
  const next = advanceScene(scene, signal)
  Object.assign(scene, next)
  if (!next.failure) delete scene.failure
  return scene
}
export const sceneTransitions = transitions
