// Incredible Studio desktop shell (spec §1): hosts the studio-v2 worker
// in-process, loads it from its http://127.0.0.1 origin (never file://), and
// grants the media permissions the recording blocks need. `--smoke` launches,
// verifies the app end to end and quits with exit code 0/1.
import { app, BrowserWindow, desktopCapturer } from 'electron'
import { fileURLToPath } from 'node:url'
import { startWorker, type WorkerHandle } from './worker-host'

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
}

// The editor DOM checks mirror the reference shell's product smoke: the
// ProseMirror/contenteditable editor, the model-settings entry point and the
// notebook list (fetched from the same origin the page uses).
const SMOKE_PROBE = `(async () => {
  for (let i = 0; i < 40 && !document.querySelector('.ProseMirror, [contenteditable="true"]'); i++) {
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
  await stopWorker()
  app.exit(code)
}

if (!app.requestSingleInstanceLock()) {
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
      worker = await startWorker()
    } catch (error) {
      log('worker failed to start:', error instanceof Error ? error.message : error)
      return quit(2)
    }
    const { origin } = worker
    log('serving studio from', origin)
    console.log(`STUDIO_ORIGIN ${origin}`)
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
