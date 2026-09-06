// Deterministic motion rules (motion-master references/tokens.md §5, core.md
// §2.2, levels.md L1–L10). Iteration 1 covers reveal / trace / dim / undim /
// emphasize / pulse (spec §4); the planner model supplies meaning only —
// every number below is a token.
export type GeometryUnit = {
  id: string
  kind: string
  label?: string
  role?: string
  bbox: { x: number; y: number; w: number; h: number }
  ids?: string[]
  from?: { x: number; y: number }
  to?: { x: number; y: number }
}

export type Geometry = {
  viewBox: { x: number; y: number; w: number; h: number }
  readingMode?: string
  units: GeometryUnit[]
  edges?: Array<{ connector: string; from: string | null; to: string | null }>
}

export type BriefStep = {
  id?: string
  title?: string
  explanation?: string
  intent?: string
  hero?: string[]
  supporting?: string[]
  reveals?: string[]
  verb?: 'reveal' | 'trace' | 'focus'
  actions?: Array<Record<string, unknown> & { op: string }>
}

export type ResolvedAction = {
  id: string
  op: string
  targets: string[]
  startMs: number
  durationMs: number
  ease: string
  pivot?: { x: number; y: number }
  ports?: { from?: string; to?: string }
  path?: string
  value?: Record<string, unknown>
  persistence: 'state' | 'flourish'
  implicit: boolean
}

export type ResolvedStep = {
  id: string
  title: string
  explanation: string
  hero: string[]
  supporting: string[]
  intent?: string
  actions: ResolvedAction[]
  motionWindowMs: number
  holdMs: number
}

// ——— Tokens (references/tokens.md §5; technical-trace preset column) ———
const EASE = {
  enter: 'enter',
  settle: 'settle',
  draw: 'draw',
  exit: 'exit',
  pop: 'pop',
  pulse: 'pulse',
} as const
const DUR = {
  small: 220,
  medium: 320,
  large: 550,
  dim: 300,
  release: 300,
  pulse: 500,
} as const
const CHAIN_AT = 0.7
const STAGGER_UNIT = 70 // technical-trace column
const HOLD_MIN = 600
const HOLD_LAST = 1500
const DIM = { shape: 0.35, text: 0.45 }
const EMPH = { scaleHeld: 1.08, scalePulse: 1.04 }
const DRAW_SPEED_PW_PER_S = 0.75
const BUDGET = { beat: 1600, attentional: 600, newUnits: 5, pulses: 2, motionTypes: 3 }

const PERSISTENCE: Record<string, 'state' | 'flourish'> = {
  reveal: 'state',
  trace: 'state',
  dim: 'state',
  undim: 'state',
  emphasize: 'state', // state with auto-release
  pulse: 'flourish',
}

const sizeClassDuration = (unit: GeometryUnit | undefined) => {
  if (!unit) return DUR.medium
  if (unit.kind === 'label') return DUR.small
  if (unit.kind === 'group' || unit.kind === 'frame') return DUR.large
  return DUR.medium
}

const centerOf = (unit: GeometryUnit | undefined) =>
  unit ? { x: unit.bbox.x + unit.bbox.w / 2, y: unit.bbox.y + unit.bbox.h / 2 } : undefined

export class MotionRules {
  private unitById = new Map<string, GeometryUnit>()
  private unitByElement = new Map<string, GeometryUnit>()
  private pageWidth: number

  constructor(private geometry: Geometry) {
    for (const unit of geometry.units) {
      this.unitById.set(unit.id, unit)
      for (const elementId of unit.ids || []) this.unitByElement.set(elementId, unit)
    }
    this.pageWidth = geometry.viewBox?.w || 1280
  }

  unit(id: string) {
    return this.unitById.get(id)
  }

  // Element ids (V1 reveals) resolve to the smallest unit containing them.
  resolveTargets(ids: string[]): string[] {
    const seen = new Set<string>()
    for (const id of ids) {
      const unit = this.unitById.get(id) || this.unitByElement.get(id)
      if (unit) seen.add(unit.id)
    }
    return [...seen]
  }

