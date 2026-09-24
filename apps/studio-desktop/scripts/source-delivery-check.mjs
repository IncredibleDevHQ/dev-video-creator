// Source-delivery check (review finding #9): the delivery path chosen in
// Create explainer belongs to the journey, so a source flow that finishes
// into a new notebook carries the choice with it — reopening and building
// never ask again. Both paths are walked: the chooser records the mode on the
// current notebook, the wizard finishes into a fresh one (a notebook with a
// scene is offered the destination, "Start a new notebook" kept), and the new
// notebook builds without another prompt. Pattern per
// take-workflow-check.mjs (smoke app + /__eval) and build-fork-check.mjs
// (stub kimi on PATH); the local file store keeps the shared database out of
// the fixture, per local-store-check.mjs.
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-delivery-'))
const dataDir = join(root, 'data')
const SCENE_SVG = '<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="40" y="40" width="200" height="120" fill="#4f46e5"/></svg>'

const NARRATIVES = {
  human: '# Queue drains\n\nA drain watches the queue and pulls work out while the rate stays below the limit.\n\nWhen the limit is reached the drain pauses, so the queue never tips the service over.',
  generated: '# Cache windows\n\nA cached answer lives inside its freshness window and is served without another call.\n\nPast the window the next call refreshes the entry, so readers never see a stale answer.',
}

