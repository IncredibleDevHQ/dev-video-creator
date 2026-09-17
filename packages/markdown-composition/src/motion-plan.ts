// Motion plan V2 — the resolved tier of the Motion Decision Core (Part I
// §3.2 / §5) as the composition executes it. A plan is a list of beats; each
// beat carries actions with an op, targets (element ids of the page svg),
// timing relative to the beat start, an easing anchor and a persistence
// class. The same document shape is what motion-master writes to
// motion/resolved.json, so an agent-authored plan and a locally planned one
// run through one driver (see motion-driver.ts). V1 steps (title /
// explanation / reveals / verb) are derived from a plan for the step bar,
// captions and narration; they are never the source of truth once a plan
// exists.
import type { SlideStepV1 } from './slide'

export const MOTION_OPS = [
  'reveal', 'trace', 'dim', 'undim', 'emphasize', 'pulse', 'move',
  'connect', 'camera', 'morph', 'swap', 'count', 'exit', 'phase',
  // level: how full a drawn bar, gauge or fill is — value { from, to } as
  // fractions of the shape the page drew, animated along its longer side.
  'level',
  // resize: a thing is deliberately made larger or smaller and stays that
  // way — value { to } as a factor of the size the page drew it at.
  'resize',
] as const
export type MotionOp = (typeof MOTION_OPS)[number]

export const MOTION_EASES = [
  'enter', 'settle', 'travel', 'camera', 'exit', 'pop', 'popOver', 'draw', 'pulse',
] as const
export type MotionEase = (typeof MOTION_EASES)[number]

export const MOTION_INTENTS = [
  'introduce', 'locate', 'relate', 'contrast', 'transform',
  'quantify', 'emphasize', 'flow', 'recap', 'transition',
] as const
export type MotionIntent = (typeof MOTION_INTENTS)[number]

export type MotionRect = { x: number; y: number; width: number; height: number }

export type MotionAction = {
  id?: string
  op: MotionOp
  targets: string[]
  startMs: number
  durationMs: number
  ease: MotionEase
  persistence: 'state' | 'flourish'
  // connect: the two units the synthesized connector joins.
  ports?: { from: string; to: string }
  // camera: the rect to frame (viewBox units); absent = back to the page.
  // move: { dx, dy }. count: { from, to, decimals, suffix }. reveal/trace:
  // { staggerMs }. dim: { to }.
  value?: Record<string, number | string>
  implicit?: boolean
}

export type MotionBeat = {
  id: string
  title: string
  explanation: string
  intent?: MotionIntent
  hero?: string[]
  supporting?: string[]
  actions: MotionAction[]
  motionWindowMs: number
  holdMs: number
}

// The entity registry inside a scene: the typed things on the page, with
// their possible states and the beats whose subject they are. Persistence
// (follow over cut, a state kept at ambient amplitude) reads it.
export type PlanEntity = {
  id: string
  label: string
  type: string
  states?: string[]
  beats: number[]
}

export type MotionPlanV2 = {
  version: 2
  preset?: 'technical-trace' | 'premium-settle' | 'data-confirm'
  steps: MotionBeat[]
  entities?: PlanEntity[]
}

// Cubic-bezier anchors per easing name. `enter`/`settle`/`draw` are the V1
// driver's curves; the rest follow the lottie-derived token table
// (studio motion-tokens.ts) so both planners resolve to the same feel.
export const MOTION_EASE_ANCHORS: Record<MotionEase, [number, number, number, number]> = {
  enter: [0.2, 0.75, 0.34, 0.94],
  settle: [0, 0.65, 0.51, 0.99],
  travel: [1.0, 0.49, 0.0, 0.55],
  camera: [0.65, 0.05, 0.25, 1],
  exit: [1.0, 0.02, 0.54, 0.42],
  pop: [0.94, 0.75, 0.34, 0.94],
  popOver: [0.34, 1.56, 0.64, 1],
  draw: [0.25, 0.6, 0.4, 1],
  pulse: [0.45, 0, 0.55, 1],
}