  private traceDuration(unit: GeometryUnit | undefined) {
    let length = this.pageWidth * 0.2
    if (unit?.from && unit?.to) {
      length = Math.hypot(unit.to.x - unit.from.x, unit.to.y - unit.from.y) * 1.2
    }
    const ms = length / this.pageWidth / DRAW_SPEED_PW_PER_S * 1000
    return Math.round(Math.min(1200, Math.max(300, ms)))
  }

  // Expands a V1 step (verb + reveals) into V2 actions (data-model §3.1).
  expandStep(step: BriefStep): Array<Record<string, unknown> & { op: string }> {
    if (step.actions?.length) return step.actions
    const targets = this.resolveTargets(step.reveals || [])
    if (step.verb === 'trace') {
      const connectors = targets.filter(id => this.unit(id)?.kind === 'connector')
      const rest = targets.filter(id => this.unit(id)?.kind !== 'connector')
      return [
        ...(connectors.length ? [{ op: 'trace', targets: connectors }] : []),
        ...(rest.length ? [{ op: 'reveal', targets: rest }] : []),
      ]
    }
    if (step.verb === 'focus') {
      return [
        { op: 'dim', targets: 'others' },
        { op: 'reveal', targets },
      ]
    }
    return [{ op: 'reveal', targets }]
  }

  // Resolves one step's actions to absolute times (chain.at sequencing,
  // stagger per target). `entered` tracks units visible before this step.
  resolveStep(
    step: BriefStep,
    index: number,
    entered: Set<string>,
    isLast: boolean,
  ): ResolvedStep {
    const hero = this.resolveTargets(step.hero || [])
    const supporting = this.resolveTargets(step.supporting || [])
    const rawActions = this.expandStep(step)
    const actions: ResolvedAction[] = []
    let cursor = 0
    let actionNumber = 0
    for (const raw of rawActions) {
      actionNumber += 1
      const op = String(raw.op)
      const id = String(raw.id || `a${index + 1}-${actionNumber}`)
      const explicitTargets = Array.isArray(raw.targets)
        ? this.resolveTargets(raw.targets as string[])
        : null
      let targets: string[]
      let durationMs: number = DUR.medium
      let ease: string = EASE.enter
      let pivot: ResolvedAction['pivot']
      let ports: ResolvedAction['ports']
      let value: Record<string, unknown> | undefined

      if (op === 'reveal') {
        targets = explicitTargets || hero
        // Duration by the largest size class in the target set; targets
        // stagger by stagger.unit.
        durationMs = targets.reduce<number>(
          (max, target) => Math.max(max, sizeClassDuration(this.unit(target))),
          DUR.small,
        )
        ease = EASE.settle
        value = { enterFrom: 'auto', lines: 'auto' }
      } else if (op === 'trace') {
        targets = explicitTargets || []
        durationMs = targets.reduce<number>(
          (max, target) => Math.max(max, this.traceDuration(this.unit(target))),
          DUR.small,
        )
        ease = EASE.draw
        const edge = (this.geometry.edges || []).find(
          candidate => candidate.connector === targets[0],
        )
        if (edge) ports = { from: edge.from || undefined, to: edge.to || undefined }
      } else if (op === 'dim') {
        // "others" = entered units − hero − supporting − chrome/anchors.
        targets =
          explicitTargets ||
          [...entered].filter(target => {
            if (hero.includes(target) || supporting.includes(target)) return false
            const role = this.unit(target)?.role
            return role !== 'chrome' && role !== 'anchor'
          })
        durationMs = DUR.dim
        ease = EASE.exit
        value = { level: DIM.shape }
      } else if (op === 'undim') {
        targets = explicitTargets || [...entered]
        durationMs = DUR.dim
        ease = EASE.settle
      } else if (op === 'emphasize') {
        targets = explicitTargets || hero
        durationMs = DUR.medium
        ease = EASE.pop
        pivot = centerOf(this.unit(targets[0]))
        const factor = Math.min(
          EMPH.scaleHeld,
          Number((raw.value as Record<string, unknown> | undefined)?.factor) || EMPH.scalePulse,
        )
        value = { factor }
      } else if (op === 'pulse') {
        targets = explicitTargets || hero
        durationMs = DUR.pulse
        ease = EASE.pulse
        pivot = centerOf(this.unit(targets[0]))
        value = { repeats: 1 }
      } else {
        // Ops beyond iteration 1 pass through unresolved-but-timed so the
        // validator can still reason about the step.
        targets = explicitTargets || hero
        durationMs = DUR.medium
        ease = EASE.settle
      }

      const stagger =
        op === 'reveal' && targets.length > 1
          ? Math.min(500, STAGGER_UNIT * (targets.length - 1))
          : 0
      actions.push({
        id,
        op,
        targets,
        startMs: Math.round(cursor),
        durationMs: Math.round(durationMs),
        ease,
        ...(pivot ? { pivot } : {}),
        ...(ports ? { ports } : {}),
        ...(value ? { value } : {}),
        persistence: PERSISTENCE[op] || 'state',
        implicit: false,
      })
      // Chain: the next action starts when this one reaches chain.at of its
      // window (including the stagger span).
      cursor += (durationMs + stagger) * CHAIN_AT
      if (op === 'reveal') targets.forEach(target => entered.add(target))
    }
    const last = actions[actions.length - 1]
    const motionWindowMs = last ? Math.round(last.startMs + last.durationMs) : 0
    return {
      id: String(step.id || `st-${index + 1}`),
      title: String(step.title || `Step ${index + 1}`),
      explanation: String(step.explanation || ''),
      hero,
      supporting,
      intent: step.intent,
      actions,
      motionWindowMs,
      holdMs: isLast ? HOLD_LAST : HOLD_MIN,
    }
  }

