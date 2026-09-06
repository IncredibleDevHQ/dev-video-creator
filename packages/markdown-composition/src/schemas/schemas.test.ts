import { describe, expect, it } from 'vitest'
import { artefactSchemas, validateArtefact } from './index'
import { validateSchema } from './json-schema'

// Faithful to the artefacts produced by a real Plan Motion — Default run
// (kimi harness e2e): a three-beat encoder page — reveal of the input box,
// then a connector trace chained into the target's arrival reveal per beat.
const validResolved = {
  version: 1,
  preset: 'technical-trace',
  steps: [
    {
      id: 'st-1',
      title: 'Input embeddings',
      explanation: 'Tokens come in as input embeddings.',
      intent: 'introduce',
      hero: ['u-input'],
      supporting: [],
      actions: [
        {
          id: 'a1-1',
          op: 'reveal',
          targets: ['u-input'],
          startMs: 0,
          durationMs: 550,
          ease: 'settle',
          value: { enterFrom: 'auto', lines: 'auto' },
          persistence: 'state',
          implicit: false,
        },
      ],
      motionWindowMs: 550,
      holdMs: 600,
    },
    {
      id: 'st-2',
      title: 'Multi-head attention',
      explanation: 'Each position looks at every other through multi-head attention.',
      intent: 'flow',
      hero: ['u-attn'],
      supporting: ['u-arrow-1'],
      actions: [
        {
          id: 'a2-1',
          op: 'trace',
          targets: ['u-arrow-1'],
          startMs: 0,
          durationMs: 300,
          ease: 'draw',
          ports: { from: 'u-input', to: 'u-attn' },
          persistence: 'state',
          implicit: false,
        },
        {
          id: 'a2-2',
          op: 'reveal',
          targets: ['u-attn'],
          startMs: 210,
          durationMs: 320,
          ease: 'settle',
          value: { enterFrom: 'auto', lines: 'auto' },
          persistence: 'state',
          implicit: false,
        },
      ],
      motionWindowMs: 530,
      holdMs: 600,
    },
    {
      id: 'st-3',
      title: 'Add & norm',
      explanation: 'The result is added back and normalised.',
      intent: 'flow',
      hero: ['u-norm'],
      supporting: ['u-arrow-2'],
      actions: [
        {
          id: 'a3-1',
          op: 'trace',
          targets: ['u-arrow-2'],
          startMs: 0,
          durationMs: 300,
          ease: 'draw',
          ports: { from: 'u-attn', to: 'u-norm' },
          persistence: 'state',
          implicit: false,
        },
        {
          id: 'a3-2',
          op: 'reveal',
          targets: ['u-norm'],
          startMs: 210,
          durationMs: 320,
          ease: 'settle',
          persistence: 'state',
          implicit: false,
        },
      ],
      motionWindowMs: 530,
      holdMs: 1500,
    },
  ],
}

// A plan-tier page in the §3.2 V2 form (intent/hero variant) with a V1 step.
const validPlan = {
  motion: { preset: 'technical-trace', fit: 'scale-holds' },
  steps: [
    {
      id: 'st-residual',
      title: 'Residual into Add & Norm',
      explanation: 'The attention output is added back to its input and normalised.',
      narration: { sentences: [4], cueWordIndex: 1 },
      intent: 'relate',
      hero: ['u-enc-mha'],
      supporting: ['u-enc-addnorm-1'],
      actions: [
        { id: 'a1', op: 'emphasize', targets: ['u-enc-mha'], value: { factor: 1.08 } },
        { id: 'a2', op: 'trace', targets: ['u-enc-arrow-mha-addnorm'] },
        { id: 'a3', op: 'pulse', targets: ['u-enc-addnorm-1'] },
      ],
    },
    { title: 'Legacy step', reveals: ['u1', 'u2'], verb: 'reveal' },
  ],
}

const validTake = {
  version: 1,
  id: 'take-2026-09-06-abc',
  steps: [
    { stepId: 'st-1', atMs: 1200 },
    { stepId: 'st-2', atMs: 5400 },
    { stepId: 'st-3', atMs: 9800 },
  ],
  overlays: [{ actionId: 'a2-1', atMs: 5600 }],
  deltas: [{ stepId: 'st-2', earlyMs: 120 }],
  media: { cameraUrl: 'takes/take-2026-09-06-abc/camera.webm', micUrl: 'takes/take-2026-09-06-abc/mic.webm', t0: 410.5 },
  turns: [{ speaker: 'host', fromMs: 0, toMs: 14200, source: 'diarization' }],
  layout: [{ atMs: 0, family: 'content-pip', source: 'track' }],
}

