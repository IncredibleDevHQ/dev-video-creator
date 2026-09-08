// The deterministic director (Motion Core Part V, first iteration). Reads a
// scene's page (its units), its script beats and its motion plan, and
// decides how the scene is staged around that motion: what kind of block it
// is, its role in the arc, how much of the frame the information needs
// (measured against the 18 px legibility gate), which stage family carries
// each beat, and the coach cues that follow. Pure functions; the studio
// writes the result onto the scene node, the agent path can replace it.
import type { MotionPlanV2, StageVariant } from 'markdown-composition'
import { FLOATING_FAMILIES, placementAt, placementsFor, type PlacementTrack } from './placements'
import { leafUnits, type SlideUnit } from './slide-atoms'
import { NUMERIC_LABEL, type ScriptBeat, type WindowLayout } from './script-plan'

export type SceneKind = 'title' | 'text' | 'list' | 'diagram' | 'figure' | 'numbers' | 'table'
export type ArcRole = 'hook' | 'map' | 'build' | 'idea' | 'explain' | 'evidence' | 'close'
export type RequiredArea = 'none' | 'slot' | 'beside' | 'frame' | 'takeover'
export type StageFamily = 'speaker-full' | 'speaker-panel' | 'split' | 'content-card' | 'content-pip' | 'content-tile' | 'content-cutout'
export type StageTreatment = '' | 'overlay' | 'glow-bed-hero'

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
  perBeat: { areas?: RequiredArea[]; layouts?: Array<WindowLayout | undefined>; outro?: StoryboardEntry[] } = {},
): StoryboardEntry[] => {
  const raw: StoryboardEntry[] = beats.map(beat => {
    const step = plan.steps[beat.index]
    const beatArea = perBeat.areas?.[beat.index] ?? requiredArea
    const directed: WindowLayout | undefined = beat.directions.some(d => d.kind === 'open')
      ? 'me'
      : beat.directions.some(d => d.kind === 'panel')
        ? 'beside'
        : beat.directions.some(d => d.kind === 'takeover')
          ? 'page'
          : undefined
    const wish = perBeat.layouts?.[beat.index] || directed
    const contentFamily: StageFamily =
      wish === 'beside' ? 'speaker-panel' : wish === 'page' ? FAMILY_FOR_AREA[beatArea === 'none' ? 'takeover' : beatArea] : FAMILY_FOR_AREA[beatArea]
    const contentTreatment: StageTreatment = beatArea === 'slot' && contentFamily === 'speaker-full' ? 'overlay' : ''
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
      }
    }
    if (beatArea === 'none' && wish !== 'page') {
      return {
        label: beat.title,
        family: 'speaker-full',
        treatment: brings ? 'overlay' : '',
        note: brings ? `The title lands behind you on “${firstWords(beat.text, 4)}”` : `You, full frame · “${firstWords(beat.text)}”`,
        beats: [beat.index],
      }
    }
    return {
      label: beat.title,
      family: contentFamily,
      treatment: contentTreatment,
      note: `${describeBeat(beat, plan)} · “${firstWords(beat.text, 4)}”`,
      beats: [beat.index],
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
  return [opening, areaLine, closing, role].filter(Boolean).join(' ')
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
  const offsets: number[] = []
  let at = 0
  input.plan.steps.forEach(step => { offsets.push(at); at += step.motionWindowMs + step.holdMs })
  const storyboard = storyboardFor(input.beats, input.plan, requiredArea, arcRole, { areas, layouts: input.layouts, outro: outro?.entries }).flatMap(entry => {
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
    brief: {
      layout: dominant?.family || FAMILY_FOR_AREA[requiredArea],
      layoutReason: `${kind} · needs ${requiredArea === 'none' ? 'no' : `a ${requiredArea}`} area · smallest text ${legibility.minTextPx[requiredArea === 'none' ? 'slot' : requiredArea]} px at that width`,
      totalSeconds,
      stepCount: input.plan.steps.length,
      cues: input.beats.map(beat => ({ step: beat.index + 1, title: beat.title, text: describeBeat(beat, input.plan) })),
    },
  }
}
