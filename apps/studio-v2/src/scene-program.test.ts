import { describe, expect, it } from 'vitest'
import { compileSceneProgram, programWithEdits, sanitizeSceneProgram, type SceneProgram } from './scene-program'
import type { SceneWindow } from './script-plan'
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
// The same page, with the bar the bucket's level is drawn on.
const withLevel: SlideUnit[] = [
  ...units,
  { ...unit('bucket-level', 'Level', [720, 420, 200, 12], { kind: 'shape' }) },
]

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

  it('rejects a request that is already standing at the door', () => {
    const compiled = compileSceneProgram(
      program([
        { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
        { actor: 'actor-request', action: 'reject', to: 'node-bucket' },
      ]),
      units,
      { viewBox },
    )!
    const ops = compiled.plan.steps[1].actions.map(action => action.op)
    expect(ops).toContain('pulse')
    expect(ops).toContain('exit')
  })

  it('sends a rejected request home, so its next trip is the same journey', () => {
    const twice = program([
      { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
      { actor: 'actor-request', action: 'reject', to: 'node-bucket' },
      { actor: 'actor-request', action: 'travel', to: 'node-bucket' },
    ])
    const compiled = compileSceneProgram(twice, units, { viewBox })!
    const moves = compiled.plan.steps[1].actions.filter(action => action.op === 'move')
    const net = moves.reduce((sum, action) => sum + Number(action.value!.dx), 0)
    const trips = moves.filter(action => Number(action.value!.dx) > 0)
    expect(trips).toHaveLength(2)
    expect(Number(trips[0].value!.dx)).toBe(Number(trips[1].value!.dx))
    // Two identical journeys and one trip home: the actor ends one away.
    expect(net).toBe(Number(trips[0].value!.dx))
  })

  it('shows what a thing holds as the bar the page drew, from the first frame', () => {
    const spending = program([{ actor: 'node-bucket', action: 'spend', amount: 2, cue: 'takes' }])
    spending.cast[0].quantity!.shownOn = 'bucket-level'
    const compiled = compileSceneProgram(spending, withLevel, { viewBox })!
    const opening = compiled.plan.steps[0].actions.find(action => action.op === 'level')!
    expect(opening.value).toMatchObject({ from: 1, to: 1 })
    expect(opening.startMs).toBe(0)
    const spent = compiled.plan.steps[1].actions.find(action => action.op === 'level')!
    expect(spent.value).toMatchObject({ from: 1, to: 1 / 3 })
    // The bar itself, never the node it is drawn inside.
    expect(spent.targets).toEqual(['bucket-level'])
    expect(opening.targets).toEqual(['bucket-level'])
    expect(compiled.plan.steps[1].actions.some(action => action.op === 'count')).toBe(false)
  })

  it('recomposes the page on purpose, and what moved keeps its identity', () => {
    const restaged = program([{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }])
    restaged.beats[2].restage = [
      { id: 'node-bucket', grow: 1.5, to: 'right' },
      { id: 'node-client', clear: true },
    ]
    restaged.beats.push({ id: 'b4', moment: 'resolve', say: 'The bucket refills and the next call goes through.', events: [{ actor: 'actor-request', action: 'travel', to: 'node-bucket' }] })
    const compiled = compileSceneProgram(restaged, units, { viewBox })!
    const staging = compiled.plan.steps[2].actions
    expect(staging.find(action => action.op === 'resize')!.value).toMatchObject({ to: 1.5 })
    expect(staging.find(action => action.op === 'resize')!.targets).toContain('node-bucket')
    expect(staging.some(action => action.op === 'exit' && action.targets.includes('node-client'))).toBe(true)
    // The bucket moved right; the request's next trip goes to where it now
    // stands, not to where the page drew it.
    const moved = staging.find(action => action.op === 'move' && action.targets.includes('node-bucket'))!
    const firstTrip = compiled.plan.steps[1].actions.find(action => action.op === 'move')!
    const secondTrip = compiled.plan.steps[3].actions.find(action => action.op === 'move')!
    expect(Number(moved.value!.dx)).not.toBe(0)
    expect(Number(secondTrip.value!.dx)).not.toBe(Number(firstTrip.value!.dx))
  })

  it('transforms the one group that owns a thing, never its children as well', () => {
    // A node as the atomizer gives it: the group, and everything drawn inside.
    const withChildren: SlideUnit[] = [
      { ...unit('node-bucket', 'Token bucket', [700, 300, 260, 140]), ids: ['node-bucket', 'node-bucket-box', 'node-bucket-label', 'node-bucket-art'] },
      unit('actor-request', 'Request', [150, 340, 40, 40], { kind: 'shape', actorRole: 'request' }),
    ]
    const restaged = program([])
    restaged.beats[1].restage = [{ id: 'node-bucket', to: 'left', grow: 1.4 }]
    restaged.beats[2].camera = ['node-bucket']
    const compiled = compileSceneProgram(restaged, withChildren, { viewBox })!
    const moves = compiled.plan.steps[1].actions.filter(action => action.op === 'move')
    expect(moves).toHaveLength(1)
    expect(moves[0].targets).toEqual(['node-bucket'])
    const resize = compiled.plan.steps[1].actions.find(action => action.op === 'resize')!
    expect(resize.targets).toEqual(['node-bucket'])
    expect(resize.value).toMatchObject({ from: 1, to: 1.4 })
    // The bucket now sits left of centre, and the camera goes to where it is.
    const shot = compiled.plan.steps[2].actions.find(action => action.op === 'camera')!.value as Record<string, number>
    expect(shot.x + shot.width / 2).toBeLessThan(viewBox.width / 2)
    expect(shot.x).toBeGreaterThan(0)
  })

  it('measures every size from the drawing, so growing then restoring is a restore', () => {
    const sized = program([])
    sized.beats[1].restage = [{ id: 'node-bucket', grow: 1.5 }]
    sized.beats[2].restage = [{ id: 'node-bucket', grow: 1 }]
    const compiled = compileSceneProgram(sized, units, { viewBox })!
    const first = compiled.plan.steps[1].actions.find(action => action.op === 'resize')!
    const second = compiled.plan.steps[2].actions.find(action => action.op === 'resize')!
    expect(first.value).toMatchObject({ from: 1, to: 1.5 })
    expect(second.value).toMatchObject({ from: 1.5, to: 1 })
  })

  it('changes nothing when nothing was edited', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const same = authored.beats.map(beat => ({ say: beat.say, parts: [] }))
    const edited = programWithEdits(authored, same)
    expect(edited.beats.map(beat => (beat.events || []).map(event => event.action))).toEqual(
      authored.beats.map(beat => (beat.events || []).map(event => event.action)),
    )
    expect(edited.beats.map(beat => beat.moment)).toEqual(authored.beats.map(beat => beat.moment))
  })

  it('keeps a line\u2019s events when the line is rewritten from scratch', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const rewritten = authored.beats.map((beat, index) => ({
      say: index === 1 ? 'Every incoming call is charged one unit before anything else happens.' : beat.say,
      parts: [],
    }))
    const edited = programWithEdits(authored, rewritten)
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['spend'])
    expect(edited.beats[1].say).toBe(rewritten[1].say)
    expect(edited.beats[0].events!.map(event => event.action)).toEqual(['appear', 'appear'])
  })

  it('keeps the events when two lines are merged into one paragraph', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' }])
    const merged: SceneWindow[] = [
      {
        say: `${authored.beats[0].say} ${authored.beats[1].say}`,
        parts: [],
      },
      { say: authored.beats[2].say, parts: [] },
    ]
    const edited = programWithEdits(authored, merged)
    expect(edited.beats).toHaveLength(2)
    // Both lines' events are now in the paragraph that carries both lines.
    expect(edited.beats[0].events!.map(event => event.action)).toEqual(['appear', 'appear', 'spend'])
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['state'])
  })

  it('splits a line by its cues, so each half keeps what it named', () => {
    const authored = program([
      { actor: 'actor-request', action: 'travel', to: 'node-bucket', cue: 'arrives' },
      { actor: 'node-bucket', action: 'spend', amount: 1, cue: 'takes' },
    ])
    const split: SceneWindow[] = [
      { say: authored.beats[0].say, parts: [] },
      { say: 'A request arrives at the bucket.', parts: [] },
      { say: 'It takes a token from it.', parts: [] },
      { say: authored.beats[2].say, parts: [] },
    ]
    const edited = programWithEdits(authored, split)
    const actions = edited.beats.map(beat => (beat.events || []).map(event => event.action))
    expect(actions[1]).toContain('travel')
    expect(actions[2]).toContain('spend')
    expect(actions[1]).not.toContain('spend')
  })

  it('takes the camera choice back from the card, and leaves the events alone', () => {
    const authored = program([{ actor: 'node-bucket', action: 'spend', amount: 1 }])
    authored.beats[1].camera = ['node-bucket']
    const stay: SceneWindow[] = authored.beats.map((beat, index) => ({ say: beat.say, parts: [], ...(index === 1 ? { camera: [] } : {}) }))
    const edited = programWithEdits(authored, stay)
    expect(edited.beats[1].camera).toBe('page')
    expect(edited.beats[1].events!.map(event => event.action)).toEqual(['spend'])
  })

  it('refuses ids the page does not have', () => {
    const raw = program([{ actor: 'ghost', action: 'travel', to: 'node-bucket' }])
    const clean = sanitizeSceneProgram(raw, units)
    expect(clean!.beats[1].events).toHaveLength(0)
  })
})