  resolve(brief: { steps: BriefStep[] }): ResolvedStep[] {
    const entered = new Set<string>()
    return brief.steps.map((step, index) =>
      this.resolveStep(step, index, entered, index === brief.steps.length - 1),
    )
  }
}

// ——— Validator (levels.md L10; classes available for the resolved ops) ———
export type ValidateIssue = {
  class: string
  step?: string
  action?: string
  message: string
}

export type ValidateReport = {
  errors: ValidateIssue[]
  warnings: ValidateIssue[]
  gateSignal: { category: string; count: number; meaning: string } | null
}

export const validateResolved = (
  resolved: { steps: ResolvedStep[] },
  rules: MotionRules,
  options: { quick?: boolean } = {},
): ValidateReport => {
  const errors: ValidateIssue[] = []
  const warnings: ValidateIssue[] = []
  const entered = new Set<string>()
  for (const step of resolved.steps) {
    const stepNewUnits = new Set<string>()
    let pulses = 0
    const opsSeen = new Set<string>()
    for (const action of step.actions) {
      opsSeen.add(action.op)
      // Error: missing target.
      for (const target of action.targets) {
        if (!rules.unit(target)) {
          errors.push({
            class: 'missing-target',
            step: step.id,
            action: action.id,
            message: `target "${target}" is not a geometry unit`,
          })
        }
      }
      // Error: duty on a never-entered unit (attention ops act on visible units).
      if (action.op === 'emphasize' || action.op === 'pulse' || action.op === 'dim') {
        for (const target of action.targets) {
          if (rules.unit(target) && !entered.has(target)) {
            errors.push({
              class: 'duty-on-unentered',
              step: step.id,
              action: action.id,
              message: `${action.op} on "${target}", which has not entered`,
            })
          }
        }
      }
      // Error: dim on chrome.
      if (action.op === 'dim') {
        for (const target of action.targets) {
          const role = rules.unit(target)?.role
          if (role === 'chrome' || role === 'anchor') {
            errors.push({
              class: 'dim-on-chrome',
              step: step.id,
              action: action.id,
              message: `dim targets ${role} unit "${target}"`,
            })
          }
        }
      }
      if (action.op === 'reveal') {
        action.targets.forEach(target => stepNewUnits.add(target))
        action.targets.forEach(target => entered.add(target))
      }
      if (action.op === 'pulse') pulses += 1
    }
    // Warnings: budgets.
    if (step.motionWindowMs > BUDGET.beat) {
      warnings.push({
        class: 'budget-beat',
        step: step.id,
        message: `motion window ${step.motionWindowMs} ms exceeds budget.beat ${BUDGET.beat} ms`,
      })
    }
    const attentionalOnly = [...opsSeen].every(op =>
      ['dim', 'undim', 'emphasize', 'pulse'].includes(op),
    )
    if (attentionalOnly && step.motionWindowMs > BUDGET.attentional) {
      warnings.push({
        class: 'budget-attentional',
        step: step.id,
        message: `attentional beat runs ${step.motionWindowMs} ms (budget ${BUDGET.attentional} ms)`,
      })
    }
    if (stepNewUnits.size > BUDGET.newUnits) {
      warnings.push({
        class: 'budget-new-units',
        step: step.id,
        message: `${stepNewUnits.size} new units in one beat (budget ${BUDGET.newUnits})`,
      })
    }
    if (pulses > BUDGET.pulses) {
      warnings.push({
        class: 'budget-pulses',
        step: step.id,
        message: `${pulses} pulses in one beat (budget ${BUDGET.pulses})`,
      })
    }
    if (opsSeen.size > BUDGET.motionTypes) {
      warnings.push({
        class: 'budget-motion-types',
        step: step.id,
        message: `${opsSeen.size} op kinds in one beat (budget ${BUDGET.motionTypes})`,
      })
    }
  }
  // Gate signal (plan-motion cadence): two issues sharing a category are a
  // method fault → fix the rule or the lock before continuing.
  const byClass = new Map<string, number>()
  for (const issue of [...errors, ...warnings]) {
    byClass.set(issue.class, (byClass.get(issue.class) || 0) + 1)
  }
  let gateSignal: ValidateReport['gateSignal'] = null
  for (const [category, count] of byClass) {
    if (count >= 2) {
      gateSignal = { category, count, meaning: 'method fault — fix the rule or the lock' }
      break
    }
  }
  return { errors, warnings, gateSignal }
}

