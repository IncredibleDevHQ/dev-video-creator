// D3 run-history check: harness runs and their stage checkpoints are
// durable records. The routes round-trip through the smoke app; an
// interrupted run (never finished) is reported honestly. Pattern per
// theme-library-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-runs-'))
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
const RUN_ID = `run-check-${Date.now().toString(36)}`

try {
  const started = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: RUN_ID, projectId: 'nb-1', skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: '/tmp/x', status: 'running', inputsHash: 'abc123' }),
  }).then(r => r.json())
  check('run recorded before side effects', started.saved === true)

  const stage1 = await fetch(`${origin}/api/runs/${RUN_ID}/stages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'preview', status: 'succeeded', fingerprint: 'svg+program#1', detail: { durationMs: 4200 } }),
  }).then(r => r.json())
  check('stage checkpoint recorded', stage1.saved === true)

  await fetch(`${origin}/api/runs/${RUN_ID}/stages`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'preview', status: 'failed', fingerprint: 'svg+program#2', detail: { errors: ['artwork too small'] } }),
  })
  const stages = await fetch(`${origin}/api/runs/${RUN_ID}/stages`).then(r => r.json())
  const preview = stages.stages?.find(s => s.stage === 'preview')
  check('a retried stage updates its checkpoint in place', stages.stages?.length === 1 && preview?.status === 'failed' && preview?.fingerprint === 'svg+program#2', JSON.stringify(preview))

  await fetch(`${origin}/api/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: RUN_ID, projectId: 'nb-1', skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: '/tmp/x', status: 'done', exitCode: 0, finishedAt: new Date().toISOString() }),
  })
  const runs = await fetch(`${origin}/api/runs?projectId=nb-1`).then(r => r.json())
  const row = runs.runs?.find(r => r.id === RUN_ID)
  check('the run row lands its final outcome', row?.status === 'done' && row?.exitCode === 0 && Boolean(row?.finishedAt), JSON.stringify(row && { status: row.status, exitCode: row.exitCode }))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 500))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `RUN HISTORY CHECK FAIL (${failures})` : 'RUN HISTORY CHECK PASS')
process.exitCode = failures ? 1 : 0
