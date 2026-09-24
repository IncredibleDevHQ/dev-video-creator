// Verifies the harness picker: the top-bar pill shows the detected agent,
// Agent settings lists all three CLIs with their online state, a default and
// a per-stage harness and model are chosen there, and the choice is the
// durable server preference — it survives a restart of the app, which comes
// back on a new local port. Uses the loopback /__eval test hook.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-agent-picker-'))

let app = null
let origin = ''
const launch = async () => {
  // Its own store in the temp directory: the check writes preferences, and
  // must never reach a developer's database.
  app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_ENABLE_TEST_HOOKS: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  origin = await new Promise((resolve, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
    app.stdout.on('data', chunk => {
      buffer += chunk
      const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
      if (match) {
        clearTimeout(timeout)
        resolve(match[1])
      }
    })
  })
}
const quit = async () => {
  if (!app) return
  const exited = new Promise(resolve => app.once('exit', resolve))
  app.kill('SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))])
  app = null
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
// The window opens a moment after the origin is announced; wait for it.
const evaluate = async js => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${origin}/__eval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ js: `(${js})()` }),
    })
    const body = await response.json().catch(() => ({ ok: false, error: 'no main window' }))
    if (body.ok) return body.result
    if (!/no main window/.test(body.error || '') || attempt > 120) throw new Error(body.error || 'eval failed')
    await new Promise(r => setTimeout(r, 250))
  }
}
const preferences = async () => (await fetch(`${origin}/api/settings/harness`).then(response => response.json())).preferences
const waitForPreference = async test => {
  for (let i = 0; i < 40; i++) {
    const current = await preferences().catch(() => null)
    if (current && test(current)) return current
    await new Promise(r => setTimeout(r, 250))
  }
  return preferences().catch(() => null)
}
// The dialog, read back: each harness row, and each choice row's selects.
const readDialog = () =>
  evaluate(`async () => {
    // The app may still be booting after a restart: keep opening the dialog
    // until its rows are there.
    const dialog = document.getElementById('agent-settings-dialog')
    for (let i = 0; i < 120; i++) {
      if (!dialog.open) document.getElementById('open-agent-settings').click()
      if (document.querySelectorAll('#agent-list .agent-row').length && document.querySelectorAll('#agent-list .agent-choice').length) break
      await new Promise(r => setTimeout(r, 250))
    }
    await new Promise(r => setTimeout(r, 1200))
    return {
      rows: [...document.querySelectorAll('#agent-list .agent-row')].map(row => ({
        name: row.querySelector('.agent-row-name').textContent,
        detail: row.querySelector('.agent-row-detail').textContent,
        offline: row.classList.contains('is-offline'),
      })),
      choices: [...document.querySelectorAll('#agent-list .agent-choice')].map(row => {
        const [harness, model] = row.querySelectorAll('select')
        return {
          label: row.querySelector('.agent-choice-label').textContent,
          harness: harness?.value ?? null,
          harnessOptions: [...(harness?.options || [])].map(option => ({ value: option.value, disabled: option.disabled })),
          model: model && !model.hidden ? model.value : null,
          note: row.querySelector('small')?.textContent || '',
        }
      }),
    }
  }`)
const choose = (label, which, value) =>
  evaluate(`async () => {
    const row = [...document.querySelectorAll('#agent-list .agent-choice')].find(entry => entry.querySelector('.agent-choice-label').textContent === ${JSON.stringify(label)})
    const select = row?.querySelectorAll('select')[${which === 'model' ? 1 : 0}]
    if (!select) return false
    select.value = ${JSON.stringify(value)}
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }`)

