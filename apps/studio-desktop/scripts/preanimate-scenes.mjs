// Pre-animate scenes of the user's real derived notebook so the video
// notebook opens with real motion. Run with the user's app STOPPED (this
// script launches its own instance against the default data dir, drives it,
// and exits; relaunch the app afterwards).
// Usage: node scripts/preanimate-scenes.mjs [blk-scene-05 blk-scene-06 …]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const PROJECT = 'sample-attention-is-all-you-need-video'
const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['blk-scene-05', 'blk-scene-06']
const RUN_TIMEOUT_MS = Number(process.env.ANIMATE_TIMEOUT_MS || 840_000)

const results = []
const record = (name, ok, detail = '') => {
  results.push([name, ok])
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}

const app = spawn(electronBinary, ['.'], {
  cwd: appDir,
  env: {
    ...process.env,
    PATH: `${process.env.HOME}/.kimi-code/bin:${process.env.PATH}`,
    STUDIO_ENABLE_TEST_HOOKS: '1',
    STUDIO_GATE_AUTO_ANSWER: JSON.stringify({
      explain_move: 'the viewer can follow the page step by step in data order',
      pace: 'presenter-led with Next',
      presence: 'no camera',
      stage_default: 'free',
      attention_style: 'technical-trace',
      narration_source: 'notes',
      constraints: 'none',
    }),
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    buffer += chunk.toString()
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})
const stopApp = async () => {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}
const evalInWindow = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  }).then(r => r.json())
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}

const sceneReveals = async () => {
  const { project } = await fetch(`${origin}/api/projects/${PROJECT}`).then(r => r.json())
  const scene = project?.notebook?.content?.find(
    node => node.type === 'scene' && TARGETS.includes(node.attrs?.id),
  )
  return { project, scene }
}

try {
  // Open the derived notebook.
  await evalInWindow(`async () => {
    localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT}')
    location.href = '/studio'
  }`).catch(() => {})
  await waitFor(`() => !!document.getElementById('${TARGETS[0]}')`, 60_000)

  for (const blockId of TARGETS) {
    let ok = false
    for (let attempt = 1; attempt <= 2 && !ok; attempt += 1) {
      try {
        await evalInWindow(`() => document.querySelector('#${blockId} [data-slide-action="edit"]').click()`)
        await waitFor(`() => document.getElementById('slide-editor-dialog').open`, 15_000)
        await evalInWindow(`() => document.getElementById('se-plan-assist').click()`)
        const runs = await waitFor(
          `() => window.studioDesktop.harness.list().then(list => list.length ? list.map(r => r.id).join(',') : null)`,
          60_000,
        )
        if (!runs) throw new Error('run never started')
        const runId = runs.split(',').pop()
        const deadline = Date.now() + RUN_TIMEOUT_MS
        let status = ''
        while (Date.now() < deadline) {
          const list = await evalInWindow(`() => window.studioDesktop.harness.list()`)
          status = list.find(run => run.id === runId)?.status || ''
          if (['done', 'error', 'cancelled'].includes(status)) break
          await sleep(5_000)
        }
        if (status !== 'done') throw new Error(`run status "${status}"`)
        const applied = await waitFor(`() => !document.getElementById('se-assist-apply').hidden`, 60_000)
        if (!applied) throw new Error('no plan offered')
        await evalInWindow(`() => document.getElementById('se-assist-apply').click()`)
        // A second click confirms if the validator found errors.
        await sleep(800)
        await evalInWindow(`() => { const b = document.getElementById('se-assist-apply'); if (!b.hidden) b.click() }`)
        await sleep(800)
        await evalInWindow(`() => document.getElementById('se-save').click()`)
        await sleep(2_000)
        await evalInWindow(`() => document.getElementById('close-slide-editor').click()`)
        await sleep(500)
        const { scene } = await sceneReveals()
        const count = (scene?.attrs?.steps || []).reduce((n, s) => n + (s.reveals || []).length, 0)
        if (!count) throw new Error('saved steps have no reveals')
        record(`${blockId} animated (attempt ${attempt})`, true, `${count} reveals across ${(scene.attrs.steps || []).length} beats`)
        ok = true
      } catch (error) {
        console.log(`  …${blockId} attempt ${attempt} failed: ${error.message}`)
        await evalInWindow(`() => { const d = document.getElementById('slide-editor-dialog'); if (d.open) d.close() }`).catch(() => {})
      }
    }
    if (!ok) record(`${blockId} animated`, false, 'failed twice — moved on')
  }
} finally {
  await stopApp()
}
const failures = results.filter(([, ok]) => !ok).length
console.log(failures ? `PREANIMATE FAIL (${failures})` : 'PREANIMATE PASS')
process.exit(failures ? 1 : 0)
