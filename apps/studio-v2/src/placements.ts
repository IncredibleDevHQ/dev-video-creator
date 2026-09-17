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
  unitOffsetsAt,
  cameraRectAt,
  stageStateAt,
  boxOnStage,
} from 'markdown-composition'
import { flattenUnits, type SlideUnit } from './slide-atoms'

export type FrameBox = { left: number; top: number; width: number; height: number }

export const FLOATING_FAMILIES: StageFamily[] = ['content-pip', 'content-tile', 'content-card', 'content-cutout']

// How much of the frame's area (in percent-area units, 100×100 = the whole
// frame) a placement may cover before the presenter moves.
const CLEAR_THRESHOLD = 0.25

/** A page-space box as a frame box, given the rect the page is fitted into.
 * The third argument may be the whole page or the rect the camera is showing
 * (with its own origin) — everything downstream then measures the same frame
 * the viewer sees. */
export const pageToFrame = (
  bbox: { x: number; y: number; width: number; height: number },
  viewBox: { width: number; height: number; x?: number; y?: number },
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
  const shownX = bbox.x - (viewBox.x || 0)
  const shownY = bbox.y - (viewBox.y || 0)
  return {
    left: ((originX + shownX * scale) / 1920) * 100,
    top: ((originY + shownY * scale) / 1080) * 100,
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
// The units on screen after each beat, with their boxes where the plan's
// moves have put them — so a placement is computed from the moved ink and
// the presenter's corner adjusts when a box travels.
export const unitsOnScreenPerBeat = (
  plan: MotionPlanV2,
  units: SlideUnit[],
  // The page's own extent: with it, a beat whose camera is in reports only
  // the ink inside the crop, which is the only ink the viewer can see.
  viewBox?: { width: number; height: number },
): SlideUnit[][] => {
  const all = flattenUnits(units).filter(unit => unit.kind !== 'group')
  const shown = new Set<string>()
  return plan.steps.map((step, index) => {
    step.actions
      .filter(action => action.op === 'reveal' || action.op === 'trace' || action.op === 'count')
      .forEach(action => action.targets.forEach(id => shown.add(id)))
    // What leaves is gone: an exited unit stops occupying the frame.
    step.actions
      .filter(action => action.op === 'exit')
      .forEach(action => action.targets.forEach(id => shown.delete(id)))
    // Where everything stands at this beat: moved, resized, on or off.
    const stage = stageStateAt(plan, index)
    const crop = viewBox ? cameraRectAt(plan, index, viewBox) : null
    const inside = (box: SlideUnit['bbox']) =>
      !crop ||
      (box.x + box.width > crop.x &&
        box.x < crop.x + crop.width &&
        box.y + box.height > crop.y &&
        box.y < crop.y + crop.height)
    return all
      .filter(unit => unit.chrome || unit.ids.some(id => shown.has(id)))
      .map(unit => {
        const at = unit.ids.map(id => stage.get(id)).find(entry => entry && (entry.dx || entry.dy || entry.scale !== 1))
        return at ? { ...unit, bbox: boxOnStage(unit.bbox, at) } : unit
      })
      .filter(unit => inside(unit.bbox))
  })
}

/** The frame the presenter is placed against at a beat: the camera's crop
 * when it is in, the page otherwise. */
export const worldAt = (plan: MotionPlanV2, index: number, viewBox: { width: number; height: number }) =>
  cameraRectAt(plan, index, viewBox) || { x: 0, y: 0, width: viewBox.width, height: viewBox.height }

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
  const onScreen = unitsOnScreenPerBeat(plan, units, viewBox)
  const offsets: number[] = []
  let at = 0
  plan.steps.forEach(step => { offsets.push(at); at += step.motionWindowMs + step.holdMs })
  const result: Record<string, PlacementTrack> = {}
  FLOATING_FAMILIES.forEach(family => {
    const content = stageGeometryFor(family).content!
    let previous: StageVariant | undefined
    const track: PlacementTrack = []
    onScreen.forEach((visible, beat) => {
      // Measured against what the frame holds at this beat, not the page.
      const world = worldAt(plan, beat, viewBox)
      const boxes = visible.map(unit => pageToFrame({ ...unit.bbox, x: unit.bbox.x - world.x, y: unit.bbox.y - world.y }, world, content))
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
