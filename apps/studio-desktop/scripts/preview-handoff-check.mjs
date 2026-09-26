// The preview hand-off (U4 of the scene workspace plan) — an engineering
// fixture: the harness is a stub whose sketches wait at gates the check
// opens, so the order in which previews finish is the check's to choose.
//
// In the scene workspace, a preview the creator waits for takes the stage
// when it is ready, paused, and is announced. A creator who chose the
// reference meanwhile keeps it, and the preview is offered. One that finishes
// for another scene only says so on that scene, and loads when the creator
// comes back. When r2's preview finishes before r1's, r1's never takes the
// stage. One that finishes while the stage plays waits, then is offered. A
// preview still being made when the app reopens is handed over after it.
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
const root = await mkdtemp(join(tmpdir(), 'studio-preview-handoff-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
const gates = join(root, 'gates')
await mkdir(binDir, { recursive: true })
await mkdir(gates, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness: a brief, a three-moment plan, and gated sketches ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-handoff', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-handoff', result: 'stub done' }); process.exit(code) }
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
    const html = (registry, broken = false) => '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#0e0c17}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#0e0c17;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}' +
      '.title{position:absolute;left:120px;top:90px;color:#fff;font-size:60px;font-weight:600}.stand-in{position:absolute;right:120px;top:260px;width:420px;height:560px;border:4px dashed #f472b6;border-radius:24px;color:#f472b6;font-size:32px;display:flex;align-items:center;justify-content:center}' +
      '.pool{position:absolute;left:520px;top:300px;width:880px}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      moments.map((moment, index) => clip(moment, '<div class="title" data-sketch-layer="titles">' + moment.title + '</div>' + (index === 0 ? '<div class="stand-in" data-sketch-layer="presenter">Presenter stand-in</div>' : '') + (index === 1 && pool ? '<img class="pool" data-sketch-layer="pool" src="assets/pool.svg" alt="The page\'s twenty-slot pool">' : ''))).join('') +
      '</div><script>' + (registry ? 'window.__timelines = window.__timelines || {}\n' : '') + (broken ? "throw new Error('stub: the timeline cannot start')\n" : '') +
      'const tl = gsap.timeline({ paused: true })\n' +
      moments.map((moment, index) => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, " + moment.start + ")").join('\n') + '\n' +
      (moments[1] && pool ? "tl.fromTo('#" + moments[1].id + " .pool', { scale: 1 }, { scale: 1.25, duration: 3 }, " + moments[1].start + ")\n" : '') +
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
    // The check decides when each sketch is done: it opens this scene's gate
    // for this revision.
    const gate = require('node:path').join(process.env.PREVIEW_GATE_DIR, context.scene.id + '-r' + plan.revision)
    const until = Date.now() + 180000
    while (!fs.existsSync(gate) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 200))
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
    // A designed slide's objects are each decided: the ones the stub does not use are omitted.
    {
      const written = JSON.parse(fs.readFileSync('planning/treatment.json', 'utf8'))
      const visual = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
      const decided = new Set(written.objects.map(object => object.asset && object.asset.ref))
      for (const entry of (visual.entries || []).filter(entry => context.scene.originScenes.includes(entry.page) && entry.verification.status === 'verified' && entry.libraryKey && !decided.has(entry.libraryKey))) {
        written.objects.push({ entity: 'page-' + entry.id, role: entry.label, appearance: 'Not shown', performance: 'None', asset: { status: 'omit', ref: entry.libraryKey, reason: 'Not needed for this scene' } })
      }
      fs.writeFileSync('planning/treatment.json', JSON.stringify(written))
    }
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

