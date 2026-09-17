import { describe, expect, it } from 'vitest'
import { compileSceneProgram, sanitizeSceneProgram, type SceneProgram } from './scene-program'
import type { SlideUnit } from './slide-atoms'

const unit = (id: string, label: string, bbox: [number, number, number, number], extra: Partial<SlideUnit> = {}): SlideUnit => ({
  id, ids: [id], kind: 'box', label, bbox: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] }, chrome: false, children: [], ...extra,
})

// A page with two things and a small actor drawn beside the first.
const units: SlideUnit[] = [
  unit('node-client', 'Incoming request', [100, 300, 240, 120]),
  unit('node-bucket', 'Token bucket', [700, 300, 260, 140]),
  unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
]
const viewBox = { width: 1280, height: 720 }

const program = (events: SceneProgram['beats'][number]['events']): SceneProgram => ({
  version: 1,
  page: 'test.svg',
  cast: [{ id: 'node-bucket', role: 'bucket', quantity: { of: 'tokens', value: 3, max: 3 } }],
  beats: [
    { id: 'b1', moment: 'establish', say: 'Two things sit on the page, and one of them holds tokens.', events: [{ actor: 'node-client', action: 'appear' }, { actor: 'node-bucket', action: 'appear' }] },
    { id: 'b2', moment: 'explain', say: 'A request arrives and takes a token from the bucket.', events },
    { id: 'b3', moment: 'consequence', say: 'When the bucket is empty the next one is turned away.', events: [{ actor: 'node-bucket', action: 'state', state: 'empty' }] },
  ],
})

const movesIn = (plan: { steps: Array<{ actions: Array<{ op: string; targets: string[]; value?: Record<string, number | string> }> }> }, beat: number) =>
  plan.steps[beat].actions.filter(action => action.op === 'move')

describe('the scene program', () => {
  it('moves the actor the page drew, and stops it at the edge of what it travels to', () => {
    const compiled = compileSceneProgram(program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' }]), units, { viewBox })!
    const moves = movesIn(compiled.plan, 1)
    expect(moves).toHaveLength(1)
    expect(moves[0].targets).toContain('actor-request')
    // Centre to centre is 660 px; the actor stops short of covering the label.
    const dx = Number(moves[0].value!.dx)
    expect(dx).toBeGreaterThan(400)
    expect(dx).toBeLessThan(660 - 260 / 2)
  })

  it('never slides a labelled node: the page keeps the arrangement the reader learned', () => {
    const compiled = compileSceneProgram(program([{ actor: 'node-client', action: 'travel', to: 'node-bucket' }]), units, { viewBox })!
    expect(movesIn(compiled.plan, 1)).toHaveLength(0)
    expect(compiled.plan.steps[1].actions.map(action => action.op)).toContain('emphasize')
  })

  it('holds longest on the consequence, and says who speaks when the author said so', () => {
    const withSpeakers = program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }])
    withSpeakers.beats[0].speaker = 'beside'
    withSpeakers.beats[2].speaker = 'page'
    const compiled = compileSceneProgram(withSpeakers, units, { viewBox })!
    expect(compiled.plan.steps[2].holdMs).toBeGreaterThan(compiled.plan.steps[1].holdMs)
    expect(compiled.windows[0].layout).toBe('beside')
    expect(compiled.windows[0].layoutByAuthor).toBe(true)
    expect(compiled.windows[1].layout).toBeUndefined()
  })

  it('refuses ids the page does not have', () => {
    const raw = program([{ actor: 'ghost', action: 'travel', to: 'node-bucket' }])
    const clean = sanitizeSceneProgram(raw, units)
    expect(clean!.beats[1].events).toHaveLength(0)
  })
})
