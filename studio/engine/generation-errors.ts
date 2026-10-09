import type { RunFailure } from './harness/types'

export class HarnessStageError extends Error {
  constructor(
    readonly failure: RunFailure | undefined,
    fallback: string
  ) {
    super(failure?.message || fallback)
  }
}

/** Drawing stopped on one page: what stopped it, and where. */
export class PageDrawingError extends HarnessStageError {
  constructor(
    failure: RunFailure | undefined,
    readonly page: number,
    readonly saved: number,
    readonly total: number
  ) {
    super(failure, `Wireframe ${page} could not be drawn`)
  }
}

// Product-owned messages only: raw provider/tool errors may contain private data.
export const generationStops = {
  user: 'Stopped. Saved work is kept; Try again continues where it stopped.',
  time: 'The agent ran out of time. Saved work is kept; Try again continues from there.',
  idle: 'The agent stopped responding. Saved work is kept; Try again continues from there.',
  tools:
    'The agent used up its steps. Saved work is kept; Try again continues from there.'
} as const
const stopReasons: Record<string, string> = {
  [generationStops.time]: 'ran out of time',
  [generationStops.idle]: 'stopped responding',
  [generationStops.tools]: 'used up its steps'
}
/** Why a run stopped, as a short phrase after the agent's name, if it was a limit. */
export const stopReason = (message: string | null | undefined) =>
  stopReasons[message || ''] || null
const sharedFailures: Record<string, string> = {
  storage:
    'Generation stopped because artifacts could not be saved. Restore storage access before retrying. Recovery from object storage is not confirmed.',
  quota:
    'Generation stopped because the harness usage limit was reached. Restore credits or choose another harness, then retry. Saved work is retained.',
  auth: 'Generation stopped because harness sign-in is required. Sign in, then retry. Saved work is retained.',
  model:
    'The selected model is unavailable. Choose an available model, then retry. Saved work is retained.',
  'rate-limit':
    'Generation stopped because the harness is rate limited. Wait before retrying. Saved work is retained.',
  network:
    'Generation stopped after a connection failure. Check your connection, then retry. Saved work is retained.',
  unavailable:
    'The selected harness is unavailable. Check its installation or choose another harness. Saved work is retained.'
}
export const stopsPreparationBatch = (message: string | null | undefined) =>
  Object.values(sharedFailures).includes(message || '')
export const generationFailure = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : ''
  const stop = Object.values(generationStops).find((known) => known === message)
  if (stop) return stop
  if (error instanceof HarnessStageError) {
    return sharedFailures[error.failure?.category || ''] || fallback
  }
  return fallback
}