// ——— Receipt (scripts/README.md contract) ———
const PRIMITIVES: Record<string, string[]> = {
  reveal: ['alpha', 'xform'],
  trace: ['dash'],
  dim: ['alpha'],
  undim: ['alpha'],
  emphasize: ['xform'],
  pulse: ['xform'],
}

export const buildReceipt = (
  brief: { steps: BriefStep[] },
  resolved: { steps: ResolvedStep[] },
) => ({
  version: 1,
  beats: resolved.steps.map((step, index) => {
    const planned = brief.steps[index] || {}
    const ops = step.actions.map(action => action.op)
    const primitives = [...new Set(step.actions.flatMap(action => PRIMITIVES[action.op] || []))]
    const absences: string[] = []
    if (
      (planned.intent === 'relate' || planned.intent === 'flow') &&
      !ops.includes('trace') &&
      !ops.includes('connect')
    ) {
      absences.push('relate beat fired no trace')
    }
    if (planned.intent === 'quantify' && !ops.includes('count')) {
      absences.push('quantify beat fired no count')
    }
    return {
      step: step.id,
      title: step.title,
      hero: step.hero,
      ops,
      primitives,
      dwell: step.holdMs,
      budget: { windowMs: step.motionWindowMs, beatMs: BUDGET.beat, ok: step.motionWindowMs <= BUDGET.beat },
      clock: 'formula',
      absences,
    }
  }),
})
