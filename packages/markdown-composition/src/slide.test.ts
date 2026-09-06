import { describe, expect, it } from 'vitest'
import { slideDriverScript } from './slide'

// Pulls the easing factory out of the generated in-composition driver so the
// exact code that ships in the page is what gets tested.
const loadBezier = () => {
  const script = slideDriverScript(0, 'scene', [
    { title: 'a', explanation: 'one step', reveals: ['g1'], verb: 'reveal' },
  ])
  const start = script.indexOf('var bezier =')
  const end = script.indexOf('var easeEnter')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return new Function(
    `${script.slice(start, end)}; return bezier;`,
  )() as (x1: number, y1: number, x2: number, y2: number) => (x: number) => number
}

describe('slide driver bezier easing', () => {
  const bezier = loadBezier()
  // The three driver easings plus anchors known to spike the old Newton solver.
  const anchors: Array<[number, number, number, number]> = [
    [0.2, 0.75, 0.34, 0.94],
    [0, 0.65, 0.51, 0.99],
    [0.25, 0.6, 0.4, 1],
    [0.94, 0.02, 0.05, 0.98],
    [0.01, 0.5, 0.99, 0.5],
  ]

  it('is monotonic non-decreasing across the whole domain', () => {
    for (const [x1, y1, x2, y2] of anchors) {
      const ease = bezier(x1, y1, x2, y2)
      let previous = ease(0)
      for (let i = 1; i <= 1000; i += 1) {
        const value = ease(i / 1000)
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(previous - 1e-6)
        previous = value
      }
    }
  })

  it('pins the endpoints and stays smooth near x ≈ 0.02', () => {
    for (const [x1, y1, x2, y2] of anchors) {
      const ease = bezier(x1, y1, x2, y2)
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
      const samples = [0.015, 0.02, 0.025, 0.03].map(ease)
      for (let i = 1; i < samples.length; i += 1) {
        // No spikes: the step between neighbouring samples stays small.
        expect(samples[i] - samples[i - 1]).toBeLessThan(0.2)
      }
    }
  })

  it('inverts the curve closely enough for frame-exact seeking', () => {
    const sample = (t: number, a: number, b: number) =>
      ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t
    for (const [x1, y1, x2, y2] of anchors) {
      const ease = bezier(x1, y1, x2, y2)
      for (let i = 1; i < 20; i += 1) {
        const t = i / 20
        // ease(x(t)) must return y(t): the solver truly inverts the curve.
        expect(Math.abs(ease(sample(t, x1, x2)) - sample(t, y1, y2))).toBeLessThan(1e-4)
      }
    }
  })
})

// ——— stepsFromResolvedPlan ———
import { stepsFromResolvedPlan } from './slide'

// Mirrors the real resolved.json a Kimi Plan Motion — Default run produced
// (4 beats: introduce, two relate beats with traces, an empty recap).
const REAL_RESOLVED = {
  version: 1,
  preset: 'technical-trace',
  steps: [
    {
      id: 'B01',
      title: 'Input Embeddings',
      explanation: 'Tokens come in as input embeddings.',
      hero: [],
      supporting: [],
      intent: 'introduce',
      actions: [
        {
          id: 'a1-1', op: 'reveal', targets: ['bg', 'u-input'],
          startMs: 0, durationMs: 550, ease: 'settle',
          value: { enterFrom: 'auto', lines: 'auto' },
          persistence: 'state', implicit: false,
        },
      ],
      motionWindowMs: 550,
      holdMs: 600,
    },
    {
      id: 'B02',
      title: 'Attend Across Positions',
      explanation: 'Each position looks at every other through multi-head attention.',
      hero: [],
      supporting: [],
      intent: 'relate',
      actions: [
        {
          id: 'a2-1', op: 'trace', targets: ['u-arrow-1'],
          startMs: 0, durationMs: 300, ease: 'draw',
          ports: { from: 'u-input', to: 'u-attn' },
          persistence: 'state', implicit: false,
        },
        {
          id: 'a2-2', op: 'reveal', targets: ['u-attn'],
          startMs: 210, durationMs: 320, ease: 'settle',
          persistence: 'state', implicit: false,
        },
      ],
      motionWindowMs: 530,
      holdMs: 600,
    },
    {
      id: 'B03',
      title: 'Add And Normalize',
      explanation: 'The result is added back and normalised.',
      hero: [],
      supporting: [],
      intent: 'relate',
      actions: [
        {
          id: 'a3-1', op: 'trace', targets: ['u-arrow-2'],
          startMs: 0, durationMs: 300, ease: 'draw',
          ports: { from: 'u-attn', to: 'u-norm' },
          persistence: 'state', implicit: false,
        },
        {
          id: 'a3-2', op: 'reveal', targets: ['u-norm'],
          startMs: 210, durationMs: 320, ease: 'settle',
          persistence: 'state', implicit: false,
        },
      ],
      motionWindowMs: 530,
      holdMs: 600,
    },
    {
      id: 'B04',
      title: 'Recap',
      explanation: '',
      hero: [],
      supporting: [],
      intent: 'recap',
      actions: [
        {
          id: 'a4-1', op: 'reveal', targets: [],
          startMs: 0, durationMs: 220, ease: 'settle',
          persistence: 'state', implicit: false,
        },
      ],
      motionWindowMs: 220,
      holdMs: 1500,
    },
  ],
}

