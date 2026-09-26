// Incredible Studio desktop shell (spec §1): hosts the studio-v2 worker
// in-process, loads it from its http://127.0.0.1 origin (never file://), and
// grants the media permissions the recording blocks need. `--smoke` launches,
// verifies the app end to end and quits with exit code 0/1. The same origin
// hosts the MCP endpoint (spec §4) and the harness port runs from here
// (spec §3).
import { app, BrowserWindow, desktopCapturer, ipcMain, shell, type DownloadItem, type WebContents } from 'electron'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { startWorker, type WorkerHandle } from './worker-host'
import { handleMcpMessage } from './mcp/server'
import { closeHiddenWindow } from './mcp/hidden-window'
import { RunManager } from './harness/run-manager'
import { registerHarnessIpc } from './harness/ipc'
import { showGateDialog } from './harness/gate-dialog'
import { runHarnessE2E } from './harness/e2e'
import { createClaudeCodeAdapter } from './harness/adapters/claude-code'
import { createKimiAdapter } from './harness/adapters/kimi'
import { createCodexAdapter } from './harness/adapters/codex'
import type { HarnessContext } from './harness/types'

// A side-by-side instance — a check, or a second app on its own data
// directory — keeps its own browser profile there, so it never shares the
// creator's local storage, caches or their locks.
if (process.env.STUDIO_ALLOW_MULTI_INSTANCE && process.env.STUDIO_DATA_DIR) {
  app.setPath('userData', join(process.env.STUDIO_DATA_DIR, 'electron-profile'))
}