try {
  await launch()
  const summary = await evaluate(`async () => {
    for (let i = 0; i < 20; i++) {
      const text = document.getElementById('agent-settings-summary').textContent
      if (text.startsWith('Agent ·')) return text
      await new Promise(r => setTimeout(r, 250))
    }
    return document.getElementById('agent-settings-summary').textContent
  }`)
  check('top-bar pill shows the detected agent', summary.startsWith('Agent ·'), JSON.stringify(summary))

  const first = await readDialog()
  check('Agent settings lists all three harnesses', first.rows.length === 3, first.rows.map(r => r.name).join(', '))
  const online = first.rows.filter(r => !r.offline)
  check('at least one harness is online', online.length >= 1, online.map(r => `${r.name} (${r.detail})`).join('; '))
  for (const row of first.rows.filter(r => r.offline)) {
    check(`${row.name} shown offline with a reason`, /not found/.test(row.detail), row.detail)
  }
  check(
    'a default and every stage have a harness choice',
    ['Default', 'Story outline', 'Page drawing', 'Video planning', 'Scene production'].every(label => first.choices.some(choice => choice.label === label)),
    first.choices.map(choice => choice.label).join(', '),
  )
  const defaultRow = first.choices.find(choice => choice.label === 'Default')
  check('nothing is chosen on a fresh install', defaultRow?.harness === '', JSON.stringify(defaultRow))
  check('an unavailable harness cannot be picked', defaultRow?.harnessOptions.filter(option => option.value && option.disabled).length === first.rows.filter(r => r.offline).length, JSON.stringify(defaultRow?.harnessOptions))

  const ids = { 'Claude Code': 'claude-code', Kimi: 'kimi', Codex: 'codex' }
  const picked = ids[online[0]?.name]
  await choose('Default', 'harness', picked)
  const saved = await waitForPreference(current => current.default?.harness === picked)
  check('choosing the default is saved as the durable preference', saved?.default?.harness === picked, JSON.stringify(saved?.default))
  if (picked === 'claude-code') check('Claude Code is chosen on the latest Opus', saved?.default?.model === 'claude-opus-5-5', String(saved?.default?.model))

  const hint = await evaluate(`() => (document.getElementById('se-assist-agent') || {}).textContent || ''`)
  check('slide editor hint names the chosen harness', hint.includes(online[0].name), JSON.stringify(hint))

  // A stage override with a model of its own.
  await readDialog()
  await choose('Page drawing', 'harness', picked)
  const staged = await waitForPreference(current => current.stages?.drawing?.harness === picked)
  check('a stage can run on its own harness', staged?.stages?.drawing?.harness === picked, JSON.stringify(staged?.stages))
  const afterStage = await readDialog()
  const drawingRow = afterStage.choices.find(choice => choice.label === 'Page drawing')
  const modelOptions = await evaluate(`() => {
    const row = [...document.querySelectorAll('#agent-list .agent-choice')].find(entry => entry.querySelector('.agent-choice-label').textContent === 'Page drawing')
    return [...(row?.querySelectorAll('select')[1]?.options || [])].filter(option => !option.disabled).map(option => option.value)
  }`)
  const otherModel = modelOptions.find(value => value && value !== drawingRow?.model) ?? ''
  await choose('Page drawing', 'model', otherModel)
  const modelled = await waitForPreference(current => (current.stages?.drawing?.model || '') === otherModel)
  check('the stage keeps the model picked for it', (modelled?.stages?.drawing?.model || '') === otherModel, `${JSON.stringify(modelled?.stages?.drawing)} options=${modelOptions.join(',')}`)

  // Restart: the app returns on a new port, and the choice is still there.
  const before = origin
  await quit()
  await launch()
  check('the app restarts on its own local port', Boolean(origin), `${before} → ${origin}`)
  const after = await readDialog()
  const defaultAfter = after.choices.find(choice => choice.label === 'Default')
  const drawingAfter = after.choices.find(choice => choice.label === 'Page drawing')
  check('the default survives the restart', defaultAfter?.harness === picked, JSON.stringify(defaultAfter))
  check('the stage override and its model survive the restart', drawingAfter?.harness === picked && (drawingAfter?.model || '') === otherModel, JSON.stringify(drawingAfter))

  // Clearing the stage returns it to the default.
  await choose('Page drawing', 'harness', '')
  const cleared = await waitForPreference(current => !current.stages?.drawing)
  check('clearing a stage returns it to the default', !cleared?.stages?.drawing, JSON.stringify(cleared?.stages))
  await evaluate(`() => { document.getElementById('close-agent-settings').click(); return true }`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await quit()
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `AGENT PICKER FAIL (${failures})` : 'AGENT PICKER PASS')
process.exitCode = failures ? 1 : 0
