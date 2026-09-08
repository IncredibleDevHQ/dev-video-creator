// The deterministic director (Motion Core Part V, first iteration). Reads a
// scene's page (its units), its script beats and its motion plan, and
// decides how the scene is staged around that motion: what kind of block it
// is, its role in the arc, how much of the frame the information needs
// (measured against the 18 px legibility gate), which stage family carries
// each beat, and the coach cues that follow. Pure functions; the studio
// writes the result onto the scene node, the agent path can replace it.
import type { MotionPlanV2, StageVariant, StageFamily as AnyStageFamily, StageTreatment as AnyStageTreatment } from 'markdown-composition'
import { FLOATING_FAMILIES, bestVariant, coveredFraction, pageToFrame, placementAt, placementsFor, unitsOnScreenPerBeat, type PlacementTrack } from './placements'
import { STAGE_BOARD_CONTENT, STAGE_LABELS, STAGE_OVERLAY_CONTENT, stageGeometryFor } from 'markdown-composition'
import { leafUnits, type SlideUnit } from './slide-atoms'
import { NUMERIC_LABEL, type ScriptBeat, type WindowLayout } from './script-plan'

export type SceneKind = 'title' | 'text' | 'list' | 'diagram' | 'figure' | 'numbers' | 'table'
export type ArcRole = 'hook' | 'map' | 'build' | 'idea' | 'explain' | 'evidence' | 'close'
export type RequiredArea = 'none' | 'slot' | 'beside' | 'frame' | 'takeover'
export type StageFamily = AnyStageFamily
export type StageTreatment = AnyStageTreatment

// One way to stage a beat, scored: the family (with treatment or placement),
// how it fares, and why — the director's pick is the best of these, the
// picker shows the rest.
export type LayoutOption = {
  family: StageFamily
  treatment?: StageTreatment
  variant?: StageVariant
  score: number
  textPx: number
  why: string
}

export type StoryboardEntry = {
  label: string
  family: StageFamily
  treatment?: StageTreatment
  note: string
  beats: number[]
  // Starts this long before the end of its last beat (the lead-out).
  fromEndMs?: number
  // Placement (anchor-size) for the floating families.
  variant?: StageVariant
  // Why the director chose it (its first beat's reason).
  why?: string
}

export type DirectorBrief = {
  layout: string
  layoutReason: string
  totalSeconds: number
  stepCount: number
  cues: Array<{ step: number; title: string; text: string }>
}

export type DirectorResult = {
  kind: SceneKind
  arcRole: ArcRole
  requiredArea: RequiredArea
  legibility: { minTextPx: Record<RequiredArea, number>; gatePx: number }
  storyboard: StoryboardEntry[]
  cues: string[]
  directorNotes: string
  brief: DirectorBrief
  // Per floating family, where the presenter sits over the beats.
  placements: Record<string, PlacementTrack>
  // Per beat, every way it could be staged, best first.
  layoutOptions: LayoutOption[][]
}

export type DirectorInput = {
  title: string
  units: SlideUnit[]
  viewBox: { width: number; height: number }
  beats: ScriptBeat[]
  plan: MotionPlanV2
  position: { index: number; count: number }
  speakers?: number
  // Per-window layout wishes from the breakdown (me / beside / page).
  layouts?: Array<WindowLayout | undefined>
}

// Share of the frame width each required-area class gives the information
// (Part V §… and Part II slot table): overlay slot beside a full-frame
// person, the content side of a speaker panel, a content card, the page.
const AREA_WIDTH_SHARE: Record<RequiredArea, number> = {
  none: 0,
  slot: 0.36,
  beside: 0.52,
  frame: 0.72,
  takeover: 0.94,
}
const FRAME_WIDTH_PX = 1920
const LEGIBILITY_GATE_PX = 18

const FAMILY_FOR_AREA: Record<RequiredArea, StageFamily> = {
  none: 'speaker-full',
  slot: 'speaker-full',
  beside: 'speaker-panel',
  frame: 'content-card',
  takeover: 'content-pip',
}

export const classifyScene = (units: SlideUnit[]) => {
  const leaves = leafUnits(units)
  const boxes = leaves.filter(unit => unit.kind === 'box')
  const connectors = leaves.filter(unit => unit.kind === 'connector')
  const labels = leaves.filter(unit => unit.kind === 'label' || unit.kind === 'box')
  const numeric = labels.filter(unit => NUMERIC_LABEL.test(unit.label))
  const images = leaves.filter(unit => unit.kind === 'image')
  const textChars = labels.reduce((sum, unit) => sum + unit.label.length, 0)
  let kind: SceneKind = 'text'
  if (leaves.length <= 2 && textChars < 90) kind = 'title'
  else if (images.length && boxes.length <= 2) kind = 'figure'
  else if (connectors.length >= 1 && boxes.length >= 2) kind = 'diagram'
  else if (numeric.length >= Math.max(2, labels.length * 0.3)) kind = 'numbers'
  else if (boxes.length >= 6 && connectors.length === 0 && boxes.every(box => box.bbox.height < 80)) kind = 'table'
  else if (boxes.length >= 3 && connectors.length === 0) kind = 'list'
  return { kind, leaves, boxes, connectors, labels, numeric, images, textChars }
}