// A Finder-launched Electron inherits a minimal PATH (no ~/.local/bin, no
// Homebrew on some setups), so agent CLIs installed from a terminal are
// invisible. Merge the login shell's PATH once before the adapters probe.
const mergeLoginShellPath = () => {
  if (process.platform === 'win32') return
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const output = execFileSync(shell, ['-lic', 'echo -n "$PATH"'], {
      encoding: 'utf8',
      timeout: 4_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    // The process PATH keeps precedence (a test stub placed first must win);
    // the login shell's entries fill in whatever is missing after it.
    const merged = [...new Set([...(process.env.PATH || '').split(':'), ...(output || '').split(':')].filter(Boolean))]
    process.env.PATH = merged.join(':')
  } catch {
    // Keep whatever PATH we have.
  }
}

const SMOKE = process.argv.includes('--smoke')
// Used by scripts/test.mjs: keep serving after the smoke probe so the product
// test can run against the live origin.
const KEEP_RUNNING = process.argv.includes('--keep-running')

const log = (...args: unknown[]) => console.log('[studio-desktop]', ...args)

let worker: WorkerHandle | null = null
let mainWindow: BrowserWindow | null = null
let stopping = false

const stopWorker = async () => {
  if (!worker) return
  const current = worker
  worker = null
  await current.stop().catch(() => {})
}

type SmokeProbe = {
  title: string
  health: { persistence?: { database?: string; objectStorage?: string } } | null
  projectCount: number | null
  hasEditor: boolean
  hasModelSettings: boolean
  hasAssistButton: boolean
  agentSummary: string | null
}

// The editor DOM checks mirror the reference shell's product smoke: the
// ProseMirror/contenteditable editor, the one AI settings entry point (with
// the local harness detected) and the notebook list (fetched from the same
// origin the page uses).
const SMOKE_PROBE = `(async () => {
  for (let i = 0; i < 40 && !document.querySelector('.ProseMirror, [contenteditable="true"]'); i++) {
    await new Promise(r => setTimeout(r, 250))
  }
  // Detection asks each harness CLI for its version: on a loaded machine
  // that takes longer than the editor does to mount.
  for (let i = 0; i < 80; i++) {
    if ((document.getElementById('open-ai-settings') || { dataset: {} }).dataset.harness === 'detected') break
    await new Promise(r => setTimeout(r, 250))
  }
  const health = await fetch('/api/health').then(r => r.json()).catch(() => null)
  const projects = await fetch('/api/projects').then(r => r.json()).catch(() => null)
  const list = projects ? (Array.isArray(projects) ? projects : projects.projects) : null
  return {
    title: document.title,
    health,
    projectCount: Array.isArray(list) ? list.length : null,
    hasEditor: !!document.querySelector('.ProseMirror, [contenteditable="true"]'),
    hasModelSettings: !!document.getElementById('open-ai-settings'),
    hasAssistButton: !!document.getElementById('se-plan-assist') &&
      !(document.getElementById('se-assist-row') || { hidden: true }).hidden,
    agentSummary: (() => {
      const button = document.getElementById('open-ai-settings')
      if (!button || button.dataset.harness !== 'detected') return null
      return (document.getElementById('ai-settings-summary') || {}).textContent || null
    })(),
  }
})()`

const smokeFailure = (probe: SmokeProbe | null): string => {
  if (!probe) return 'page probe failed'
  // The smoke validates the selected backend. Default: the durable local
  // PostgreSQL + MinIO store (a null persistence means the services are
  // down — yarn studio:infra). STUDIO_PERSISTENCE=local is the explicit
  // isolated-test mode and smokes files instead.
  const expectsLocal = process.env.STUDIO_PERSISTENCE === 'local'
  const persistence = probe.health?.persistence
  const persistenceOk = expectsLocal
    ? persistence?.database === 'files'
    : persistence?.database === 'postgres' && persistence?.objectStorage === 'minio'
  if (!persistenceOk) {
    return `health persistence mismatch (${JSON.stringify(persistence ?? null)}); expected ${expectsLocal ? 'explicit local files' : 'postgres/minio — start the local services with `yarn studio:infra`'}`
  }
  if (probe.title !== 'Incredible Studio') return `unexpected title ${JSON.stringify(probe.title)}`
  if (!probe.hasEditor) return 'editor did not mount'
  if (!probe.hasModelSettings) return 'AI settings entry missing'
  if (!probe.hasAssistButton) return 'assist button missing or hidden in desktop mode'
  if (!probe.agentSummary?.startsWith('AI ·')) {
    return `agent detection did not report (${JSON.stringify(probe.agentSummary)})`
  }
  if (probe.projectCount === null) return 'notebook list unavailable'
  return ''
}

const runSmoke = async (win: BrowserWindow): Promise<string> => {
  let probe: SmokeProbe | null = null
  try {
    probe = (await Promise.race([
      win.webContents.executeJavaScript(SMOKE_PROBE),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('probe timed out')), 30_000),
      ),
    ])) as SmokeProbe
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  log('probe', JSON.stringify(probe))
  return smokeFailure(probe)
}