// Duration tokens (ms) per op — Part I §5 token table, rounded to the 30 fps
// frame grid the lottie ranges use.
export const MOTION_DURATION_MS: Record<MotionOp, number> = {
  reveal: 420,
  trace: 760,
  dim: 320,
  undim: 320,
  emphasize: 520,
  pulse: 720,
  move: 640,
  connect: 640,
  camera: 880,
  morph: 640,
  swap: 520,
  count: 920,
  exit: 360,
  // phase: a living diagram's program switches phase (the fade-in of its clip).
  phase: 400,
  // level: a bar draining or filling reads as a movement, not a jump.
  level: 720,
  // resize: a recomposition, slower than a flourish so the eye follows it.
  resize: 720,
}

export const MOTION_EASE_FOR: Record<MotionOp, MotionEase> = {
  reveal: 'enter',
  trace: 'draw',
  dim: 'settle',
  undim: 'settle',
  emphasize: 'pop',
  pulse: 'pulse',
  move: 'travel',
  connect: 'draw',
  camera: 'camera',
  morph: 'travel',
  swap: 'settle',
  count: 'settle',
  exit: 'exit',
  phase: 'settle',
  level: 'settle',
  resize: 'settle',
}

export const MOTION_STAGGER_MS = 70

const ID_PATTERN = /^[A-Za-z_][\w.:-]*$/

const cleanIds = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.map(id => String(id).trim()).filter(id => ID_PATTERN.test(id)))]
    : []

const cleanNumber = (value: unknown, fallback: number, min = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, number) : fallback
}

const cleanValue = (value: unknown): Record<string, number | string> | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, number | string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw
    // A living diagram's hops travel as one string (connector:from>to;…).
    else if (typeof raw === 'string') out[key] = raw.slice(0, key === 'hops' ? 4000 : 40)
  }
  return Object.keys(out).length ? out : undefined
}

export const sanitizeMotionAction = (raw: unknown): MotionAction | null => {
  if (!raw || typeof raw !== 'object') return null
  const action = raw as Record<string, unknown>
  const op = MOTION_OPS.includes(action.op as MotionOp) ? (action.op as MotionOp) : null
  if (!op) return null
  const targets = cleanIds(action.targets)
  const ports =
    action.ports && typeof action.ports === 'object'
      ? {
          from: String((action.ports as Record<string, unknown>).from || ''),
          to: String((action.ports as Record<string, unknown>).to || ''),
        }
      : undefined
  const validPorts = ports && ID_PATTERN.test(ports.from) && ID_PATTERN.test(ports.to) ? ports : undefined
  // Camera and connect may run without element targets; so may a phase
  // whose program is the page itself (a living title).
  if (!targets.length && op !== 'camera' && op !== 'phase' && !(op === 'connect' && validPorts)) return null
  return {
    ...(typeof action.id === 'string' && ID_PATTERN.test(action.id) ? { id: action.id } : {}),
    op,
    targets,
    startMs: cleanNumber(action.startMs, 0),
    durationMs: cleanNumber(action.durationMs, MOTION_DURATION_MS[op]),
    ease: MOTION_EASES.includes(action.ease as MotionEase) ? (action.ease as MotionEase) : MOTION_EASE_FOR[op],
    persistence: action.persistence === 'flourish' ? 'flourish' : 'state',
    ...(validPorts ? { ports: validPorts } : {}),
    ...(cleanValue(action.value) ? { value: cleanValue(action.value) } : {}),
    ...(action.implicit === true ? { implicit: true } : {}),
  }
}