export const arcRoleFor = (kind: SceneKind, position: { index: number; count: number }, beats: ScriptBeat[]): ArcRole => {
  if (position.index === 0) return 'hook'
  if (position.index === position.count - 1) return 'close'
  if (position.index === 1 && (kind === 'list' || kind === 'title')) return 'map'
  const text = beats.map(beat => `${beat.title} ${beat.text}`).join(' ').toLowerCase()
  if (kind === 'numbers' || kind === 'table' || /\b(result|score|bleu|benchmark|ablation|evidence|measured|outperform)/.test(text)) return 'evidence'
  if (kind === 'title' || (/\b(idea|insight|the trick|the claim|what if)\b/.test(text) && kind !== 'diagram')) return 'idea'
  if (kind === 'diagram' || kind === 'figure') return 'build'
  return 'explain'
}

/** Smallest text height (px at 1080p) once the page sits in each class's width. */
export const legibilityFor = (units: SlideUnit[], viewBox: { width: number; height: number }) => {
  const leaves = leafUnits(units)
  const texts = leaves.filter(unit => unit.kind === 'label' || unit.kind === 'box')
  // A box's text is roughly 0.45 of its height; a label's bbox is its text.
  const heights = texts.map(unit => (unit.kind === 'box' ? unit.bbox.height * 0.45 : unit.bbox.height)).filter(h => h > 0)
  const minText = heights.length ? Math.min(...heights) : viewBox.height * 0.03
  const minTextPx = {} as Record<RequiredArea, number>
  ;(Object.keys(AREA_WIDTH_SHARE) as RequiredArea[]).forEach(area => {
    const scale = (FRAME_WIDTH_PX * AREA_WIDTH_SHARE[area]) / viewBox.width
    minTextPx[area] = Math.round(minText * scale * 10) / 10
  })
  return { minTextPx, gatePx: LEGIBILITY_GATE_PX }
}

/** Units a beat brings on screen or highlights (by element id → unit). */
const beatUnits = (units: SlideUnit[], beat: MotionPlanV2['steps'][number]) => {
  const ids = new Set(beat.actions.filter(action => !action.implicit).flatMap(action => action.targets))
  return leafUnits(units).filter(unit => unit.ids.some(id => ids.has(id)))
}

/** The area one beat needs: measured on the parts that beat is about. */
export const requiredAreaForBeat = (
  units: SlideUnit[],
  viewBox: { width: number; height: number },
  beat: MotionPlanV2['steps'][number],
  kind: SceneKind,
): RequiredArea => {
  const subject = beatUnits(units, beat)
  if (!subject.length) return 'none'
  const legibility = legibilityFor(subject, viewBox)
  const traces = beat.actions
    .filter(action => action.op === 'trace' || action.op === 'connect')
    .reduce((sum, action) => sum + Math.max(1, action.targets.length), 0)
  const camera = beat.actions.some(action => action.op === 'camera' && !action.implicit)
  const floor: RequiredArea = kind === 'table' || traces >= 3 || camera ? 'takeover' : subject.length >= 6 ? 'frame' : 'slot'
  const orderList: RequiredArea[] = ['slot', 'beside', 'frame', 'takeover']
  for (let i = Math.max(0, orderList.indexOf(floor)); i < orderList.length; i += 1) {
    if (legibility.minTextPx[orderList[i]] >= legibility.gatePx) return orderList[i]
  }
  return 'takeover'
}

export const requiredAreaFor = (
  kind: SceneKind,
  plan: MotionPlanV2,
  legibility: ReturnType<typeof legibilityFor>,
  beats: ScriptBeat[],
): RequiredArea => {
  if (beats.some(beat => beat.directions.some(direction => direction.kind === 'takeover'))) return 'takeover'
  if (beats.some(beat => beat.directions.some(direction => direction.kind === 'panel'))) return 'beside'
  if (kind === 'title') return 'none'
  // Traced connectors, counted by target: a flow of three arrows needs the
  // frame whether they draw in one beat or three.
  const traces = plan.steps.reduce(
    (sum, beat) =>
      sum +
      beat.actions
        .filter(action => action.op === 'trace' || action.op === 'connect')
        .reduce((inner, action) => inner + Math.max(1, action.targets.length), 0),
    0,
  )
  const cameras = plan.steps.reduce((sum, beat) => sum + beat.actions.filter(action => action.op === 'camera' && !action.implicit).length, 0)
  // Traced flows and camera work need the frame; tables need every pixel.
  const floor: RequiredArea = kind === 'table' || traces >= 3 || cameras >= 1 ? 'takeover' : kind === 'diagram' ? 'frame' : kind === 'figure' ? 'slot' : 'slot'
  const orderList: RequiredArea[] = ['slot', 'beside', 'frame', 'takeover']
  const floorIndex = orderList.indexOf(floor)
  for (let i = Math.max(0, floorIndex); i < orderList.length; i += 1) {
    if (legibility.minTextPx[orderList[i]] >= legibility.gatePx) return orderList[i]
  }
  return 'takeover'
}