// A stub kimi on PATH: --version answers, a story-master run plans one scene
// per authored sentence (narration verbatim) from the run's own inputs, and
// any other run simply ends. No real agent is ever spawned.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
let inputs = null
try { inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8')) } catch {}
if (inputs && inputs.source && typeof inputs.source.text === 'string') {
  const lines = inputs.source.text.split('\\n').map(line => line.trim()).filter(Boolean)
  const title = (lines.find(line => line.startsWith('#')) || '# Untitled').replace(/^#+\\s*/, '')
  const body = lines.filter(line => !line.startsWith('#')).join(' ')
  const sentences = (body.match(/[^.!?]+[.!?]+/g) || [body]).map(s => s.trim()).filter(Boolean)
  const scenes = sentences.slice(0, 3).map((sentence, index) => ({
    title: title + ' ' + (index + 1),
    idea: sentence,
    kind: 'diagram',
    seconds: 12,
    parts: [{ label: 'Queue', kind: 'box', detail: 'holds work' }, { label: 'Drain', kind: 'box', detail: 'pulls work' }],
    relations: [{ from: 'Queue', to: 'Drain', verb: 'feeds' }],
    narration: sentence,
    source: [sentence],
  }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title, targetSeconds: scenes.length * 12, scenes, glossary: [] }))
  fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: scenes.length }))
  emit({ role: 'assistant', content: 'Planned ' + scenes.length + ' scenes.' })
} else {
  emit({ role: 'assistant', content: 'stub run' })
}
emit({ role: 'meta', type: 'session.resume_hint', session_id: 'stub-session-delivery' })
process.exit(0)
`,
)
await chmod(join(binDir, 'kimi'), 0o755)

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_DATA_DIR: dataDir,
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_PERSISTENCE: 'local',
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
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const projectBody = async id =>
  fetch(`${origin}/api/projects/${encodeURIComponent(id)}`).then(r => r.json()).then(body => body.project || null).catch(() => null)
const buildRuns = async () =>
  fetch(`${origin}/api/runs`).then(r => r.json()).then(body => (body.runs || []).filter(run => run.route === 'Build Explainer')).catch(() => [])

try {
  for (const delivery of ['human', 'generated']) {
    const stamp = `${delivery}-${Date.now().toString(36)}`
    const BASE_ID = `delivery-${stamp}`
    const BASE_TITLE = `Delivery check ${delivery}`
    // A notebook with a scene of its own: the source finish offers the
    // destination, and "Start a new notebook" is the default kept below.
    const fixture = {
      version: 1, id: BASE_ID, title: BASE_TITLE,
      notebook: { type: 'doc', content: [
        { type: 'scene', attrs: { id: `blk-${stamp}`, title: 'Existing scene', svg: SCENE_SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SCENE_SVG)}` } },
      ] },
      fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    }
    await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture) })
    await evaluate(`() => { window.localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(BASE_ID)}); window.localStorage.setItem('studio.codingAgent', 'kimi'); window.location.assign('/studio'); return true }`, `open ${delivery} base`)
    check(`${delivery}: the base notebook opens`, Boolean(await waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(BASE_TITLE)}`, 'base boot')))

    // The journey chooses the delivery path, then walks the source flow.
    await evaluate(`() => { document.getElementById('create-explainer').click(); return true }`, 'open chooser')
    await sleep(300)
    await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="${delivery}"]').click(); return true }`, 'choose path')
    await sleep(200)
    await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'own narrative')
    check(`${delivery}: the source flow opens`, Boolean(await waitFor(`() => document.getElementById('source-dialog')?.open === true`, 'source dialog')))
    await evaluate(`() => { const box = document.getElementById('source-narrative'); box.value = ${JSON.stringify(NARRATIVES[delivery])}; document.getElementById('source-read').click(); return true }`, 'read')
    check(`${delivery}: the narrative is read`, Boolean(await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')))
    await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline')
    check(`${delivery}: the story run plans the outline`, Boolean(await waitFor(`() => !document.getElementById('source-step-outline')?.hidden`, 'outline step', 150)))
    await evaluate(`() => { document.getElementById('source-make-pages').click(); return true }`, 'pages')
    check(`${delivery}: the pages are made`, Boolean(await waitFor(`() => !document.getElementById('source-step-pages')?.hidden`, 'pages step')))
    // Keep the default: Start a new notebook.
    await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish')
    const freshId = await waitFor(`async () => {
      if (document.getElementById('source-dialog')?.open) return null
      const id = window.localStorage.getItem('incredible-studio-v2-active-project')
      if (!id || id === ${JSON.stringify(BASE_ID)}) return null
      const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
      const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
      return scenes.length >= 2 ? id : null
    }`, 'finish', 120)
    check(`${delivery}: the source finishes into a new notebook`, Boolean(freshId), String(freshId))

    const fresh = freshId ? await projectBody(freshId) : null
    check(
      `${delivery}: the new notebook carries the journey's delivery choice`,
      fresh?.explainerDelivery === delivery,
      JSON.stringify(fresh?.explainerDelivery || null),
    )
    const base = await projectBody(BASE_ID)
    check(`${delivery}: the base notebook keeps its own choice too`, base?.explainerDelivery === delivery, JSON.stringify(base?.explainerDelivery || null))

    // Reopen the new notebook and build: no delivery prompt, a run starts.
    await evaluate(`() => { location.reload(); return true }`, 'reopen')
    const reopened = await waitFor(`() => document.getElementById('app') && !document.getElementById('app').hidden && document.querySelector('#editor .ProseMirror') ? window.localStorage.getItem('incredible-studio-v2-active-project') : null`, 'reboot')
    const reopenedBody = reopened ? await projectBody(reopened) : null
    check(`${delivery}: the choice survives the reopen`, reopenedBody?.explainerDelivery === delivery, JSON.stringify(reopenedBody?.explainerDelivery || null))

    const runsBefore = new Set((await buildRuns()).map(run => run.id))
    await evaluate(`() => { document.getElementById('build-explainer').click(); return true }`, 'build')
    // The fork navigates into the video notebook and the build resumes there.
    // A re-asked delivery would instead open the chooser and dispatch nothing.
    let dispatched = null
    let askedAgain = false
    for (let i = 0; i < 90 && !dispatched && !askedAgain; i += 1) {
      askedAgain = await evaluate(`() => document.getElementById('create-explainer-dialog')?.open === true`, 'chooser state').catch(() => false)
      const runs = await buildRuns()
      dispatched = runs.find(run => !runsBefore.has(run.id)) || null
      if (!dispatched && !askedAgain) await sleep(500)
    }
    check(`${delivery}: build starts without asking the delivery path again`, Boolean(dispatched) && !askedAgain, dispatched?.id || (askedAgain ? 'chooser opened' : 'no run'))
    let inputs = null
    if (dispatched?.projectDir) {
      inputs = JSON.parse(await readFile(join(dispatched.projectDir, 'motion', 'inputs.json'), 'utf8').catch(() => 'null'))
    }
    check(`${delivery}: the build runs with the carried delivery mode`, inputs?.delivery?.mode === delivery, JSON.stringify(inputs?.delivery || null))
  }

  // Cleanup: every notebook this run touched (bases, fresh notebooks, video
  // forks) goes; the temp store removes the rest.
  const projects = await fetch(`${origin}/api/projects`).then(r => r.json()).then(body => (Array.isArray(body) ? body : body.projects) || []).catch(() => [])
  for (const entry of projects) {
    await fetch(`${origin}/api/projects/${encodeURIComponent(entry.id)}`, { method: 'DELETE' }).catch(() => {})
  }
  check('cleanup', true, `${projects.length} fixture notebooks deleted`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE DELIVERY CHECK FAIL (${failures})` : 'SOURCE DELIVERY CHECK PASS')
process.exitCode = failures ? 1 : 0
