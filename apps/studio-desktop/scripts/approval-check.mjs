// Approval gate check: Plan motion (assist) refuses to run on an unapproved
// page, then runs once the user approves it. The harness.run bridge is
// monkey-patched so no agent is spawned — the gate logic is what's under test.
// Usage: node scripts/approval-check.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect id="bg" x="0" y="0" width="1280" height="720" fill="#0f1411"/>
  <rect id="u-input" x="170" y="430" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-input-label" x="310" y="472" fill="#f4f4f5" font-size="26" text-anchor="middle">Input embedding</text>
  <rect id="u-attn" x="170" y="260" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-attn-label" x="310" y="302" fill="#f4f4f5" font-size="26" text-anchor="middle">Multi-head attention</text>
  <line id="u-arrow-1" x1="310" y1="430" x2="310" y2="330" stroke="#4ade80" stroke-width="3"/>
</svg>`

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 220)])
  }
}
const j = async (base, p, init) => {
  const r = await fetch(base + p, init)
  const t = await r.text()
  let b
  try { b = JSON.parse(t) } catch { b = t }
  if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + String(b && b.error || b).slice(0, 120))
  return b
}

const root = await mkdtemp(join(tmpdir(), 'studio-approval-'))
const dataDir = join(root, 'data')
// A stub kimi on PATH: emits one text line and exits 0 (no gate), so an
// allowed run completes without a real agent.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node\nconsole.log(JSON.stringify({role:'assistant',content:'stub run'}))\nconsole.log(JSON.stringify({role:'meta',type:'session.resume_hint',session_id:'stub-session-approval'}))\n`,
)
await chmod(join(binDir, 'kimi'), 0o755)
const id = `approval-${Date.now()}`
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_DATA_DIR: dataDir,
    STUDIO_ENABLE_TEST_HOOKS: '1',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    buffer += chunk.toString()
    const match = buffer.match(/STUDIO_ORIGIN (\S+)/)
    if (buffer.includes('SMOKE PASS') && match) { clearTimeout(timeout); resolve(match[1]) }
    if (buffer.includes('SMOKE FAIL')) { clearTimeout(timeout); reject(new Error('smoke failed')) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})
const stopApp = async () => {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}
const evalInWindow = async js => {
  const response = await j(origin, '/__eval', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js }),
  })
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 80)}`)
}

try {
  await step('slide block (unapproved) opens in the slide editor', async () => {
    const project = {
      version: 1, id, title: 'Approval check',
      notebook: { type: 'doc', content: [
        { type: 'slide', attrs: { id: 'blk-slide', title: 'Encoder', svg: SVG, steps: [] } },
      ] },
      fps: 30, width: 1920, height: 1080,
      blocks: { 'blk-slide': { speakerNotes: 'Tokens come in as embeddings. Attention relates every pair.' } },
      presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.getElementById('blk-slide')`)
    await evalInWindow(`document.querySelector('#blk-slide [data-slide-action="edit"]').click()`)
    await waitFor(`document.getElementById('slide-editor-dialog').open`)
    const approved = await evalInWindow(`document.getElementById('se-approve').textContent`)
    return `slide editor open, toggle reads "${approved}"`
  })
  await step('assist refused on the unapproved page', async () => {
    await evalInWindow(`document.getElementById('se-plan-assist').click()`)
    await new Promise(resolve => setTimeout(resolve, 1_500))
    const runs = await evalInWindow(`window.studioDesktop.harness.list()`)
    if (runs.length !== 0) throw new Error('a run started on an unapproved page')
    const status = await evalInWindow(`document.getElementById('se-status').textContent`)
    if (!/approve/i.test(status)) throw new Error(`status: ${status}`)
    return `refused: "${status.slice(0, 80)}"`
  })
  await step('approve toggle flips and persists', async () => {
    await evalInWindow(`document.getElementById('se-approve').click()`)
    const label = await waitFor(`document.getElementById('se-approve').textContent.includes('approved') && document.getElementById('se-approve').textContent`)
    const deadline = Date.now() + 10_000
    let saved = false
    while (Date.now() < deadline) {
      const { project } = await j(origin, '/api/projects/' + id)
      saved = Boolean(project.notebook.content[0].attrs.structureApproved)
      if (saved) break
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (!saved) throw new Error('structureApproved not persisted')
    return `"${label}" + structureApproved saved`
  })
  await step('assist allowed after approval', async () => {
    await evalInWindow(`document.getElementById('se-plan-assist').click()`)
    const runs = await waitFor(`window.studioDesktop.harness.list().then(runs => runs.length ? runs : null)`)
    const deadline = Date.now() + 30_000
    let status = ''
    while (Date.now() < deadline) {
      const current = await evalInWindow(`window.studioDesktop.harness.list()`)
      status = current[0]?.status || ''
      if (status === 'done') break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (status !== 'done') throw new Error(`run status ${status}`)
    return `run started and finished: ${runs[0].adapter} → ${status}`
  })
  await step('cleanup', async () => {
    await j(origin, '/api/projects/' + id, { method: 'DELETE' })
    return 'test notebook deleted'
  })
} finally {
  await stopApp()
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  const failures = results.filter(result => result[1] === 'FAIL').length
  console.log(failures ? `APPROVAL CHECK FAIL (${failures})` : 'APPROVAL CHECK PASS')
  await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
