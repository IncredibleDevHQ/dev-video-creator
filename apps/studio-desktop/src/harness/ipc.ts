// Renderer-facing IPC for the harness port (see preload.ts for the typed
// surface). Events are broadcast to the main window as `harness:event`.
import { ipcMain, BrowserWindow } from 'electron'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
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

  ipcMain.handle('harness:list', () => manager.history())

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
      const adapter = options.adapter ? adapters.find(candidate => candidate.id === options.adapter) : adapters[0]
      if (!adapter) throw new Error(`The requested local harness ${options.adapter} is not available`)
      return manager.start({ ...options, adapter })
    },
  )

  ipcMain.handle('harness:cancel', (_event, id: string) => manager.cancel(id))

  ipcMain.handle(
    'harness:answer',
    (_event, id: string, answers: Record<string, unknown>) => manager.answer(id, answers),
  )

  // On-demand skill install into a project directory (spec §5).
  ipcMain.handle('harness:install-skills', (_event, projectDir: string) =>
    manager.installInto(projectDir),
  )

  // The pages a page-master run drew: every pages/*.svg with its receipt.
  ipcMain.handle('harness:pages', async (_event, runId: string) => {
    const run = (await manager.history()).find(candidate => candidate.id === runId)
    if (!run) return { pages: [], receipt: null }
    const pagesDir = join(run.projectDir, 'pages')
    const names = await readdir(pagesDir).catch(() => [] as string[])
    const pages: Array<{ name: string; svg: string; program: unknown | null }> = []
    for (const name of names.filter(entry => entry.toLowerCase().endsWith('.svg')).sort()) {
      const svg = await readFile(join(pagesDir, name), 'utf8').catch(() => '')
      if (!svg.trim()) continue
      // The page and the story it can tell are drawn together, so they
      // arrive together: NN_slug.svg beside NN_slug.program.json.
      const program = await readFile(join(pagesDir, name.replace(/\.svg$/i, '.program.json')), 'utf8')
        .then(text => JSON.parse(text) as unknown)
        .catch(() => null)
      pages.push({ name, svg, program })
    }
    const receipt = await readFile(join(pagesDir, 'receipt.json'), 'utf8').then(text => JSON.parse(text) as unknown).catch(() => null)
    return { pages, receipt }
  })

  // Read a finished run's artefacts from its projectDir (nulls for missing).
  ipcMain.handle('harness:artefacts', async (_event, runId: string) => {
    const run = (await manager.history()).find(candidate => candidate.id === runId)
    if (!run) return { resolved: null, receipt: null, validation: null, brief: null, explainer: null }
    const motionDir = join(run.projectDir, 'motion')
    const readJson = async (dir: string, name: string) => {
      try {
        return JSON.parse(await readFile(join(dir, name), 'utf8')) as unknown
      } catch {
        return null
      }
    }
    const brief = await readFile(join(motionDir, 'brief.md'), 'utf8').catch(() => null)
    const validation =
      (await readJson(motionDir, 'validate.final.json')) || (await readJson(motionDir, 'validate.early.json'))
    // Explainer runs keep their finish/export receipts beside the scenes.
    const explainerDir = join(run.projectDir, 'explainer')
    const explainerReceipt = await readJson(explainerDir, 'receipt.json')
    const explainerExport = await readJson(explainerDir, 'export.json')
    // The cast so far (D4's Objects panel): briefs written and assets
    // accepted or reused, read from the run directory.
    const assetsDir = join(explainerDir, 'assets')
    const assetFiles = await readdir(assetsDir).catch(() => [] as string[])
    const castAssets = []
    for (const name of assetFiles.filter(entry => entry.endsWith('.json'))) {
      const record = await readJson(assetsDir, name)
      if (record && typeof record === 'object' && 'key' in (record as Record<string, unknown>)) castAssets.push(record)
    }
    const briefFiles = (await readdir(explainerDir).catch(() => [] as string[])).filter(entry => /^brief-.*\.json$/.test(entry))
    const briefs = []
    for (const name of briefFiles) {
      const brief = await readJson(explainerDir, name)
      briefs.push({ file: name, entity: (brief as { entity?: string } | null)?.entity || name.replace(/^brief-|\.json$/g, '') })
    }
    // Story runs keep the outline and its receipt beside the story.
    const storyDir = join(run.projectDir, 'story')
    const storyOutline = await readJson(storyDir, 'outline.json')
    const storyReceipt = await readJson(storyDir, 'receipt.json')
    return {
      resolved: await readJson(motionDir, 'resolved.json'),
      receipt: await readJson(motionDir, 'receipt.json'),
      validation,
      brief,
      explainer: explainerReceipt || explainerExport || castAssets.length || briefs.length
        ? { receipt: explainerReceipt, export: explainerExport, assets: castAssets, briefs }
        : null,
      story: storyOutline || storyReceipt ? { outline: storyOutline, receipt: storyReceipt } : null,
    }
  })
}
