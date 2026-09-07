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
  // Per-scene: the card's Animate button re-plans locally (idempotent; writes
  // the atomized svg + steps through the normal persist path).
  const animated = await evalInWindow(`(() => {
    const buttons = [...document.querySelectorAll('#editor figure[data-block-type="scene"] [data-slide-action="animate"]')]
    buttons.forEach(button => button.click())
    return buttons.length
  })()`)
  check('Animate clicked per scene card', animated === 15, `${animated} cards`)
  await sleep(4_000) // fifteen syncProjects land through the debounced save
  const { project } = await fetch(`${origin}/api/projects/${PROJECT}`).then(r => r.json())
  const scenes = project.notebook.content.filter(node => node.type === 'scene')
  const perScene = scenes.map(node => {
    const svg = String(node.attrs.svg || '')
    const flat = (node.attrs.steps || []).flatMap(s => s.reveals || [])
    const missing = flat.filter(reveal => !svg.includes(`id="${reveal}"`))
    return {
      id: node.attrs.id,
      title: node.attrs.title,
      beats: (node.attrs.steps || []).length,
      reveals: flat.length,
      missing: missing.length,
    }
  })
  for (const scene of perScene) {
    check(
      `${scene.id} "${scene.title}"`,
      scene.reveals > 0 && scene.missing === 0,
      `${scene.beats} beats, ${scene.reveals} reveals, ${scene.missing} unresolved`,
    )
  }
  check('all 15 scenes animated with resolving reveals', perScene.every(s => s.reveals > 0 && s.missing === 0))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await stopApp()
}
console.log(failures ? `PREANIMATE LOCAL FAIL (${failures})` : 'PREANIMATE LOCAL PASS')
process.exit(failures ? 1 : 0)
