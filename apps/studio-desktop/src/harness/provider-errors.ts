// What went wrong with a harness run, in terms a creator can act on.
//
// The provider's own public message is kept verbatim (trimmed); the category
// decides the recovery offered. A known quota or sign-in failure is never
// retried automatically: the creator restores credits, signs in, or switches
// harness or model.
import type { FailureCategory, RunFailure } from './types'

const PATTERNS: Array<[FailureCategory, RegExp]> = [
  // Quota first: a provider's 403 "usage limit" is a quota, not a sign-in.
  ['quota', /usage limit|usage credits|out of (?:usage )?credits|credit balance|quota|insufficient (?:funds|credits|balance)|purchase extra usage|billing/i],
  ['model', /does not support this model|unrecognized[_ ]model|model[_ ]not[_ ]found|invalid model|unknown model|not available (?:for|on) your (?:account|plan)|requires? (?:a )?newer version/i],
  ['auth', /not logged in|\/login|log ?in again|unauthori[sz]ed|authentication|invalid (?:api )?key|expired token|\b401\b|forbidden|\b403\b/i],
  ['rate-limit', /rate[ -]?limit|too many requests|\b429\b|overloaded|\b529\b|try again later/i],
  ['network', /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|socket hang up|fetch failed|timed? ?out/i],
  ['unavailable', /not found — set STUDIO_|binary not found|command not found|spawn \S+ ENOENT|is not available/i],
]

const LABELS: Record<string, string> = { 'claude-code': 'Claude Code', kimi: 'Kimi', codex: 'Codex' }

export const categorise = (message: string): FailureCategory => {
  for (const [category, pattern] of PATTERNS) if (pattern.test(message)) return category
  return 'other'
}

// The actions a creator can take, in order of usefulness.
export const recoveryFor = (category: FailureCategory, harness: string): string[] => {
  const name = LABELS[harness] || harness
  switch (category) {
    case 'quota':
      return [`Retry after restoring ${name} credits`, 'Switch harness or model']
    case 'auth':
      return [`Sign in to ${name}, then retry`, 'Switch harness or model']
    case 'model':
      return ['Choose another model', `Update ${name}`, 'Switch harness']
    case 'rate-limit':
      return ['Retry in a minute', 'Switch harness or model']
    case 'network':
      return ['Check the connection, then retry']
    case 'unavailable':
      return [`Install ${name}, or choose another harness`]
    case 'interrupted':
      return ['Retry']
    default:
      return ['Retry', 'Switch harness or model']
  }
}

export const describeFailure = (input: {
  message: string
  harness: string
  requestedModel?: string
  reportedModel?: string
  category?: FailureCategory
}): RunFailure => {
  const message = input.message.replace(/\s+/g, ' ').trim().slice(0, 600) || 'The run ended without saying why'
  const category = input.category || categorise(message)
  return {
    category,
    message,
    harness: input.harness,
    ...(input.requestedModel ? { requestedModel: input.requestedModel } : {}),
    ...(input.reportedModel ? { reportedModel: input.reportedModel } : {}),
    at: new Date().toISOString(),
    recovery: recoveryFor(category, input.harness),
  }
}
