// §5.5 stage-panel check: the build panel renders a run's durable stage
// checkpoints in plain language — a needs-input stage shows as "waiting for
// you" with its per-beat notes, never as a failure. Pattern per
// rehearsal-check.mjs (smoke app + __eval via the __buildStages dev hook).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-stages-'))
const RUN_ID = `stage-panel-${Date.now().toString(36)}`

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_ENABLE_TEST_HOOKS: '1',
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
const evalInWindow = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
  }).then(r => r.json())
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 90)}`)
}

try {
  await evalInWindow(`location.assign('/studio')`)
  await waitFor(`!!window.__buildStages`)
  await fetch(`${origin}/api/runs`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: RUN_ID, projectId: 'nb-stage-panel', skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: '/tmp/x', status: 'running' }),
  })
  const postStage = (stage, status, detail) =>
    fetch(`${origin}/api/runs/${RUN_ID}/stages`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage, status, detail }),
    })
  await postStage('preview', 'succeeded', { durationMs: 4200 })
  await postStage('align-take', 'needs-input', { scene: 's2', review: [{ beat: 2, note: 'The take skips the second sentence.' }, { beat: 4, note: 'Cue "queue" has no matching word.' }] })
  await postStage('export', 'pending', {})

  await evalInWindow(`window.__buildStages(${JSON.stringify(RUN_ID)})`)
  const panel = await evalInWindow(`(() => {
    const box = document.getElementById('explainer-stages')
    return {
      hidden: box.hidden,
      rows: [...box.children].map(row => ({ text: row.textContent, className: row.className })),
    }
  })()`)
  check('the panel lists every checkpoint', panel.hidden === false && panel.rows.length === 5, `${panel.rows.length} rows`)
  check('a finished stage reads done', panel.rows[0]?.text === 'preview · done' && panel.rows[0]?.className === 'stage-row is-quiet', JSON.stringify(panel.rows[0]))
  check(
    'needs-input reads "waiting for you", not a failure',
    panel.rows[1]?.text === 'align-take · waiting for you' && panel.rows[1]?.className === 'stage-row is-waiting',
    JSON.stringify(panel.rows[1]),
  )
  check(
    'the named beats ride under the waiting stage',
    panel.rows[2]?.text === 'beat 2: The take skips the second sentence.' && panel.rows[2]?.className.includes('stage-note') && panel.rows[3]?.text === 'beat 4: Cue "queue" has no matching word.',
    JSON.stringify(panel.rows[2]),
  )
  check('a pending stage stays quiet', panel.rows[4]?.text === 'export · pending' && panel.rows[4]?.className === 'stage-row is-quiet', JSON.stringify(panel.rows[4]))

  await evalInWindow(`window.__buildStages('no-such-run')`)
  const empty = await evalInWindow(`(() => ({ hidden: document.getElementById('explainer-stages').hidden, rows: document.getElementById('explainer-stages').children.length }))()`)
  check('an unknown run leaves the panel untouched', empty.hidden === false && empty.rows === 5, `hidden=${empty.hidden} rows=${empty.rows}`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(resolve => setTimeout(resolve, 600))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `STAGE PANEL CHECK FAIL (${failures})` : 'STAGE PANEL CHECK PASS')
process.exitCode = failures ? 1 : 0
