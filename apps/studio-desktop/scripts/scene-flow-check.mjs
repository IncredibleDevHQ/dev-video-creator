// A video's scene work in one place (R06 and R08 of the project-flow
// rereview) — an engineering fixture: the harness is a stub, so this proves
// the machinery, never a plan's quality.
//
// The live review found a new video covered by the planning workspace,
// opened by itself over the scene workspace; the choice of who speaks
// hidden in Record until it made a plan in flight obsolete; eight runtime
// caveats expanded down the inspector; and a finished production left off
// the stage. Here a video made from a base opens in Scenes, the scene
// chosen in the base selected and its brief preparing, with no planning
// window. The scene's voice is chosen beside its title: changed while a
// plan is being made, it says so first, stops that plan and plans again
// with it. The plan's caveats read as one line. A production that finishes
// comes onto the stage — or, when the creator chose another view, is
// offered, one click away.
//
// The fix verification (F02, F06, F07): who speaks, changed while a plan is
// made, after a failed save, after approval and an accepted production, and
// after a candidate, says exactly what the scene is left with — and once
// saved, and only then, plans it again. Played to its end, the produced
// scene holds its last drawn frame with a replay. Accepted and released,
// the project's Video tab and Publish count it without a reload.
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
const root = await mkdtemp(join(tmpdir(), 'studio-scene-flow-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
const controlPath = join(root, 'plan-mode')
await mkdir(binDir, { recursive: true })
const setPlan = mode => writeFile(controlPath, mode)
await setPlan('normal')

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness: a brief, a plan (held when asked), a silent production ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-flow', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-flow', result: 'stub done' }); process.exit(code) }
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
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
  } else if (inputs.planning.route === 'Produce Scene') {
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    const clock = JSON.parse(fs.readFileSync('packet/CLOCK.json', 'utf8'))
    const id = context.composition.id
    const titles = Object.fromEntries(plan.plan.moments.map(moment => [moment.id, moment.title]))
    const moments = clock.moments.map(moment => ({ id: moment.id, title: titles[moment.id], start: moment.start, end: moment.end }))
    const duration = clock.duration
    fs.mkdirSync('production', { recursive: true })
    fs.writeFileSync('production/index.html', '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#1d4ed8}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#1d4ed8;font-family:Inter,sans-serif}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font-size:72px;font-weight:700}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      moments.map(moment => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + Number((moment.end - moment.start).toFixed(3)) + '" data-track-index="0"><div class="title" data-sketch-layer="titles">' + moment.title + '</div></div>').join('') +
      '</div><script>window.__timelines = window.__timelines || {}\nconst tl = gsap.timeline({ paused: true })\n' +
      moments.map(moment => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, " + moment.start + ")").join('\n') +
      '\nwindow.__timelines["' + id + '"] = tl</script></body></html>')
    fs.writeFileSync('production/manifest.json', JSON.stringify({
      version: 1, kind: 'production', scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration: moments[moments.length - 1].end }, runtime: { hyperframes: '0.7.106' },
      clock: { kind: clock.kind, audio: clock.audio }, moments,
      layers: [{ id: 'titles', kind: 'text', label: 'Moment titles', moments: moments.map(moment => moment.id) }],
      unmet: [],
    }, null, 2))
    const answer = await tool('produce_submit_scene', { projectDir })
    if (!answer.accepted) process.stderr.write('stub production refused: ' + JSON.stringify(answer) + '\n')
  } else if (inputs.planning.route === 'Plan Scene') {
    // Held when asked: a plan still being made, for the creator to change
    // who speaks while it runs.
    if (fs.readFileSync(${JSON.stringify(controlPath)}, 'utf8').trim() === 'hold') {
      fs.writeFileSync(${JSON.stringify(controlPath)} + '.held', String(process.pid))
      await sleep(90_000)
    }
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const recipes = [
      { id: 'count-the-passes', catalog: 'adapted', purpose: 'Count the requests as they pass the limit', channel: 'objects', controls: [] },
      { id: 'pulse-the-limit', catalog: 'adapted', purpose: 'Pulse the limit when it bites', channel: 'objects', controls: [] },
    ]
    const moment = (id, title, extra = {}) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility: 'hidden', reason: 'No presenter in this scene' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 2, ...extra })
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show requests, then the limit biting.', demonstration: null, ledger: null,
      moments: [moment('m1', 'Requests arrive'), moment('m2', 'The limit bites', { recipes }), moment('m3', 'Load stays safe')], objects: [], treatments: { presenter: 'Off camera', text: 'None', camera: 'Holds' },
      skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
      requirements: { assets: [], takes: [], decisions: [] },
      continuity: { entry: 'The page in view', exit: 'The limit holding', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
      coverage: units.flatMap(unit => brief.units.find(entry => entry.id === unit).communicationNeeds.map(need => ({ unit, need: need.need, moments: ['m1'] }))),
      rosterProposal: null, delivery: { voice: context.delivery || 'undecided', note: '' },
    }))
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

