// The bridge the studio-desktop preload exposes (apps/studio-desktop/src/preload.ts).
// Present only when the studio runs inside the Electron shell.
type StudioDesktopRunSummary = {
  id: string
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: 'running' | 'gate' | 'done' | 'error' | 'cancelled'
  resumeId?: string
  startedAt: string
  finishedAt?: string
}

type StudioDesktopHarnessEvent = {
  runId: string
  event: {
    type: 'text' | 'tool' | 'file' | 'gate' | 'error' | 'done'
    ts: number
    text?: string
    tool?: string
    file?: string
    gate?: { id?: string; stage?: string }
    error?: string
    exitCode?: number
  }
}

type StudioDesktopBridge = {
  isDesktop: true
  platform: string
  versions: { electron: string; chrome: string; node: string }
  harness: {
    list: () => Promise<StudioDesktopRunSummary[]>
    adapters: () => Promise<Array<{ id: string; ok: boolean; version?: string; reason?: string }>>
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
    artefacts: (runId: string) => Promise<{
      resolved: unknown | null
      receipt: unknown | null
      validation: { errors?: unknown[]; warnings?: unknown[]; gateSignal?: unknown } | null
      brief: string | null
    }>
    onEvent: (listener: (payload: StudioDesktopHarnessEvent) => void) => () => void
  }
}

interface Window {
  studioDesktop?: StudioDesktopBridge
}
