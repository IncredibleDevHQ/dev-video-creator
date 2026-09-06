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