// ——— The app ———
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
  if (!process.env.SCENE_FLOW_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_FLOW_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_FLOW_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const focusApp = () => evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
const clickText = (selector, text) => evaluate(`() => { const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.textContent.trim() === ${JSON.stringify(text)} && !item.disabled); if (!element) return false; element.click(); return true }`)
const primary = () => evaluate(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent || ''`)
const stageMode = () => evaluate(`() => document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode || ''`)

try {
  await launch()
  // ——— A base of one designed page ———
  const narrative = 'Rate limiters keep an API alive under load. The concurrency limiter lets only twenty requests run at once.\n\nA token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `flow-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    // A project's presentation: the video made from it is the project's, its tab counting what is produced (F06).
    container: { id: `flow-project-${Date.now().toString(36)}`, kind: 'presentation' },
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-flow', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'p-intro' }, content: [{ type: 'text', text: 'Rate limiters keep an API alive under load.' }] }, { type: 'scene', attrs: { id: 'b06', title: 'Concurrent requests limiter', script: 'The concurrency limiter lets only twenty requests run at once.', directorNotes: 'Concurrent requests limiter', sourcePassages: [], svg: await readFile(join(fixtures, '06_concurrent_requests_limiter.svg'), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } }] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  check(Boolean(await openNotebook(base.id, 'Scaling your API with rate limiters')), 'the base opens')

  // ——— R06: Create video opens the video in Scenes, never a planning window ———
  await evaluate(`() => { const node = document.querySelector('#editor .tiptap > [data-block-type="scene"]'); node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true }`)
  await waitFor(`() => document.getElementById('next-step')?.textContent === 'Create video' || null`, 30)
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  await waitFor(`() => document.querySelector('#planning-workspace .planning-create-fork:not([disabled])') ? true : null`, 30)
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-create-fork').click(); return true }`)
  const video = await waitFor(`async () => {
    const id = localStorage.getItem('incredible-studio-v2-active-project')
    const body = id ? await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null) : null
    const workspace = document.getElementById('scene-workspace')
    return body?.project?.derivedFrom?.notebook === ${JSON.stringify(base.id)} && workspace && !workspace.hidden && document.querySelector('#scene-workspace .sw-scene.is-selected') ? id : null
  }`, 90)
  check(Boolean(video), 'the video is made from the base, and opens in Scenes')
  // Watched for a while: the planning window never opens by itself.
  let modal = false
  for (let i = 0; i < 12; i += 1) {
    modal = modal || (await evaluate(`() => document.getElementById('planning-dialog')?.open === true`))
    await sleep(500)
  }
  const opened = await evaluate(`() => ({ selected: document.querySelector('#scene-workspace .sw-scene.is-selected strong')?.textContent || '', stage: Boolean(document.querySelector('#scene-workspace .sw-stage-frame #scene-stage')), title: document.querySelector('#scene-workspace .sw-title h2')?.textContent || '' })`)
  check(!modal && opened.selected === 'Concurrent requests limiter' && opened.stage, `no planning window covers it: the scene chosen in the base is selected, its reference on the stage (${JSON.stringify(opened)})`)
  const brief = await until(async () => (await overview(video)).brief.current, 90)
  check(Boolean(brief), 'its brief is prepared from Scenes, as it opens')
  await shot('01-video-in-scenes')

  // ——— R08: who speaks, beside the scene's title ———
  await focusApp()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Plan the scene' || null`, 60)
  const voice = await evaluate(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); return select ? { value: select.value, text: select.selectedOptions[0]?.textContent, undecided: select.closest('.ws-voice-field').classList.contains('is-undecided'), title: select.title } : null }`)
  check(voice?.value === '' && voice.text === 'Voice: decide later' && voice.undecided && /planned again once you choose/.test(voice.title), `the scene's voice is beside its title, undecided, with what deciding later costs (${JSON.stringify(voice)})`)
  // A plan is being made, for who speaks still undecided.
  await setPlan('hold')
  await clickText('#scene-workspace .sw-actions .button', 'Plan the scene')
  const planning = await until(async () => { const latest = (await overview(video)).scenes[0].view.latest; return latest?.status === 'running' ? latest : null }, 60)
  check(Boolean(planning), `the scene is being planned (r${planning?.revision})`)
  // Released only once the stub holds: the next plan runs as normal.
  await until(async () => (await readFile(`${controlPath}.held`, 'utf8').catch(() => '')) || null, 60)
  await setPlan('normal')
  await evaluate(`() => { window.__confirms = []; window.confirm = message => { window.__confirms.push(message); return true }; return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-head .ws-voice:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); select.value = 'silent'; select.dispatchEvent(new Event('change', { bubbles: true })); return true }`)
  const asked = await waitFor(`() => window.__confirms?.[0] || null`, 10)
  check(asked === `Plan r${planning?.revision} is being made for who speaks still undecided. Change who speaks to no voice? r${planning?.revision} is stopped and kept, and the scene is planned again as r${planning?.revision + 1} with no voice. Other scenes are unchanged.`, `changing who speaks while a plan is made says so first, and what the scene is left with (${JSON.stringify(asked)})`)
  const replanned = await until(async () => {
    const scene = (await overview(video)).scenes[0]
    const stopped = (await api(`/api/planning/records/${planning.id}`)).body?.record
    return scene.delivery === 'silent' && stopped && !['queued', 'running', 'verifying'].includes(stopped.status) && scene.view.current?.status === 'candidate' && scene.view.current.id !== planning.id ? { scene, stopped } : null
  }, 120)
  check(Boolean(replanned) && replanned.stopped.status === 'failed' && /^Stopped|cancelled/.test(replanned.stopped.error?.message || '') && replanned.scene.view.current.revision > planning.revision, `the plan in flight is stopped and kept; the scene is planned again, silent (${JSON.stringify(replanned && { stopped: replanned.stopped.status, message: replanned.stopped.error?.message, delivery: replanned.scene.delivery, current: replanned.scene.view.current.revision })})`)
  await focusApp()
  const silent = await waitFor(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); return select?.value === 'silent' ? { text: select.selectedOptions[0].textContent, undecided: select.closest('.ws-voice-field').classList.contains('is-undecided') } : null }`, 30)
  check(silent?.text === 'Voice: silent' && !silent.undecided, `the scene says who speaks now (${JSON.stringify(silent)})`)

  // ——— F02: a change that cannot be saved changes nothing ———
  await evaluate(`() => {
    window.__toasts = []
    const toast = document.getElementById('toast')
    window.__toastWatch?.disconnect()
    window.__toastWatch = new MutationObserver(() => { if (!toast.hidden && toast.textContent) window.__toasts.push(toast.textContent) })
    window.__toastWatch.observe(toast, { childList: true, characterData: true, subtree: true, attributes: true })
    window.__confirms = []
    const real = window.fetch
    window.fetch = (input, init) => String(input).endsWith('/inputs') && init?.method === 'PUT' ? (window.fetch = real, Promise.resolve(new Response(JSON.stringify({ error: 'the store refused it' }), { status: 500, headers: { 'content-type': 'application/json' } }))) : real(input, init)
    return true
  }`)
  const beforeFailure = (await overview(video)).scenes[0]
  await waitFor(`() => document.querySelector('#scene-workspace .sw-head .ws-voice:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); select.value = 'generated'; select.dispatchEvent(new Event('change', { bubbles: true })); return true }`)
  const refused = await waitFor(`() => window.__toasts.find(text => /^Who speaks did not change/.test(text)) || null`, 20)
  await sleep(3000)
  const afterFailure = (await overview(video)).scenes[0]
  const shownAfter = await evaluate(`() => document.querySelector('#scene-workspace .sw-head .ws-voice')?.value || ''`)
  check(refused === 'Who speaks did not change — the store refused it. The scene keeps no voice; its plans are as they were.' && afterFailure.delivery === 'silent' && afterFailure.view.latest?.id === beforeFailure.view.latest?.id && shownAfter === 'silent', `a change that could not be saved says so, and nothing is stopped or planned (${JSON.stringify({ refused, delivery: afterFailure.delivery, latest: afterFailure.view.latest?.revision, shown: shownAfter })})`)

  // ——— R06: the plan's runtime caveats read as one line ———
  const risks = await waitFor(`() => { const box = document.querySelector('#scene-workspace [data-review-risks]'); if (!box) return null; const details = box.querySelector('details'); return { line: box.querySelector('p')?.textContent || '', open: details?.open ?? null, summary: details?.querySelector('summary')?.textContent || '', items: box.querySelectorAll('li').length } }`, 30)
  check(/^2 recipes not yet proven in the pinned runtime — the production may build them another way, and will say so\.$/.test(risks?.line || '') && risks.open === false && risks.summary === 'Which 2' && risks.items === 2, `the plan's runtime caveats are one status, the list on demand (${JSON.stringify(risks)})`)
  await shot('02-voice-and-caveats')

  // ——— R06: a finished production comes onto the stage ———
  const toApprove = (await overview(video)).scenes[0].view.current
  await clickText('#scene-workspace .sw-actions .button', `Approve r${toApprove.revision} without a preview`)
  await until(async () => (await overview(video)).scenes[0].view.reviewed?.id === toApprove.id, 30)
  await focusApp()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Produce the scene' || null`, 30)
  check((await stageMode()) === 'reference', 'the stage shows the scene\'s page while it is produced')
  await clickText('#scene-workspace .sw-actions .button', 'Produce the scene')
  const first = await until(async () => (await overview(video)).scenes[0].production?.ready || null, 180)
  const onStage = await waitFor(`() => document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode === 'output' ? true : null`, 30)
  check(Boolean(first) && Boolean(onStage), 'the finished production comes onto the stage by itself, the creator having chosen no other view')
  await shot('03-output-on-stage')

  // Chosen the page instead, and produced again: offered, not forced.
  await evaluate(`() => { document.querySelector('.scene-stage-modes [data-stage-mode="reference"]').click(); return true }`)
  await waitFor(`() => document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode === 'reference' ? true : null`, 10)
  await clickText('#scene-workspace .sw-actions .button', 'Produce again')
  const second = await until(async () => { const production = (await overview(video)).scenes[0].production; return production?.ready && production.ready.id !== first.id ? production.ready : null }, 180)
  const offer = await waitFor(`() => { const offer = document.querySelector('#scene-workspace [data-offer="output"]'); return offer ? { text: offer.textContent, mode: document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode } : null }`, 30)
  if (!offer) console.log('DIAGNOSIS', JSON.stringify({ first: first?.id, second: second?.id, production: (await overview(video)).scenes[0].production?.latest, mode: await stageMode(), head: await evaluate(`() => document.querySelector('#scene-workspace .sw-head')?.innerText || ''`) }))
  check(Boolean(second) && /^Output ready\. The scene is produced; your view is kept\. Watch the output$/.test(offer?.text || '') && offer.mode === 'reference', `with the page chosen, the new output is offered and the page kept (${JSON.stringify(offer)})`)
  await shot('04-output-offered')
  await evaluate(`() => { document.querySelector('#scene-workspace [data-offer="output"] button').click(); return true }`)
  const watched = await waitFor(`() => document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode === 'output' && !document.querySelector('#scene-workspace [data-offer="output"]') ? true : null`, 20)
  check(Boolean(watched), 'Watch the output plays it on the stage, and the offer goes')

  // ——— F07: played to its natural end, from the workspace's own transport ———
  await evaluate(`() => { document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)').seek(0); return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-play:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-play').click(); return true }`)
  const naturalEnd = await waitFor(`() => {
    const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)')
    const play = document.querySelector('#scene-workspace .sw-play')
    if (play?.getAttribute('aria-label') !== 'Play again from the start') return null
    const drawn = [...(player.iframe?.contentDocument?.querySelectorAll('.clip') || [])].filter(clip => getComputedStyle(clip).visibility !== 'hidden').map(clip => clip.id)
    return { time: player.currentTime, duration: player.duration, text: play.textContent, drawn, stage: document.querySelector('.scene-stage-transport > button').getAttribute('aria-label') }
  }`, 60)
  check(Boolean(naturalEnd) && naturalEnd.text === '↻' && naturalEnd.stage === 'Replay the produced scene from the start' && Math.abs(naturalEnd.time - (Math.ceil(naturalEnd.duration * 30 - 1e-6) - 1) / 30) < 0.02 && naturalEnd.drawn.length > 0, `played to its end, the produced scene holds its last drawn frame, paused, with a replay (${JSON.stringify(naturalEnd)})`)
  await shot('04b-natural-end')
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-play').click(); return true }`)
  const fromZero = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)'); return document.querySelector('#scene-workspace .sw-play')?.getAttribute('aria-label') === 'Pause' && player.currentTime < 1.5 ? player.currentTime : null }`, 10)
  check(fromZero !== null, `Play again starts from the beginning (${fromZero}s)`)
  await evaluate(`() => { document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)').pause(); return true }`)

  // Publish names the scene as Scenes does: the first scene, though a text
  // block comes before it.
  await evaluate(`() => { document.getElementById('render-video').click(); return true }`)
  const named = await waitFor(`() => document.getElementById('publish-dialog').open ? document.querySelector('#publish-scope-options [data-scope="scene"] small')?.textContent || '' : null`, 20)
  check(/^Scene 1 · Concurrent requests limiter/.test(named || ''), `Publish names the scene as Scenes does, not by its block (${JSON.stringify(named)})`)
  await evaluate(`() => { document.getElementById('publish-dialog').close(); return true }`)

  // ——— F06: what the project says it has produced follows an acceptance ———
  const counts = async () => evaluate(`async () => {
    const tab = document.querySelector('#notebook-switch .notebook-switch-tab[data-kind="video"]')
    document.getElementById('publish-export-kind').textContent = ''
    document.getElementById('render-video').click()
    const deadline = Date.now() + 10000
    let kind = ''
    while (Date.now() < deadline && !(kind = document.getElementById('publish-export-kind')?.textContent || '')) await new Promise(resolve => setTimeout(resolve, 100))
    document.getElementById('publish-dialog').close()
    return { tab: tab ? tab.textContent.replace(/\\s+/g, ' ').trim() : null, rail: document.querySelector('#scene-workspace .sw-scene .sw-scene-state')?.textContent || '', publish: kind }
  }`)
  await evaluate(`() => { document.getElementById('sw-tab-output')?.click(); return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace [data-focus^="accept-production:"]:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { document.querySelector('#scene-workspace [data-focus^="accept-production:"]').click(); return true }`)
  const acceptedScene = await until(async () => { const { body } = await api(`/api/projects/${encodeURIComponent(video)}`); return body?.project?.producedScenes?.[(await overview(video)).scenes[0].id] || null }, 180)
  await focusApp()
  const afterAccept = await until(async () => { const seen = await counts(); return /1 of 1 scenes produced/.test(seen?.tab || '') ? seen : null }, 20)
  check(Boolean(acceptedScene) && Boolean(afterAccept) && /^Video export — every scene plays the production you accepted/.test(afterAccept.publish), `accepted, the Video tab, the rail and Publish say it is produced, without a reload (${JSON.stringify(afterAccept || await counts())})`)
  await shot('05-accepted-counted')

  // ——— F02: who speaks, changed after approval and production ———
  const approved = (await overview(video)).scenes[0]
  await evaluate(`() => { window.__confirms = []; return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-head .ws-voice:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); select.value = 'generated'; select.dispatchEvent(new Event('change', { bubbles: true })); return true }`)
  const askedApproved = await waitFor(`() => window.__confirms?.[0] || null`, 10)
  const next = approved.view.latest.revision + 1
  check(askedApproved === `Change who speaks in this scene to a generated voice? The scene is planned again as r${next} with a generated voice. The approved plan r${approved.view.reviewed.revision}, made for no voice, stays approved, out of date, until you approve r${next}. Its accepted production still plays in the video until you accept one made again. Other scenes are unchanged.`, `changed after approval and an accepted production, it says what the scene is left with (${JSON.stringify(askedApproved)})`)
  const replannedApproved = await until(async () => { const scene = (await overview(video)).scenes[0]; return scene.delivery === 'generated' && scene.view.current?.revision === next && scene.view.current.status === 'candidate' ? scene : null }, 120)
  check(Boolean(replannedApproved) && replannedApproved.view.reviewed?.id === approved.view.reviewed.id, `the choice is saved and r${next} is planned by itself; r${approved.view.reviewed.revision} stays approved (${JSON.stringify(replannedApproved && { delivery: replannedApproved.delivery, current: replannedApproved.view.current.revision, reviewed: replannedApproved.view.reviewed?.revision })})`)

  // ——— F02: and again after a candidate ———
  await focusApp()
  await evaluate(`() => { window.__confirms = []; return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-head .ws-voice:not([disabled])') ? true : null`, 20)
  await evaluate(`() => { const select = document.querySelector('#scene-workspace .sw-head .ws-voice'); select.value = 'silent'; select.dispatchEvent(new Event('change', { bubbles: true })); return true }`)
  const askedCandidate = await waitFor(`() => window.__confirms?.[0] || null`, 10)
  check(askedCandidate === `Change who speaks in this scene to no voice? The scene is planned again as r${next + 1} with no voice. Plan r${next}, made for a generated voice, is kept, out of date. The approved plan r${approved.view.reviewed.revision} stays approved, out of date, until you approve r${next + 1}. Its accepted production still plays in the video until you accept one made again. Other scenes are unchanged.`, `changed after a candidate, it says what the scene is left with (${JSON.stringify(askedCandidate)})`)
  const replannedCandidate = await until(async () => { const scene = (await overview(video)).scenes[0]; return scene.delivery === 'silent' && scene.view.current?.revision === next + 1 && scene.view.current.status === 'candidate' ? scene : null }, 120)
  check(Boolean(replannedCandidate), `the choice is saved and r${next + 1} is planned by itself (${JSON.stringify(replannedCandidate && { delivery: replannedCandidate.delivery, current: replannedCandidate.view.current.revision })})`)

  // ——— F06: released, every count goes back ———
  await focusApp()
  await evaluate(`() => { document.getElementById('sw-tab-output')?.click(); return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace [data-focus^="use-production:"]:not([disabled])')?.textContent === "Play the notebook's own scene" ? true : null`, 20)
  await evaluate(`() => { document.querySelector('#scene-workspace [data-focus^="use-production:"]').click(); return true }`)
  const released = await until(async () => { const { body } = await api(`/api/projects/${encodeURIComponent(video)}`); return body?.project && !body.project.producedScenes?.[(await overview(video)).scenes[0].id] ? true : null }, 60)
  const afterRelease = await until(async () => { const seen = await counts(); return seen?.tab && !/produced/.test(seen.tab) ? seen : null }, 20)
  check(Boolean(released) && Boolean(afterRelease) && /^Draft export/.test(afterRelease.publish), `released, the Video tab and Publish no longer count it, without a reload (${JSON.stringify(afterRelease || await counts())})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE FLOW CHECK FAIL (${failures})` : 'SCENE FLOW CHECK PASS')
process.exitCode = failures ? 1 : 0
