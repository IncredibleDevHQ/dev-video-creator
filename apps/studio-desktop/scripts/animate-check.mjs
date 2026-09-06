// FULL ANIMATE E2E (the money test): import a real ppt-master SVG page, give
// the block an explanation, approve the page, run Plan motion (assist) with
// the REAL kimi CLI (gates auto-answered), then apply the plan, save it, and
// drive the step bar through the applied steps. Asserts: steps non-empty and
// sanitised, reveals reference real SVG unit ids, validator 0 errors,
// director's brief stored, step bar advances.
// Usage: node scripts/animate-check.mjs   (ANIMATE_TIMEOUT_MS, KEEP_ANIMATE_DIR)
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const SVG_URL =
  'https://hugohe3.github.io/ppt-master-examples/examples/ppt169_attention_is_all_you_need/svg_final/05_architecture.svg'
const NARRATION =
  'Inputs become embeddings with positional encoding and enter the encoder stack. ' +
  'Six identical layers refine them through multi-head attention and feed-forward networks with residual connections. ' +
  'The decoder mirrors the stack, adding masked attention over its own outputs. ' +
  'The output chain turns the final states into next-token probabilities.'

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

const root = await mkdtemp(join(tmpdir(), 'studio-animate-'))
const dataDir = join(root, 'data')
const id = `animate-${Date.now()}`
const TIMEOUT_MS = Number(process.env.ANIMATE_TIMEOUT_MS || 840_000)

