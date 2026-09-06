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
  type: 'text' | 'tool' | 'file' | 'gate' | 'error' | 'done'
  ts: number
  text?: string
  tool?: string
  file?: string
  gate?: GateRequest
  error?: string
  exitCode?: number
}

export interface HarnessAdapter {
  id: 'claude-code' | 'codex' | 'kimi'
  available(): Promise<{ ok: boolean; version?: string; reason?: string }>
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
  startedAt: string
  finishedAt?: string
}