const createWindow = (origin: string) => {
  // Shown even in smoke mode: hidden windows suspend requestAnimationFrame
  // (spec §8), which can stall the editor mount the probe waits for.
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
    },
  })
  mainWindow = win

  // Camera/mic for the app origin (recording blocks); everything else denied.
  const ses = win.webContents.session
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    let requestingOrigin = ''
    try {
      requestingOrigin = new URL(webContents.getURL()).origin
    } catch {
      // Deny below.
    }
    callback(permission === 'media' && requestingOrigin === origin)
  })
  // Screen-recording blocks get the primary screen.
  ses.setDisplayMediaRequestHandler((_request, callback) => {
    void desktopCapturer.getSources({ types: ['screen'] }).then(
      sources => callback({ video: sources[0] }),
      () => callback({}),
    )
  })

  // The studio's window stays the studio (F01 of the fix verification): a
  // link anywhere else opens in the creator's browser, and an address of
  // the app from an earlier start — its port long gone — is refused rather
  // than replacing the app with an error page.
  const outside = (url: string) => {
    let target: URL
    try {
      target = new URL(url)
    } catch {
      return 'refuse' as const
    }
    if (target.origin === origin) return 'inside' as const
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    if (!loopback && (target.protocol === 'https:' || target.protocol === 'http:')) {
      void shell.openExternal(target.href)
      return 'external' as const
    }
    return 'refuse' as const
  }
  win.webContents.on('will-navigate', (event, url) => {
    const where = outside(url)
    if (where === 'inside') return
    event.preventDefault()
    if (where === 'refuse') log('navigation refused', url)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (outside(url) === 'refuse') log('new window refused', url)
    return { action: 'deny' }
  })
  // The default console hook only surfaces warnings (spec §8); log everything
  // plus failed loads so a 404'd bundle is visible immediately. A page that
  // failed to load anything but the app goes back to the app.
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    log('did-fail-load', code, description, url)
    if (isMainFrame && code !== -3 && !url.startsWith(`${origin}/`) && url !== origin) void win.loadURL(`${origin}/studio`)
  })
  win.webContents.on('console-message', event => {
    log(`console.${event.level}`, event.message, `(${event.sourceId}:${event.lineNumber})`)
  })
  return win
}

const quit = async (code: number): Promise<void> => {
  closeHiddenWindow()
  await stopWorker()
  app.exit(code)
}

// MCP over HTTP on the app's own origin (POST /mcp). The harness CLIs reach
// it through the stdio shim; the shim never talks to any other process.
// POST /__eval {js} is a loopback TEST HOOK (used by scripts/*-check.mjs):
// evaluates JS in the main window and returns the result. Only registered
// when STUDIO_ENABLE_TEST_HOOKS=1 — never enabled in a normal launch.
const mcpPreHandler = async (
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
): Promise<boolean> => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)
  if (
    url.pathname === '/__eval' &&
    request.method === 'POST' &&
    process.env.STUDIO_ENABLE_TEST_HOOKS === '1'
  ) {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    const write = (status: number, value: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(value))
    }
    try {
      const { js } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { js: string }
      if (!mainWindow || mainWindow.isDestroyed()) throw new Error('no main window')
      const result = await mainWindow.webContents.executeJavaScript(String(js))
      write(200, { ok: true, result })
    } catch (error) {
      write(200, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
    return true
  }
  // POST /__window {width, height} — the same TEST HOOK gate: sizes the main
  // window, for check scripts that read a layout at a given window size.
  if (url.pathname === '/__window' && request.method === 'POST' && process.env.STUDIO_ENABLE_TEST_HOOKS === '1') {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    if (!mainWindow || mainWindow.isDestroyed()) {
      response.end(JSON.stringify({ ok: false, error: 'no main window' }))
      return true
    }
    const { width, height } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { width?: number; height?: number }
    if (width && height) mainWindow.setSize(Math.round(width), Math.round(height))
    response.end(JSON.stringify({ ok: true, size: mainWindow.getSize(), content: mainWindow.getContentSize() }))
    return true
  }
  // POST /__quit — the same TEST HOOK gate: quits as the creator does, so
  // a check can restart the app on a new port and read what survived.
  if (url.pathname === '/__quit' && request.method === 'POST' && process.env.STUDIO_ENABLE_TEST_HOOKS === '1') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ ok: true }))
    setTimeout(() => app.quit(), 50)
    return true
  }
  // GET /__capture — the same TEST HOOK gate: a PNG of the main window, for
  // check scripts that record what the creator saw.
  if (url.pathname === '/__capture' && request.method === 'GET' && process.env.STUDIO_ENABLE_TEST_HOOKS === '1') {
    if (!mainWindow || mainWindow.isDestroyed()) {
      response.writeHead(503, { 'content-type': 'text/plain' })
      response.end('no main window')
      return true
    }
    // An occluded or busy window can hold its next frame back; never hang.
    const image = await Promise.race([
      mainWindow.webContents.capturePage(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 15_000)),
    ])
    if (!image) {
      response.writeHead(504, { 'content-type': 'text/plain' })
      response.end('the window did not paint a frame in time')
      return true
    }
    response.writeHead(200, { 'content-type': 'image/png' })
    response.end(image.toPNG())
    return true
  }
  if (url.pathname !== '/mcp' || request.method !== 'POST') return false
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const origin = `http://${request.headers.host}`
  // The run's capability scope travels in its MCP URL (see the adapters).
  const scopeParam = url.searchParams.get('scope')
  const scope = scopeParam === 'planning' || scopeParam === 'production' ? scopeParam : undefined
  const write = (status: number, value: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify(value))
  }
  let message: unknown
  try {
    message = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    write(400, { error: 'invalid JSON' })
    return true
  }
  if (Array.isArray(message)) {
    const results = []
    for (const entry of message) {
      const result = await handleMcpMessage(entry, { origin, scope })
      if (result) results.push(result)
    }
    write(200, results)
    return true
  }
  const result = await handleMcpMessage(message as Record<string, unknown>, { origin, scope })
  write(200, result || {})
  return true
}