export const sanitizeMotionPlan = (value: unknown): MotionPlanV2 | null => {
  if (!value || typeof value !== 'object') return null
  const plan = value as Record<string, unknown>
  if (!Array.isArray(plan.steps) || !plan.steps.length) return null
  const steps: MotionBeat[] = []
  plan.steps.slice(0, 24).forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return
    const beat = raw as Record<string, unknown>
    const actions = (Array.isArray(beat.actions) ? beat.actions : [])
      .map(sanitizeMotionAction)
      .filter((action): action is MotionAction => Boolean(action))
    const motionWindowMs = cleanNumber(
      beat.motionWindowMs,
      actions.reduce((max, action) => Math.max(max, action.startMs + action.durationMs), 0),
    )
    steps.push({
      id: typeof beat.id === 'string' && ID_PATTERN.test(beat.id) ? beat.id : `B${String(index + 1).padStart(2, '0')}`,
      title: String(beat.title || '').trim().slice(0, 120),
      explanation: String(beat.explanation || '').trim().slice(0, 1_200),
      ...(MOTION_INTENTS.includes(beat.intent as MotionIntent) ? { intent: beat.intent as MotionIntent } : {}),
      ...(cleanIds(beat.hero).length ? { hero: cleanIds(beat.hero) } : {}),
      ...(cleanIds(beat.supporting).length ? { supporting: cleanIds(beat.supporting) } : {}),
      actions,
      motionWindowMs,
      holdMs: cleanNumber(beat.holdMs, 1_200),
    })
  })
  if (!steps.length) return null
  const entities = (Array.isArray(plan.entities) ? plan.entities : [])
    .map(raw => {
      if (!raw || typeof raw !== 'object') return null
      const entity = raw as Record<string, unknown>
      if (typeof entity.id !== 'string' || !ID_PATTERN.test(entity.id)) return null
      const beats = (Array.isArray(entity.beats) ? entity.beats : []).map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < steps.length)
      const states = (Array.isArray(entity.states) ? entity.states : []).map(String).filter(Boolean).slice(0, 8)
      return { id: entity.id, label: String(entity.label || '').slice(0, 80), type: String(entity.type || 'thing').slice(0, 24), ...(states.length ? { states } : {}), beats } as PlanEntity
    })
    .filter((entity): entity is PlanEntity => Boolean(entity))
    .slice(0, 60)
  return {
    version: 2,
    ...(plan.preset === 'technical-trace' || plan.preset === 'premium-settle' || plan.preset === 'data-confirm'
      ? { preset: plan.preset }
      : {}),
    steps,
    ...(entities.length ? { entities } : {}),
  }
}

/** Where every moved unit sits by the end of a beat: the sum of its `move`
 * actions up to and including that beat, keyed by target id. */
// ——— the stage: where everything stands at a beat ———
// One record per element, folded from the plan the same way the driver folds
// it: where it has been moved to, how big it has been made, whether it is on
// screen, and how full it is. The renderer, the camera and the director all
// read this rather than each measuring the page their own way.
export type StageEntry = { dx: number; dy: number; scale: number; visible: boolean; level: number | null }

const STAGE_REST: StageEntry = { dx: 0, dy: 0, scale: 1, visible: false, level: null }

export const stageStateAt = (plan: MotionPlanV2, beatIndex: number): Map<string, StageEntry> => {
  const stage = new Map<string, StageEntry>()
  const entry = (id: string) => {
    const current = stage.get(id)
    if (current) return current
    const fresh = { ...STAGE_REST }
    stage.set(id, fresh)
    return fresh
  }
  plan.steps.slice(0, beatIndex + 1).forEach(step => {
    step.actions.forEach(action => {
      const value = action.value || {}
      switch (action.op) {
        case 'reveal':
        case 'trace':
        case 'count':
        case 'connect':
          action.targets.forEach(id => { entry(id).visible = true })
          break
        case 'exit':
          action.targets.forEach(id => { entry(id).visible = false })
          break
        case 'move': {
          const dx = Number(value.dx) || 0
          const dy = Number(value.dy) || 0
          if (!dx && !dy) break
          action.targets.forEach(id => {
            const item = entry(id)
            item.dx += dx
            item.dy += dy
          })
          break
        }
        case 'resize':
          // A size is a factor of how the page drew it, so the last one wins.
          action.targets.forEach(id => { entry(id).scale = Number(value.to) || 1 })
          break
        case 'level':
          action.targets.forEach(id => { entry(id).level = Number(value.to) || 0 })
          break
        case 'morph':
        case 'swap': {
          const fromCount = Number(value.fromCount) > 0 ? Number(value.fromCount) : 1
          action.targets.forEach((id, index) => { entry(id).visible = index >= fromCount })
          break
        }
        default:
          break
      }
    })
  })
  return stage
}

