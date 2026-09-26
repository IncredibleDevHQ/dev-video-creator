import { describe, it, expect } from 'vitest'
import { compileSceneProgram, sanitizeSceneProgram, type SceneProgram } from './scene-program'
import { validateBehavior, controlValue, type ObjectBehavior } from './object-behavior'
import { validateBoundary } from './continuity'
import type { SlideUnit } from './slide-atoms'
const units: SlideUnit[] = ['a','b','service'].map((id, i) => ({ id, ids: [id], kind: 'shape', label: id, bbox: { x: i * 300, y: 100, width: 40, height: 40 }, chrome: false, children: [], actorRole: 'request' }))
units[2].appearance = { parts: { inbox: 'inbox' }, bounds: { inbox: { x: 650, y: 100, width: 20, height: 20 } } }
const p = (events: SceneProgram['beats'][number]['events']): SceneProgram => ({ version: 1, scheduling: 2, clock: 'take', cast: [{ id: 'a' }, { id: 'b' }, { id: 'service' }], beats: [{ say: 'Both requests arrive and settle.', durationMs: 4000, words: [{ word: 'arrive', startMs: 2000, endMs: 2400 }], events }] })
const compile = (program: SceneProgram) => compileSceneProgram(program, units, { viewBox: { width: 1280, height: 720 } })!
describe('repair package contracts', () => {
  it('resolves a named port to its own geometry and retains the destination through sanitizing', () => {
    const program = p([{ id: 'arrival', actor: 'a', action: 'travel', to: 'service.inbox', atMs: 0 }])
    const clean = sanitizeSceneProgram(program, units)!
    expect(clean.beats[0].events![0].to).toBe('service.inbox')
    expect(compile(clean).plan.steps[0].actions.some(a => a.op === 'move' && Number(a.value?.dx) > 550)).toBe(true)
  })
  it('anchors concurrent arrivals on the spoken outcome without serialized silence', () => {
    const r = compile(p(['a','b'].map(actor => ({ id: actor, actor, action: 'travel', to: 'service.inbox', cue: 'arrive', anchor: 'arrival' }))))
    expect(r.schedule.map(e => e.arrival)).toEqual([2000,2000])
    expect(r.plan.steps[0].motionWindowMs + r.plan.steps[0].holdMs).toBe(4000)
    expect(r.diagnostics).toEqual([])
  })
  it('honors a forward dependency and rejects a cycle', () => {
    const r = compile(p([{ id: 'second', actor: 'b', action: 'highlight', atMs: 0, dependsOn: [{ event: 'first', milestone: 'settled' }] }, { id: 'first', actor: 'a', action: 'highlight', atMs: 0 }]))
    expect(r.schedule[1].start).toBeGreaterThanOrEqual(r.schedule[0].settled)
    const cyclic = compile(p([{ id: 'first', actor: 'a', action: 'highlight', after: 'second' }, { id: 'second', actor: 'b', action: 'highlight', after: 'first' }]))
    expect(cyclic.diagnostics.some(d => d.code === 'cycle')).toBe(true)
  })
  it('reports an impossible cue preparation and truncated measured actions', () => {
    const r = compile(p([{ id: 'late', actor: 'a', action: 'travel', to: 'service', atMs: 3999 }]))
    expect(r.diagnostics.some(d => d.code === 'truncated-action' && d.severity === 'error')).toBe(true)
    const early = compile(p([{ id: 'early', actor: 'a', action: 'travel', to: 'service', atMs: 10, anchor: 'arrival' }]))
    expect(early.diagnostics.some(d => d.code === 'anchor-conflict')).toBe(true)
  })
  it('keeps internal beat IDs out of display headings', () => {
    const program = p([]); program.beats[0].id = 'internal-01'
    expect(compile(program).plan.steps[0].title).toBe('')
  })
  const def: ObjectBehavior = { version: 1, key: 'v1:receive', artworkKey: 'v1', name: 'receive', requiredParts: ['inbox'], port: 'inbox', duration: { minMs: 100, defaultMs: 900, maxMs: 2000 } }
  it('rejects missing required behavior ports instead of substituting a glow', () => {
    expect(() => validateBehavior(def, {})).toThrow('missing parts: inbox')
    const r = compile(p([{ id: 'receive', actor: 'service', action: 'behavior', atMs: 0, behavior: { definition: def, request: 'a' } }]))
    expect(r.plan.steps[0].actions.some(a => a.op === 'move')).toBe(true)
  })
  it('rejects consuming from an empty authoritative quantity', () => {
    const program = p([{ id: 'consume', actor: 'service', action: 'behavior', atMs: 0, behavior: { definition: { ...def, name: 'consume' } } }])
    program.cast[2].quantity = { value: 0, max: 3, shownOn: 'service.inbox' }
    expect(compile(program).diagnostics.some(d => d.code === 'quantity-precondition')).toBe(true)
  })
  it('does not process a rejected request', () => {
    const program = p([{ id: 'deny', actor: 'a', action: 'reject', to: 'service', atMs: 0 }, { id: 'process', actor: 'service', action: 'behavior', after: 'deny', behavior: { definition: { ...def, name: 'process', clip: 'inbox' }, request: 'a' } }])
    expect(compile(program).diagnostics.some(d => d.code === 'state-precondition')).toBe(true)
  })
  it('carries the same actor quantity without replaying its entrance', () => {
    const program = p([])
    program.initialState = [{ id: 'a', dx: 25, dy: 0, scale: 1, visible: true, bounds: units[0].bbox, quantity: 2 }]
    program.cast[0].quantity = { value: 0, max: 3, shownOn: 'a' }
    const result = compile(program)
    expect(result.boundaryState[0]).toMatchObject({ dx: 25, visible: true, quantity: 2 })
    expect(validateBoundary({ kind: 'carry', reason: 'Keep the same request visible', outgoingSubject: 'a', incomingSubject: 'a', readableMs: 300, actors: result.boundaryState }, result.boundaryState)).toEqual([])
    expect(validateBoundary({ kind: 'carry', reason: 'Keep the same request visible', outgoingSubject: 'a', incomingSubject: 'a', readableMs: 300, actors: result.boundaryState }, [])).not.toEqual([])
  })
  it('retains finite performance position across an explicit boundary', () => {
    const program = p([])
    program.initialState = [{ id: 'service', dx: 0, dy: 0, scale: 1, visible: true, bounds: units[2].bbox, clips: { inbox: 500 } }]
    const result = compile(program)
    expect(result.boundaryState.find(actor => actor.id === 'service')?.clips).toEqual({ inbox: 500 })
    expect(result.plan.steps[0].actions.some(action => action.op === 'clip' && action.value?.from === 500 && action.value?.to === 500)).toBe(true)
  })
  it('bounds safe controls instead of exposing factual counts', () => {
    expect(() => controlValue({ id: 'scale', label: 'Scale', property: 'scale', type: 'number', min: .5, max: 2, default: 1, parts: ['inbox'], invalidates: 'geometry' }, 5)).toThrow()
  })
})
