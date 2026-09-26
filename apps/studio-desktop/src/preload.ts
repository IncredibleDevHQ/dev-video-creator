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
  // The models the harness can run; `default` is what the CLI runs unnamed.
  models?: { default: string | null; options: Array<{ id: string; label: string; unavailable?: string }>; source: string }
}

const bridge = {
  isDesktop: true as const,
  platform: process.platform,
  // The studio's own download (F01 of the fix verification): the desktop
  // saves the file; the window is never navigated to it.
  download: (url: string, filename: string): Promise<{ state: 'completed' | 'cancelled' | 'interrupted'; path?: string }> =>
    ipcRenderer.invoke('studio:download', url, filename),
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

// The studio's web storage outlives the port (F03 of the fix verification).
// The worker takes a new port at every start and web storage belongs to an
// origin, so the open notebook, its scene and inspector, and any unsaved
// draft would read as gone after a restart. The desktop keeps the app's own
// copy in its data folder: handed back before the page's first script runs
// (once per app start — a reload keeps what the page wrote since), and
// kept again whenever it changes and as the page goes.
const STORAGE_SESSION = 'studio.desktop.storage-session'
const mirrorWebStorage = () => {
  // The gate dialog's data: page has no storage of its own.
  if (location.protocol !== 'http:') return
  let seed: { session: string; entries: Record<string, string> | null } | null = null
  try {
    seed = ipcRenderer.sendSync('studio:web-storage:load')
  } catch {
    return
  }
  if (!seed) return
  try {
    if (localStorage.getItem(STORAGE_SESSION) !== seed.session) {
      if (seed.entries) {
        localStorage.clear()
        for (const [key, value] of Object.entries(seed.entries)) localStorage.setItem(key, value)
      }
      localStorage.setItem(STORAGE_SESSION, seed.session)
    }
  } catch {
    return
  }
  let kept = ''
  const snapshot = () => {
    const entries: Record<string, string> = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key === null || key === STORAGE_SESSION) continue
      entries[key] = localStorage.getItem(key) ?? ''
    }
    return JSON.stringify({ entries, path: location.pathname })
  }
  const keep = (now: boolean) => {
    let payload = ''
    try {
      payload = snapshot()
    } catch {
      return
    }
    if (payload === kept) return
    kept = payload
    if (now) ipcRenderer.sendSync('studio:web-storage:flush', payload)
    else ipcRenderer.send('studio:web-storage:save', payload)
  }
  setInterval(() => keep(false), 1500)
  addEventListener('pagehide', () => keep(true))
}
mirrorWebStorage()
