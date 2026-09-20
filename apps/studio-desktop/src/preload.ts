// Minimal typed bridge. Exposes the desktop flag/version info and the
// harness port (runs, events, gate answers) to the studio renderer, plus the
// gate dialog's submit/cancel (used by the dialog window only).
import { contextBridge, ipcRenderer } from 'electron'

export type RunSummary = {
  id: string
  skill: string
  route: string
  adapter: string
  projectDir: string
  status: 'running' | 'gate' | 'waiting' | 'done' | 'error' | 'cancelled'
  resumeId?: string
  startedAt: string
  finishedAt?: string
}

export type HarnessEventPayload = {
  runId: string
  event: {
    type: 'text' | 'tool' | 'file' | 'gate' | 'error' | 'done'
    ts: number
    text?: string
    tool?: string
    file?: string
    gate?: unknown
    error?: string
    exitCode?: number
    // Terminal run status on a done event ('waiting' = parked for a person).
    status?: RunSummary['status']
  }
}

export type AdapterAvailability = {
  id: string
  ok: boolean
  version?: string
  reason?: string
}

const bridge = {
  isDesktop: true as const,
  platform: process.platform,
  versions: {
    electron: process.versions.electron || '',
    chrome: process.versions.chrome || '',
    node: process.versions.node || '',
  },
  harness: {
    list: (): Promise<RunSummary[]> => ipcRenderer.invoke('harness:list'),
    adapters: (): Promise<AdapterAvailability[]> => ipcRenderer.invoke('harness:adapters'),
    run: (options: {
      adapter?: string
      skill: string
      route: string
      projectId?: string
      projectDir?: string
      inputs?: Record<string, unknown>
    }): Promise<RunSummary> => ipcRenderer.invoke('harness:run', options),
    cancel: (id: string): Promise<boolean> => ipcRenderer.invoke('harness:cancel', id),
    answer: (id: string, answers: Record<string, unknown>): Promise<boolean> =>
      ipcRenderer.invoke('harness:answer', id, answers),
    installSkills: (projectDir: string): Promise<unknown> =>
      ipcRenderer.invoke('harness:install-skills', projectDir),
    pages: (runId: string): Promise<{ pages: Array<{ name: string; svg: string; program: unknown | null }>; receipt: unknown | null }> =>
      ipcRenderer.invoke('harness:pages', runId),
    artefacts: (runId: string): Promise<{
      resolved: unknown | null
      receipt: unknown | null
      validation: unknown | null
      brief: string | null
      explainer: { receipt: unknown | null; export: unknown | null; story?: { scenes?: Array<{ id?: string; file?: string }> } | null; assets?: unknown[]; briefs?: Array<{ file: string; entity: string }> } | null
      story: { outline: unknown | null; receipt: unknown | null } | null
    }> => ipcRenderer.invoke('harness:artefacts', runId),
    onEvent: (listener: (payload: HarnessEventPayload) => void) => {
      const wrapped = (_event: unknown, payload: HarnessEventPayload) => listener(payload)
      ipcRenderer.on('harness:event', wrapped)
      return () => ipcRenderer.removeListener('harness:event', wrapped)
    },
  },
  // Used by the gate dialog window's data-URL page.
  gateDialog: {
    submit: (answers: Record<string, unknown>) =>
      ipcRenderer.send('gate-dialog:submit', answers),
    cancel: () => ipcRenderer.send('gate-dialog:cancel'),
  },
}

export type StudioDesktopBridge = typeof bridge

contextBridge.exposeInMainWorld('studioDesktop', bridge)
