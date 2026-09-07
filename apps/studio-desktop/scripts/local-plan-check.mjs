// Local motion planner e2e (no agent): a scratch notebook with one scene
// block (real sample page 06 + its video.json beats) gets planned via the
// slide editor's "Animate (local)" button; asserts reveals land on real unit
// ids, persist, and the compiled driver registers and steps. Fast — seconds.
// Usage: node scripts/local-plan-check.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

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

const root = await mkdtemp(join(tmpdir(), 'studio-local-plan-'))
const id = `local-plan-${Date.now()}`
const BLOCK_ID = 'blk-scene-local'
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
    buffer += chunk.toString()
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
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
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 80)}`)
}

try {
  await step('scratch scene block from the real sample page', async () => {
    const [svg, manifest] = await Promise.all([
      fetch(`${origin}/samples/attention-is-all-you-need/06_scaled_dot_product.svg`).then(r => {
        if (!r.ok) throw new Error(`svg ${r.status}`)
        return r.text()
      }),
      fetch(`${origin}/samples/attention-is-all-you-need/video.json`).then(r => r.json()),
    ])
    const scene = manifest.scenes.find(s => s.page === '06_scaled_dot_product.svg')
    const steps = scene.steps.map(s => ({ title: s.title, explanation: s.explanation, reveals: [], verb: 'reveal' }))
    const project = {
      version: 1, id, title: 'Local plan check',
      notebook: { type: 'doc', content: [
        { type: 'scene', attrs: { id: BLOCK_ID, title: scene.title, svg, svgSrc: `/samples/attention-is-all-you-need/${scene.page}`, derivedFrom: 'sample-attention-is-all-you-need', structureApproved: true, arcRole: scene.arcRole || '', directorNotes: scene.director || '', storyboard: scene.storyboard || [], cues: scene.cues || [], steps } },
      ] },
      fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.getElementById('${BLOCK_ID}')`)
    const caption = await evalInWindow(`document.getElementById('${BLOCK_ID}').querySelector('figcaption').textContent`)
    if (!/no dialogue|not planned|not in windows|drafted/.test(caption)) throw new Error(caption)
    return `scene card shows its dialogue state "${caption.split(' · ')[0]}" (${steps.length} beats)`
  })
  await step('Animate (local) assigns real unit reveals', async () => {
    await evalInWindow(`document.querySelector('#${BLOCK_ID} [data-slide-action="edit"]').click()`)
    await waitFor(`document.getElementById('slide-editor-dialog').open`)
    await evalInWindow(`document.getElementById('se-plan-local').click()`)
    const state = await waitFor(`(() => {
      const steps = window.__slideEditor.state().steps
      const flat = steps.flatMap(s => s.reveals)
      return flat.length ? { steps: steps.length, reveals: flat.length, verbs: steps.map(s => s.verb).join(',') } : null
    })()`)
    if (!state.steps) throw new Error('no steps planned')
    return `${state.steps} beats, ${state.reveals} element references (verbs: ${state.verbs})`
  })
  await step('save persists the plan', async () => {
    await evalInWindow(`document.getElementById('se-save').click()`)
    await new Promise(resolve => setTimeout(resolve, 2_000))
    const { project } = await j(origin, '/api/projects/' + id)
    const scene = project.notebook.content.find(node => node.type === 'scene')
    const steps = scene?.attrs.steps || []
    const flat = steps.flatMap(s => s.reveals || [])
    if (!flat.length) throw new Error('no reveals saved')
    const svg = String(scene.attrs.svg)
    const missing = flat.filter(reveal => !svg.includes(`id="${reveal}"`))
    if (missing.length) throw new Error(`unknown reveals: ${missing.slice(0, 4)}`)
    return `${steps.length} beats saved, all reveals real`
  })
  await step('every reveal resolves in the compiled scene HTML (s0- prefix)', async () => {
    const { project } = await j(origin, '/api/projects/' + id)
    const scene = project.notebook.content.find(node => node.type === 'scene')
    const flat = (scene?.attrs.steps || []).flatMap(s => s.reveals || [])
    // The compiled page lives in the player iframe; the driver prefixes every
    // authored id with s<sceneIndex>- (this block is scene index 0).
    const missing = await evalInWindow(`(() => {
      const doc = document.querySelector('#player').iframeElement.contentDocument
      return ${JSON.stringify(flat)}.filter(id => !doc.getElementById('s0-' + id))
    })()`)
    if (missing.length) throw new Error(`unresolved in compiled scene: ${missing.slice(0, 4)}`)
    return `${flat.length} reveals resolve in the compiled scene`
  })
  await step('driver registers and the step bar advances', async () => {
    await evalInWindow(`document.getElementById('close-slide-editor').click()`)
    const probe = `(() => {
      const bar = document.getElementById('explainer-step-bar')
      const player = document.querySelector('#player')
      const drivers = player && player.iframeElement && player.iframeElement.contentWindow
        ? player.iframeElement.contentWindow.__explainerDrivers : null
      const driver = drivers ? drivers['${BLOCK_ID}'] : null
      return bar && !bar.hidden && driver ? driver.stepCount : null
    })()`
    const deadline = Date.now() + 60_000
    let stepCount = null
    while (Date.now() < deadline) {
      stepCount = await evalInWindow(probe).catch(() => null)
      if (stepCount) break
      await evalInWindow(`document.getElementById('${BLOCK_ID}').click()`).catch(() => null)
      await new Promise(resolve => setTimeout(resolve, 1_000))
    }
    if (!stepCount || stepCount < 2) throw new Error(`stepCount ${stepCount}`)
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const label = await evalInWindow(`document.getElementById('ex-canvas-step-label').textContent`)
    if (!label.startsWith('2/')) throw new Error(`label stuck at ${label}`)
    return `${stepCount} step windows, label → ${label}`
  })
  await step('setStep repaints the DOM (last-beat unit fades in)', async () => {
    const { project } = await j(origin, '/api/projects/' + id)
    const scene = project.notebook.content.find(node => node.type === 'scene')
    const steps = scene?.attrs.steps || []
    const lastWithReveals = [...steps].reverse().find(s => (s.reveals || []).length)
    const lastReveal = lastWithReveals?.reveals[0]
    if (!lastReveal) throw new Error('no reveal in any beat')
    const diff = await evalInWindow(`(() => {
      const win = document.querySelector('#player').iframeElement.contentWindow
      const driver = win.__explainerDrivers['${BLOCK_ID}']
      const el = win.document.getElementById('s0-${lastReveal}')
      if (!el) return { missing: true }
      driver.setStep(0, 0)
      const atZero = win.getComputedStyle(el).opacity
      driver.setStep(driver.stepCount - 1, 1)
      const atEnd = win.getComputedStyle(el).opacity
      return { atZero, atEnd }
    })()`)
    if (diff.missing) throw new Error(`s0-${lastReveal} missing from the compiled scene`)
    if (diff.atZero === diff.atEnd) throw new Error(`opacity unchanged: ${diff.atZero}`)
    return `#s0-${lastReveal} opacity ${diff.atZero} → ${diff.atEnd}`
  })
  await step('cleanup', async () => {
    await j(origin, '/api/projects/' + id, { method: 'DELETE' })
    return 'scratch notebook deleted'
  })
} finally {
  await stopApp()
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  const failures = results.filter(result => result[1] === 'FAIL').length
  console.log(failures ? `LOCAL PLAN CHECK FAIL (${failures})` : 'LOCAL PLAN CHECK PASS')
  await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
