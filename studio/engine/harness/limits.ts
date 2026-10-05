// How long each kind of harness call may run, sized for the model that runs
// it. One fixed ten-minute ceiling stopped slow models part-way (review 5:
// Kimi K3 thinks for five to eight minutes before its first write), so every
// call names its operation and the model's pace scales the base budget.
import type { HarnessSelection } from '../../shared/model'

export type HarnessOperation =
  | 'brief'
  | 'story'
  | 'design'
  | 'page'
  | 'revise-story'
  | 'revise-page'
  | 'planning'
  | 'composition'
  | 'chat'
  | 'extension'

export type StageLimits = {
  timeoutMs: number
  idleTimeoutMs: number
  maxToolCalls: number
}

const minutes = (value: number) => Math.round(value * 60_000)

/** Budgets for a model of ordinary pace. */
const BASE: Record<HarnessOperation, StageLimits> = {
  brief: { timeoutMs: minutes(8), idleTimeoutMs: minutes(3), maxToolCalls: 80 },
  story: { timeoutMs: minutes(8), idleTimeoutMs: minutes(3), maxToolCalls: 80 },
  // The deck's design system and its first page, in one call.
  design: {
    timeoutMs: minutes(12),
    idleTimeoutMs: minutes(4),
    maxToolCalls: 60
  },
  // One more page against the authored design system. A live K3 run took
  // 8½ to 14½ minutes a page, so its 2.5× pace gets 20.
  page: { timeoutMs: minutes(8), idleTimeoutMs: minutes(3), maxToolCalls: 40 },
  'revise-story': {
    timeoutMs: minutes(3),
    idleTimeoutMs: minutes(1.5),
    maxToolCalls: 20
  },
  'revise-page': {
    timeoutMs: minutes(8),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 40
  },
  planning: {
    timeoutMs: minutes(10),
    idleTimeoutMs: minutes(4),
    maxToolCalls: 80
  },
  composition: {
    timeoutMs: minutes(5),
    idleTimeoutMs: minutes(2),
    maxToolCalls: 30
  },
  chat: { timeoutMs: minutes(2), idleTimeoutMs: 45_000, maxToolCalls: 20 },
  extension: { timeoutMs: minutes(1), idleTimeoutMs: 30_000, maxToolCalls: 12 }
}

/**
 * How much longer than the base a model takes, from measured runs. The
 * first match wins; models not listed run at the base pace.
 */
const PACE: Array<[RegExp, number]> = [
  // Review 5: K3 re-reads the skill and thinks 5–8 min before writing.
  [/^kimi:(?:kimi-code\/)?k3/i, 2.5],
  [/^kimi:/i, 1.5],
  [/^codex:/i, 1.25],
  [/^claude-code:.*opus/i, 1.25],
  [/^claude-code:/i, 1]
]

/** No single call may run longer than this, whatever its pace. */
export const LIMIT_CEILING_MS = minutes(45)

export const modelPace = (selection?: Partial<HarnessSelection> | null) => {
  const key = `${selection?.adapter || ''}:${selection?.model || ''}`
  return PACE.find(([pattern]) => pattern.test(key))?.[1] ?? 1
}

export const stageLimits = (
  operation: HarnessOperation,
  selection?: Partial<HarnessSelection> | null
): StageLimits => {
  const base = BASE[operation]
  const pace = modelPace(selection)
  return {
    timeoutMs: Math.min(Math.round(base.timeoutMs * pace), LIMIT_CEILING_MS),
    idleTimeoutMs: Math.min(
      Math.round(base.idleTimeoutMs * pace),
      LIMIT_CEILING_MS
    ),
    maxToolCalls: base.maxToolCalls
  }
}
