// Deterministic local motion planner for slide/scene blocks: assigns the
// page's units to the existing narration beats with no model call. Topology
// first (arrows), reading order otherwise — the same ordering the slide
// editor's "Suggest steps" uses. Pure: same input, same output. The pure
// core (planUnitsLocally) is unit-tested without a DOM; planSceneLocally is
// the thin atomizer wrapper covered by scripts/local-plan-check.mjs.
import {
  atomizeSlideSvg,
  leafUnits,
  oneStepPerUnit,
  suggestSteps,
  type OrderedStepDraft,
} from './slide-atoms'
import type { SlideStepV1 } from 'markdown-composition'

// Purely numeric labels count up instead of revealing (the driver treats
// 'count' as a reveal until a count carrier lands — see motion-tokens.ts).
const NUMERIC_LABEL = /^\s*[-+]?[\d,]+(\.\d+)?\s*[%\w$€#×x]*\s*$/

// Contiguous partition of the ordered drafts over the beats: roughly even,
// every unit exactly once; when beats outnumber drafts, the later beats get
// empty reveals (hold beats).
export const distributeDrafts = (
  drafts: OrderedStepDraft[],
  beatCount: number,
): OrderedStepDraft[][] => {
  const slices: OrderedStepDraft[][] = Array.from({ length: beatCount }, () => [])
  if (!drafts.length || !beatCount) return slices
  const base = Math.floor(drafts.length / beatCount)
  const extra = drafts.length % beatCount
  let cursor = 0
  for (let beat = 0; beat < beatCount && cursor < drafts.length; beat += 1) {
    const take = base + (beat < extra ? 1 : 0)
    slices[beat] = drafts.slice(cursor, cursor + take)
    cursor += take
  }
  return slices
}

// The pure core: ordered drafts (from suggestSteps / oneStepPerUnit) merged
// into the existing beats.
export const planUnitsLocally = (
  drafts: OrderedStepDraft[],
  steps: SlideStepV1[],
): SlideStepV1[] => {
  if (!steps.length) return drafts.map(draft => ({ ...draft, explanation: '' }))
  const slices = distributeDrafts(drafts, steps.length)
  return steps.map((step, index) => {
    const slice = slices[index]
    if (!slice.length) return { ...step, reveals: [] }
    const reveals = [...new Set(slice.flatMap(draft => draft.reveals))]
    const heroLabel = String(slice[0].title || '')
    const verb = slice.some(draft => draft.verb === 'trace')
      ? 'trace'
      : NUMERIC_LABEL.test(heroLabel)
        ? 'count'
        : 'reveal'
    return { ...step, reveals, verb }
  })
}

export const planSceneLocally = (svg: string, steps: SlideStepV1[]): SlideStepV1[] => {
  const atomized = atomizeSlideSvg(svg)
  const leaves = leafUnits(atomized.units)
  if (!leaves.length) return steps
  // No beats yet: synthesize one step per unit (the editor's own fallback).
  if (!steps.length) {
    return oneStepPerUnit(atomized.units).map(draft => ({ ...draft, explanation: '' }))
  }
  const drafts = suggestSteps(atomized.units)
  return planUnitsLocally(drafts, steps)
}
