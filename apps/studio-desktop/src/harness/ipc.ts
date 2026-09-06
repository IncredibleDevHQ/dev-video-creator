// Renderer-facing IPC for the harness port (see preload.ts for the typed
// surface). Events are broadcast to the main window as `harness:event`.
import { ipcMain, BrowserWindow } from 'electron'
import type { RunManager } from './run-manager'
import type { HarnessAdapter } from './types'

export const registerHarnessIpc = (
  manager: RunManager,
  adapters: HarnessAdapter[],
  getWindow: () => BrowserWindow | null,
) => {
  manager.onEvent((runId, event) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('harness:event', { runId, event })
  })

  ipcMain.handle('harness:list', () => manager.list())

  ipcMain.handle('harness:adapters', () =>
    Promise.all(
      adapters.map(async adapter => ({
        id: adapter.id,
        ...(await adapter.available().catch(error => ({
          ok: false,
          reason: String(error),
        }))),
      })),
    ),
  )

  ipcMain.handle(
    'harness:run',
    (
      _event,
      options: {
        adapter?: string
        skill: string
        route: string
        projectId?: string
        projectDir?: string
        inputs?: Record<string, unknown>
      },
    ) => {
      const adapter =
        adapters.find(candidate => candidate.id === options.adapter) || adapters[0]
      return manager.start({ ...options, adapter })
    },
  )

  ipcMain.handle('harness:cancel', (_event, id: string) => manager.cancel(id))

  ipcMain.handle(
    'harness:answer',
    (_event, id: string, answers: Record<string, unknown>) => manager.answer(id, answers),
  )
}
