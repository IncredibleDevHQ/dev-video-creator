// Verifies the coding-agent picker: the top-bar pill shows the detected
// agent, the dialog lists all three CLIs with their online state, and picking
// one persists the choice. Uses the loopback /__eval test hook.
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
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_DATA_DIR: join(root, 'data'), STUDIO_ENABLE_TEST_HOOKS: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})

const origin = await new Promise((resolve, reject) => {
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

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
const evaluate = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(body.error || 'eval failed')
  return body.result
}

try {
  const summary = await evaluate(`async () => {
    for (let i = 0; i < 20; i++) {
      const text = document.getElementById('agent-settings-summary').textContent
      if (text.startsWith('Agent ·')) return text
      await new Promise(r => setTimeout(r, 250))
    }
    return document.getElementById('agent-settings-summary').textContent
  }`)
  check('top-bar pill shows the detected agent', summary.startsWith('Agent ·'), JSON.stringify(summary))

  const rows = await evaluate(`async () => {
    document.getElementById('open-agent-settings').click()
    await new Promise(r => setTimeout(r, 1500))
    return [...document.querySelectorAll('#agent-list .agent-row')].map(row => ({
      name: row.querySelector('.agent-row-name').textContent,
      detail: row.querySelector('.agent-row-detail').textContent,
      offline: row.classList.contains('is-offline'),
      selected: row.classList.contains('is-selected'),
      disabled: row.querySelector('input').disabled,
    }))
  }`)
  check('dialog lists all three agents', rows.length === 3, rows.map(r => r.name).join(', '))
  const online = rows.filter(r => !r.offline)
  check('at least one agent online and selected', online.length >= 1 && online.some(r => r.selected),
    online.map(r => `${r.name} (${r.detail})`).join('; '))
  for (const row of rows.filter(r => r.offline)) {
    check(`${row.name} shown offline with a reason`, row.disabled && /not found/.test(row.detail), row.detail)
  }

  const persisted = await evaluate(`async () => {
    const row = [...document.querySelectorAll('#agent-list .agent-row')].find(r => !r.classList.contains('is-offline'))
    row.click()
    row.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(r => setTimeout(r, 200))
    const stored = localStorage.getItem('studio.codingAgent')
    const hint = (document.getElementById('se-assist-agent') || {}).textContent || ''
    document.getElementById('close-agent-settings').click()
    return { stored, hint }
  }`)
  check('picking an agent persists the choice', persisted.stored === 'kimi', `stored=${persisted.stored}`)
  check('slide editor hint names the active agent', persisted.hint.includes('Kimi'), JSON.stringify(persisted.hint))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 500))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `AGENT PICKER FAIL (${failures})` : 'AGENT PICKER PASS')
process.exitCode = failures ? 1 : 0
