import { describe, expect, it } from 'vitest'
import {
  motionPlanFromSteps,
  motionPlanOffsetsMs,
  sanitizeMotionPlan,
  stepsFromMotionPlan,
} from './motion-plan'

describe('sanitizeMotionPlan', () => {
  it('fills timing, easing and persistence from the token table', () => {
    const plan = sanitizeMotionPlan({
      steps: [
        { title: 'One', actions: [{ op: 'reveal', targets: ['a', 'b'] }, { op: 'camera', value: { x: 0, y: 0, width: 100, height: 50 } }] },
      ],
    })
    expect(plan).not.toBeNull()
    const [beat] = plan!.steps
    expect(beat.id).toBe('B01')
    expect(beat.actions).toHaveLength(2)
    expect(beat.actions[0]).toMatchObject({ op: 'reveal', durationMs: 420, ease: 'enter', persistence: 'state' })
    expect(beat.actions[1]).toMatchObject({ op: 'camera', ease: 'camera', value: { width: 100 } })
    expect(beat.motionWindowMs).toBe(880)
    expect(beat.holdMs).toBe(1200)
  })

  it('drops actions without targets unless they are camera or ported connects', () => {
    const plan = sanitizeMotionPlan({
      steps: [{ title: 'x', actions: [{ op: 'reveal', targets: [] }, { op: 'connect', ports: { from: 'a', to: 'b' } }, { op: 'nope', targets: ['a'] }] }],
    })
    expect(plan!.steps[0].actions.map(action => action.op)).toEqual(['connect'])
  })

  it('rejects empty plans', () => {
    expect(sanitizeMotionPlan({ steps: [] })).toBeNull()
    expect(sanitizeMotionPlan(null)).toBeNull()
  })
})

describe('motionPlanFromSteps (V1 → V2)', () => {
  const steps = [
    { title: 'Boxes', explanation: 'Two boxes come in first, one after the other.', reveals: ['a', 'b'], verb: 'reveal' as const },
    { title: 'Arrow', explanation: 'The arrow between them draws.', reveals: ['c'], verb: 'trace' as const },
    { title: 'Focus', explanation: 'Look at the second box only.', reveals: ['b2'], verb: 'focus' as const },
    { title: 'Next', explanation: 'And everything is back.', reveals: ['d'], verb: 'reveal' as const },
  ]

  it('upgrades verbs to ops with staggers, and dims for a focus beat only', () => {
    const plan = motionPlanFromSteps(steps)!
    expect(plan.steps[0].actions[0]).toMatchObject({ op: 'reveal', targets: ['a', 'b'], durationMs: 420 + 70 })
    expect(plan.steps[1].actions[0]).toMatchObject({ op: 'trace', targets: ['c'] })
    const focus = plan.steps[2].actions
    expect(focus[0]).toMatchObject({ op: 'dim', targets: ['a', 'b', 'c'], persistence: 'state' })
    expect(focus[1]).toMatchObject({ op: 'reveal', targets: ['b2'] })
    expect(plan.steps[3].actions[0]).toMatchObject({ op: 'undim', targets: ['a', 'b', 'c'], implicit: true })
  })

  it('round-trips back to the same V1 reveals and verbs', () => {
    const plan = motionPlanFromSteps(steps)!
    const back = stepsFromMotionPlan(plan)
    expect(back.map(step => step.reveals)).toEqual(steps.map(step => step.reveals))
    expect(back.map(step => step.verb)).toEqual(['reveal', 'trace', 'reveal', 'reveal'])
  })

  it('holds for as long as the narration needs beyond the motion window', () => {
    const plan = motionPlanFromSteps(steps)!
    const { offsets, durationMs } = motionPlanOffsetsMs(plan)
    expect(offsets[0]).toBe(0)
    expect(offsets[1]).toBe(plan.steps[0].motionWindowMs + plan.steps[0].holdMs)
    expect(durationMs).toBeGreaterThan(4 * 3000)
  })
})
