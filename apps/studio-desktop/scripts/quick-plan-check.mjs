// Plan Motion Quick check (spec §7 item 5): slide block + narration →
// gateway plan → MCP resolve+validate (0 errors) → then drives the REAL
// step bar in the app window (prev/next/Play/Loop) via the loopback /__eval
// hook and asserts the driver state advances.
// Usage: node scripts/quick-plan-check.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  <rect id="u-norm" x="170" y="90" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-norm-label" x="310" y="132" fill="#f4f4f5" font-size="26" text-anchor="middle">Add &amp; norm</text>
  <line id="u-arrow-1" x1="310" y1="430" x2="310" y2="330" stroke="#4ade80" stroke-width="3"/>
  <line id="u-arrow-2" x1="310" y1="260" x2="310" y2="160" stroke="#4ade80" stroke-width="3"/>
</svg>`
const NARRATION =
  'Tokens come in as input embeddings. Each position looks at every other through multi-head attention. The result is added back and normalised.'
const UNITS = [
  { id: 'u-input', kind: 'box', label: 'Input embedding', x: 170, y: 430, w: 280, h: 70 },
  { id: 'u-attn', kind: 'box', label: 'Multi-head attention', x: 170, y: 260, w: 280, h: 70 },
  { id: 'u-norm', kind: 'box', label: 'Add & norm', x: 170, y: 90, w: 280, h: 70 },
  { id: 'u-arrow-1', kind: 'connector', label: 'arrow 1', x: 310, y: 330, w: 0, h: 100 },
  { id: 'u-arrow-2', kind: 'connector', label: 'arrow 2', x: 310, y: 160, w: 0, h: 100 },
]

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
  if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + (typeof b === 'string' ? b.slice(0, 120) : JSON.stringify(b).slice(0, 160)))
  return b
}

const root = await mkdtemp(join(tmpdir(), 'studio-quick-plan-'))
const dataDir = join(root, 'data')
const id = `quick-plan-${Date.now()}`
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: dataDir, STUDIO_ENABLE_TEST_HOOKS: '1' },
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

// Evaluate JS in the real app window through the loopback test hook.
const evalInWindow = async js => {
  const response = await j(origin, '/__eval', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
  })
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  let last
  while (Date.now() < deadline) {
    last = await evalInWindow(js)
    if (last) return last
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 80)}`)
}
const callTool = async (name, args) => {
  const response = await j(origin, '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const text = response.result?.content?.[0]?.text || ''
  if (response.result?.isError) throw new Error(`${name}: ${text.slice(0, 160)}`)
  return JSON.parse(text)
}

try {
  let stepsPlanned
  await step('slide block + narration → gateway plan (Quick)', async () => {
    const project = {
      version: 1, id, title: 'Quick plan check',
      notebook: { type: 'doc', content: [
        { type: 'slide', attrs: { id: 'blk-slide', title: 'Encoder', svg: SVG, steps: [] } },
      ] },
      fps: 30, width: 1920, height: 1080,
      blocks: { 'blk-slide': { speakerNotes: NARRATION } },
      presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    const planned = await j(origin, '/api/slides/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Encoder', narration: NARRATION, units: UNITS, steps: [] }),
    })
    stepsPlanned = planned.steps || []
    if (stepsPlanned.length < 2) throw new Error('no steps planned')
    // Save the plan into the block (the editor's "Save steps" path).
    project.notebook.content[0].attrs.steps = stepsPlanned
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    return `${stepsPlanned.length} steps via ${planned.provider}`
  })
  await step('MCP resolve + validate → 0 errors', async () => {
    const svgPath = join(root, 'page.svg')
    await writeFile(svgPath, SVG)
    const atomized = await callTool('atomize', { svgPath, projectDir: root })
    const resolved = await callTool('resolve', {
      brief: { steps: stepsPlanned },
      geometry: atomized.file,
      projectDir: root,
    })
    const report = await callTool('validate', {
      resolved: resolved.file, geometry: atomized.file, stage: 'final', quick: true, projectDir: root,
    })
    if (report.errors.length) throw new Error(`${report.errors.length} errors: ${report.errors[0].message}`)
    return `${report.warnings.length} warnings, gateSignal ${JSON.stringify(report.gateSignal)}`
  })

  // ——— drive the real step bar in the app window ———
  await step('studio surface shows the planned notebook', async () => {
    // The app boots on the theme-library surface unless the path is /studio,
    // and it restores the localStorage active project id — point it at the
    // API-created notebook first (the studio does the same on save).
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.querySelector('#editor .ProseMirror, #editor [contenteditable="true"]')`)
    const hasSlide = await waitFor(`!!document.getElementById('blk-slide')`)
    return hasSlide ? 'slide block in the editor' : ''
  })
  await step('step bar appears with the driver registered', async () => {
    await evalInWindow(`document.getElementById('blk-slide').click()`)
    const state = await waitFor(`(() => {
      const bar = document.getElementById('explainer-step-bar')
      const label = document.getElementById('ex-canvas-step-label')
      const player = document.querySelector('#player')
      const drivers = player && player.iframeElement && player.iframeElement.contentWindow
        ? player.iframeElement.contentWindow.__explainerDrivers : null
      const driver = drivers ? drivers['blk-slide'] : null
      return bar && !bar.hidden && driver
        ? { label: label.textContent, stepCount: driver.stepCount } : null
    })()`)
    if (state.stepCount !== stepsPlanned.length) throw new Error(`driver has ${state.stepCount} steps`)
    return `label "${state.label}", driver.stepCount ${state.stepCount}`
  })
  const labelNow = `document.getElementById('ex-canvas-step-label').textContent`
  await step('Next steps through the driver', async () => {
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const second = await evalInWindow(labelNow)
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const third = await evalInWindow(labelNow)
    await evalInWindow(`document.getElementById('ex-canvas-prev').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const back = await evalInWindow(labelNow)
    if (second !== `2/${stepsPlanned.length}` || third !== `3/${stepsPlanned.length}` || back !== `2/${stepsPlanned.length}`) {
      throw new Error(`labels ${second} → ${third} → ${back}`)
    }
    return `${second} → ${third} → (prev) ${back}`
  })
  await step('step visibility follows the driver', async () => {
    // Read the driver's opacity writes on a unit element in the composition
    // (compiled slide ids carry the scene prefix: s<sceneIndex>-<id>).
    const read = async unit => evalInWindow(`(() => {
      const win = document.querySelector('#player').iframeElement.contentWindow
      const el = win.document.getElementById('s0-${unit}') || win.document.getElementById('${unit}')
      if (!el) return null
      return Number(win.getComputedStyle(el).opacity)
    })()`)
    await evalInWindow(`document.getElementById('ex-canvas-restart').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const before = await read('u-norm')
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 1_200))
    const after = await read('u-norm')
    if (before === null || after === null) throw new Error('unit element not found in the composition')
    if (!(before < 0.5 && after > 0.5)) throw new Error(`u-norm opacity ${before} → ${after}`)
    return `u-norm opacity ${before} → ${after} after stepping to its beat`
  })
  await step('Play advances and stops', async () => {
    await evalInWindow(`document.getElementById('ex-canvas-restart').click()`)
    await new Promise(resolve => setTimeout(resolve, 500))
    await evalInWindow(`document.getElementById('ex-canvas-play').click()`)
    await new Promise(resolve => setTimeout(resolve, 3_500))
    const playing = await evalInWindow(`document.getElementById('ex-canvas-play').classList.contains('is-playing')`)
    const duringLabel = await evalInWindow(labelNow)
    await evalInWindow(`document.getElementById('ex-canvas-play').click()`)
    const stopped = await evalInWindow(`!document.getElementById('ex-canvas-play').classList.contains('is-playing')`)
    if (!playing || !stopped) throw new Error(`playing=${playing} stopped=${stopped}`)
    if (duringLabel === `1/${stepsPlanned.length}`) throw new Error('play never advanced')
    return `is-playing during play, advanced to ${duringLabel}, stopped cleanly`
  })
  await step('Loop wraps to the first step', async () => {
    // Jump to the last step, enable loop, play: after the last hold it wraps.
    await evalInWindow(`document.getElementById('ex-canvas-restart').click()`)
    for (let i = 0; i < stepsPlanned.length - 1; i += 1) {
      await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
      await new Promise(resolve => setTimeout(resolve, 350))
    }
    await evalInWindow(`document.getElementById('ex-canvas-loop').click()`)
    await evalInWindow(`document.getElementById('ex-canvas-play').click()`)
    const deadline = Date.now() + 25_000
    let wrapped = ''
    while (Date.now() < deadline) {
      const label = await evalInWindow(labelNow)
      if (label === `1/${stepsPlanned.length}`) { wrapped = label; break }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    await evalInWindow(`document.getElementById('ex-canvas-play').click()`)
    await evalInWindow(`document.getElementById('ex-canvas-loop').click()`)
    if (!wrapped) throw new Error('never wrapped to 1')
    return `wrapped to ${wrapped}`
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
  console.log(failures ? `QUICK PLAN FAIL (${failures})` : 'QUICK PLAN PASS')
  await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
