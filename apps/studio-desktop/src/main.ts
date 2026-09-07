// Incredible Studio desktop shell (spec §1): hosts the studio-v2 worker
// in-process, loads it from its http://127.0.0.1 origin (never file://), and
// grants the media permissions the recording blocks need. `--smoke` launches,
// verifies the app end to end and quits with exit code 0/1. The same origin
// hosts the MCP endpoint (spec §4) and the harness port runs from here
// (spec §3).
import { app, BrowserWindow, desktopCapturer } from 'electron'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
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
  health: { persistence?: { database?: string } } | null
  projectCount: number | null
  hasEditor: boolean
  hasModelSettings: boolean
  hasAssistButton: boolean
  agentSummary: string | null
}

// The editor DOM checks mirror the reference shell's product smoke: the
// ProseMirror/contenteditable editor, the model-settings entry point and the
// notebook list (fetched from the same origin the page uses).
const SMOKE_PROBE = `(async () => {
  for (let i = 0; i < 40 && !document.querySelector('.ProseMirror, [contenteditable="true"]'); i++) {
    await new Promise(r => setTimeout(r, 250))
  }
  for (let i = 0; i < 20; i++) {
    const summary = (document.getElementById('agent-settings-summary') || {}).textContent || ''
    if (summary.startsWith('Agent ·')) break
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
    hasModelSettings: !!document.getElementById('open-model-settings'),
    hasAssistButton: !!document.getElementById('se-plan-assist') &&
      !(document.getElementById('se-assist-row') || { hidden: true }).hidden,
    agentSummary: (() => {
      const button = document.getElementById('open-agent-settings')
      if (!button || button.hidden) return null
      return (document.getElementById('agent-settings-summary') || {}).textContent || null
    })(),
  }
})()`

const smokeFailure = (probe: SmokeProbe | null): string => {
  if (!probe) return 'page probe failed'
  if (probe.health?.persistence?.database !== 'files') {
    return `health persistence is not files (${JSON.stringify(probe.health?.persistence ?? null)})`
  }
  if (probe.title !== 'Incredible Studio') return `unexpected title ${JSON.stringify(probe.title)}`
  if (!probe.hasEditor) return 'editor did not mount'
  if (!probe.hasModelSettings) return 'model settings entry missing'
  if (!probe.hasAssistButton) return 'assist button missing or hidden in desktop mode'
  if (!probe.agentSummary?.startsWith('Agent ·')) {
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

  // The default console hook only surfaces warnings (spec §8); log everything
  // plus failed loads so a 404'd bundle is visible immediately.
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    log('did-fail-load', code, description, url)
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
  if (url.pathname !== '/mcp' || request.method !== 'POST') return false
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const origin = `http://${request.headers.host}`
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
      const result = await handleMcpMessage(entry, { origin })
      if (result) results.push(result)
    }
    write(200, results)
    return true
  }
  const result = await handleMcpMessage(message as Record<string, unknown>, { origin })
  write(200, result || {})
  return true
}

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
      worker = await startWorker({ preHandler: mcpPreHandler })
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
      await win.loadURL(`${origin}/`)
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