const REAL_BRIEF = `<!-- motion-master-schema: brief/v1 -->

### P01 · B01
- Move: see that tokens enter the layer as input embeddings            (binding)
- Narration: sentences [1], cue word 6 ("embeddings")                  (binding)

### P01 · B02
- Move: see each position attend to every other through multi-head attention (binding)
- Narration: sentences [2], cue word 8 ("multi-head")                  (binding)

### P01 · B04
- Move: recap the sub-layer chain in data order                        (binding)
`

describe('stepsFromResolvedPlan', () => {
  it('maps entering actions to reveals and picks the verb per beat', () => {
    const steps = stepsFromResolvedPlan(REAL_RESOLVED)
    expect(steps).toHaveLength(4)
    expect(steps[0]).toMatchObject({ verb: 'reveal', reveals: ['bg', 'u-input'] })
    expect(steps[1]).toMatchObject({ verb: 'trace', reveals: ['u-arrow-1', 'u-attn'] })
    expect(steps[2]).toMatchObject({ verb: 'trace', reveals: ['u-arrow-2', 'u-norm'] })
    // The empty recap action converts to an empty reveal step (a hold).
    expect(steps[3]).toMatchObject({ verb: 'reveal', reveals: [] })
  })

  it('keeps titles and falls back to the resolved explanation, then the title', () => {
    const steps = stepsFromResolvedPlan(REAL_RESOLVED)
    expect(steps[0].title).toBe('Input Embeddings')
    expect(steps[1].explanation).toBe(REAL_RESOLVED.steps[1].explanation)
    expect(steps[3].explanation).toBe('Recap')
  })

  it('prefers the brief beat Move line when the brief is given', () => {
    const steps = stepsFromResolvedPlan(REAL_RESOLVED, { brief: REAL_BRIEF })
    expect(steps[0].explanation).toBe('see that tokens enter the layer as input embeddings')
    expect(steps[1].explanation).toBe(
      'see each position attend to every other through multi-head attention',
    )
    // B03 has no beat in this brief → resolved explanation.
    expect(steps[2].explanation).toBe(REAL_RESOLVED.steps[2].explanation)
    expect(steps[3].explanation).toBe('recap the sub-layer chain in data order')
  })

  it('marks attention-only beats as focus', () => {
    const steps = stepsFromResolvedPlan({
      version: 1,
      steps: [
        {
          id: 'st-1',
          title: 'Watch this',
          actions: [
            { id: 'a1', op: 'dim', targets: ['u-b'], startMs: 0, durationMs: 300, ease: 'exit', persistence: 'state', implicit: false },
            { id: 'a2', op: 'emphasize', targets: ['u-a'], startMs: 210, durationMs: 320, ease: 'pop', persistence: 'state', implicit: false },
          ],
          motionWindowMs: 530,
          holdMs: 600,
        },
      ],
    })
    expect(steps[0]).toMatchObject({ verb: 'focus', reveals: [] })
  })

  it('dedupes targets across actions and keeps action order', () => {
    const steps = stepsFromResolvedPlan({
      version: 1,
      steps: [
        {
          id: 'st-1',
          title: 'Dupes',
          actions: [
            { id: 'a1', op: 'reveal', targets: ['u-a', 'u-b'], startMs: 0, durationMs: 320, ease: 'settle', persistence: 'state', implicit: false },
            { id: 'a2', op: 'reveal', targets: ['u-b', 'u-c'], startMs: 224, durationMs: 320, ease: 'settle', persistence: 'state', implicit: false },
          ],
          motionWindowMs: 544,
          holdMs: 600,
        },
      ],
    })
    expect(steps[0].reveals).toEqual(['u-a', 'u-b', 'u-c'])
  })

  it('caps at 24 steps through sanitizeSlideSteps', () => {
    const steps = stepsFromResolvedPlan({
      version: 1,
      steps: Array.from({ length: 24 }, (_, index) => ({
        id: `st-${index + 1}`,
        title: `Beat ${index + 1}`,
        actions: [
          { id: `a${index}`, op: 'reveal', targets: [`u-${index}`], startMs: 0, durationMs: 220, ease: 'settle', persistence: 'state', implicit: false },
        ],
        motionWindowMs: 220,
        holdMs: 600,
      })),
    })
    expect(steps).toHaveLength(24)
  })

  it('rejects an input that fails the resolved schema', () => {
    expect(() =>
      stepsFromResolvedPlan({
        version: 1,
        steps: [
          {
            id: 'st-1',
            title: 'Broken',
            actions: [
              { id: 'a1', op: 'reveal', targets: ['u-a'], startMs: 0, ease: 'settle', persistence: 'state' },
            ],
            motionWindowMs: 220,
            holdMs: 600,
          },
        ],
      }),
    ).toThrow(/schema/)
    expect(() => stepsFromResolvedPlan({ steps: 'nope' })).toThrow()
  })
})