/** Where a box the page drew actually sits, once the stage has moved and
 * sized it: scaled about its own centre, then translated. */
export const boxOnStage = (
  box: { x: number; y: number; width: number; height: number },
  at: StageEntry | undefined,
) => {
  if (!at) return box
  const width = box.width * at.scale
  const height = box.height * at.scale
  return {
    x: box.x + at.dx - (width - box.width) / 2,
    y: box.y + at.dy - (height - box.height) / 2,
    width,
    height,
  }
}

export const unitOffsetsAt = (plan: MotionPlanV2, beatIndex: number): Map<string, { dx: number; dy: number }> => {
  const offsets = new Map<string, { dx: number; dy: number }>()
  plan.steps.slice(0, beatIndex + 1).forEach(step => {
    step.actions.forEach(action => {
      if (action.op !== 'move') return
      const dx = Number(action.value?.dx) || 0
      const dy = Number(action.value?.dy) || 0
      if (!dx && !dy) return
      action.targets.forEach(id => {
        const current = offsets.get(id) || { dx: 0, dy: 0 }
        offsets.set(id, { dx: current.dx + dx, dy: current.dy + dy })
      })
    })
  })
  return offsets
}

// Ops that bring a unit on screen (their targets start hidden).
export const ENTERING_MOTION_OPS: ReadonlySet<MotionOp> = new Set(['reveal', 'trace', 'count'])

/** What the camera actually frames at a beat: the last camera action up to
 * and including it, padded, fitted to the page's aspect and clamped the way
 * the driver clamps it (never tighter than a third, never beyond the page).
 * Null means the camera is on the page. The driver, the placements and the
 * director must agree on this, or the presenter is placed against ink that
 * is not on screen. */
export const cameraRectAt = (
  plan: MotionPlanV2,
  beatIndex: number,
  page: { x?: number; y?: number; width: number; height: number },
) => {
  const pageBox = { x: page.x || 0, y: page.y || 0, width: page.width, height: page.height }
  let framed: { x: number; y: number; width: number; height: number } | null = null
  plan.steps.slice(0, beatIndex + 1).forEach(step => {
    step.actions
      .filter(action => action.op === 'camera')
      .forEach(action => {
        const value = action.value || {}
        const width = Number(value.width) || 0
        const height = Number(value.height) || 0
        if (!(width > 0 && height > 0)) {
          framed = null
          return
        }
        const pad = Math.max(width, height) * 0.12
        let x = Number(value.x) - pad
        let y = Number(value.y) - pad
        let w = width + pad * 2
        let h = height + pad * 2
        const aspect = pageBox.width / pageBox.height
        if (w / h < aspect) {
          const next = h * aspect
          x -= (next - w) / 2
          w = next
        } else {
          const next = w / aspect
          y -= (next - h) / 2
          h = next
        }
        const minWidth = pageBox.width / 3
        if (w < minWidth) {
          const cx = x + w / 2
          const cy = y + h / 2
          w = minWidth
          h = minWidth / aspect
          x = cx - w / 2
          y = cy - h / 2
        }
        if (w > pageBox.width) {
          framed = null
          return
        }
        x = Math.max(pageBox.x, Math.min(x, pageBox.x + pageBox.width - w))
        y = Math.max(pageBox.y, Math.min(y, pageBox.y + pageBox.height - h))
        framed = { x, y, width: w, height: h }
      })
  })
  return framed as { x: number; y: number; width: number; height: number } | null
}

