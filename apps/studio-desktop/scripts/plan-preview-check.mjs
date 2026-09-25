// Plan preview (P3) — an engineering fixture: the harness is a stub, so this
// proves the machinery, never a sketch's quality.
//
// From the notebook's scene review, Preview plan starts a "Sketch Scene" run
// on the creator's planning harness. The stub writes a small Hyperframes
// composition that reuses the page's twenty-slot pool from the visual cast,
// with a presenter stand-in; its first submission leaves out what the pinned
// engine's lint requires and is refused, the second is accepted. The Studio
// stage then plays the sketch through its Hyperframes player, seeks from the
// read-only timeline the manifest declares, labels everything provisional —
// and nothing is approved, recorded or produced by it. Revising the plan
// leaves the preview readable but out of date.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const fixtures = fileURLToPath(new URL('../../studio-v2/server/fixtures/visual-cast/', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-plan-preview-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-review', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-review', result: 'stub done' }); process.exit(code) }
const mcp = JSON.parse(fs.readFileSync(flag('--mcp-config'), 'utf8')).mcpServers.studio
const origin = mcp.env.STUDIO_MCP_URL.replace(/\/mcp.*$/, '')
const shim = spawn(mcp.command, mcp.args, { env: { ...process.env, ...mcp.env }, stdio: ['pipe', 'pipe', 'inherit'] })
let buffer = ''
const waiting = new Map()
shim.stdout.on('data', chunk => {
  buffer += chunk.toString()
  let at
  while ((at = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, at); buffer = buffer.slice(at + 1)
    if (!line.trim()) continue
    const message = JSON.parse(line)
    waiting.get(message.id)?.(message); waiting.delete(message.id)
  }
})
let next = 1
const rpc = (method, params) => new Promise(resolve => { const id = next++; waiting.set(id, resolve); shim.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n') })
const tool = async (name, args2) => {
  const answer = await rpc('tools/call', { name, arguments: args2 })
  if (answer.error) return { error: answer.error.message }
  const text = answer.result.content[0].text
  return answer.result.isError ? { error: text } : JSON.parse(text)
}
;(async () => {
  const projectDir = process.cwd()
  await rpc('initialize', { protocolVersion: '2024-11-05' })
  const inputs = JSON.parse(fs.readFileSync('motion/inputs.json', 'utf8'))
  const context = JSON.parse(fs.readFileSync('packet/CONTEXT.json', 'utf8'))
  fs.mkdirSync('planning', { recursive: true })
  if (inputs.planning.route === 'Prepare Brief') {
    const source = fs.readFileSync('packet/SOURCE.md', 'utf8')
    const paragraphs = source.split(/\n\n/).filter(p => /^¶\d+  /.test(p)).map(p => p.replace(/^¶\d+  /, ''))
    const quote = paragraphs[0].split(/(?<=[.!?])\s/)[0]
    const pages = context.basePages
    fs.writeFileSync('planning/brief.json', JSON.stringify({
      schemaVersion: 1,
      purpose: { deliverable: 'Narrated technical explainer', audience: 'Developers', message: 'Limiters keep an API alive under load.', language: 'en', requestedSeconds: context.requestedSeconds, styleConstraints: [] },
      source: { revisionRef: context.sourceRevision, narrativeRef: context.narrativeRevision, wordingPolicy: context.wordingPolicy, coverage: 'full', limitations: [] },
      evidence: [{ id: 'ev-1', kind: 'source', text: quote, locator: '¶1' }],
      entities: [{ id: 'limiter', name: 'Limiter', role: 'Decides which requests go through', interactions: [], evidenceRefs: ['ev-1'], legacyObjectIds: [] }],
      units: pages.map((page, index) => ({ id: 'u' + (index + 1), question: 'What does ' + page.title + ' do?', explain: 'It limits requests.', evidenceRefs: ['ev-1'], entities: ['limiter'], conditions: [], demonstration: null, observations: [], communicationNeeds: [{ need: 'See ' + page.title + ' work', why: 'It is the point', basis: 'suggestion' }], preserve: [], originScenes: [page.scene], dependsOn: [] })),
      progression: pages.map((page, index) => ({ unit: 'u' + (index + 1), note: page.title, ordering: 'editorial' })),
      narrative: { approvedLines: [], terminology: [], omissions: [] },
      material: { themeRef: context.themeRef, baseNotebookRef: context.baseNotebook, baseRevision: context.baseRevision, assetRefs: [], takeRefs: [] },
      delivery: { sceneDecisions: context.sceneDecisions, unresolved: 'Per scene.' },
      creativeGuidance: [], openDecisions: ['Everything creative'], uncertainty: [],
      route: { workflow: 'general-video', reason: 'Narrated explainer' },
      coverage: pages.map((page, index) => ({ scene: page.scene, units: ['u' + (index + 1)] })),
    }))
    const answer = await tool('plan_submit_brief', { projectDir })
    if (!answer.accepted) process.stderr.write('stub brief refused: ' + JSON.stringify(answer) + '\n')
  } else if (inputs.planning.route === 'Sketch Scene') {
    const path = require('node:path')
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
    const pool = (cast.entries || []).find(entry => entry.object === 'slot-pool')
    fs.mkdirSync('sketch/assets', { recursive: true })
    if (pool) fs.copyFileSync(path.join('packet', pool.files.svg), 'sketch/assets/pool.svg')
    const id = context.composition.id
    const per = 4
    const moments = plan.plan.moments.map((moment, index) => ({ id: moment.id, title: moment.title, start: index * per, end: (index + 1) * per, estimated: true }))
    const duration = moments.length * per
    const clip = (moment, body) => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + (moment.end - moment.start) + '" data-track-index="0">' + body + '</div>'
    const html = (registry) => '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#0e0c17}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#0e0c17;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}' +
      '.title{position:absolute;left:120px;top:90px;color:#fff;font-size:60px;font-weight:600}.stand-in{position:absolute;right:120px;top:260px;width:420px;height:560px;border:4px dashed #f472b6;border-radius:24px;color:#f472b6;font-size:32px;display:flex;align-items:center;justify-content:center}' +
      '.pool{position:absolute;left:520px;top:300px;width:880px}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      moments.map((moment, index) => clip(moment, '<div class="title">' + moment.title + '</div>' + (index === 0 ? '<div class="stand-in">Presenter stand-in</div>' : '') + (index === 1 ? '<img class="pool" src="assets/pool.svg" alt="The page\'s twenty-slot pool">' : ''))).join('') +
      '</div><script>' + (registry ? 'window.__timelines = window.__timelines || {}\n' : '') +
      'const tl = gsap.timeline({ paused: true })\n' +
      moments.map((moment, index) => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, " + moment.start + ")").join('\n') + '\n' +
      (moments[1] ? "tl.fromTo('#" + moments[1].id + " .pool', { scale: 1 }, { scale: 1.25, duration: 3 }, " + moments[1].start + ")\n" : '') +
      'window.__timelines["' + id + '"] = tl</script></body></html>'
    const manifest = {
      version: 1, scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' },
      moments,
      layers: [
        { id: 'titles', kind: 'text', label: 'Moment titles', moments: moments.map(moment => moment.id) },
        ...(pool && moments[1] ? [{ id: 'pool', kind: 'object', label: 'Twenty-slot pool', moments: [moments[1].id], asset: { libraryKey: pool.libraryKey, path: 'assets/pool.svg' } }, { id: 'camera', kind: 'camera', label: 'Push in on the pool', moments: [moments[1].id] }] : []),
        { id: 'presenter', kind: 'presenter', label: 'Presenter', moments: [moments[0].id], placeholder: 'Presenter stand-in: no take recorded' },
      ],
      provisional: ['Timing is estimated from the plan — no voice or take yet', 'Presenter stand-in: no take recorded'],
    }
    fs.writeFileSync('sketch/manifest.json', JSON.stringify(manifest, null, 2))
    // First attempt: without the registry the pinned lint requires.
    fs.writeFileSync('sketch/index.html', html(false))
    const first = await tool('plan_submit_sketch', { projectDir })
    fs.writeFileSync('planning/sketch-first.json', JSON.stringify(first))
    fs.writeFileSync('sketch/index.html', html(true))
    const answer = await tool('plan_submit_sketch', { projectDir })
    if (!answer.accepted) process.stderr.write('stub sketch refused: ' + JSON.stringify(answer) + '\n')
  } else {
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
    const scene = fs.readFileSync('packet/SCENE.md', 'utf8')
    const pushIn = /push in/i.test(scene)
    const things = (cast.entries || []).filter(entry => entry.libraryKey && entry.verification.status === 'verified').slice(0, 2)
    const objects = things.map((entry, index) => ({ entity: 'thing-' + (index + 1), role: entry.label, appearance: 'The page\'s own ' + entry.label, performance: 'It does its job in view', asset: { status: 'reuse', ref: entry.libraryKey, reason: 'The page already draws it with its parts' } }))
    const actors = objects.map(object => object.entity)
    const moment = (id, title, visibility, extra = {}) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: actors.length ? { change: title, actors: id === 'm2' ? actors.slice(0, 1) : actors } : null, text: null, presenter: { visibility, reason: 'Suggested' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 4, ...extra })
    const moments = [
      moment('m1', 'Set the scene', 'full'),
      moment('m2', 'The limit bites', 'hidden', pushIn ? { camera: { treatment: 'push in', subject: 'the limit', reason: 'The creator asked for it' } } : {}),
      moment('m3', 'Back to the viewer', 'shared'),
    ]
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show the thing, then the limit biting.', demonstration: null, ledger: null,
      moments, objects, treatments: { presenter: 'Opens and closes on camera', text: 'None', camera: pushIn ? 'Pushes in on the limit' : 'Holds' },
      skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
      requirements: { assets: [], takes: [], decisions: [] },
      continuity: { entry: 'The page in view', exit: 'The limit holding', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
      coverage: units.flatMap(unit => brief.units.find(entry => entry.id === unit).communicationNeeds.map(need => ({ unit, need: need.need, moments: ['m1'] }))),
      rosterProposal: null, delivery: { voice: context.delivery || 'undecided', note: '' },
    }))
    const answer = await tool('plan_submit_treatment', { projectDir })
    if (!answer.accepted) process.stderr.write('stub plan refused: ' + JSON.stringify(answer) + '\n')
  }
  shim.kill()
  finish(0)
})().catch(error => { console.error(error); finish(1) })
`
const stubPath = join(binDir, 'claude')
await writeFile(stubPath, stub)
await chmod(stubPath, 0o755)

// ——— The app, relaunched on the same data to prove what survives ———
let child
let origin
const launch = async () => {
  child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_CLAUDE_BIN: stubPath },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  origin = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the app did not start')), 120_000)
    child.stdout.on('data', chunk => {
      text += chunk.toString()
      const match = /STUDIO_ORIGIN (\S+)/.exec(text)
      if (match && /SMOKE PASS/.test(text)) { clearTimeout(timer); resolve(match[1]) }
    })
  })
}
const quit = async () => {
  if (!child) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))])
  child = null
}
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const evaluate = async js => {
  const { body } = await post('/__eval', { js: `(${js})()` })
  if (!body?.ok) throw new Error(body?.error || 'eval failed')
  return body.result
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (js, seconds = 60) => {
  for (let i = 0; i < seconds * 2; i++) {
    const value = await evaluate(js).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const until = async (test, seconds = 90) => {
  for (let i = 0; i < seconds * 2; i++) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const shot = async name => {
  if (!process.env.PLAN_PREVIEW_SHOTS) return
  // The selected scene at the top of the notebook, its review below it.
  await evaluate(`() => { const node = document.querySelector('#editor .tiptap > .selected-block'); if (node) node.scrollIntoView({ block: 'start' }); return true }`).catch(() => {})
  await sleep(900)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.PLAN_PREVIEW_SHOTS, { recursive: true })
  await writeFile(join(process.env.PLAN_PREVIEW_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)
const reviewOf = index => evaluate(`() => {
  const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]
  const review = document.querySelector('.scene-review[data-review-scene="' + node.id + '"]')
  if (!review) return null
  return {
    expanded: review.classList.contains('is-expanded'),
    strip: [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent),
    thumbs: review.querySelectorAll('.review-strip-cast img').length,
    panel: Boolean(review.querySelector('.review-panel')),
    question: review.querySelector('.review-question')?.textContent || '',
    cast: [...review.querySelectorAll('.review-cast-item')].map(item => ({ entity: item.querySelector('strong')?.textContent, image: Boolean(item.querySelector('img')) })),
    moments: [...review.querySelectorAll('.review-moment-head strong')].map(entry => entry.textContent),
    approve: review.querySelector('[data-focus^="approve:"]')?.textContent || '',
    approveDisabled: review.querySelector('[data-focus^="approve:"]')?.disabled,
  }
}`)

try {
  await launch()
  // ——— A rich base, its video, a brief and one approved scene plan ———
  const narrative = 'Rate limiters keep an API alive under load. The concurrency limiter lets only twenty requests run at once.\n\nA token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `preview-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-preview', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [await page('b06', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'The concurrency limiter lets only twenty requests run at once.')] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the rich base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `preview-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens')
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  check(Boolean(await until(async () => (await overview(videoId)).brief.current, 90)), 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await selectScene(0)
  await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]:not([disabled])') ? true : null`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const plan = await until(async () => (await overview(videoId)).scenes[0].view.current, 90)
  check(plan?.status === 'candidate', 'the scene is planned from the notebook')
  await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]:not([disabled])') ? true : null`, 30)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]').click(); return true }`)
  check(Boolean(await until(async () => (await overview(videoId)).scenes[0].view.reviewed, 30)), 'the plan is approved')
  const runsBefore = (await api('/api/runs')).body.runs.map(run => run.id)

  // ——— Preview plan: a Sketch Scene run, checked by the pinned engine ———
  await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-focus^="preview:"]:not([disabled])') ? true : null`, 30)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="preview:"]').click(); return true }`)
  const ready = await until(async () => { const preview = (await overview(videoId)).scenes[0].preview; return preview?.ready ? preview : null }, 120)
  check(Boolean(ready?.ready?.current) && ready.ready.of.record === plan.id, `Preview plan makes a preview of this very plan (${JSON.stringify(ready?.ready?.of)})`)
  const sketchRun = (await api('/api/runs')).body.runs.find(run => run.route === 'Sketch Scene')
  check(sketchRun?.skill === 'video-planner' && sketchRun.status === 'done', `it ran as a Sketch Scene run on the planning skill (${sketchRun?.skill} ${sketchRun?.status})`)
  const first = JSON.parse(await readFile(join(sketchRun.projectDir, 'planning', 'sketch-first.json'), 'utf8'))
  check(first.accepted === false && first.problems.some(problem => /hyperframes lint timeline_registry_missing_init/.test(problem)), `the pinned engine's lint refused the first attempt, and the run repaired it (${first.problems?.[0]})`)
  check(ready.ready.summary.moments.length === 3 && ready.ready.summary.provisional.some(item => /stand-in/.test(item)), `the manifest declares every moment and what is provisional (${JSON.stringify(ready.ready.summary.provisional)})`)
  const served = await fetch(origin + ready.ready.url).then(async response => ({ status: response.status, type: response.headers.get('content-type'), html: await response.text() }))
  check(served.status === 200 && /text\/html/.test(served.type) && served.html.includes('assets/pool.svg'), 'the accepted sketch is served for the player')
  const poolSvg = await fetch(origin + ready.ready.url.replace('index.html', 'assets/pool.svg')).then(response => response.text())
  check(/data-part="slots"/.test(poolSvg), 'the sketch reuses the page\'s twenty-slot pool from the visual cast')

  // ——— The stage plays it; the timeline seeks it ———
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const shown = await waitFor(`() => { const button = document.querySelector('.scene-review.is-expanded [data-focus^="show-preview:"]'); if (!button) return null; button.click(); return true }`, 60)
  check(Boolean(shown), 'the review offers the preview on the stage')
  const stage = await waitFor(`() => {
    const player = document.querySelector('#scene-stage-preview hyperframes-player')
    if (!player || document.getElementById('scene-stage-preview').hidden) return null
    return { src: player.getAttribute('src'), mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, note: document.getElementById('scene-stage-note').textContent, moments: [...document.querySelectorAll('.scene-stage-moment')].map(button => button.textContent) }
  }`, 30)
  check(stage?.src === ready.ready.url && stage.mode === 'Plan preview', `the stage plays the sketch through the Hyperframes player (${JSON.stringify(stage)})`)
  check(/^Rough sketch of plan r\d+ · timing estimated · presenter stand-in$/.test(stage?.note || ''), `the stage labels it a rough sketch and says what is provisional (${stage?.note})`)
  const played = await waitFor(`async () => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); return player.duration > 0 ? player.duration : null }`, 40)
  check(Math.abs((played || 0) - ready.ready.summary.duration) < 0.5, `the engine loaded the composition (${played}s)`)
  // One composition, one clock (R5): the sketch starts at its first frame,
  // paused, and nothing that works on the notebook's own composition shows.
  const start = await waitFor(`() => {
    const player = document.querySelector('#scene-stage-preview hyperframes-player')
    const hidden = selector => { const element = document.querySelector(selector); return !element || element.hidden || getComputedStyle(element).display === 'none' }
    return player && player.currentTime === 0 ? { time: player.currentTime, button: document.querySelector('.scene-stage-transport > button').getAttribute('aria-label'), shell: document.getElementById('player-shell').classList.contains('has-scene-stage'), legacy: ['#scene-timeline', '#canvas-recording-controls', '#live-camera-toggle', '#canvas-block-timeline'].every(hidden) } : null
  }`, 20)
  check(start?.time === 0 && start.button === 'Play the preview' && start.shell && start.legacy, `the sketch starts at its first frame, paused, with the notebook's own controls stepped back (${JSON.stringify(start)})`)
  await evaluate(`() => { document.querySelectorAll('.scene-stage-moment')[1].click(); return true }`)
  const seeked = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); return Math.abs(player.currentTime - ${ready.ready.summary.moments[1].start}) < 0.25 ? player.currentTime : null }`, 20)
  check(seeked !== null, `the timeline seeks the preview to a moment (${seeked}s)`)
  await sleep(1500)
  await shot('01-preview-on-stage')
  // Selecting a moment in the review goes there too.
  await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[2].click(); return true }`)
  const followed = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); return Math.abs(player.currentTime - ${ready.ready.summary.moments[2].start}) < 0.25 ? player.currentTime : null }`, 20)
  check(followed !== null, `selecting a moment in the review seeks the preview (${followed}s)`)
  // Full screen shows the same sketch, its one transport and its label —
  // not the notebook's dialogue timeline, recording bar or director.
  await evaluate(`() => { document.getElementById('canvas-fullscreen').click(); return true }`)
  const full = await waitFor(`() => {
    const shell = document.getElementById('player-shell')
    if (!shell.classList.contains('canvas-open')) return null
    const shown = selector => { const element = document.querySelector(selector); return Boolean(element) && !element.hidden && getComputedStyle(element).display !== 'none' }
    const bar = document.getElementById('scene-stage-bar').getBoundingClientRect()
    const stage = document.getElementById('scene-stage').getBoundingClientRect()
    const player = document.querySelector('#scene-stage-preview hyperframes-player')
    const box = player.getBoundingClientRect()
    return { src: player?.getAttribute('src'), transport: shown('.scene-stage-transport'), label: shown('#scene-stage-note') && bar.top >= 0 && bar.top < 80, legacy: ['#scene-timeline', '#canvas-recording-controls', '.canvas-director', '#live-camera-toggle'].filter(shown), fills: Math.abs(box.width - stage.width) < 2 && box.height > stage.height * 0.8 }
  }`, 20)
  check(full?.src === ready.ready.url && full.transport && full.label && full.legacy.length === 0 && full.fills, `full screen keeps the one sketch, filling the stage, its transport and its label (${JSON.stringify(full)})`)
  await evaluate(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); player.seek(${ready.ready.summary.moments[1].start} + 1.5); return true }`)
  await shot('01b-preview-full-screen')
  await evaluate(`() => { document.getElementById('canvas-fullscreen').click(); return true }`)
  // At its end the sketch holds its last frame and offers a replay.
  await evaluate(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); player.seek(player.duration - 0.4); player.play(); return true }`)
  const ended = await waitFor(`() => {
    const player = document.querySelector('#scene-stage-preview hyperframes-player')
    const button = document.querySelector('.scene-stage-transport > button')
    return button.getAttribute('aria-label') === 'Replay the preview from the start' ? { time: player.currentTime, duration: player.duration, text: button.textContent } : null
  }`, 20)
  check(Boolean(ended) && ended.time < ended.duration && ended.time > ended.duration - 0.2 && ended.text === '↻', `the end holds the last frame and offers a replay (${JSON.stringify(ended)})`)
  await evaluate(`() => { document.querySelector('.scene-stage-transport > button').click(); return true }`)
  const replayed = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); const label = document.querySelector('.scene-stage-transport > button').getAttribute('aria-label'); return label === 'Pause the preview' && player.currentTime < 1.5 ? player.currentTime : null }`, 10)
  check(replayed !== null, `replay starts again from the beginning (${replayed}s)`)
  await evaluate(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); player.pause(); return true }`)
  // The decision first; the sketch in one line; its details and the moment
  // map on demand (R6, G3).
  const order = await evaluate(`() => {
    const review = document.querySelector('.scene-review.is-expanded')
    const question = review.querySelector('.review-question')
    const preview = review.querySelector('.review-preview')
    const details = review.querySelector('[data-review-open^="preview-details:"]')
    return { questionFirst: Boolean(question && preview && (question.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING)), summary: review.querySelector('.review-preview-summary')?.textContent || '', provisionalOutside: [...review.querySelectorAll('.review-provisional')].every(list => details && details.contains(list)), mapClosed: Boolean(details && !details.open && details.contains(review.querySelector('.review-timeline'))), mapLabel: details?.querySelector('summary')?.textContent || '' }
  }`)
  check(order.questionFirst && /rough: timing estimated · draft artwork · presenter stand-in/.test(order.summary) && order.provisionalOutside && order.mapClosed && /^Preview details and moment map \(r\d+\)$/.test(order.mapLabel), `the plan comes first, the sketch in one line, its details and moment map collapsed (${JSON.stringify(order)})`)
  const lanes = await evaluate(`() => [...document.querySelectorAll('.scene-review.is-expanded .review-timeline-row .review-timeline-label')].map(label => label.textContent)`)
  check(lanes.includes('Moments') && lanes.includes('Twenty-slot pool') && lanes.includes('Presenter'), `the review shows the preview's read-only timeline (${lanes})`)
  await shot('02-preview-review')

  // ——— Nothing else happened ———
  const after = await overview(videoId)
  check(after.scenes[0].view.reviewed?.id === plan.id, 'the preview left the approval as it was')
  const newRuns = (await api('/api/runs')).body.runs.filter(run => !runsBefore.includes(run.id))
  check(newRuns.length === 1 && newRuns[0].route === 'Sketch Scene', `the only new run is the sketch (${newRuns.map(run => run.route)})`)
  check((await api('/api/runs')).body.runs.every(run => run.skill === 'video-planner'), 'only planning runs ran — no production, no export')

  // ——— A revised plan leaves the preview readable, and out of date ———
  await evaluate(`() => { const box = document.querySelector('.scene-review.is-expanded [data-focus^="direction:"]'); box.value = 'Push in on the limit when it bites'; box.dispatchEvent(new Event('input')); document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const revised = await until(async () => { const view = (await overview(videoId)).scenes[0].view; return view.current?.id !== plan.id && view.current?.status === 'candidate' && view.current }, 90)
  check(Boolean(revised), 'the plan is revised')
  const stale = (await overview(videoId)).scenes[0].preview
  check(stale?.ready?.current === false && stale.ready.of.record === plan.id, 'the preview is kept, and reads as out of date')
  const strip = await waitFor(`() => { const chips = [...document.querySelectorAll('.scene-review .review-strip .review-chip')].map(chip => chip.textContent); return chips.includes('Preview: out of date') ? chips : null }`, 30)
  check(Boolean(strip), `the scene's strip says the preview is out of date (${strip})`)

  // ——— A revision is never shown another revision's sketch (R1) ———
  const onR2 = await waitFor(`() => {
    const review = document.querySelector('.scene-review.is-expanded')
    const note = review?.querySelector('.review-no-preview')?.textContent
    if (!note) return null
    return { note, approve: review.querySelector('[data-focus^="approve:"]').textContent, preview: review.querySelector('[data-focus^="preview:"]').textContent, stagePreview: document.querySelector('[data-stage-mode="preview"]').disabled, stageTitle: document.querySelector('[data-stage-mode="preview"]').title, mode: document.querySelector('.scene-stage-modes .is-active')?.textContent }
  }`, 30)
  check(/^No preview of r\d+ yet — the stage shows its page\. Sketches exist for r\d+\./.test(onR2?.note || '') && onR2.mode === 'Wireframe reference' && onR2.stagePreview === true, `the new revision shows its page, not the older revision's sketch (${JSON.stringify(onR2)})`)
  check(onR2?.approve === `Approve r${revised.revision}` && onR2.preview === `Preview r${revised.revision}`, `the actions name the revision they act on (${onR2?.approve} · ${onR2?.preview})`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="show-revision:"]').click(); return true }`)
  const onR1 = await waitFor(`() => {
    const review = document.querySelector('.scene-review.is-expanded')
    const heading = review?.querySelector('.review-preview-head h4')?.textContent
    if (!heading) return null
    return { heading, warn: review.querySelector('.review-preview .review-warn')?.textContent || '', stagePreview: document.querySelector('[data-stage-mode="preview"]').disabled, selected: review.querySelector('.review-revision.is-selected')?.textContent }
  }`, 30)
  check(onR1?.heading === `Plan preview — a rough sketch of r${plan.revision}` && /^Out of date: it sketches r\d+; the scene's current plan is r\d+/.test(onR1.warn) && onR1.stagePreview === false, `selecting the older revision shows its own sketch, as out of date, with why (${JSON.stringify(onR1)})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PLAN PREVIEW CHECK FAIL (${failures})` : 'PLAN PREVIEW CHECK PASS')
process.exitCode = failures ? 1 : 0
