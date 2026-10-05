import { describe, expect, it } from 'vitest'
import type { Scene } from '../shared/model'
import { advanceScene, transitionScene, type SceneSignal } from './autopilot'
import type { ActivityLedger } from './activity'

// Explicit lifecycle contract, independent of the implementation's transition table.
const expected: Record<
  Scene['phase'],
  Partial<Record<SceneSignal, Scene['phase']>>
> = {
  idle: {
    make: 'queued',
    invalidate: 'idle',
    fail: 'failed'
  },
  queued: {
    'leave-out': 'idle',
    start: 'writing',
    change: 'changing',
    replan: 'replanning',
    invalidate: 'queued',
    fail: 'failed'
  },
  writing: {
    'leave-out': 'idle',
    'plan-ready': 'waiting',
    'recover-plan': 'queued',
    invalidate: 'queued',
    fail: 'failed'
  },
  waiting: {
    'leave-out': 'idle',
    change: 'changing',
    replan: 'replanning',
    produce: 'producing',
    'recording-saved': 'waiting',
    invalidate: 'queued',
    fail: 'failed'
  },
  changing: {
    'leave-out': 'idle',
    'plan-ready': 'waiting',
    'recover-plan': 'queued',
    invalidate: 'queued',
    fail: 'failed'
  },
  replanning: {
    'leave-out': 'idle',
    'plan-ready': 'waiting',
    'recover-plan': 'queued',
    invalidate: 'queued',
    fail: 'failed'
  },
  producing: {
    produced: 'produced',
    'animation-ready': 'waiting',
    'recover-production': 'waiting',
    invalidate: 'queued',
    fail: 'failed'
  },
  produced: {
    'leave-out': 'idle',
    change: 'changing',
    replan: 'replanning',
    produce: 'producing',
    'recording-saved': 'waiting',
    invalidate: 'queued',
    fail: 'failed'
  },
  failed: {
    'leave-out': 'idle',
    change: 'changing',
    replan: 'replanning',
    produce: 'producing',
    retry: 'queued',
    'recording-saved': 'waiting',
    invalidate: 'queued',
    fail: 'failed'
  }
}
const signals: SceneSignal[] = [
  'make',
  'leave-out',
  'start',
  'plan-ready',
  'change',
  'replan',
  'produce',
  'produced',
  'animation-ready',
  'recording-saved',
  'fail',
  'retry',
  'invalidate',
  'recover-plan',
  'recover-production'
]
const fixture = (phase: Scene['phase']): Scene => ({
  id: 'scene',
  slideId: 'slide',
  phase,
  moments: [],
  inputKey: 'input',
  produced: null,
  presence: null,
  error: 'A failure',
  failure: 'production'
})
const ledger = (): ActivityLedger => ({
  project: { id: 'notebook' },
  events: []
})

describe.each(Object.keys(expected) as Scene['phase'][])(
  '%s lifecycle',
  (phase) => {
    it.each(signals)(
      '%s is applied atomically or rejected without mutation',
      (signal) => {
        const scene = fixture(phase),
          original = structuredClone(scene),
          history = ledger()
        const destination = expected[phase][signal]
        if (!destination) {
          expect(() => transitionScene(scene, signal, history)).toThrow()
          expect(scene).toEqual(original)
          expect(history.events).toEqual([])
          return
        }
        const pure = advanceScene(scene, signal)
        expect(scene).toEqual(original)
        expect(pure.phase).toBe(destination)
        expect(transitionScene(scene, signal, history)).toBe(scene)
        expect(scene).toEqual(pure)
        expect(scene.error).toBe(signal === 'fail' ? original.error : null)
        expect(scene.failure).toBe(
          signal === 'fail' ? original.failure : undefined
        )
        expect(history.events).toHaveLength(1)
        expect(history.events[0]).toMatchObject({
          projectId: 'notebook',
          sceneId: 'scene',
          kind: 'scene',
          sequence: 1,
          activity: signal === 'fail' ? 'failed' : expect.any(String)
        })
        expect(history.events[0].message.length).toBeGreaterThan(0)
      }
    )
  }
)
it.each(['planning', undefined] as const)(
  'does not retry production for a %s failure',
  (failure) => {
    const scene = { ...fixture('failed'), failure },
      original = structuredClone(scene),
      history = ledger()
    expect(() => transitionScene(scene, 'produce', history)).toThrow(
      'Write this scene first'
    )
    expect(scene).toEqual(original)
    expect(history.events).toEqual([])
  }
)
it('keeps one ordered activity entry per change, including a caller-specific recording message', () => {
  const scene = fixture('queued'),
    history = ledger()
  transitionScene(scene, 'start', history)
  transitionScene(scene, 'plan-ready', history)
  transitionScene(scene, 'recording-saved', history, '2 moments recorded')
  expect(
    history.events.map((event) => [event.sequence, event.message])
  ).toEqual([
    [1, 'Writing the scene'],
    [2, 'Scene written'],
    [3, '2 moments recorded']
  ])
})
it('preserves the semantic step on failure even when its copy changes', () => {
  const scene = fixture('queued'),
    history = ledger()
  transitionScene(scene, 'start', history, 'A new planning message')
  expect(history.events[0].stage).toBe('artwork')
  history.events.push({
    ...history.events[0],
    sequence: 2,
    stage: 'planning',
    activity: 'processing',
    message: 'Refining the explanation'
  })
  scene.error = 'Please try again'
  transitionScene(scene, 'fail', history)
  expect(history.events.at(-1)).toMatchObject({
    stage: 'planning',
    activity: 'failed',
    message: 'Please try again'
  })
})
