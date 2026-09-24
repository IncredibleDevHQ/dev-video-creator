// The bridge the studio-desktop preload exposes (apps/studio-desktop/src/preload.ts).
// Present only when the studio runs inside the Electron shell.
type StudioDesktopRunSummary = {
  id: string
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: 'running' | 'gate' | 'waiting' | 'done' | 'error' | 'cancelled'
  resumeId?: string
  // The model asked for, then the one the harness reported running.
  model?: string
  startedAt: string
  finishedAt?: string
}

// The models a harness can run; `default` is what its CLI runs unnamed.
type StudioDesktopHarnessModels = {
  default: string | null
  options: Array<{ id: string; label: string; unavailable?: string }>
  source: string
}

type StudioDesktopHarnessEvent = {
  runId: string
  event: {
    type: 'text' | 'tool' | 'file' | 'gate' | 'error' | 'done' | 'session'
    ts: number
    // On a session event: the model the harness says it runs.
    model?: string
    text?: string
    tool?: string
    file?: string
    gate?: { id?: string; stage?: string }
    error?: string
    exitCode?: number
    // Terminal run status on a done event ('waiting' = parked for a person).
    status?: StudioDesktopRunSummary['status']
  }
}

type StudioDesktopBridge = {
  isDesktop: true
  platform: string
  versions: { electron: string; chrome: string; node: string }
  harness: {
    list: () => Promise<StudioDesktopRunSummary[]>
    adapters: () => Promise<Array<{ id: string; ok: boolean; version?: string; reason?: string; models?: StudioDesktopHarnessModels }>>
    run: (options: {
      adapter?: string
      skill: string
      route: string
      projectId?: string
      projectDir?: string
      inputs?: Record<string, unknown>
    }) => Promise<StudioDesktopRunSummary>
    cancel: (id: string) => Promise<boolean>
    answer: (id: string, answers: Record<string, unknown>) => Promise<boolean>
    installSkills: (projectDir: string) => Promise<unknown>
    pages: (runId: string) => Promise<{ pages: Array<{ name: string; svg: string; program: unknown | null }>; receipt: unknown | null }>
    artefacts: (runId: string) => Promise<{
      resolved: unknown | null
      receipt: unknown | null
      validation: { errors?: unknown[]; warnings?: unknown[]; gateSignal?: unknown } | null
      brief: string | null
      explainer: { receipt: unknown | null; export: unknown | null; story?: { scenes?: Array<{ id?: string; file?: string }> } | null; assets?: unknown[]; briefs?: Array<{ file: string; entity: string }> } | null
      story: { outline: unknown | null; receipt: unknown | null } | null
      // A planning run's packet and what it wrote (M0).
      planning?: { packet: Record<string, string>; planning: Record<string, string> } | null
    }>
    onEvent: (listener: (payload: StudioDesktopHarnessEvent) => void) => () => void
  }
}

interface Window {
  studioDesktop?: StudioDesktopBridge
}
