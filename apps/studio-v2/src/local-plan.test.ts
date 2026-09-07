import { describe, expect, it } from 'vitest'
import { distributeDrafts, planUnitsLocally } from './local-plan'
import type { SlideStepV1 } from 'markdown-composition'

type Draft = { title: string; reveals: string[]; verb: 'reveal' | 'trace' }

const drafts = (list: Array<[string, string[], Draft['verb']]>): Draft[] =>
  list.map(([title, reveals, verb]) => ({ title, reveals, verb }))

const beats = (titles: string[]): SlideStepV1[] =>
  titles.map(title => ({ title, explanation: `Beat ${title}`, reveals: [], verb: 'reveal' }))

describe('distributeDrafts', () => {
  it('partitions contiguously and roughly evenly', () => {
    const d = drafts([['a', ['a'], 'reveal'], ['b', ['b'], 'reveal'], ['c', ['c'], 'reveal'], ['d', ['d'], 'reveal'], ['e', ['e'], 'reveal']])
    const slices = distributeDrafts(d, 3)
    expect(slices.map(slice => slice.map(draft => draft.title))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ])
  })

  it('assigns nothing when there are more beats than units (hold beats at the end)', () => {
    const d = drafts([['a', ['a'], 'reveal']])
    const slices = distributeDrafts(d, 3)
    expect(slices.map(slice => slice.length)).toEqual([1, 0, 0])
  })

  it('handles zero beats and zero drafts', () => {
    expect(distributeDrafts([], 2)).toEqual([[], []])
    expect(distributeDrafts(drafts([['a', ['a'], 'reveal']]), 0)).toEqual([])
  })
})

describe('planUnitsLocally', () => {
  it('assigns every unit exactly once, keeping beat titles and explanations', () => {
    const d = drafts([
      ['input', ['u-input'], 'reveal'],
      ['arrow', ['u-arrow-1'], 'trace'],
      ['attention', ['u-attn'], 'reveal'],
    ])
    const out = planUnitsLocally(d, beats(['one', 'two']))
    expect(out[0]).toMatchObject({ title: 'one', explanation: 'Beat one', reveals: ['u-input', 'u-arrow-1'], verb: 'trace' })
    expect(out[1]).toMatchObject({ reveals: ['u-attn'], verb: 'reveal' })
    expect(out.flatMap(step => step.reveals).sort()).toEqual(['u-arrow-1', 'u-attn', 'u-input'])
  })

  it('is deterministic', () => {
    const d = drafts([['a', ['a'], 'reveal'], ['b', ['b'], 'trace']])
    expect(planUnitsLocally(d, beats(['x', 'y']))).toEqual(planUnitsLocally(d, beats(['x', 'y'])))
  })

  it('marks a numeric-hero beat as count', () => {
    const d = drafts([['64 heads', ['u-num'], 'reveal']])
    expect(planUnitsLocally(d, beats(['n']))[0].verb).toBe('count')
  })

  it('leaves later beats as empty holds when beats outnumber units', () => {
    const d = drafts([['a', ['a'], 'reveal']])
    const out = planUnitsLocally(d, beats(['x', 'y']))
    expect(out[0].reveals).toEqual(['a'])
    expect(out[1].reveals).toEqual([])
  })

  it('no beats returns one step per draft (with an empty explanation)', () => {
    const d = drafts([['a', ['a'], 'reveal']])
    expect(planUnitsLocally(d, [])).toEqual([{ title: 'a', reveals: ['a'], verb: 'reveal', explanation: '' }])
  })

  it('every planned reveal id comes from the drafts (so it exists in the annotated svg)', () => {
    const d = drafts([
      ['input', ['u-input', 'u-input-label'], 'reveal'],
      ['arrow', ['u-arrow-1'], 'trace'],
      ['attention', ['u-attn'], 'reveal'],
    ])
    const known = new Set(d.flatMap(draft => draft.reveals))
    for (const step of planUnitsLocally(d, beats(['one', 'two']))) {
      for (const reveal of step.reveals) expect(known.has(reveal)).toBe(true)
    }
  })
})
