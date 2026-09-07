// Scene animation e2e — THE AGENT PATH (real Kimi run, takes 10–20 min).
// Kept for when the assist/agent route is exercised again; the default
// scene animation path is the deterministic local planner (local-plan.ts,
// verified by scripts/local-plan-check.mjs — no agent needed).
// Usage: node scripts/scene-animate-check.mjs  (SCENE_ANIMATE_TIMEOUT_MS, KEEP)
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const TIMEOUT_MS = Number(process.env.SCENE_ANIMATE_TIMEOUT_MS || 840_000)

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 260)])
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

const root = await mkdtemp(join(tmpdir(), 'studio-scene-animate-'))
const dataDir = join(root, 'data')
const id = `scene-animate-${Date.now()}`
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    PATH: `${process.env.HOME}/.kimi-code/bin:${process.env.PATH}`,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: dataDir,
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_ENABLE_TEST_HOOKS: '1',
    STUDIO_GATE_AUTO_ANSWER: JSON.stringify({
      explain_move: 'follow the dot-product attention computation left to right',
      pace: 'presenter-led with Next',
      presence: 'no camera',
      stage_default: 'free',
      attention_style: 'technical-trace',
      narration_source: 'literal script',
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
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
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

const BLOCK_ID = 'blk-scene-test'
try {
  await step('scratch notebook with one scene block (real sample page)', async () => {
    const [svg, manifest] = await Promise.all([
      fetch(`${origin}/samples/attention-is-all-you-need/06_scaled_dot_product.svg`).then(r => {
        if (!r.ok) throw new Error(`svg ${r.status}`)
        return r.text()
      }),
      fetch(`${origin}/samples/attention-is-all-you-need/video.json`).then(r => r.json()),
    ])
    const scene6 = manifest.scenes.find(scene => scene.page === '06_scaled_dot_product.svg')
    if (!scene6) throw new Error('scene 6 not in video.json')
    const steps = scene6.steps.map(s => ({ title: s.title, explanation: s.explanation, reveals: [], verb: 'reveal' }))
    const project = {
      version: 1, id, title: 'Scene animate check',
      notebook: { type: 'doc', content: [
        { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Scene motion' }] },
        { type: 'scene', attrs: {
          id: BLOCK_ID, title: scene6.title, svg,
          svgSrc: `/samples/attention-is-all-you-need/${scene6.page}`,
          derivedFrom: 'sample-attention-is-all-you-need', structureApproved: true,
          arcRole: scene6.arcRole || 'explain', directorNotes: scene6.director || '',
          storyboard: scene6.storyboard || [], cues: scene6.cues || [], steps,
        } },
      ] },
      fps: 30, width: 1920, height: 1080,
      blocks: { [BLOCK_ID]: { speakerNotes: steps.map(s => s.explanation).join(' ') } },
      presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.getElementById('${BLOCK_ID}')`)
    const card = await evalInWindow(`(() => {
      const card = document.getElementById('${BLOCK_ID}')
      return {
        hasAnimate: !!card.querySelector('[data-slide-action="animate"]'),
        caption: card.querySelector('figcaption').textContent,
      }
    })()`)
    if (!card.hasAnimate) throw new Error('scene card has no Animate button')
    if (!card.caption.includes('not animated')) throw new Error(card.caption)
    return `scene card shows "Animate" + not-animated note (${scene6.steps.length} beats)`
  })
  let runId = ''
  await step('Plan motion (assist) on the scene — real run to done', async () => {
    await evalInWindow(`document.querySelector('#${BLOCK_ID} [data-slide-action="edit"]').click()`)
    await waitFor(`document.getElementById('slide-editor-dialog').open`)
    await evalInWindow(`document.getElementById('se-plan-assist').click()`)
    const runs = await waitFor(`window.studioDesktop.harness.list().then(list => list.length ? list : null)`, 60_000)
    runId = runs[0].id
    const deadline = Date.now() + TIMEOUT_MS
    let status = ''
    while (Date.now() < deadline) {
      const current = await evalInWindow(`window.studioDesktop.harness.list()`)
      status = current.find(run => run.id === runId)?.status || ''
      if (['done', 'error', 'cancelled'].includes(status)) break
      await new Promise(resolve => setTimeout(resolve, 5_000))
    }
    if (status !== 'done') throw new Error(`run status "${status}"`)
    return `run ${runId} done`
  })
  await step('apply the plan + save', async () => {
    await waitFor(`!document.getElementById('se-assist-apply').hidden`, 60_000)
    const label = await evalInWindow(`document.getElementById('se-assist-apply').textContent`)
    if (/error/i.test(label)) throw new Error(`plan has validation errors: ${label}`)
    await evalInWindow(`document.getElementById('se-assist-apply').click()`)
    await waitFor(`document.getElementById('se-status').textContent.includes('Plan applied')`, 15_000)
    await evalInWindow(`document.getElementById('se-save').click()`)
    await new Promise(resolve => setTimeout(resolve, 2_000))
    return label
  })
  let stepCount = 0
  await step('saved scene steps have real reveals', async () => {
    const { project } = await j(origin, '/api/projects/' + id)
    const scene = project.notebook.content.find(node => node.type === 'scene')
    const steps = scene?.attrs.steps || []
    if (!steps.length) throw new Error('no steps saved')
    const flat = steps.flatMap(s => s.reveals || [])
    if (!flat.length) throw new Error('all reveals empty')
    const svg = String(scene.attrs.svg)
    const missing = flat.filter(reveal => !svg.includes(`id="${reveal}"`))
    if (missing.length) throw new Error(`reveals not in the svg: ${missing.slice(0, 4)}`)
    stepCount = steps.length
    return `${steps.length} beats, ${flat.length} unit references, all real ids`
  })
  await step('compiled driver registers the scene and stepping paints', async () => {
    await evalInWindow(`document.getElementById('close-slide-editor').click()`)
    // The save recompiles the preview asynchronously; re-click the block
    // while polling for the step bar + driver.
    const probe = `(() => {
      const bar = document.getElementById('explainer-step-bar')
      const player = document.querySelector('#player')
      const drivers = player && player.iframeElement && player.iframeElement.contentWindow
        ? player.iframeElement.contentWindow.__explainerDrivers : null
      const driver = drivers ? drivers['${BLOCK_ID}'] : null
      return bar && !bar.hidden && driver ? { label: document.getElementById('ex-canvas-step-label').textContent, stepCount: driver.stepCount } : null
    })()`
    let state = null
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      state = await evalInWindow(probe).catch(() => null)
      if (state) break
      await evalInWindow(`document.getElementById('${BLOCK_ID}') && document.getElementById('${BLOCK_ID}').click()`).catch(() => null)
      await new Promise(resolve => setTimeout(resolve, 1_000))
    }
    if (!state) {
      const diag = await evalInWindow(`(() => {
        const bar = document.getElementById('explainer-step-bar')
        const player = document.querySelector('#player')
        const win = player && player.iframeElement ? player.iframeElement.contentWindow : null
        return {
          barExists: !!bar, barHidden: bar && bar.hidden,
          hasIframe: !!(player && player.iframeElement),
          drivers: win ? Object.keys(win.__explainerDrivers || {}) : null,
          slideSvg: win ? !!win.document.querySelector('.slide-svg') : null,
          selectedFigure: !!document.querySelector('#editor .selected-block'),
          sceneFigure: !!document.getElementById('${BLOCK_ID}'),
        }
      })()`).catch(error => ({ error: String(error) }))
      throw new Error(`step bar never appeared: ${JSON.stringify(diag)}`)
    }
    if (state.stepCount < 2) throw new Error(`driver.stepCount ${state.stepCount}`)
    if (state.stepCount !== stepCount) throw new Error(`driver ${state.stepCount} vs saved ${stepCount}`)
    const before = await evalInWindow(`(() => {
      const doc = document.querySelector('#player').iframeElement.contentDocument
      return doc.querySelector('.slide-svg').innerHTML.length
    })()`)
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 1_200))
    const label = await evalInWindow(`document.getElementById('ex-canvas-step-label').textContent`)
    const after = await evalInWindow(`(() => {
      const doc = document.querySelector('#player').iframeElement.contentDocument
      return doc.querySelector('.slide-svg').innerHTML.length
    })()`)
    if (!label.startsWith('2/')) throw new Error(`label stuck at ${label}`)
    if (before === after) throw new Error('frame unchanged after stepping')
    return `driver ${state.stepCount} steps · label ${state.label} → ${label} · frame changed (${before}→${after} bytes)`
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
  console.log(failures ? `SCENE ANIMATE FAIL (${failures})` : 'SCENE ANIMATE PASS')
  if (process.env.KEEP) console.log(`kept ${root}`)
  else await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