// Only the studio's own window asks the desktop for these.
const fromStudioWindow = (sender: WebContents) => Boolean(mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents)

// The studio's own download (F01 of the fix verification): a file of the
// app's own origin, saved where the creator chooses — never a navigation
// of the window. STUDIO_DOWNLOADS_DIR saves without asking (the checks).
ipcMain.handle('studio:download', (event, url: unknown, filename: unknown) => {
  if (!worker || !fromStudioWindow(event.sender)) throw new Error('Downloads come from the studio window')
  const target = new URL(String(url), worker.origin)
  if (target.origin !== worker.origin) throw new Error('Only the studio’s own files download here')
  const name = basename(String(filename || '')) || 'Incredible Studio.mp4'
  const contents = event.sender
  return new Promise<{ state: 'completed' | 'cancelled' | 'interrupted'; path?: string }>(resolve => {
    const timer = setTimeout(() => {
      contents.session.removeListener('will-download', onDownload)
      resolve({ state: 'interrupted' })
    }, 20_000)
    const onDownload = (_event: Electron.Event, item: DownloadItem, source: WebContents) => {
      if (source !== contents || item.getURL() !== target.href) return
      clearTimeout(timer)
      contents.session.removeListener('will-download', onDownload)
      const folder = process.env.STUDIO_DOWNLOADS_DIR
      if (folder) item.setSavePath(join(folder, name))
      else item.setSaveDialogOptions({ defaultPath: join(app.getPath('downloads'), name) })
      item.once('done', (_done, state) => resolve(state === 'completed' ? { state, path: item.getSavePath() } : { state: state === 'cancelled' ? 'cancelled' : 'interrupted' }))
    }
    contents.session.on('will-download', onDownload)
    contents.downloadURL(target.href)
  })
})

// The studio's web storage outlives the port (F03 of the fix verification;
// see preload.ts): the app's own copy, in the worker's data folder, with
// the page it was on. Only the studio window reads or writes it.
const storageSession = randomUUID()
type StorageSnapshot = { entries: Record<string, string>; path?: string }
// Known from the worker's start, and kept past its stop: the page's last
// copy arrives as its window closes, after a quit has stopped the worker.
let storagePath = ''
const storageFile = () => storagePath
const readStorageSnapshot = (): StorageSnapshot | null => {
  try {
    const parsed = JSON.parse(readFileSync(storageFile(), 'utf8')) as StorageSnapshot
    return parsed && parsed.entries && typeof parsed.entries === 'object' ? parsed : null
  } catch {
    return null
  }
}
const keepStorageSnapshot = (payload: unknown) => {
  const file = storageFile()
  if (!file || typeof payload !== 'string') return
  try {
    const parsed = JSON.parse(payload) as StorageSnapshot
    if (!parsed || typeof parsed.entries !== 'object') return
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, payload)
    renameSync(temporary, file)
  } catch (error) {
    log('web storage not kept:', error instanceof Error ? error.message : error)
  }
}
ipcMain.on('studio:web-storage:load', event => {
  event.returnValue = fromStudioWindow(event.sender) ? { session: storageSession, entries: readStorageSnapshot()?.entries ?? null } : null
})
ipcMain.on('studio:web-storage:save', (event, payload) => {
  if (fromStudioWindow(event.sender)) keepStorageSnapshot(payload)
})
ipcMain.on('studio:web-storage:flush', (event, payload) => {
  if (fromStudioWindow(event.sender)) keepStorageSnapshot(payload)
  event.returnValue = true
})

