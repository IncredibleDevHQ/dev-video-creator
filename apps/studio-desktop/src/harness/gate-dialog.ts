// Gate dialog (spec §3.2): a modal dark-chrome window shown when a skill
// stops at a ⛔ BLOCKING gate. Electron's native dialog has no text inputs,
// so this is a small BrowserWindow with a data-URL form: the stage, one
// textarea per field, the recommendation, submit / dismiss. Submit resolves
// with the answers object; dismiss (or close) resolves null, cancelling the
// run. Never answers on the user's behalf.
import { BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import type { GateRequest } from './types'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const fieldName = (field: GateRequest['fields'][number], index: number) =>
  typeof field === 'string' ? field : field.name || field.label || `field-${index + 1}`

const fieldLabel = (field: GateRequest['fields'][number], index: number) =>
  typeof field === 'string' ? field : field.label || field.name || `Field ${index + 1}`

const fieldValue = (field: GateRequest['fields'][number]) =>
  typeof field === 'string' ? '' : field.value || ''

const dialogHtml = (gate: GateRequest) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; background: #141816; color: #e4e7e5;
         font: 13px/1.5 -apple-system, system-ui, sans-serif; }
  h1 { font-size: 15px; margin: 0 0 2px; }
  .stage { color: #7fb98e; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 14px; }
  label { display: block; margin: 12px 0 4px; color: #b9c1bb; font-weight: 600; }
  textarea { width: 100%; min-height: 56px; resize: vertical; background: #0e1210; color: #e4e7e5;
             border: 1px solid #2c3530; border-radius: 6px; padding: 8px; font: 12px/1.5 ui-monospace, monospace; }
  textarea:focus { outline: 1px solid #4ade80; }
  .rec { margin-top: 14px; padding: 10px; background: #0e1210; border: 1px solid #2c3530; border-radius: 6px; }
  .rec summary { cursor: pointer; color: #7fb98e; font-weight: 600; }
  .rec pre { white-space: pre-wrap; word-break: break-word; font-size: 11px; color: #b9c1bb; }
  .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
  button { border: 1px solid #2c3530; background: #1b211e; color: #e4e7e5; border-radius: 6px;
           padding: 7px 16px; font: 600 12px system-ui; cursor: pointer; }
  button.primary { background: #16a34a; border-color: #16a34a; color: #fff; }
  button:hover { filter: brightness(1.15); }
</style></head><body>
  <h1>${escapeHtml(`Confirmation needed — ${gate.stage}`)}</h1>
  <div class="stage">motion gate · ${escapeHtml(gate.id)}</div>
  <form id="form">
    ${gate.fields
      .map(
        (field, index) => `
      <label for="f${index}">${escapeHtml(fieldLabel(field, index))}</label>
      <textarea id="f${index}" name="${escapeHtml(fieldName(field, index))}">${escapeHtml(fieldValue(field))}</textarea>`,
      )
      .join('')}
  </form>
  ${
    gate.recommendation === undefined
      ? ''
      : `<details class="rec" open><summary>Recommendation</summary><pre>${escapeHtml(
          typeof gate.recommendation === 'string'
            ? gate.recommendation
            : JSON.stringify(gate.recommendation, null, 2),
        )}</pre></details>`
  }
  <div class="row">
    <button id="cancel" type="button">Dismiss (cancel run)</button>
    <button id="submit" type="submit" form="form" class="primary">Confirm &amp; resume</button>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', event => {
      event.preventDefault()
      const answers = {}
      new FormData(event.target).forEach((value, key) => { answers[key] = String(value) })
      window.studioDesktop.gateDialog.submit(answers)
    })
    document.getElementById('cancel').addEventListener('click', () => {
      window.studioDesktop.gateDialog.cancel()
    })
  </script>
</body></html>`

let openGateId: string | null = null

export const showGateDialog = (
  parent: BrowserWindow | null,
  gate: GateRequest,
): Promise<Record<string, unknown> | null> =>
  new Promise(resolve => {
    // One gate at a time; a second gate queues behind the current run anyway.
    if (openGateId) {
      resolve(null)
      return
    }
    openGateId = gate.id
    const win = new BrowserWindow({
      width: 560,
      height: 640,
      parent: parent || undefined,
      modal: Boolean(parent),
      frame: true,
      resizable: true,
      title: `Motion gate — ${gate.stage}`,
      backgroundColor: '#141816',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      },
    })
    const done = (answers: Record<string, unknown> | null) => {
      openGateId = null
      ipcMain.removeListener('gate-dialog:submit', onSubmit)
      ipcMain.removeListener('gate-dialog:cancel', onCancel)
      if (!win.isDestroyed()) win.close()
      resolve(answers)
    }
    const onSubmit = (event: Electron.IpcMainEvent, answers: Record<string, unknown>) => {
      if (event.sender === win.webContents) done(answers || {})
    }
    const onCancel = (event: Electron.IpcMainEvent) => {
      if (event.sender === win.webContents) done(null)
    }
    ipcMain.on('gate-dialog:submit', onSubmit)
    ipcMain.on('gate-dialog:cancel', onCancel)
    win.on('closed', () => {
      if (openGateId === gate.id) done(null)
    })
    win.removeMenu()
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(dialogHtml(gate))}`)
  })