/** Beat start offsets (ms) and the plan's total duration. */
export const motionPlanOffsetsMs = (plan: MotionPlanV2) => {
  const offsets: number[] = []
  let at = 0
  for (const beat of plan.steps) {
    offsets.push(at)
    at += beat.motionWindowMs + beat.holdMs
  }
  return { offsets, durationMs: at }
}

export const motionPlanDurationSeconds = (plan: MotionPlanV2) =>
  Math.max(3, motionPlanOffsetsMs(plan).durationMs / 1000)

/** The V1 view of a plan: what each beat brings on screen, and how. */
export const stepsFromMotionPlan = (plan: MotionPlanV2): SlideStepV1[] =>
  plan.steps.map(beat => {
    const entering = beat.actions.filter(action => ENTERING_MOTION_OPS.has(action.op))
    const reveals = [...new Set(entering.flatMap(action => action.targets))]
    const verb: SlideStepV1['verb'] = entering.some(action => action.op === 'trace')
      ? 'trace'
      : entering.length && entering.every(action => action.op === 'count')
        ? 'count'
        : !entering.length && beat.actions.some(action => action.op === 'dim' || action.op === 'emphasize')
          ? 'focus'
          : 'reveal'
    return { title: beat.title, explanation: beat.explanation, reveals, verb }
  })

// Speech pacing shared with V1: ~2.4 words a second plus a lead-in.
export const speechMs = (explanation: string) => {
  const words = explanation.split(/\s+/).filter(Boolean).length
  return Math.round(Math.min(12, Math.max(3, 1.4 + words / 2.4)) * 1000)
}

/**
 * Upgrades V1 steps to a plan so every slide runs on the V2 driver: reveals
 * enter with a stagger (or trace), focus dims what came before for the beat,
 * count counts. Timing follows the token table; the hold is whatever the
 * narration needs beyond the motion window.
 */
export const motionPlanFromSteps = (steps: SlideStepV1[]): MotionPlanV2 | null => {
  if (!steps.length) return null
  const shown: string[] = []
  let dimmed: string[] = []
  const beats: MotionBeat[] = steps.map((step, index) => {
    const actions: MotionAction[] = []
    const ids = step.reveals
    // A focus beat dims what came before for its own duration; the next beat
    // lifts the dim again (state ops, so seeking stays exact).
    if (dimmed.length) {
      actions.push({
        op: 'undim', targets: dimmed, startMs: 0, durationMs: MOTION_DURATION_MS.undim,
        ease: 'settle', persistence: 'state', implicit: true,
      })
      dimmed = []
    }
    if (step.verb === 'focus' && shown.length) {
      dimmed = shown.filter(id => !ids.includes(id))
      if (dimmed.length) {
        actions.push({
          op: 'dim', targets: dimmed, startMs: 0, durationMs: MOTION_DURATION_MS.dim,
          ease: 'settle', persistence: 'state', value: { to: 0.35 },
        })
      }
    }
    if (ids.length) {
      const op: MotionOp = step.verb === 'trace' ? 'trace' : step.verb === 'count' ? 'count' : 'reveal'
      actions.push({
        op, targets: ids, startMs: 0,
        durationMs: MOTION_DURATION_MS[op] + MOTION_STAGGER_MS * Math.max(0, ids.length - 1),
        ease: MOTION_EASE_FOR[op], persistence: 'state', value: { staggerMs: MOTION_STAGGER_MS },
      })
      shown.push(...ids.filter(id => !shown.includes(id)))
    }
    const motionWindowMs = actions.reduce((max, action) => Math.max(max, action.startMs + action.durationMs), 0)
    const speech = speechMs(step.explanation)
    return {
      id: `B${String(index + 1).padStart(2, '0')}`,
      title: step.title,
      explanation: step.explanation,
      ...(ids.length ? { hero: [ids[0]] } : {}),
      actions,
      motionWindowMs,
      holdMs: Math.max(800, speech - motionWindowMs),
    }
  })
  return { version: 2, steps: beats }
}
