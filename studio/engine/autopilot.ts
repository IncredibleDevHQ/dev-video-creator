import type { Scene } from '../shared/model'

export type SceneSignal = 'start' | 'plan-ready' | 'change' | 'replan' | 'produce' | 'produced' | 'fail' | 'retry'
const transitions: Partial<Record<Scene['phase'], Partial<Record<SceneSignal, Scene['phase']>>>> = {
  queued: { start: 'writing', fail: 'failed' },
  writing: { 'plan-ready': 'waiting', fail: 'failed' },
  waiting: { change: 'changing', replan: 'replanning', produce: 'producing', fail: 'failed' },
  changing: { 'plan-ready': 'waiting', fail: 'failed' },
  replanning: { 'plan-ready': 'waiting', fail: 'failed' },
  producing: { produced: 'produced', fail: 'failed' },
  produced: { change: 'changing', replan: 'replanning', produce: 'producing', fail: 'failed' },
  failed: { retry: 'queued' },
}
export const advanceScene = (scene: Scene, signal: SceneSignal): Scene => {
  const phase = transitions[scene.phase]?.[signal]
  if (!phase) throw new Error(`Cannot ${signal} a scene that is ${scene.phase}`)
  return { ...scene, phase, error: signal === 'fail' ? scene.error : null }
}
export const sceneTransitions = transitions