// ——— Layout scoring: every family, every beat ———
// The director weighs each way of staging a beat on four things: whether
// the beat's own parts stay legible at that size (the 18 px gate), whether
// the space matches the information's complexity, how much the beat needs
// your face, and what the writer asked for. Floating families lose points
// for the ink they cover. Each option carries its reason.
const CANDIDATE_FAMILIES: StageFamily[] = [
  'speaker-full',
  'speaker-lead',
  'speaker-panel',
  'split',
  'content-lead',
  'content-card',
  'content-cutout',
  'content-tile',
  'content-pip',
]
// Share of the frame the presenter holds in each family.
const SPEAKER_SHARE: Record<StageFamily, number> = {
  'content-full': 0,
  'speaker-full': 1,
  'speaker-lead': 0.58,
  'speaker-panel': 0.44,
  split: 0.5,
  'content-lead': 0.23,
  'content-card': 0.16,
  'content-cutout': 0.12,
  'content-tile': 0.09,
  'content-pip': 0.06,
}
const FRAME_HEIGHT_PX = 1080
// Among the floating families the chip is the default; the others need a
// reason (crowding, a busier presence) to win.
const FAMILY_PREFERENCE: Partial<Record<StageFamily, number>> = { 'content-pip': 0.04, 'content-tile': 0.02, 'content-cutout': 0.01, 'speaker-panel': 0.02 }

type BeatMeasure = {
  subject: SlideUnit[]
  visible: SlideUnit[]
  traces: number
  camera: boolean
  brings: boolean
  moves: boolean
  words: number
  wish?: WindowLayout
  // An explicit [panel] direction means the panel itself, not any "beside".
  panelDirected: boolean
}

const measureBeat = (units: SlideUnit[], plan: MotionPlanV2, beat: ScriptBeat, visible: SlideUnit[], wish?: WindowLayout): BeatMeasure => {
  const step = plan.steps[beat.index]
  const subject = step ? beatUnits(units, step) : []
  const traces = step ? step.actions.filter(a => a.op === 'trace' || a.op === 'connect').reduce((sum, a) => sum + Math.max(1, a.targets.length), 0) : 0
  const camera = Boolean(step?.actions.some(a => a.op === 'camera' && !a.implicit))
  const brings = Boolean(step?.actions.some(a => ['reveal', 'trace', 'count', 'connect'].includes(a.op)))
  const moves = Boolean(step?.actions.some(a => !a.implicit && a.op !== 'undim'))
  const directed: WindowLayout | undefined = beat.directions.some(d => d.kind === 'open')
    ? 'me'
    : beat.directions.some(d => d.kind === 'panel')
      ? 'beside'
      : beat.directions.some(d => d.kind === 'takeover')
        ? 'page'
        : undefined
  return {
    subject,
    visible: visible.filter(unit => !unit.chrome),
    traces,
    camera,
    brings,
    moves,
    words: beat.text.split(/\s+/).filter(Boolean).length,
    wish: wish || directed,
    panelDirected: beat.directions.some(d => d.kind === 'panel'),
  }
}

// The smallest text (page units) among some units; a box's text is ~0.45 of its height.
const smallestText = (units: SlideUnit[], viewBox: { width: number; height: number }) => {
  const heights = units
    .filter(unit => unit.kind === 'label' || unit.kind === 'box')
    .map(unit => (unit.kind === 'box' ? unit.bbox.height * 0.45 : unit.bbox.height))
    .filter(h => h > 0)
  return heights.length ? Math.min(...heights) : viewBox.height * 0.03
}

// How large the page renders inside a content rect (frame percent), aspect kept.
const pageScaleIn = (rect: { width: number; height: number } | null, viewBox: { width: number; height: number }) =>
  rect ? Math.min(((rect.width / 100) * FRAME_WIDTH_PX) / viewBox.width, ((rect.height / 100) * FRAME_HEIGHT_PX) / viewBox.height) : 0

