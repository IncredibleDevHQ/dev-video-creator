// How long each kind of harness call may run, sized for the model that runs
// it, and how hard it thinks. One fixed ten-minute ceiling stopped slow
// models part-way (review 5: Kimi K3 thinks for five to eight minutes before
// its first write), so every call names its operation and the model's pace
// scales the base budget. Planning thinks hard; drawing one page from a
// finished spec, or revising, does not need to (the wireframe analysis of the
// same run: every call ran at high effort with no limit on a response).
import type { HarnessSelection } from '../../shared/model'

export type HarnessOperation =
  | 'brief'
  | 'story'
  | 'page'
  | 'revise-story'
  | 'revise-page'
  | 'planning'
  | 'composition'
  | 'chat'
  | 'extension'

export type ThinkingEffort = 'low' | 'medium' | 'high'

export type StageLimits = {
  timeoutMs: number
  idleTimeoutMs: number
  maxToolCalls: number
  effort: ThinkingEffort
  /** The most tokens one model response may hold, thinking included. */
  maxOutputTokens: number
}

const minutes = (value: number) => Math.round(value * 60_000)

/** Budgets for a model of ordinary pace. */
const BASE: Record<HarnessOperation, StageLimits> = {
  brief: {
    timeoutMs: minutes(8),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 80,
    effort: 'high',
    maxOutputTokens: 64_000
  },
  story: {
    timeoutMs: minutes(8),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 80,
    effort: 'high',
    maxOutputTokens: 64_000
  },
  // One page from the engine's spec and a style page. A K3 call at high
  // effort with the old packet took 8½ to 14½ minutes; its 2.5× pace gets 20.
  page: {
    timeoutMs: minutes(8),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 30,
    effort: 'medium',
    maxOutputTokens: 32_000
  },
  'revise-story': {
    timeoutMs: minutes(3),
    idleTimeoutMs: minutes(1.5),
    maxToolCalls: 20,
    effort: 'low',
    maxOutputTokens: 32_000
  },
  'revise-page': {
    timeoutMs: minutes(8),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 30,
    effort: 'medium',
    maxOutputTokens: 32_000
  },
  planning: {
    timeoutMs: minutes(10),
    idleTimeoutMs: minutes(4),
    maxToolCalls: 80,
    effort: 'high',
    maxOutputTokens: 64_000
  },
  // The settled-frame check made composition a loop: build, measure, fix.
  // High effort: it builds what the viewer sees. Asked "medium", K3 (low,
  // high, max) ran every composition at low. Seen live at high: K3 read the
  // recipes, thought 32k tokens (13½ min), built by 18½ min and ran out of
  // its 25 mid-fix. A build and two fixes fit in 40.
  composition: {
    timeoutMs: minutes(16),
    idleTimeoutMs: minutes(3),
    maxToolCalls: 60,
    effort: 'high',
    maxOutputTokens: 48_000
  },
  chat: {
    timeoutMs: minutes(2),
    idleTimeoutMs: 45_000,
    maxToolCalls: 20,
    effort: 'low',
    maxOutputTokens: 16_000
  },
  extension: {
    timeoutMs: minutes(1),
    idleTimeoutMs: 30_000,
    maxToolCalls: 12,
    effort: 'low',
    maxOutputTokens: 8_000
  }
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
    maxToolCalls: base.maxToolCalls,
    effort: base.effort,
    maxOutputTokens: base.maxOutputTokens
  }
}
