// Shared hidden BrowserWindow for the geometry tools (atomize / measure /
// frames). Hidden windows suspend requestAnimationFrame (spec §8), but the
// atomizer never uses rAF — it measures synchronously and waits on
// document.fonts.ready (a promise, not a frame), so a hidden window is safe
// here. The window loads a data-URL page with the bundled atomizer IIFE
// (dist-electron/atomizer.js) inlined.
import { BrowserWindow } from 'electron'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

let window: BrowserWindow | null = null
let ready: Promise<BrowserWindow> | null = null

const ensureWindow = () => {
  ready ||= (async () => {
    const atomizerSource = await readFile(
      fileURLToPath(new URL('./atomizer.js', import.meta.url)),
      'utf8',
    )
    const win = new BrowserWindow({
      width: 1600,
      height: 900,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    })
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!doctype html><html><head><meta charset="utf-8"><script>${atomizerSource}</script></head><body></body></html>`,
      )}`,
    )
    window = win
    win.on('closed', () => {
      window = null
      ready = null
    })
    return win
  })()
  return ready
}

// Calls window.StudioAtomize.<fn>(...args) in the hidden page and returns the
// JSON result.
export const runAtomizer = async <T>(fn: string, ...args: unknown[]): Promise<T> => {
  const win = await ensureWindow()
  const call = `window.StudioAtomize.${fn}(${args.map(arg => JSON.stringify(arg)).join(',')})`
  return (await win.webContents.executeJavaScript(call)) as T
}

// Renders the current page state in the hidden window and captures a PNG.
export const captureHiddenPage = async (): Promise<Buffer> => {
  const win = await ensureWindow()
  const image = await win.webContents.capturePage()
  return image.toPNG()
}

export const closeHiddenWindow = () => {
  if (window && !window.isDestroyed()) window.close()
  window = null
  ready = null
}