const validTrack = {
  version: 1,
  mode: 'assist',
  weights: { fit: 0.35, presence: 0.2, continuity: 0.2, legibility: 0.15, composition: 0.1 },
  track: [
    {
      stepId: 'st-1',
      class: 'slot',
      primary: 'content-pip',
      treatment: 'overlay',
      alternates: [{ family: 'split', score: 61, kind: 'alternate' }],
      switchCost: 'reframe',
      cueMs: 1200,
      scores: { 'content-pip': 78, split: 61 },
    },
    { stepId: 'st-3', class: 'frame', primary: 'speaker-full', switchCost: 'cut', cueMs: 9800 },
  ],
}

const validSpeakers = {
  speakers: [
    { id: 'host', name: 'Ada', role: 'host', source: 'local', feedId: 'cam-1', colour: 'primary' },
    { id: 'guest', name: 'Bo', role: 'guest', source: 'remote', feedId: 'rtc-2' },
  ],
  nextOwner: 'host',
  turnPolicy: { source: 'diarization', dominant: true, overlap: 'equalize' },
}

describe('artefact schemas', () => {
  it('exposes the Core §3.2/§13.1/§25.1/§28.9 schemas', () => {
    expect(Object.keys(artefactSchemas).sort()).toEqual([
      'resolved',
      'slide-motion-v2',
      'speakers',
      'take',
      'track',
    ])
  })

  it('accepts a real resolved.json (§3.2 resolved tier)', () => {
    const result = validateArtefact('resolved', validResolved)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('accepts a plan-tier page (§3.2 plan tier, V2 and V1 steps)', () => {
    const result = validateArtefact('slide-motion-v2', validPlan)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('accepts a take.json (§13.1 + §24 additions)', () => {
    const result = validateArtefact('take', validTake)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('accepts a media array with offsets (§24)', () => {
    const result = validateArtefact('take', {
      ...validTake,
      media: [
        { feedId: 'cam-1', kind: 'camera', url: 'takes/t/camera.webm', offsetMs: 0 },
        { feedId: 'rtc-2', kind: 'remote', url: 'takes/t/guest.webm', offsetMs: 38 },
      ],
    })
    expect(result.valid).toBe(true)
  })

  it('accepts a track.json (§28.9)', () => {
    expect(validateArtefact('track', validTrack).valid).toBe(true)
  })

  it('accepts a speaker roster with turn policy (§25.1)', () => {
    expect(validateArtefact('speakers', validSpeakers).valid).toBe(true)
  })

  it('rejects a resolved action missing resolved-tier fields', () => {
    const broken = structuredClone(validResolved)
    const action = broken.steps[1].actions[0] as Record<string, unknown>
    delete action.startMs
    delete action.persistence
    const result = validateArtefact('resolved', broken)
    expect(result.valid).toBe(false)
    const messages = result.errors.map(error => `${error.path}: ${error.message}`)
    expect(messages.some(message => message.includes('startMs'))).toBe(true)
    expect(messages.some(message => message.includes('persistence'))).toBe(true)
  })

  it('rejects an unknown op with a useful path', () => {
    const broken = structuredClone(validResolved)
    ;(broken.steps[0].actions[0] as { op: string }).op = 'spin'
    const result = validateArtefact('resolved', broken)
    expect(result.valid).toBe(false)
    expect(result.errors[0].path).toBe('$.steps[0].actions[0].op')
    expect(result.errors[0].message).toContain('expected one of')
  })

  it('rejects a plan step that is neither V1, V2-actions nor intent/hero', () => {
    const result = validateArtefact('slide-motion-v2', {
      steps: [{ title: 'Empty step' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.message.includes('branch'))).toBe(true)
  })

  it('rejects an emphasize factor above 1.08 (§3.2 EmphasizeValue)', () => {
    const plan = structuredClone(validPlan)
    ;(plan.steps[0].actions![0].value as { factor: number }).factor = 1.5
    const result = validateArtefact('slide-motion-v2', plan)
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('1.08')
  })

  it('rejects a take without the reference clock', () => {
    const broken = structuredClone(validTake) as Record<string, unknown>
    delete broken.media
    const result = validateArtefact('take', broken)
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('media')
  })

  it('rejects a track row without a primary family', () => {
    const broken = structuredClone(validTrack)
    delete (broken.track[0] as Record<string, unknown>).primary
    const result = validateArtefact('track', broken)
    expect(result.valid).toBe(false)
    expect(result.errors[0].path).toBe('$.track[0]')
  })

  it('flags duplicate targets (IdList uniqueItems)', () => {
    const broken = structuredClone(validResolved)
    broken.steps[0].actions[0].targets = ['u-input', 'u-input']
    const result = validateArtefact('resolved', broken)
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('unique')
  })

  it('reports unknown artefacts and pattern violations', () => {
    expect(validateArtefact('nope' as never, {}).valid).toBe(false)
    const result = validateSchema(artefactSchemas.resolved.$defs.Id as never, 'syn-bad')
    expect(result.length).toBe(1)
  })
})
