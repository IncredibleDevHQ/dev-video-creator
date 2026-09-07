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
  'connect', 'camera', 'morph', 'swap', 'count', 'exit',
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

export type MotionPlanV2 = {
  version: 2
  preset?: 'technical-trace' | 'premium-settle' | 'data-confirm'
  steps: MotionBeat[]
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
    else if (typeof raw === 'string') out[key] = raw.slice(0, 40)
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
  // Camera and connect may run without element targets.
  if (!targets.length && op !== 'camera' && !(op === 'connect' && validPorts)) return null
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
  return {
    version: 2,
    ...(plan.preset === 'technical-trace' || plan.preset === 'premium-settle' || plan.preset === 'data-confirm'
      ? { preset: plan.preset }
      : {}),
    steps,
  }
}

// Ops that bring a unit on screen (their targets start hidden).
export const ENTERING_MOTION_OPS: ReadonlySet<MotionOp> = new Set(['reveal', 'trace', 'count'])

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