// The check scripts set STUDIO_ALLOW_MULTI_INSTANCE so a test app can run
// (on its own port and temp data dir) while the user's app stays open.
if (!process.env.STUDIO_ALLOW_MULTI_INSTANCE && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('before-quit', event => {
    if (!worker || stopping) return
    stopping = true
    event.preventDefault()
    void stopWorker().then(() => app.quit())
  })
  app.on('window-all-closed', () => app.quit())

  void app.whenReady().then(async () => {
    try {
      // The vendored skills root, visible to the worker's diagnostics (§8
      // records skill versions per proof). The worker runs in-process.
      process.env.STUDIO_SKILLS_DIR = fileURLToPath(new URL('../skills', import.meta.url))
      worker = await startWorker({ preHandler: mcpPreHandler })
      storagePath = join(worker.dataDir, 'web-storage.json')
    } catch (error) {
      log('worker failed to start:', error instanceof Error ? error.message : error)
      return quit(2)
    }
    const { origin } = worker
    log('serving studio from', origin)
    console.log(`STUDIO_ORIGIN ${origin}`)

    // Harness port + MCP tool context share the app's origin.
    const harnessContext: HarnessContext = {
      origin,
      mcpShimPath: fileURLToPath(new URL('./mcp-stdio.mjs', import.meta.url)),
      skillsDir: fileURLToPath(new URL('../skills', import.meta.url)),
    }
    const projectsRoot = join(worker.dataDir, 'projects')
    const runManager = new RunManager(harnessContext, projectsRoot, (runId, gate) =>
      showGateDialog(mainWindow, gate),
    )
    mergeLoginShellPath()
    const adapters = [
      createClaudeCodeAdapter(harnessContext),
      createCodexAdapter(harnessContext),
      createKimiAdapter(harnessContext),
    ]
    registerHarnessIpc(runManager, adapters, () => mainWindow)
    // Runs cut off when the app last closed are settled before anyone looks.
    await runManager.reconcileInterrupted()

    // Headless harness protocol test (STUDIO_HARNESS_E2E=<config.json>).
    if (process.env.STUDIO_HARNESS_E2E) {
      const code = await runHarnessE2E(harnessContext, projectsRoot).catch(error => {
        console.log(`HARNESS E2E FAIL: ${error instanceof Error ? error.message : error}`)
        return 1
      })
      return quit(code)
    }

    const win = createWindow(origin)
    try {
      // The studio opens where the creator left it: the studio itself, or
      // the themes page it starts on (F03 of the fix verification).
      await win.loadURL(`${origin}${readStorageSnapshot()?.path === '/studio' ? '/studio' : '/'}`)
    } catch (error) {
      log('load failed:', error instanceof Error ? error.message : error)
      if (SMOKE) {
        console.log('SMOKE FAIL: page failed to load')
        return quit(1)
      }
      return
    }
    if (!SMOKE) return
    const failure = await runSmoke(win)
    console.log(failure ? `SMOKE FAIL: ${failure}` : 'SMOKE PASS')
    if (KEEP_RUNNING && !failure) return
    await quit(failure ? 1 : 0)
  })
}
