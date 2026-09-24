// Harness port — the adapter interface every coding-agent CLI implements
// (spec §3.1 verbatim). The run manager orchestrates runs on top of it.

export interface HarnessRun {
  id: string
  skill: string
  projectDir: string
  inputs: Record<string, unknown>
  resumeId?: string
}

export type GateRequest = {
  id: string
  stage: 'contract' | 'solution' | 'question'
  fields: Array<string | { name?: string; label?: string; value?: string }>
  recommendation?: unknown
}

export interface HarnessEvent {
  // 'session': the harness started its session and says which model it runs.
  type: 'text' | 'tool' | 'file' | 'gate' | 'error' | 'done' | 'session'
  ts: number
  model?: string
  text?: string
  tool?: string
  file?: string
  gate?: GateRequest
  error?: string
  exitCode?: number
  // The run's terminal status on a done event (e.g. 'waiting': the run parked
  // on a person-facing checkpoint — a normal durable state, not an error).
  status?: RunStatus
}

// The models a harness can run, for the creator to choose from. `default`
// is what the CLI runs when no model is named (null when it cannot be known).
export type HarnessModelOption = { id: string; label: string; unavailable?: string }
export type HarnessModels = { default: string | null; options: HarnessModelOption[]; source: string }

export interface HarnessAdapter {
  id: 'claude-code' | 'codex' | 'kimi'
  available(): Promise<{ ok: boolean; version?: string; reason?: string }>
  models?(): Promise<HarnessModels>
  run(
    run: HarnessRun,
    onEvent: (e: HarnessEvent) => void,
    signal: AbortSignal,
  ): Promise<{ resumeId?: string; exitCode: number }>
}

// Everything an adapter needs beyond the run itself, supplied by the desktop
// main once the worker is up.
export type HarnessContext = {
  // http origin of the in-process studio worker (serves /mcp too).
  origin: string
  // Absolute path of the bundled dist-electron/mcp-stdio.mjs bridge.
  mcpShimPath: string
  // Absolute path of the vendored skills root (apps/studio-desktop/skills).
  skillsDir: string
}

export type RunStatus =
  | 'running'
  | 'gate'
  // The run ended normally on a needs-input checkpoint: it waits for its
  // person (a take to record), durably — never an error.
  | 'waiting'
  | 'done'
  | 'error'
  | 'cancelled'

export type RunSummary = {
  id: string
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: RunStatus
  resumeId?: string
  // The model the run asked for, then the one its harness reported running.
  model?: string
  startedAt: string
  finishedAt?: string
}
