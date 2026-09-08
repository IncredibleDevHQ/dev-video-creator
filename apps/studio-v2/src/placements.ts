// Where the presenter sits when floating over the page: the director
// measures the page at every beat (which parts are on screen, where) and
// picks, per family, the placement that covers the least ink — bottom
// right first, then the other corners, smaller before larger — moving only
// when the current placement would cover something.
import {
  stageGeometryFor,
  variantsFor,
  type MotionPlanV2,
  type StageFamily,
  type StageRect,
  type StageVariant,
} from 'markdown-composition'
import { flattenUnits, type SlideUnit } from './slide-atoms'

export type FrameBox = { left: number; top: number; width: number; height: number }

export const FLOATING_FAMILIES: StageFamily[] = ['content-pip', 'content-tile', 'content-card', 'content-cutout']

// How much of the frame's area (in percent-area units, 100×100 = the whole
// frame) a placement may cover before the presenter moves.
const CLEAR_THRESHOLD = 0.25

/** A page-space box as a frame box, given the rect the page is fitted into. */
export const pageToFrame = (
  bbox: { x: number; y: number; width: number; height: number },
  viewBox: { width: number; height: number },
  content: StageRect,
): FrameBox => {
  // The page keeps its aspect inside the content rect (frame is 16:9).
  const rectW = (content.width / 100) * 1920
  const rectH = (content.height / 100) * 1080
  const scale = Math.min(rectW / viewBox.width, rectH / viewBox.height)
  const pageW = viewBox.width * scale
  const pageH = viewBox.height * scale
  const originX = (content.left / 100) * 1920 + (rectW - pageW) / 2
  const originY = (content.top / 100) * 1080 + (rectH - pageH) / 2
  return {
    left: ((originX + bbox.x * scale) / 1920) * 100,
    top: ((originY + bbox.y * scale) / 1080) * 100,
    width: ((bbox.width * scale) / 1920) * 100,
    height: ((bbox.height * scale) / 1080) * 100,
  }
}

const overlapArea = (a: FrameBox, b: FrameBox) => {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/** Ink the camera would cover, in percent-area units. */
export const coveredInk = (camera: StageRect, boxes: FrameBox[]) =>
  boxes.reduce((sum, box) => sum + overlapArea(camera, box), 0)

/** The share of the camera's own area that has page ink under it (a union,
 * so nested boxes count once), sampled on a grid. */
export const coveredFraction = (camera: StageRect, boxes: FrameBox[], grid = 24) => {
  if (!boxes.length) return 0
  let hit = 0
  for (let row = 0; row < grid; row += 1) {
    const y = camera.top + ((row + 0.5) / grid) * camera.height
    for (let col = 0; col < grid; col += 1) {
      const x = camera.left + ((col + 0.5) / grid) * camera.width
      if (boxes.some(box => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height)) hit += 1
    }
  }
  return hit / (grid * grid)
}

/** Units on screen at each beat: chrome from the start, the rest as they enter. */
export const unitsOnScreenPerBeat = (plan: MotionPlanV2, units: SlideUnit[]): SlideUnit[][] => {
  const all = flattenUnits(units).filter(unit => unit.kind !== 'group')
  const shown = new Set<string>()
  return plan.steps.map(step => {
    step.actions
      .filter(action => action.op === 'reveal' || action.op === 'trace' || action.op === 'count')
      .forEach(action => action.targets.forEach(id => shown.add(id)))
    return all.filter(unit => unit.chrome || unit.ids.some(id => shown.has(id)))
  })
}

const PREFERENCE = (index: number) => index * 0.03

export const bestVariant = (
  family: StageFamily,
  boxes: FrameBox[],
  previous?: StageVariant,
): { variant: StageVariant; ink: number } | null => {
  const candidates = variantsFor(family)
  if (!candidates.length) return null
  const ink = (variant: StageVariant) => coveredInk(stageGeometryFor(family, variant).camera!, boxes)
  if (previous && candidates.includes(previous) && ink(previous) <= CLEAR_THRESHOLD) return { variant: previous, ink: ink(previous) }
  let bestVariantSoFar: StageVariant = candidates[0]
  let bestScore = Number.POSITIVE_INFINITY
  let bestInk = 0
  for (let index = 0; index < candidates.length; index += 1) {
    const variant = candidates[index]
    const covered = ink(variant)
    const score = covered + PREFERENCE(index)
    if (score < bestScore) {
      bestScore = score
      bestVariantSoFar = variant
      bestInk = covered
    }
  }
  return { variant: bestVariantSoFar, ink: bestInk }
}

export type PlacementTrack = Array<{ atMs: number; beat: number; variant: StageVariant }>

/** Per floating family, the placement over the scene's beats (repeats collapsed). */
export const placementsFor = (
  plan: MotionPlanV2,
  units: SlideUnit[],
  viewBox: { width: number; height: number },
): Record<string, PlacementTrack> => {
  const onScreen = unitsOnScreenPerBeat(plan, units)
  const offsets: number[] = []
  let at = 0
  plan.steps.forEach(step => { offsets.push(at); at += step.motionWindowMs + step.holdMs })
  const result: Record<string, PlacementTrack> = {}
  FLOATING_FAMILIES.forEach(family => {
    const content = stageGeometryFor(family).content!
    let previous: StageVariant | undefined
    const track: PlacementTrack = []
    onScreen.forEach((visible, beat) => {
      const boxes = visible.map(unit => pageToFrame(unit.bbox, viewBox, content))
      const pick = bestVariant(family, boxes, previous)
      if (!pick) return
      if (pick.variant !== previous) track.push({ atMs: offsets[beat], beat, variant: pick.variant })
      previous = pick.variant
    })
    result[family] = track
  })
  return result
}

export const placementAt = (track: PlacementTrack | undefined, atMs: number): StageVariant | undefined => {
  if (!track?.length) return undefined
  let current = track[0].variant
  track.forEach(entry => { if (entry.atMs <= atMs) current = entry.variant })
  return current
}
