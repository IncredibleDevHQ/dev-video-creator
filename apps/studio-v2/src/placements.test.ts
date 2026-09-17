import { describe, expect, it } from 'vitest'
import { bestVariant, pageToFrame, placementsFor, unitsOnScreenPerBeat, unitsOnStageAt } from './placements'
import { stageGeometryFor, type MotionPlanV2 } from 'markdown-composition'
import type { SlideUnit } from './slide-atoms'

const unit = (id: string, label: string, bbox: [number, number, number, number], chrome = false): SlideUnit => ({
  id, ids: [id], kind: 'label', label, bbox: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] }, chrome, children: [],
})
const viewBox = { width: 1280, height: 720 }
const content = stageGeometryFor('content-pip').content!

describe('the stage everything reads', () => {
  const page: SlideUnit[] = [
    unit('request', 'Request', [100, 300, 60, 60]),
    unit('response', 'Response', [900, 300, 240, 120]),
  ]
  const plan: MotionPlanV2 = {
    version: 2,
    steps: [
      {
        id: 'b1', title: 'one', explanation: '', motionWindowMs: 1000, holdMs: 0,
        actions: [{ op: 'reveal', targets: ['request'], startMs: 0, durationMs: 200, ease: 'enter', persistence: 'state' }],
      },
      {
        id: 'b2', title: 'two', explanation: '', motionWindowMs: 1000, holdMs: 0,
        actions: [
          { op: 'morph', targets: ['request', 'response'], startMs: 0, durationMs: 400, ease: 'travel', persistence: 'state', value: { fromCount: 1 } },
          { op: 'resize', targets: ['response'], startMs: 0, durationMs: 400, ease: 'settle', persistence: 'state', value: { from: 1, to: 2 } },
        ],
      },
    ],
  }

  it('reports what the plan says is on screen, not a second opinion', () => {
    const [first, second] = unitsOnScreenPerBeat(plan, page, viewBox)
    expect(first.map(unit => unit.id)).toEqual(['request'])
    // After becoming something else, the thing that left is gone and the
    // thing it became is there.
    expect(second.map(unit => unit.id)).toEqual(['response'])
  })

  it('reports things at the size the scene made them', () => {
    const before = unitsOnStageAt(plan, page, 0).find(unit => unit.id === 'response')!
    const after = unitsOnStageAt(plan, page, 1).find(unit => unit.id === 'response')!
    expect(before.bbox.width).toBe(240)
    expect(after.bbox.width).toBe(480)
    // Grown about its own centre.
    expect(after.bbox.x + after.bbox.width / 2).toBe(before.bbox.x + before.bbox.width / 2)
  })
})

describe('placements', () => {
  it('maps page boxes into the frame where the page is fitted', () => {
    const box = pageToFrame({ x: 1180, y: 680, width: 90, height: 30 }, viewBox, content)
    expect(box.left).toBeGreaterThan(85)
    expect(box.top).toBeGreaterThan(85)
  })

  it('moves the chip off a footer label in the bottom-right corner', () => {
    const footer = pageToFrame({ x: 1050, y: 660, width: 200, height: 40 }, viewBox, content)
    const pick = bestVariant('content-pip', [footer])
    expect(pick!.variant).not.toMatch(/^br-/)
    expect(pick!.ink).toBeLessThan(0.05)
    const clear = bestVariant('content-pip', [])
    expect(clear!.variant).toBe('br-m')
  })

  it('keeps the previous placement while it stays clear, and moves when it would cover ink', () => {
    const plan: MotionPlanV2 = {
      version: 2,
      steps: [
        { id: 'B01', title: 'a', explanation: 'a', actions: [{ op: 'reveal', targets: ['t1'], startMs: 0, durationMs: 400, ease: 'enter', persistence: 'state' }], motionWindowMs: 400, holdMs: 3000 },
        { id: 'B02', title: 'b', explanation: 'b', actions: [{ op: 'reveal', targets: ['t2'], startMs: 0, durationMs: 400, ease: 'enter', persistence: 'state' }], motionWindowMs: 400, holdMs: 3000 },
      ],
    }
    const units = [unit('t1', 'Title', [100, 60, 600, 60]), unit('t2', 'Footer', [1050, 660, 200, 40])]
    const placements = placementsFor(plan, units, viewBox)
    const chip = placements['content-pip']
    expect(chip[0]).toMatchObject({ atMs: 0, variant: 'br-m' })
    expect(chip[1].atMs).toBe(3400)
    expect(chip[1].variant).not.toMatch(/^br-/)
  })
})
