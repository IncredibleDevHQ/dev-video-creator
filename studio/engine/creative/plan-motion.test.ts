import { expect, it } from 'vitest'
import { plainBox } from './cast-packet'
import { validateTreatment } from './scene-treatment'
import { normalizeTreatment } from './treatment-normalize'

const context = {
  brief: { purpose: {}, units: [], evidence: [], coverage: [], entities: [] },
  scene: 's',
  originScenes: [],
  videoScenes: [],
  catalog: { entries: [] },
  bundleSkills: [],
  bundleReferences: [],
  delivery: null,
  assetKeys: []
}
const moment = (estimateSeconds: number, beats?: unknown[]) => ({
  id: 'm2',
  purpose: 'Show that only one side was measured',
  observation: 'The label’s bar fills while the title’s stays empty',
  attention: 'the two bars',
  objects: {
    change: 'A bar fills; its neighbour stays empty',
    actors: [],
    beats
  },
  estimateSeconds
})
const beatProblems = (plan: ReturnType<typeof moment>) =>
  validateTreatment({ moments: [plan] }, context as never).problems.filter(
    (problem) => problem.includes('beat')
  )

it('asks a long moment to develop with its voice, not change once and hold', () => {
  expect(beatProblems(moment(12))).toEqual([
    'moment m2 develops in 0 beats over about 12 s: give objects.beats, one visible change for each idea its voice reaches (at least one every 4 s), in the order it says them'
  ])
  const beats = [
    { on: 'the old rule measured the label', change: 'the label’s bar fills' },
    { on: 'about a quarter', change: 'the fill stops at 25%' },
    { on: 'never the title', change: 'the title’s track greys, dashed' }
  ]
  expect(beatProblems(moment(12, beats))).toEqual([])
  // A short moment can be one change; a beat needs its idea and its change.
  expect(beatProblems(moment(6))).toEqual([])
  expect(
    beatProblems(moment(8, [beats[0], { on: 'half', change: '' }]))
  ).toEqual([
    'moment m2 develops in one beat over about 8 s: give objects.beats, one visible change for each idea its voice reaches (at least one every 4 s), in the order it says them'
  ])
})

it('keeps a plan’s beats through normalization', () => {
  const plan = normalizeTreatment({
    moments: [moment(8, [{ on: 'it fills', change: 'the bar fills' }, 'x'])]
  })
  expect(plan.moments[0].objects?.beats).toEqual([
    { on: 'it fills', change: 'the bar fills' }
  ])
})

it('tells the page’s plain box from a drawing', () => {
  // Seen live: every actor of a scene was one rounded rectangle.
  expect(
    plainBox(
      '<svg><g><rect x="80" y="180" width="200" height="130" rx="12"/></g></svg>'
    )
  ).toBe(true)
  expect(plainBox('<svg><rect/><line/></svg>')).toBe(true)
  expect(plainBox('<svg><rect/><path d="M0 0h10"/></svg>')).toBe(false)
  expect(plainBox('<svg><circle r="4"/></svg>')).toBe(false)
  expect(plainBox('<svg></svg>')).toBe(false)
})
