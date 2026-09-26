// Verifies the harness picker: the top bar's one AI entry shows what
// creation runs on, AI settings lists all three CLIs with their online
// state, a default and a per-stage harness and model are chosen there, and
// the choice is the durable server preference — it survives a restart of
// the app, which comes back on a new local port. One screen says what every
// job runs on, harness stage and direct API alike (F7 of the Perplexity
// review). Uses the loopback /__eval test hook.
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  // An app still up 5s after SIGTERM is killed, so its pipes cannot keep the
  // check (or release-check) waiting — and that is said, not hidden.
  if (!(await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]))) {
    console.log('NOTE  the app was still running 5s after SIGTERM; it was killed')
    child.kill('SIGKILL')
  }
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
    const dialog = document.getElementById('ai-settings-dialog')
    for (let i = 0; i < 120; i++) {
      if (!dialog.open) document.getElementById('open-ai-settings').click()
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
// What runs where, as the one screen says it.
const readRoutes = () =>
  evaluate(`() => [...document.querySelectorAll('#ai-routes tbody tr')].map(row => ({ id: row.dataset.aiJob, job: row.querySelector('th strong').textContent, runsOn: row.querySelector('.ai-route-runs-on').textContent, status: row.querySelector('.ai-route-status').textContent }))`)
const routeOf = (routes, id) => routes.find(route => route.id === id)
const shot = async name => {
  if (!process.env.AGENT_PICKER_SHOTS) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.AGENT_PICKER_SHOTS, { recursive: true })
  await writeFile(join(process.env.AGENT_PICKER_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
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
    for (let i = 0; i < 40; i++) {
      if (document.getElementById('open-ai-settings').dataset.harness === 'detected') break
      await new Promise(r => setTimeout(r, 250))
    }
    return document.getElementById('ai-settings-summary').textContent
  }`)
  check('the top bar\'s AI entry shows what creation runs on, once the harnesses are detected', /^AI · (Claude Code|Kimi|Codex) · /.test(summary), JSON.stringify(summary))
  const entries = await evaluate(`() => ({ ai: document.querySelectorAll('#open-ai-settings').length, models: Boolean(document.getElementById('open-model-settings')), agent: Boolean(document.getElementById('open-agent-settings')), dialogs: document.querySelectorAll('dialog#model-settings-dialog, dialog#agent-settings-dialog').length })`)
  check('there is one AI settings entry, not a Models and an Agent one', entries.ai === 1 && !entries.models && !entries.agent && entries.dialogs === 0, JSON.stringify(entries))

  const first = await readDialog()
  check('AI settings lists all three harnesses', first.rows.length === 3, first.rows.map(r => r.name).join(', '))
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

  // One screen says what every job runs on (F7): each harness stage on the
  // chosen harness, the direct API's jobs on its provider — and which
  // features the direct API serves.
  await readDialog()
  const routes = await readRoutes()
  const stageIds = ['story', 'drawing', 'planning', 'composition']
  check('every harness stage names the harness and model it runs on', stageIds.every(id => routeOf(routes, id)?.runsOn.startsWith(`Local harness · ${online[0].name} · `)), JSON.stringify(stageIds.map(id => routeOf(routes, id))))
  check('the direct API\'s jobs name its provider and model', ['writing', 'vision', 'coding'].every(id => /^Direct API · \S/.test(routeOf(routes, id)?.runsOn || '')) && Boolean(routeOf(routes, 'image')), JSON.stringify(['writing', 'vision', 'coding', 'image'].map(id => routeOf(routes, id))))
  const uses = await evaluate(`() => document.getElementById('ai-api-uses').textContent`)
  check('the direct API says which features it serves, and that the harness stages never use it', /writing help/.test(uses) && /illustrations/.test(uses) && /never use it/.test(uses), JSON.stringify(uses))
  await shot('01-ai-settings')

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
  // Which model will draw a page, and which will plan a scene, read off the
  // same screen: the override shows on its stage alone.
  let overridden = null
  for (let i = 0; i < 20 && !overridden; i++) {
    const now = await readRoutes()
    if (/this stage’s own choice/.test(routeOf(now, 'drawing')?.runsOn || '')) overridden = now
    else await new Promise(r => setTimeout(r, 250))
  }
  check('the page-drawing override shows on its row, and planning keeps the default', Boolean(overridden) && routeOf(overridden, 'drawing').runsOn !== routeOf(overridden, 'planning').runsOn && !/own choice/.test(routeOf(overridden, 'planning').runsOn), JSON.stringify(overridden && { drawing: routeOf(overridden, 'drawing'), planning: routeOf(overridden, 'planning') }))
  await shot('02-stage-override')

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
  await evaluate(`() => { document.getElementById('close-ai-settings').click(); return true }`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await quit()
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `AGENT PICKER FAIL (${failures})` : 'AGENT PICKER PASS')
process.exitCode = failures ? 1 : 0