let app
const startApp = async () => {
  app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.kimi-code/bin:${process.env.PATH}`,
      STUDIO_DATA_DIR: dataDir,
      STUDIO_ENABLE_TEST_HOOKS: '1',
      STUDIO_GATE_AUTO_ANSWER: JSON.stringify({
        explain_move: 'name the architecture parts in data order',
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
  return new Promise((resolve, reject) => {
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
}
const stopApp = async () => {
  if (!app || app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}

try {
  const origin = await startApp()
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
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error(`waitFor timed out: ${js.slice(0, 80)}`)
  }

  let svgText = ''
  await step('import the real architecture page', async () => {
    const response = await fetch(SVG_URL)
    if (!response.ok) throw new Error(`svg fetch ${response.status}`)
    svgText = await response.text()
    const project = {
      version: 1, id, title: 'Animate check',
      notebook: { type: 'doc', content: [
        { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'The Transformer' }] },
      ] },
      fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.href = '/studio'`)
    await waitFor(`!!document.querySelector('#editor .ProseMirror, #editor [contenteditable="true"]')`)
    const summary = await evalInWindow(`window.importSvgPages([{ name: '05_architecture.svg', text: ${JSON.stringify(svgText)} }])`)
    if (summary.imported.length !== 1) throw new Error(JSON.stringify(summary).slice(0, 120))
    return 'slide block imported'
  })
  await step('explanation on the block + page approved', async () => {
    // The import saves through a debounced database sync — poll for the node.
    let slideNode = null
    let project = null
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      ;({ project } = await j(origin, '/api/projects/' + id))
      slideNode = (project.notebook?.content || []).find(node => node.type === 'slide')
      if (slideNode) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!slideNode) throw new Error('no slide node after 15 s')
    const blockId = slideNode.attrs.id
    project.blocks = { [blockId]: { speakerNotes: NARRATION } }
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    globalThis.__animateBlockId = blockId
    await evalInWindow(`location.href = '/studio'`)
    await waitFor(`!!document.getElementById('${blockId}')`)
    await evalInWindow(`document.querySelector('#${blockId} [data-slide-action="edit"]').click()`)
    await waitFor(`document.getElementById('slide-editor-dialog').open`)
    await evalInWindow(`document.getElementById('se-approve').click()`)
    await waitFor(`document.getElementById('se-approve').textContent.includes('approved')`)
    return `approved ${blockId}`
  })
  const blockId = globalThis.__animateBlockId
  let runId = ''
  await step('Plan motion (assist) — real kimi run to done', async () => {
    await evalInWindow(`document.getElementById('se-plan-assist').click()`)
    const runs = await waitFor(`window.studioDesktop.harness.list().then(list => list.length ? list : null)`, 60_000)
    runId = runs[0].id
    const deadline = Date.now() + TIMEOUT_MS
    let status = ''
    let lastLog = ''
    while (Date.now() < deadline) {
      const current = await evalInWindow(`window.studioDesktop.harness.list()`)
      status = current.find(run => run.id === runId)?.status || ''
      if (status === 'done' || status === 'error' || status === 'cancelled') break
      if (status !== lastLog) { console.log(`  …run ${status}`); lastLog = status }
      await new Promise(resolve => setTimeout(resolve, 5_000))
    }
    if (status !== 'done') throw new Error(`run ended with status "${status}"`)
    return `run ${runId} done`
  })
  let artefacts
  await step('artefacts read back, validator 0 errors', async () => {
    artefacts = await evalInWindow(`window.studioDesktop.harness.artefacts('${runId}')`)
    if (!artefacts?.resolved?.steps?.length) throw new Error('no resolved plan')
    const errors = artefacts.validation?.errors?.length ?? 'n/a'
    if (errors !== 0) throw new Error(`${errors} validation errors: ${JSON.stringify(artefacts.validation?.errors?.[0])}`)
    return `${artefacts.resolved.steps.length} beats, 0 errors, brief ${artefacts.brief ? '✓' : '—'}`
  })
  await step('Apply plan + Save steps', async () => {
    await waitFor(`!document.getElementById('se-assist-apply').hidden`, 60_000)
    const label = await evalInWindow(`document.getElementById('se-assist-apply').textContent`)
    await evalInWindow(`document.getElementById('se-assist-apply').click()`)
    await waitFor(`document.getElementById('se-status').textContent.includes('Plan applied')`, 15_000)
    await evalInWindow(`document.getElementById('se-save').click()`)
    await new Promise(resolve => setTimeout(resolve, 2_500))
    return label
  })
  await step('saved steps: non-empty, sanitised, real unit ids', async () => {
    const { project } = await j(origin, '/api/projects/' + id)
    const slide = project.notebook.content.find(node => node.type === 'slide')
    const steps = slide?.attrs.steps || []
    if (!steps.length) throw new Error('no steps saved')
    if (steps.length > 24) throw new Error(`${steps.length} steps > 24`)
    const svg = String(slide.attrs.svg)
    const missing = []
    const seen = new Set()
    for (const s of steps) {
      if (!s.title) throw new Error('empty step title')
      for (const reveal of s.reveals || []) {
        seen.add(reveal)
        if (!svg.includes(`id="${reveal}"`)) missing.push(reveal)
      }
    }
    if (missing.length) throw new Error(`reveals not in the svg: ${missing.slice(0, 5)}`)
    const verbs = steps.map(s => s.verb).join(',')
    return `${steps.length} steps, ${seen.size} units referenced, verbs: ${verbs}`
  })
  await step('director\'s brief stored on the block', async () => {
    const { project } = await j(origin, '/api/projects/' + id)
    const slide = project.notebook.content.find(node => node.type === 'slide')
    const brief = slide?.attrs.directorBrief
    if (!brief?.layout || !brief.cues?.length) throw new Error('no directorBrief')
    if (brief.stepCount !== (slide.attrs.steps || []).length) throw new Error('stepCount mismatch')
    return `${brief.layout} — ${brief.layoutReason.slice(0, 60)} (${brief.stepCount} cues, ≈${brief.totalSeconds}s)`
  })
  await step('step bar advances through the applied plan', async () => {
    await evalInWindow(`document.getElementById('close-slide-editor').click()`)
    await evalInWindow(`document.getElementById('${blockId}').click()`)
    const state = await waitFor(`(() => {
      const bar = document.getElementById('explainer-step-bar')
      const label = document.getElementById('ex-canvas-step-label')
      const player = document.querySelector('#player')
      const drivers = player && player.iframeElement && player.iframeElement.contentWindow
        ? player.iframeElement.contentWindow.__explainerDrivers : null
      const driver = drivers ? drivers['${blockId}'] : null
      return bar && !bar.hidden && driver ? { label: label.textContent, stepCount: driver.stepCount } : null
    })()`)
    if (state.stepCount < 2) throw new Error(`driver.stepCount ${state.stepCount}`)
    await evalInWindow(`document.getElementById('ex-canvas-next').click()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const advanced = await evalInWindow(`document.getElementById('ex-canvas-step-label').textContent`)
    if (!advanced.startsWith('2/')) throw new Error(`label stuck at ${advanced}`)
    return `driver ${state.stepCount} steps, label ${state.label} → ${advanced}`
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
  console.log(failures ? `ANIMATE CHECK FAIL (${failures})` : 'ANIMATE CHECK PASS')
  if (process.env.KEEP_ANIMATE_DIR) console.log(`kept ${root}`)
  else await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
