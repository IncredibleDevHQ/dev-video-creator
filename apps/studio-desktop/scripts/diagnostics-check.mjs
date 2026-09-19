// D7 diagnostics check: /api/diagnostics returns a secrets-free bundle —
// store health, counts, provider flags, runs with stages — and never a
// credential. Pattern per run-history-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-diag-'))
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

try {
  // Plant a run with a stage so the bundle has something to report.
  const runId = `run-diag-${Date.now().toString(36)}`
  await fetch(`${origin}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: runId, projectId: 'nb-diag', skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: '/tmp/x', status: 'running' }) })
  await fetch(`${origin}/api/runs/${runId}/stages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: 'preview', status: 'succeeded', detail: { durationMs: 1200 } }) })

  const response = await fetch(`${origin}/api/diagnostics`)
  const diag = await response.json()
  check('store health is in the bundle', diag.persistence?.database === 'postgres' && diag.persistence?.objectStorage === 'minio', JSON.stringify(diag.persistence))
  check('counts are numeric', typeof diag.counts?.notebooks === 'number' && typeof diag.counts?.artworkCallsSpent === 'number')
  check('provider flags are present without secrets', 'configured' in (diag.providers?.quiver || {}) && typeof diag.providers?.fishAudio === 'boolean')
  const run = diag.runs?.find(entry => entry.id === runId)
  check('recent runs carry their stage outcomes', run?.stages?.[0]?.status === 'succeeded', JSON.stringify(run?.stages || []))
  const skills = diag.skills || []
  check(
    'installed skills carry name, version and a content fingerprint',
    ['explainer-master', 'page-master', 'story-master'].every(name => skills.some(s => s.name === name && /^\d/.test(s.version) && /^[0-9a-f]{16}$/.test(s.hash))),
    JSON.stringify(skills.map(s => `${s.name}@${s.version}`)),
  )
  const raw = JSON.stringify(diag)
  const leaks = ['SuperSecretRootPwd', 'QUIVER_API_KEY=', 'FISH_AUDIO_API_KEY='].filter(secret => raw.includes(secret))
  check('the bundle carries no credential values', leaks.length === 0, leaks.join(','))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 500))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `DIAGNOSTICS CHECK FAIL (${failures})` : 'DIAGNOSTICS CHECK PASS')
process.exitCode = failures ? 1 : 0
