// Pre-animate the user's derived video notebook via the LOCAL planner:
// launches the app against the default data dir, opens the notebook, clicks
// "Animate all scenes", and verifies every scene's reveals on disk.
// Usage: node scripts/preanimate-local.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const PROJECT = 'sample-attention-is-all-you-need-video'

const app = spawn(electronBinary, ['.'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ENABLE_TEST_HOOKS: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
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
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js }),
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

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
try {
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT}'); location.href = '/studio'`).catch(() => {})
  await waitFor(`!!document.querySelector('#editor .ProseMirror, #editor [contenteditable="true"]')`, 60_000)
  // The notebook menu's Animate-all entry runs the local planner per scene.
  await evalInWindow(`document.getElementById('notebook-menu-toggle').click()`)
  await sleep(700)
  const entry = await evalInWindow(`(() => {
    const entry = document.querySelector('.notebook-menu-animate-all')
    if (!entry) return null
    entry.click()
    return entry.textContent
  })()`)
  check('Animate all scenes entry ran', Boolean(entry), entry ? entry.slice(0, 40) : '')
  await sleep(3_000) // local planning is synchronous per scene; saves are debounced
  const { project } = await fetch(`${origin}/api/projects/${PROJECT}`).then(r => r.json())
  const scenes = project.notebook.content.filter(node => node.type === 'scene')
  const perScene = scenes.map(node => ({
    id: node.attrs.id,
    title: node.attrs.title,
    beats: (node.attrs.steps || []).length,
    reveals: (node.attrs.steps || []).reduce((n, s) => n + (s.reveals || []).length, 0),
  }))
  const animated = perScene.filter(scene => scene.reveals > 0)
  for (const scene of perScene) {
    check(`${scene.id} "${scene.title}"`, scene.reveals > 0, `${scene.beats} beats, ${scene.reveals} reveals`)
  }
  check('all 15 scenes animated', animated.length === 15, `${animated.length}/15`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await stopApp()
}
console.log(failures ? `PREANIMATE LOCAL FAIL (${failures})` : 'PREANIMATE LOCAL PASS')
process.exit(failures ? 1 : 0)
