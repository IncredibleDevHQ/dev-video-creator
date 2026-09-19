import { describe, expect, it } from 'vitest'
import { buildExplanationModel, wordingPolicyFrom } from './story-model'
import type { Outline } from './source'

const outline: Outline = {
  title: 'Retry storms',
  targetSeconds: 90,
  scenes: [
    {
      title: 'The storm',
      idea: 'Clients retry in sync after an outage.',
      kind: 'diagram',
      seconds: 30,
      parts: [
        { label: 'Clients', kind: 'box', detail: 'many callers' },
        { label: 'Service', kind: 'box', detail: 'recovering' },
      ],
      relations: [{ from: 'Clients', to: 'Service', verb: 'calls' }],
      narration: 'Everyone retries together, and the recovering service falls over again.',
      source: ['When the service came back, every client retried at the same moment.'],
    },
    {
      title: 'The storm', // duplicate title on purpose
      idea: 'Jitter spreads the retries.',
      kind: 'diagram',
      seconds: 30,
      parts: [
        { label: 'Clients', kind: 'box', detail: 'same callers, staggered' },
        { label: 'Scheduler', kind: 'box', detail: 'assigns waits' },
      ],
      relations: [{ from: 'Scheduler', to: 'Clients', verb: 'returns' }],
      narration: 'Each client waits a different interval, so arrivals spread out.',
      source: [],
    },
  ],
  glossary: [],
}

describe('buildExplanationModel', () => {
  const model = buildExplanationModel(outline)

  it('gives duplicate-titled scenes distinct positional ids', () => {
    expect(model.scenes.map(scene => scene.id)).toEqual(['scene-1-the-storm', 'scene-2-the-storm'])
    expect(new Set(model.scenes.map(scene => scene.id)).size).toBe(model.scenes.length)
  })

  it('keeps one object identity across scenes that name the same thing', () => {
    const clients = model.objects.find(object => object.label === 'Clients')
    expect(clients?.scenes).toEqual(['scene-1-the-storm', 'scene-2-the-storm'])
    expect(model.objects).toHaveLength(3)
  })

  it('resolves relations to object ids, not labels or coordinates', () => {
    const [first, second] = model.relations
    expect(first.from).toMatch(/^obj-/)
    expect(first.to).toMatch(/^obj-/)
    expect(second.scene).toBe('scene-2-the-storm')
  })

  it('marks ungrounded claims as illustrative', () => {
    expect(model.claims.filter(claim => claim.scene === 'scene-1-the-storm').every(claim => !claim.illustrative)).toBe(true)
    expect(model.claims.filter(claim => claim.scene === 'scene-2-the-storm').every(claim => claim.illustrative)).toBe(true)
  })

  it('is stable for the same outline', () => {
    expect(buildExplanationModel(outline)).toEqual(model)
  })
})

describe('wordingPolicyFrom', () => {
  it('accepts known policies and defaults otherwise', () => {
    expect(wordingPolicyFrom('preserve')).toBe('preserve')
    expect(wordingPolicyFrom('assist')).toBe('assist')
    expect(wordingPolicyFrom('draft')).toBe('draft')
    expect(wordingPolicyFrom('everything', 'preserve')).toBe('preserve')
    expect(wordingPolicyFrom(undefined)).toBe('draft')
  })
})