const contentRectFor = (family: StageFamily, treatment: StageTreatment | undefined, variant: StageVariant | undefined) => {
  if (family === 'speaker-full') return treatment === 'board' ? STAGE_BOARD_CONTENT : treatment === 'overlay' ? STAGE_OVERLAY_CONTENT : null
  return stageGeometryFor(family, variant).content
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

// The share of the frame the information wants, from how much is on screen
// and how it moves: a few parts fit a card; traced flows, camera work and
// tables want the frame.
const wantedShareFor = (measure: BeatMeasure, kind: SceneKind) => {
  const count = measure.visible.length
  let share = count <= 3 ? 0.25 : count <= 6 ? 0.45 : count <= 12 ? 0.6 : 0.82
  if (measure.traces >= 3 || measure.camera) share = Math.max(share, 0.82)
  else if (measure.traces >= 1) share += 0.12
  if (kind === 'table') share = 0.9
  return Math.min(0.9, share)
}

// How much the beat wants your face: your line, the open and the close,
// a beat that brings nothing new; less as the page gets busier.
const speakerNeedFor = (measure: BeatMeasure, arcRole: ArcRole, position: { first: boolean; last: boolean }) => {
  if (measure.wish === 'me') return 1
  if (!measure.brings && !measure.moves) return position.first || position.last ? 1 : 0.85
  let need = measure.subject.length <= 2 ? 0.55 : measure.subject.length <= 5 ? 0.4 : 0.25
  if (position.first && arcRole === 'hook') need += 0.15
  if (measure.words >= 40) need += 0.1
  return Math.min(1, need)
}

export const layoutOptionsFor = (
  units: SlideUnit[],
  viewBox: { width: number; height: number },
  plan: MotionPlanV2,
  beat: ScriptBeat,
  context: {
    kind: SceneKind
    arcRole: ArcRole
    count: number
    visible: SlideUnit[]
    wish?: WindowLayout
    crowded?: boolean
    // Per floating family: the best placement and the share of the presenter's
    // area that would sit on page ink there.
    ink?: Partial<Record<StageFamily, { variant: StageVariant; ink: number } | null>>
    previous?: StageFamily
  },
): LayoutOption[] => {
  const measure = measureBeat(units, plan, beat, context.visible, context.wish)
  const position = { first: beat.index === 0, last: beat.index === context.count - 1 }
  const wanted = wantedShareFor(measure, context.kind)
  const need = speakerNeedFor(measure, context.arcRole, position)
  const subjectText = smallestText(measure.subject.length ? measure.subject : measure.visible, viewBox)
  const textOnly = measure.subject.length > 0 && measure.subject.length <= 4 && measure.subject.every(unit => unit.kind === 'label' || unit.kind === 'box')
  const candidates: Array<{ family: StageFamily; treatment?: StageTreatment }> = CANDIDATE_FAMILIES.map(family => ({ family }))
  if (measure.brings && textOnly) candidates.push({ family: 'speaker-full', treatment: 'board' })
  if (measure.brings && measure.subject.length <= 2 && context.kind === 'title') candidates.push({ family: 'speaker-full', treatment: 'overlay' })

  const options = candidates.map(({ family, treatment }): LayoutOption => {
    const placed = context.ink?.[family] || null
    const variant = placed?.variant
    const rect = contentRectFor(family, treatment, variant)
    const scale = pageScaleIn(rect, viewBox)
    const textPx = Math.round(subjectText * scale * 10) / 10
    const share = rect ? (rect.width / 100) * (rect.height / 100) * (family === 'speaker-full' ? 0.9 : 1) : 0
    const needsPage = measure.brings || measure.moves || measure.subject.length > 0
    const why: string[] = []
    // Legibility: the beat's own parts at this size.
    let legibility = 1
    if (needsPage) {
      if (!rect) {
        legibility = measure.brings ? 0 : 0.35
        why.push(measure.brings ? 'the page would be off screen while it brings something in' : 'nothing new on the page')
      } else {
        legibility = clamp01((textPx - 10) / 12)
        if (textPx < LEGIBILITY_GATE_PX) why.push(`smallest text ${textPx} px, under the ${LEGIBILITY_GATE_PX} px gate`)
        else why.push(`smallest text ${textPx} px`)
      }
    } else {
      why.push('your line — the page only keeps you company')
    }
    // Space vs complexity.
    let space = rect ? clamp01(1 - Math.abs(wanted - share) / 0.55) : need >= 0.85 ? 1 : 0.2
    const ink = Math.min(1, placed?.ink ?? 0)
    if (FLOATING_FAMILIES.includes(family as never)) {
      space = clamp01(space - ink * 0.9)
      if (ink > 0.25) why.push(`you would cover ${Math.round(ink * 100)}% of the page's ink`)
      if (context.crowded && family === 'content-pip') space *= 0.6
    }
    if (rect && wanted >= 0.8 && share < 0.5) why.push(measure.traces >= 3 ? `${measure.traces} traced arrows need the frame` : measure.camera ? 'the camera moves in — the page needs the frame' : `${measure.visible.length} parts on screen need room`)
    if (rect && wanted <= 0.3 && share >= 0.6) why.push(`only ${Math.max(1, measure.visible.length)} part${measure.visible.length === 1 ? '' : 's'} on screen — more page than the beat needs`)
    // Your presence.
    const presence = clamp01(1 - Math.abs(need - SPEAKER_SHARE[family] * (treatment === 'board' ? 0.6 : 1)))
    if (need >= 0.85 && SPEAKER_SHARE[family] >= 0.5) why.push('the beat wants your face')
    // Wishes.
    let wish = 0.5
    if (measure.wish === 'me') wish = family === 'speaker-full' && !treatment ? 1 : 0
    else if (measure.wish === 'beside') {
      wish = ['speaker-panel', 'speaker-lead', 'content-lead', 'split'].includes(family) ? 1 : family === 'speaker-full' ? 0.1 : 0.4
      if (measure.panelDirected && family !== 'speaker-panel') wish = Math.min(wish, 0.7)
    }
    else if (measure.wish === 'page') wish = family.startsWith('content-') ? 1 : family === 'speaker-full' ? 0 : 0.5
    if (measure.wish && wish === 1) why.push(measure.wish === 'me' ? 'you asked for this line on you' : measure.wish === 'beside' ? 'you asked to be beside the page' : 'you asked the page to take the frame')
    const continuity = context.previous === family ? 1 : 0
    // A wish the writer or the breakdown made is decisive while it stays legible.
    const weights = { legibility: 3, space: 2, presence: 1.5, wish: measure.wish ? 5 : 0, continuity: 0.4 }
    const total =
      (legibility * weights.legibility + space * weights.space + presence * weights.presence + wish * weights.wish + continuity * weights.continuity) /
      (weights.legibility + weights.space + weights.presence + weights.wish + weights.continuity)
    const hardFail = (needsPage && measure.brings && (!rect || textPx < LEGIBILITY_GATE_PX * 0.75)) || (measure.wish === 'me' && wish === 0)
    const preferred = total + (treatment ? 0 : FAMILY_PREFERENCE[family] || 0)
    return {
      family,
      ...(treatment ? { treatment } : {}),
      ...(variant ? { variant } : {}),
      score: Math.round((hardFail ? preferred * 0.3 : preferred) * 1000) / 1000,
      textPx,
      why: why.slice(0, 2).join(' · '),
    }
  })
  return options.sort((a, b) => b.score - a.score)
}

const firstWords = (text: string, count = 5) => {
  const words = text.split(/\s+/).filter(Boolean)
  return `${words.slice(0, count).join(' ')}${words.length > count ? '…' : ''}`
}

const describeBeat = (beat: ScriptBeat, plan: MotionPlanV2) => {
  const step = plan.steps[beat.index]
  const ops = new Set(step?.actions.filter(action => !action.implicit).map(action => action.op))
  const parts: string[] = []
  if (ops.has('reveal')) parts.push('the parts land as you name them')
  if (ops.has('trace')) parts.push('the arrows trace')
  if (ops.has('connect')) parts.push('a link draws between the two')
  if (ops.has('count')) parts.push('the number counts up')
  if (ops.has('camera')) parts.push('the camera moves in')
  if (ops.has('dim')) parts.push('everything else dims')
  if (ops.has('emphasize') && !ops.has('reveal')) parts.push('the named part pops')
  if (ops.has('exit')) parts.push('what is done leaves')
  return parts.length ? parts.join(', ') : 'nothing new on the page — this line is yours'
}

const beatSeconds = (plan: MotionPlanV2, index: number) => {
  const step = plan.steps[index]
  return step ? (step.motionWindowMs + step.holdMs) / 1000 : 0
}

/**
 * The storyboard: one entry per layout moment. Opens on the person when the
 * first beat brings nothing on screen (or the scene is the hook), hands the
 * frame to the information for the beats that move it, comes back to the
 * person for a closing line that adds nothing to the page. Then smooths:
 * merges same-family neighbours, folds segments under four seconds into
 * their neighbours, keeps at most four changes.
 */
// The outro (Motion Core Part V, closing a scene): the last stretch has
// you fully in frame beside the page while the thought closes, then the
// frame is yours alone to lead into the next scene. It exists whether or
// not the dialogue wrote an outro line; the cue says when it did not.
const OUTRO_LEAD_MS = 1_100
const OUTRO_MIN_BRIDGE_MS = 1_800

export const outroFor = (
  beats: ScriptBeat[],
  plan: MotionPlanV2,
  position: { index: number; count: number },
  layouts: Array<WindowLayout | undefined> = [],
  requiredArea: RequiredArea = 'takeover',
): { entries: StoryboardEntry[]; scripted: boolean } | null => {
  if (position.index >= position.count - 1 || beats.length < 2) return null
  const lastIndex = beats.length - 1
  const last = plan.steps[lastIndex]
  if (!last) return null
  const brings = last.actions.some(action => ['reveal', 'trace', 'count', 'connect'].includes(action.op))
  const wish = layouts[lastIndex]
  // A written outro: the last window brings nothing new (or asks to be
  // beside / on you). Otherwise the bridge is cut into the final beat.
  const scripted = !brings || wish === 'beside' || wish === 'me'
  const lastMs = last.motionWindowMs + last.holdMs
  const beatsOfBridge = [lastIndex]
  // A page with almost nothing on it (a title card) stays behind you as an
  // overlay instead of opening a panel beside you.
  const bridgeFamily: StageFamily = requiredArea === 'none' ? 'speaker-full' : 'speaker-panel'
  const bridgeTreatment: StageTreatment | undefined = requiredArea === 'none' ? 'overlay' : undefined
  const bridge: StoryboardEntry = scripted
    ? { label: 'Outro', family: bridgeFamily, ...(bridgeTreatment ? { treatment: bridgeTreatment } : {}), note: `You ${requiredArea === 'none' ? 'with the card behind you' : 'beside the page'}, closing the thought · “${beats[lastIndex].text.split(/\s+/).slice(0, 5).join(' ')}…”`, beats: beatsOfBridge }
    : { label: 'Outro', family: bridgeFamily, ...(bridgeTreatment ? { treatment: bridgeTreatment } : {}), note: 'The frame opens to you for the last seconds — no outro line was written', beats: beatsOfBridge, fromEndMs: Math.min(lastMs * 0.6, OUTRO_MIN_BRIDGE_MS + OUTRO_LEAD_MS) }
  const lead: StoryboardEntry = {
    label: 'Lead into the next scene',
    family: 'speaker-full',
    note: 'You alone, then the cut to the next scene',
    beats: [lastIndex],
    fromEndMs: Math.min(lastMs * 0.35, OUTRO_LEAD_MS),
  }
  return { entries: [bridge, lead], scripted }
}

export const storyboardFor = (
  beats: ScriptBeat[],
  plan: MotionPlanV2,
  requiredArea: RequiredArea,
  arcRole: ArcRole,
  perBeat: { areas?: RequiredArea[]; layouts?: Array<WindowLayout | undefined>; outro?: StoryboardEntry[]; crowded?: boolean; choices?: LayoutOption[] } = {},
): StoryboardEntry[] => {
  const raw: StoryboardEntry[] = beats.map(beat => {
    const step = plan.steps[beat.index]
    const beatArea = perBeat.areas?.[beat.index] ?? requiredArea
    const choice = perBeat.choices?.[beat.index]
    const directed: WindowLayout | undefined = beat.directions.some(d => d.kind === 'open')
      ? 'me'
      : beat.directions.some(d => d.kind === 'panel')
        ? 'beside'
        : beat.directions.some(d => d.kind === 'takeover')
          ? 'page'
          : undefined
    const wish = perBeat.layouts?.[beat.index] || directed
    let contentFamily: StageFamily =
      wish === 'beside' ? 'speaker-panel' : wish === 'page' ? FAMILY_FOR_AREA[beatArea === 'none' ? 'takeover' : beatArea] : FAMILY_FOR_AREA[beatArea]
    // A page busy to its corners leaves no clear spot for a chip: the page
    // moves aside for a card instead of being covered.
    if (perBeat.crowded && contentFamily === 'content-pip') contentFamily = 'content-card'
    let contentTreatment: StageTreatment = beatArea === 'slot' && contentFamily === 'speaker-full' ? 'overlay' : ''
    // The scored choice wins where the director scored the beat.
    if (choice) {
      contentFamily = choice.family
      contentTreatment = choice.treatment || ''
    }
    const brings = step?.actions.some(action => ['reveal', 'trace', 'count', 'connect'].includes(action.op)) || false
    const moves = step?.actions.some(action => !action.implicit && action.op !== 'undim') || false
    const onMe = wish === 'me' || beat.directions.some(direction => direction.kind === 'open')
    const last = beat.index === beats.length - 1
    if (onMe || (!brings && !moves && (beat.index === 0 || last))) {
      return {
        label: beat.index === 0 ? 'Open' : last ? 'Back to you' : 'On you',
        family: 'speaker-full',
        treatment: arcRole === 'idea' && !brings ? 'glow-bed-hero' : '',
        note: `You, full frame · “${firstWords(beat.text)}”`,
        beats: [beat.index],
        why: onMe ? 'your line, on you' : beat.index === 0 ? 'open on you — the first line belongs to your face' : 'the last line belongs to your face',
      }
    }
    if (beatArea === 'none' && wish !== 'page' && !choice) {
      return {
        label: beat.title,
        family: 'speaker-full',
        treatment: brings ? 'overlay' : '',
        note: brings ? `The title lands behind you on “${firstWords(beat.text, 4)}”` : `You, full frame · “${firstWords(beat.text)}”`,
        beats: [beat.index],
        why: 'the page has almost nothing on it',
      }
    }
    return {
      label: beat.title,
      family: contentFamily,
      treatment: contentTreatment,
      note: `${describeBeat(beat, plan)} · “${firstWords(beat.text, 4)}”`,
      beats: [beat.index],
      ...(choice?.why ? { why: choice.why } : {}),
    }
  })
  // Merge same-family neighbours.
  const merged: StoryboardEntry[] = []
  raw.forEach(entry => {
    const previous = merged[merged.length - 1]
    if (previous && previous.family === entry.family && (previous.treatment || '') === (entry.treatment || '')) {
      previous.beats.push(...entry.beats)
      previous.note = `${previous.note} → ${entry.note}`
      return
    }
    merged.push({ ...entry, beats: [...entry.beats] })
  })
  // Fold short segments (< 4 s) sandwiched between identical families.
  const seconds = (entry: StoryboardEntry) => entry.beats.reduce((sum, index) => sum + beatSeconds(plan, index), 0)
  for (let i = 1; i < merged.length - 1; i += 1) {
    if (seconds(merged[i]) < 4 && merged[i - 1].family === merged[i + 1].family) {
      merged[i - 1].beats.push(...merged[i].beats, ...merged[i + 1].beats)
      merged.splice(i, 2)
      i -= 1
    }
  }
  // Cap the number of changes: keep the first five moments, fold the rest.
  while (merged.length > 5) {
    const tail = merged.pop()!
    merged[merged.length - 1].beats.push(...tail.beats)
  }
  // The outro replaces whatever the last beat was staged as when the outro
  // owns the whole beat; a cut-in outro rides after the last moment.
  const outro = perBeat.outro || []
  if (outro.length) {
    const bridge = outro[0]
    if (!bridge.fromEndMs) {
      const lastBeat = beats.length - 1
      merged.forEach(entry => { entry.beats = entry.beats.filter(index => index !== lastBeat) })
      for (let i = merged.length - 1; i >= 0; i -= 1) if (!merged[i].beats.length) merged.splice(i, 1)
    }
    merged.push(...outro)
  }
  return merged
}

export const cuesFor = (storyboard: StoryboardEntry[], beats: ScriptBeat[], plan: MotionPlanV2, outro?: { scripted: boolean } | null): string[] => {
  const cues: string[] = []
  if (outro) {
    cues.push(
      outro.scripted
        ? `Outro: turn to camera on “${beats[beats.length - 1].text.split(/\s+/).slice(0, 4).join(' ')}…” — the frame opens to you beside the page, then to you alone; land the last word and hold`
        : 'Outro: the frame opens to you beside the page for the last seconds, then to you alone — write an outro line (+ Outro) so the words close the scene too',
    )
  }
  storyboard.forEach((entry, index) => {
    const firstBeat = beats[entry.beats[0]]
    if (!firstBeat) return
    const previous = storyboard[index - 1]
    if (index === 0 && entry.family === 'speaker-full') cues.push('Open on you — the first line belongs to your face, not the page')
    if (previous && previous.family === 'speaker-full' && entry.family !== 'speaker-full') cues.push(`Hand the frame to the page on “${firstWords(firstBeat.text, 4)}”`)
    if (previous && previous.family !== 'speaker-full' && entry.family === 'speaker-full') cues.push(`Back to you on “${firstWords(firstBeat.text, 4)}”`)
    entry.beats.forEach(beatIndex => {
      const step = plan.steps[beatIndex]
      if (!step) return
      if (step.actions.some(action => action.op === 'trace')) cues.push(`Let the trace land before the next sentence (beat ${beatIndex + 1})`)
      if (step.actions.some(action => action.op === 'count')) cues.push(`Hold on the number until it stops counting (beat ${beatIndex + 1})`)
      if (step.actions.some(action => action.op === 'camera' && !action.implicit)) cues.push(`The camera moves in — slow down, the viewer is reading (beat ${beatIndex + 1})`)
    })
  })
  return [...new Set(cues)].slice(0, 6)
}

const notesFor = (kind: SceneKind, arcRole: ArcRole, requiredArea: RequiredArea, storyboard: StoryboardEntry[], legibility: ReturnType<typeof legibilityFor>) => {
  const open = storyboard[0]
  const opening =
    open?.family === 'speaker-full'
      ? 'Open on you.'
      : `Open straight on the page — the first line already brings something in.`
  const areaLine =
    requiredArea === 'none'
      ? 'The page has almost nothing on it, so it stays a card behind you.'
      : requiredArea === 'slot'
        ? `The information fits a slot beside you (smallest text ${legibility.minTextPx.slot} px at 1080p).`
        : requiredArea === 'beside'
          ? `Sit in a panel with the page beside you — it stays legible at that width (${legibility.minTextPx.beside} px), it would not in a slot (${legibility.minTextPx.slot} px).`
          : requiredArea === 'frame'
            ? `The page needs a card most of the frame wide; you ride in the margin (smallest text ${legibility.minTextPx.frame} px).`
            : `The ${kind === 'diagram' ? 'diagram' : 'page'} needs the whole frame — you become a chip (in a panel the smallest text would be ${legibility.minTextPx.beside} px, under the 18 px gate).`
  const close = storyboard[storyboard.length - 1]
  const closing = storyboard.some(entry => entry.label === 'Outro')
    ? 'Close beside the page with the last thought, then alone in frame to lead into the next scene.'
    : storyboard.length > 1 && close?.family === 'speaker-full' ? 'Come back full frame for the last line.' : ''
  const role = arcRole === 'hook' ? 'This is the hook: earn the next minute.' : arcRole === 'close' ? 'This is the close: land it and stop.' : arcRole === 'map' ? 'This is the map: do not rush it.' : ''
  const crowdedLine = storyboard.some(entry => entry.family === 'content-card' && entry.label !== 'Outro') && requiredArea === 'takeover' ? 'The page is busy to its corners, so it moves aside for a card rather than being covered by a chip.' : ''
  return [opening, areaLine, crowdedLine, closing, role].filter(Boolean).join(' ')
}

export const direct = (input: DirectorInput): DirectorResult => {
  const { kind } = classifyScene(input.units)
  const arcRole = arcRoleFor(kind, input.position, input.beats)
  const legibility = legibilityFor(input.units, input.viewBox)
  const sceneArea = requiredAreaFor(kind, input.plan, legibility, input.beats)
  // Per beat: the area the beat's own parts need; the scene's area is the
  // largest any beat needs (what the pill shows), never more than the
  // whole-page measure.
  const order: RequiredArea[] = ['none', 'slot', 'beside', 'frame', 'takeover']
  const areas = input.plan.steps.map(step => requiredAreaForBeat(input.units, input.viewBox, step, kind))
  const requiredArea = areas.length
    ? order[Math.min(order.indexOf(sceneArea), Math.max(...areas.map(area => order.indexOf(area))))]
    : sceneArea
  const outro = outroFor(input.beats, input.plan, input.position, input.layouts, requiredArea)
  const placements = placementsFor(input.plan, input.units, input.viewBox)
  // Crowded: on most beats even the best chip placement covers ink.
  const chipContent = stageGeometryFor('content-pip').content!
  const inkPerBeat = unitsOnScreenPerBeat(input.plan, input.units).map(visible => {
    const boxes = visible.map(unit => pageToFrame(unit.bbox, input.viewBox, chipContent))
    return bestVariant('content-pip', boxes)?.ink ?? 0
  })
  const crowded = inkPerBeat.length > 0 && inkPerBeat.filter(ink => ink > 0.6).length >= Math.ceil(inkPerBeat.length / 2)
  const offsets: number[] = []
  let at = 0
  input.plan.steps.forEach(step => { offsets.push(at); at += step.motionWindowMs + step.holdMs })
  // Every way each beat could be staged, scored; the best runs into the
  // storyboard with a little loyalty to the previous beat's choice.
  const visiblePerBeat = unitsOnScreenPerBeat(input.plan, input.units)
  const layoutOptions: LayoutOption[][] = []
  const choices: LayoutOption[] = []
  let previous: StageFamily | undefined
  input.beats.forEach(beat => {
    const visible = visiblePerBeat[beat.index] || []
    const ink: Partial<Record<StageFamily, { variant: StageVariant; ink: number } | null>> = {}
    FLOATING_FAMILIES.forEach(family => {
      const content = stageGeometryFor(family).content!
      const boxes = visible.map(unit => pageToFrame(unit.bbox, input.viewBox, content))
      const best = bestVariant(family, boxes, placementAt(placements[family], offsets[beat.index] ?? 0))
      // As a share of the presenter's own area, counted once (a union).
      ink[family] = best ? { variant: best.variant, ink: coveredFraction(stageGeometryFor(family, best.variant).camera!, boxes) } : null
    })
    const options = layoutOptionsFor(input.units, input.viewBox, input.plan, beat, {
      kind,
      arcRole,
      count: input.beats.length,
      visible,
      wish: input.layouts?.[beat.index],
      crowded,
      ink,
      previous,
    })
    if ((areas[beat.index] === 'none' || kind === 'title') && input.layouts?.[beat.index] !== 'page') {
      // The page has almost nothing on it: you, with the title landing
      // behind you if the beat brings it in.
      const step = input.plan.steps[beat.index]
      const brings = Boolean(step?.actions.some(a => ['reveal', 'trace', 'count', 'connect'].includes(a.op)))
      const wanted = options.find(option => option.family === 'speaker-full' && (option.treatment || '') === (brings ? 'overlay' : ''))
        || { family: 'speaker-full' as StageFamily, ...(brings ? { treatment: 'overlay' as StageTreatment } : {}), score: 1, textPx: 0, why: '' }
      const lead = { ...wanted, score: Math.max(wanted.score, (options[0]?.score ?? 0) + 0.01), why: 'the page has almost nothing on it' }
      options.splice(options.indexOf(wanted), wanted.score ? 1 : 0)
      options.unshift(lead)
    }
    layoutOptions[beat.index] = options
    choices[beat.index] = options[0]
    previous = options[0]?.family
  })
  const storyboard = storyboardFor(input.beats, input.plan, requiredArea, arcRole, { areas, layouts: input.layouts, outro: outro?.entries, crowded, choices }).flatMap(entry => {
    // A floating presenter follows the page: one entry per placement.
    if (!FLOATING_FAMILIES.includes(entry.family as never) || entry.fromEndMs) return [entry]
    const groups: StoryboardEntry[] = []
    entry.beats.forEach(beat => {
      const variant = placementAt(placements[entry.family], offsets[beat] ?? 0)
      const last = groups[groups.length - 1]
      if (last && last.variant === variant) last.beats.push(beat)
      else groups.push({ ...entry, beats: [beat], ...(variant ? { variant } : {}), note: groups.length ? `${entry.note} · moves out of the way` : entry.note })
    })
    return groups
  })
  const cues = cuesFor(storyboard, input.beats, input.plan, outro)
  const directorNotes = notesFor(kind, arcRole, requiredArea, storyboard, legibility)
  const totalSeconds = Math.round(input.plan.steps.reduce((sum, step) => sum + step.motionWindowMs + step.holdMs, 0) / 100) / 10
  const dominant = storyboard.reduce<StoryboardEntry | null>((best, entry) => {
    const seconds = entry.beats.reduce((sum, index) => sum + beatSeconds(input.plan, index), 0)
    const bestSeconds = best ? best.beats.reduce((sum, index) => sum + beatSeconds(input.plan, index), 0) : -1
    return seconds > bestSeconds ? entry : best
  }, null)
  return {
    kind,
    arcRole,
    requiredArea,
    legibility,
    storyboard,
    cues,
    directorNotes,
    placements,
    layoutOptions,
    brief: {
      layout: dominant?.family || FAMILY_FOR_AREA[requiredArea],
      layoutReason: dominant?.why
        ? `${STAGE_LABELS[dominant.family]} — ${dominant.why}`
        : `${kind} · needs ${requiredArea === 'none' ? 'no' : `a ${requiredArea}`} area · smallest text ${legibility.minTextPx[requiredArea === 'none' ? 'slot' : requiredArea]} px at that width`,
      totalSeconds,
      stepCount: input.plan.steps.length,
      cues: input.beats.map(beat => ({ step: beat.index + 1, title: beat.title, text: describeBeat(beat, input.plan) })),
    },
  }
}