let child
let origin
const launch = async () => {
  child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_CLAUDE_BIN: stubPath, PREVIEW_GATE_DIR: gates },
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
  // An app still up 5s after SIGTERM is killed, so its pipes cannot keep the
  // check (or release-check) waiting — and that is said, not hidden.
  if (!(await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]))) {
    console.log('NOTE  the app was still running 5s after SIGTERM; it was killed')
    child.kill('SIGKILL')
  }
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
  if (!process.env.PREVIEW_HANDOFF_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.PREVIEW_HANDOFF_SHOTS, { recursive: true })
  await writeFile(join(process.env.PREVIEW_HANDOFF_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const release = (sceneId, revision) => writeFile(join(gates, `${sceneId}-r${revision}`), 'go')
const click = selector => evaluate(`() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true }`)
const clickText = (selector, text) => evaluate(`() => { const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(entry => entry.textContent.trim() === ${JSON.stringify(text)}); if (!element) return false; element.click(); return true }`)
const pickScene = sceneId => click(`#scene-workspace .sw-scene[data-scene="${sceneId}"]`)
// What the stage shows: its mode, whose composition the player holds, and whether it plays.
const stageNow = `() => {
  const pressed = document.querySelector('#scene-stage-bar [data-stage-mode][aria-pressed="true"]')?.dataset.stageMode || ''
  const players = [...document.querySelectorAll('#scene-stage-preview hyperframes-player')]
  const shown = players.find(player => !player.classList.contains('is-loading'))
  const preview = document.getElementById('scene-stage-preview')
  return {
    scene: document.querySelector('#scene-workspace .sw-scene.is-selected')?.dataset.scene || '',
    mode: pressed,
    reference: !document.getElementById('scene-stage-reference').hidden,
    player: preview.hidden || preview.classList.contains('is-only-loading') ? '' : shown?.getAttribute('src') || '',
    players: players.length,
    playing: document.querySelector('#scene-workspace .sw-play')?.getAttribute('aria-label') === 'Pause',
    note: document.getElementById('scene-stage-note').textContent,
    offer: document.querySelector('#scene-workspace .ws-offer')?.dataset.offer || '',
    announced: document.querySelector('#scene-workspace [aria-live="polite"][role="status"].sr-only')?.textContent || '',
  }
}`
const previewUrl = async (videoId, sceneId, treatmentId) => (await overview(videoId)).scenes.find(scene => scene.id === sceneId)?.preview?.byTreatment?.[treatmentId]?.url || ''

try {
  await launch()
  const narrative = 'A rate limiter keeps an API alive when load spikes.\n\nIt refuses the excess before it hurts.'
  const read = await post('/api/source/read', { narrative, title: 'Rate limiters', wordingPolicy: 'draft' })
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `handoff-base-${Date.now().toString(36)}`, title: 'Rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Rate limiters' },
    theme: { version: 1, id: 'handoff', name: 'Rate limiters', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b04', 'Request rate limiter', '05_request_rate_limiter.svg', 'A limiter refuses the excess.'),
      await page('b05', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'It caps what runs at once.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'Rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `handoff-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens on its scenes')
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Prepare the brief' ? true : null`, 60)
  await click('#scene-workspace .sw-actions .button.primary')
  check(Boolean(await until(async () => (await overview(videoId)).brief.current, 90)), 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const [s1, s2] = (await overview(videoId)).scenes.map(scene => scene.id)
  // Both scenes planned: r1 each.
  for (const sceneId of [s1, s2]) {
    await pickScene(sceneId)
    await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
    await click('#scene-workspace .sw-actions .button.primary')
    await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === sceneId)?.view.current?.status === 'candidate', 90)
  }
  await pickScene(s1)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Preview r1' ? true : null`, 30)
  const t1 = (await overview(videoId)).scenes.find(scene => scene.id === s1).view.current.id

  // ——— 1. Waiting on the scene: the preview takes the stage, paused, and is announced ———
  await click('#scene-workspace .sw-actions .button.primary')
  const building = await waitFor(`() => { const activity = document.querySelector('#scene-workspace .sw-stage-activity .ws-activity'); return activity ? activity.textContent : null }`, 30)
  check(/^Building the preview of r1…/.test(building || ''), `the preview is shown being built, under the stage (${building})`)
  const waiting = await evaluate(stageNow)
  check(waiting.reference && waiting.mode === 'reference', `while it builds, the stage keeps the page (${JSON.stringify({ mode: waiting.mode, reference: waiting.reference })})`)
  await shot('01-building')
  await release(s1, 1)
  const url1 = await until(() => previewUrl(videoId, s1, t1), 90)
  const loaded = await waitFor(`() => { const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url1)}) && !now.reference ? now : null }`, 40)
  check(loaded?.mode === 'preview' && !loaded.playing && loaded.players === 1, `waiting on the scene, the ready preview takes the stage by itself, paused (${JSON.stringify({ mode: loaded?.mode, playing: loaded?.playing, players: loaded?.players })})`)
  check(/Preview r1 ready/.test(loaded?.announced || ''), `and it is announced (${loaded?.announced})`)
  await shot('02-loaded')

  // ——— 2. The creator chose the reference meanwhile: kept, and the preview offered ———
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  const t2 = (await overview(videoId)).scenes.find(scene => scene.id === s2).view.current.id
  await clickText('#scene-workspace .sw-actions .button', 'Preview r1')
  await waitFor(`() => document.querySelector('#scene-workspace .sw-stage-activity .ws-activity') ? true : null`, 30)
  await click('#scene-stage-bar [data-stage-mode="schematic"]:not([hidden])') || await click('#scene-stage-bar [data-stage-mode="reference"]')
  const chosen = await evaluate(stageNow)
  await release(s2, 1)
  const url2 = await until(() => previewUrl(videoId, s2, t2), 90)
  const offered = await waitFor(`() => { const now = (${stageNow})(); return now.offer ? now : null }`, 40)
  check(Boolean(url2) && offered?.offer === 'offer' && offered.mode === chosen.mode && !offered.player, `a creator who chose ${chosen.mode} meanwhile keeps it; the ready preview is offered, not forced (${JSON.stringify({ mode: offered?.mode, offer: offered?.offer, player: offered?.player })})`)
  await shot('03-offered')
  await click('#scene-workspace [data-focus="sw-play-offer"]')
  const played = await waitFor(`() => { const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url2)}) ? now : null }`, 40)
  check(played?.mode === 'preview' && !played.offer, `the offer plays it when asked (${JSON.stringify({ mode: played?.mode, offer: played?.offer })})`)

  // ——— 3. Another scene is on show: that scene only says so; coming back loads it ———
  await pickScene(s1)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Request rate limiter' ? true : null`, 20)
  await evaluate(`() => { document.querySelector('#scene-workspace [data-focus^="direction:"]').value = 'Hold on the refusal longer'; document.querySelector('#scene-workspace [data-focus^="direction:"]').dispatchEvent(new Event('input', { bubbles: true })); return true }`)
  await click('#scene-workspace [data-focus^="revise:"]')
  const r2 = await until(async () => { const scene = (await overview(videoId)).scenes.find(entry => entry.id === s1); return scene.view.current?.revision === 2 && scene.view.current.status === 'candidate' ? scene.view.current : null }, 90)
  check(Boolean(r2), 'scene 1 is planned again: r2')
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Preview r2' ? true : null`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  await waitFor(`() => document.querySelector('#scene-workspace .sw-stage-activity .ws-activity') ? true : null`, 30)
  await pickScene(s2)
  // Scene 2's stage settles on its own preview first.
  const onTwo = await waitFor(`() => { const now = (${stageNow})(); return now.scene === ${JSON.stringify(s2)} && now.player.startsWith(${JSON.stringify(url2)}) ? now : null }`, 30)
  check(Boolean(onTwo), 'scene 2 opens on the preview chosen for it')
  await release(s1, 2)
  const url3 = await until(() => previewUrl(videoId, s1, r2.id), 90)
  const elsewhere = await waitFor(`() => { const state = document.querySelector('#scene-workspace .sw-scene[data-scene=${JSON.stringify(s1)}] .sw-scene-state')?.textContent || ''; return /ready/.test(state) ? { state, now: (${stageNow})() } : null }`, 40)
  check(Boolean(url3) && elsewhere?.state === 'Preview r2 ready' && elsewhere.now.scene === s2 && elsewhere.now.player === onTwo.player && elsewhere.now.mode === onTwo.mode, `finished for scene 1 while scene 2 is on show: scene 1 says it is ready, and scene 2's stage is untouched (${JSON.stringify({ state: elsewhere?.state, scene: elsewhere?.now.scene === s2, same: elsewhere?.now.player === onTwo?.player })})`)
  await shot('04-elsewhere')
  await pickScene(s1)
  const back = await waitFor(`() => { const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url3)}) ? now : null }`, 40)
  check(back?.mode === 'preview' && back.scene === s1, `coming back to scene 1 loads its r2 preview (${JSON.stringify({ mode: back?.mode, scene: back?.scene })})`)

  // ——— 4. The newer revision's preview finishes first: the older one never takes the stage ———
  const direct = async text => {
    await evaluate(`() => { const box = document.querySelector('#scene-workspace [data-focus^="direction:"]'); box.value = ${JSON.stringify(text)}; box.dispatchEvent(new Event('input', { bubbles: true })); return true }`)
    await click('#scene-workspace [data-focus^="revise:"]')
  }
  const planned = (sceneId, revision) => until(async () => { const scene = (await overview(videoId)).scenes.find(entry => entry.id === sceneId); return scene.view.current?.revision === revision && scene.view.current.status === 'candidate' ? scene.view.current : null }, 90)
  const previewIt = async revision => {
    await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Preview r${revision}' ? true : null`, 30)
    await click('#scene-workspace .sw-actions .button.primary')
    return waitFor(`() => document.querySelector('#scene-workspace .sw-stage-activity .ws-activity') ? true : null`, 30)
  }
  await direct('Open on the refusal')
  const r3 = await planned(s1, 3)
  await previewIt(3)
  await direct('Close on the refusal')
  const r4 = await planned(s1, 4)
  check(Boolean(r3 && r4), 'scene 1 is planned twice more: r3, then r4')
  await previewIt(4)
  await release(s1, 4)
  const url4 = await until(() => previewUrl(videoId, s1, r4.id), 90)
  const r4Loaded = await waitFor(`() => { const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url4)}) ? now : null }`, 40)
  check(r4Loaded?.mode === 'preview', `r4's preview, the one waited for, takes the stage (${JSON.stringify({ mode: r4Loaded?.mode })})`)
  await release(s1, 3)
  const r3Done = await until(async () => { const records = (await api(`/api/planning/${encodeURIComponent(videoId)}`)).body.records; const sketch = records.filter(record => record.kind === 'preview' && record.subject === s1 && record.inputs?.treatmentId === r3.id).sort((a, b) => b.revision - a.revision)[0]; return sketch && !['queued', 'running', 'verifying'].includes(sketch.status) ? sketch : null }, 90)
  await sleep(5000)
  const afterOlder = await evaluate(stageNow)
  check(Boolean(r3Done) && afterOlder.player.startsWith(url4) && !afterOlder.offer, `r3's preview finishing later (${r3Done?.status}) is kept as history, never put on the stage (${JSON.stringify({ stillR4: afterOlder.player.startsWith(url4), offer: afterOlder.offer })})`)
  await shot('05-race')

  // ——— 5. A preview finishing while the stage plays: playback goes on, then it is offered ———
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  await direct('Tighter')
  const s2r2 = await planned(s2, 2)
  await previewIt(2)
  // Back on r1, whose preview plays.
  await evaluate(`() => { const select = document.querySelector('#scene-workspace .ws-revision'); select.value = ${JSON.stringify(t2)}; select.dispatchEvent(new Event('change')); return true }`)
  const onR1 = await waitFor(`() => { const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url2)}) ? now : null }`, 30)
  check(Boolean(onR1), 'the revision control goes back to r1, and its preview is on the stage')
  await click('#scene-workspace .sw-play')
  const isPlaying = await waitFor(`() => (${stageNow})().playing ? true : null`, 20)
  check(isPlaying === true, 'the stage plays r1\'s preview')
  await release(s2, 2)
  const url5 = await until(() => previewUrl(videoId, s2, s2r2.id), 90)
  await sleep(3000)
  const held = await evaluate(stageNow)
  check(Boolean(url5) && held.player.startsWith(url2) && held.offer === 'held', `finished while the stage plays: the playback goes on, and r2's preview waits (${JSON.stringify({ playing: held.playing, offer: held.offer, stillR1: held.player.startsWith(url2) })})`)
  await click('#scene-workspace .sw-play')
  const offeredAfter = await waitFor(`() => { const now = (${stageNow})(); return now.offer === 'offer' ? now : null }`, 20)
  check(Boolean(offeredAfter) && offeredAfter.player.startsWith(url2), `stopped, r2's preview is offered, not loaded (${JSON.stringify({ offer: offeredAfter?.offer })})`)
  await shot('06-held-then-offered')

  // ——— 6. The app reopens while a preview is made: it is handed over after ———
  // On the second scene: the notebook opens on its first, and the workspace
  // must come back to the scene the creator was on, waiting preview and all.
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  await direct('One more pass')
  const r3b = await planned(s2, 3)
  await previewIt(3)
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(3000)
  const cameBack = await waitFor(`() => document.querySelector('#scene-workspace .sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(s2)} && document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 60)
  check(cameBack === true, 'reopened while a preview is made, the workspace comes back to that scene, not the first')
  await release(s2, 3)
  const url6 = await until(() => previewUrl(videoId, s2, r3b.id), 90)
  const reopened = await waitFor(`() => { window.dispatchEvent(new Event('focus')); const now = (${stageNow})(); return now.player && now.player.startsWith(${JSON.stringify(url6)}) ? now : null }`, 60)
  check(reopened?.mode === 'preview' && reopened.scene === s2, `reopened while it was made, the preview is still handed over when ready (${JSON.stringify({ mode: reopened?.mode, scene: reopened?.scene })})`)
  await shot('07-reopened')
  const leftovers = await evaluate(`() => document.querySelectorAll('#scene-stage-preview hyperframes-player').length`)
  check(leftovers === 1, `one player on the stage: each replaced one was removed (${leftovers})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PREVIEW HANDOFF CHECK FAIL (${failures})` : 'PREVIEW HANDOFF CHECK PASS')
process.exitCode = failures ? 1 : 0
