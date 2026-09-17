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
  boxCarriedBy,
  type StageEntry,
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

// ——— The presenter's own room ———
// A take is a person in a rectangle, and the part of that rectangle that must
// stay clear is their head. Detection can refine it later; the default is the
// conservative region a framed speaker occupies, with padding for the way they
// move while talking.
export type FaceRegion = { left: number; top: number; width: number; height: number }
export const FACE_SAFE_DEFAULT: FaceRegion = { left: 0.18, top: 0.04, width: 0.64, height: 0.52 }

/** Where a take's head sits inside a presenter rectangle, in frame units. */
export const faceBoxIn = (camera: StageRect, region: FaceRegion = FACE_SAFE_DEFAULT, pad = 0.04): FrameBox => {
  const left = Math.max(0, region.left - pad)
  const top = Math.max(0, region.top - pad)
  const width = Math.min(1 - left, region.width + pad * 2)
  const height = Math.min(1 - top, region.height + pad * 2)
  return {
    left: camera.left + camera.width * left,
    top: camera.top + camera.height * top,
    width: camera.width * width,
    height: camera.height * height,
  }
}

/** The band burned captions occupy: nothing that matters may sit under it. */
export const CAPTION_BAND: FrameBox = { left: 6, top: 84, width: 88, height: 14 }

/** The room a presenter sweeps moving from one place to another. What the
 * path crosses matters as much as where it starts and stops. */
export const sweptBetween = (from: StageRect, to: StageRect): FrameBox => {
  const left = Math.min(from.left, to.left)
  const top = Math.min(from.top, to.top)
  return {
    left,
    top,
    width: Math.max(from.left + from.width, to.left + to.width) - left,
    height: Math.max(from.top + from.height, to.top + to.height) - top,
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
/** Every unit with the box it now has: moved and resized as the plan says,
 * and carried by whatever its ancestors were moved and resized by — a group
 * that travels takes what is drawn inside it, exactly as the renderer does. */
export const unitsOnStageAt = (plan: MotionPlanV2, units: SlideUnit[], beatIndex: number): SlideUnit[] => {
  const stage = stageStateAt(plan, beatIndex)
  // Only the element that owns a unit carries its transform: a group's id
  // list includes its children, and reading those would move it twice.
  const moved = (unit: SlideUnit) => {
    const at = stage.get(unit.id)
    return at && (at.dx || at.dy || at.scale !== 1) ? at : undefined
  }
  const carry = (unit: SlideUnit, ancestors: Array<{ at: StageEntry; about: SlideUnit['bbox'] }>): SlideUnit => {
    const own = moved(unit)
    // Innermost first: a thing moves within its parent, then the parent moves.
    const chain = own ? [{ at: own, about: unit.bbox }, ...ancestors] : ancestors
    const bbox = chain.reduce((box, link) => boxCarriedBy(box, link.at, link.about), unit.bbox)
    const children = unit.children.length ? unit.children.map(child => carry(child, chain)) : unit.children
    return chain.length || children !== unit.children ? { ...unit, bbox, children } : unit
  }
  return units.map(unit => carry(unit, []))
}

/** One unit's box, staged the same way, wherever it sits in the tree. */
export const boxOnStageAt = (plan: MotionPlanV2, units: SlideUnit[], beatIndex: number, id: string) =>
  flattenUnits(unitsOnStageAt(plan, units, beatIndex)).find(unit => unit.id === id)?.bbox

export const unitsOnScreenPerBeat = (
  plan: MotionPlanV2,
  units: SlideUnit[],
  // The page's own extent: with it, a beat whose camera is in reports only
  // the ink inside the crop, which is the only ink the viewer can see.
  viewBox?: { width: number; height: number },
): SlideUnit[][] => {
  const all = flattenUnits(units).filter(unit => unit.kind !== 'group')
  return plan.steps.map((step, index) => {
    // Where everything stands at this beat — moved, resized, on or off — read
    // from the one record, not from a second opinion kept here.
    const stage = stageStateAt(plan, index)
    const shown = new Set<string>()
    stage.forEach((entry, id) => { if (entry.visible) shown.add(id) })
    const stagedById = new Map(flattenUnits(unitsOnStageAt(plan, units, index)).map(unit => [unit.id, unit]))
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
        const staged = stagedById.get(unit.id)
        return staged ? { ...unit, bbox: staged.bbox } : unit
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
