// A preview whose checks refuse every submission (R09 of the project-flow
// rereview) — an engineering fixture: the harness is a stub, so this proves
// the machinery, never a sketch's quality.
//
// The live review's preview submitted six sketches whose frames moved
// between two seeks of the same moment, then ended as "The run ended (done,
// exit 0) without submitting a result" — its checks lost. Here the stub
// submits such a sketch six times. Each refusal gives the harness the
// player's evidence — both frames, written beside the run — and the sixth
// tells it to stop. The record ends as "could not be verified after 6
// attempts" with every check kept. The scene says so under the stage, with
// the last check, every attempt to inspect and the ways on, and still does
// after a reload. Approved without a preview and produced, the failure is
// the preview's history, never the stage's state. Asked for again, the
// sketch is given the last check and passes the same, unchanged check.
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
const root = await mkdtemp(join(tmpdir(), 'studio-preview-exhausted-'))
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
const path = require('node:path')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-exhausted', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-exhausted', result: 'stub done' }); process.exit(code) }
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
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    const id = context.composition.id
    const per = 4
    const moments = plan.plan.moments.map((moment, index) => ({ id: moment.id, title: moment.title, start: index * per, end: (index + 1) * per, estimated: true }))
    const duration = moments.length * per
    // A marker moved by a timer, not the timeline: each seek finds it
    // elsewhere. The repair puts the same move on the timeline.
    const html = drifting => '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#0e0c17}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#0e0c17;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}' +
      '.title{position:absolute;left:120px;top:90px;color:#fff;font-size:60px;font-weight:600}.marker{position:absolute;left:160px;top:520px;width:220px;height:220px;border-radius:28px;background:#635bff}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      '<div class="marker" data-sketch-layer="marker"></div>' +
      moments.map(moment => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + (moment.end - moment.start) + '" data-track-index="0"><div class="title" data-sketch-layer="titles">' + moment.title + '</div></div>').join('') +
      '</div><script>window.__timelines = window.__timelines || {}\nconst tl = gsap.timeline({ paused: true })\n' +
      moments.map(moment => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, " + moment.start + ")").join('\n') + '\n' +
      (drifting ? "let n = 0\nsetInterval(() => { n += 1; document.querySelector('.marker').style.transform = 'translateX(' + (n * 4) + 'px)' }, 16)\n" : "tl.to('.marker', { x: 900, duration: " + duration + ", ease: 'none' }, 0)\n") +
      'window.__timelines["' + id + '"] = tl</script></body></html>'
    fs.mkdirSync('sketch', { recursive: true })
    fs.writeFileSync('sketch/manifest.json', JSON.stringify({
      version: 1, scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' }, moments,
      layers: [{ id: 'titles', kind: 'text', label: 'Moment titles', moments: moments.map(moment => moment.id) }, { id: 'marker', kind: 'object', label: 'Marker', moments: moments.map(moment => moment.id) }],
      provisional: ['Timing is estimated from the plan — no voice or take yet'],
    }, null, 2))
    const retried = fs.existsSync('packet/LAST-CHECK.md')
    const answers = []
    if (retried) {
      // Given the last check: its words and its frames, then the repair.
      const lastCheck = fs.readFileSync('packet/LAST-CHECK.md', 'utf8')
      const frames = (lastCheck.match(/last-check\/[\w-]+\.png/g) || []).map(file => ({ file, exists: fs.existsSync(path.join('packet', file)) }))
      fs.writeFileSync('planning/last-check-seen.json', JSON.stringify({ lastCheck, frames, told: /LAST-CHECK\.md/.test(fs.readFileSync('packet/SKETCH.md', 'utf8')) }))
      fs.writeFileSync('sketch/index.html', html(false))
      answers.push(await tool('plan_submit_sketch', { projectDir }))
    } else {
      fs.writeFileSync('sketch/index.html', html(true))
      for (let attempt = 1; attempt <= 7; attempt += 1) {
        const answer = await tool('plan_submit_sketch', { projectDir })
        answers.push({ ...answer, framesOnDisk: (answer.evidence || []).map(item => [item.frames.first, item.frames.again].every(file => fs.existsSync(path.join(projectDir, file)))) })
        // The harness does as it is told: it stops when the budget is spent.
        if (answer.accepted || answer.error || !answer.remaining) break
      }
    }
    fs.writeFileSync('planning/sketch-answers.json', JSON.stringify(answers))
  } else if (inputs.planning.route === 'Produce Scene') {
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    const clock = JSON.parse(fs.readFileSync('packet/CLOCK.json', 'utf8'))
    const id = context.composition.id
    const titles = Object.fromEntries(plan.plan.moments.map(moment => [moment.id, moment.title]))
    const moments = clock.moments.map(moment => ({ id: moment.id, title: titles[moment.id], start: moment.start, end: moment.end }))
    const duration = clock.duration
    fs.mkdirSync('production', { recursive: true })
    fs.writeFileSync('production/index.html', '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#1d4ed8}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#1d4ed8;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font-size:72px;font-weight:700}</style></head><body>' +
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
  } else {
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const moment = (id, title) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility: 'hidden', reason: 'No presenter in this scene' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 2 })
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show requests, then the limit biting.', demonstration: null, ledger: null,
      moments: [moment('m1', 'Requests arrive'), moment('m2', 'The limit bites'), moment('m3', 'Load stays safe')], objects: [], treatments: { presenter: 'Off camera', text: 'None', camera: 'Holds' },
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
  if (!process.env.PREVIEW_EXHAUSTED_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.PREVIEW_EXHAUSTED_SHOTS, { recursive: true })
  await writeFile(join(process.env.PREVIEW_EXHAUSTED_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
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
const failureNotice = `() => {
  const box = document.querySelector('#scene-workspace .ws-build-failure')
  if (!box) return null
  return {
    kind: box.dataset.failure,
    history: box.classList.contains('is-history'),
    role: box.getAttribute('role'),
    text: box.querySelector('p')?.textContent || '',
    buttons: [...box.querySelectorAll('.review-actions .button')].map(button => button.textContent),
    inspect: box.querySelector('.review-disclosure > summary')?.textContent || '',
  }
}`

try {
  await launch()
  // ——— A base of one designed page, its video, a brief and a silent scene's plan ———
  const narrative = 'Rate limiters keep an API alive under load. The concurrency limiter lets only twenty requests run at once.\n\nA token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `exhausted-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-exhausted', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'b06', title: 'Concurrent requests limiter', script: 'The concurrency limiter lets only twenty requests run at once.', directorNotes: 'Concurrent requests limiter', sourcePassages: [], svg: await readFile(join(fixtures, '06_concurrent_requests_limiter.svg'), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } }] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `exhausted-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  const sceneId = (await overview(videoId)).scenes[0].id
  await api(`/api/planning/${videoId}/inputs`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: sceneId, delivery: 'silent' }) })
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens')
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  check(Boolean(await until(async () => (await overview(videoId)).brief.current, 90)), 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await focusApp()
  check(Boolean(await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Plan the scene' || null`, 60)), 'the video opens on its scene, to be planned')
  await clickText('#scene-workspace .sw-actions .button', 'Plan the scene')
  const plan = await until(async () => { const view = (await overview(videoId)).scenes[0].view; return view.current?.status === 'candidate' && view.current }, 90)
  check(Boolean(plan), `the scene is planned (r${plan?.revision})`)

  // ——— Preview: six refusals, each with the player's evidence ———
  await focusApp()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Preview r${plan.revision}' || null`, 30)
  const runsBefore = (await api('/api/runs')).body.runs.map(run => run.id)
  await clickText('#scene-workspace .sw-actions .button', `Preview r${plan.revision}`)
  const failed = await until(async () => { const latest = (await overview(videoId)).scenes[0].preview?.latest; return latest?.status === 'failed' ? latest : null }, 300)
  const sketchRun = (await api('/api/runs')).body.runs.find(run => run.route === 'Sketch Scene' && !runsBefore.includes(run.id))
  await until(async () => (await api('/api/runs')).body.runs.find(run => run.id === sketchRun?.id)?.status === 'done', 30)
  const answers = sketchRun ? JSON.parse(await readFile(join(sketchRun.projectDir, 'planning', 'sketch-answers.json'), 'utf8').catch(() => '[]')) : []
  check(answers.length === 6 && answers.every((answer, index) => answer.accepted === false && answer.attempt === index + 1 && answer.remaining === 5 - index), `the harness submitted six times, told each time how many were left (${JSON.stringify(answers.map(answer => [answer.attempt, answer.remaining]))})`)
  check(answers.slice(0, 5).every(answer => /^Look at the evidence first/.test(answer.next) && answer.evidence?.length > 0 && answer.framesOnDisk.every(Boolean)), `each refusal gave it the player's evidence — both frames, written beside the run (${answers[0]?.evidence?.[0]?.frames?.first})`)
  check(/^The submission budget is spent: stop the run now\./.test(answers[5]?.next || '') && !/submit again/.test(answers[5]?.next || ''), `the sixth told it to stop, not to submit again (${answers[5]?.next})`)
  check(failed?.error?.message === 'The preview could not be verified after 6 attempts' && failed.error.category === 'verification', `the preview ends as could not be verified after six attempts — not "without submitting a result" (${failed?.error?.message})`)
  check(failed?.validation?.attempts.length === 6 && failed.validation.attempts.every(attempt => attempt.evidence.length > 0 && /^\/objects\//.test(attempt.evidence[0].frames.first)), `every attempt's check is kept, with its frames (${failed?.validation?.attempts.length})`)
  const frame = failed?.validation?.attempts[5]?.evidence[0]?.frames.again
  const served = frame ? await fetch(origin + frame).then(async response => ({ status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength })) : null
  check(served?.status === 200 && served.type === 'image/png' && served.bytes > 1000, `the frames are served for the creator (${JSON.stringify(served)})`)

  // ——— The scene says so, under the stage ———
  await focusApp()
  const notice = await waitFor(`() => { const seen = (${failureNotice})(); return seen && seen.kind === 'unverified' ? seen : null }`, 30)
  check(Boolean(notice) && notice.role === 'alert' && /^The preview of r\d+ could not be verified after 6 attempts\. The last check found: Seeking to [\d.]+s twice shows two different frames \(\d+ pixels differ, within x \d+–\d+, y \d+–\d+\)( — and \d+ more problems?)?\. The stage keeps the reference\.$/.test(notice.text), `the scene says the preview could not be verified, with the last check in a line (${notice?.text})`)
  const approveUnpreviewed = await evaluate(`() => document.querySelector('#scene-workspace .sw-actions [data-action="approve-unpreviewed"]')?.textContent || ''`)
  check(JSON.stringify(notice?.buttons) === JSON.stringify([`Preview r${plan.revision} again`, 'Change the harness or model']) && notice.inspect === 'Inspect the 6 checks' && approveUnpreviewed === `Approve r${plan.revision} without a preview`, `it offers the ways on — again, another harness, and above it approval without a preview — and every check to inspect (${JSON.stringify(notice && { buttons: notice.buttons, inspect: notice.inspect, approveUnpreviewed })})`)
  await evaluate(`() => { document.querySelector('#scene-workspace .ws-build-failure .review-disclosure').open = true; return true }`)
  // The newest check's frames, scrolled to: they load as they come into view.
  await waitFor(`() => { const figure = document.querySelector('#scene-workspace .ws-build-failure .ws-checks .ws-evidence'); if (!figure) return null; figure.scrollIntoView({ block: 'center' }); return true }`, 20)
  const inspected = await waitFor(`() => {
    const panel = document.querySelector('#scene-workspace .ws-build-failure .ws-checks')
    const figure = panel?.querySelector('.ws-evidence')
    if (!figure) return null
    figure.scrollIntoView({ block: 'center' })
    const images = [...figure.querySelectorAll('.ws-evidence-frame img')]
    if (images.length !== 2 || images.some(image => !image.complete || !image.naturalWidth)) return null
    return { attempts: [...panel.querySelectorAll('.ws-check h4')].map(heading => heading.textContent.replace(/ ·.*$/, '')), frames: images.map(image => image.naturalWidth), labels: [...figure.querySelectorAll('.ws-evidence-label')].map(label => label.textContent), regions: figure.querySelectorAll('.ws-evidence-region').length, caption: figure.querySelector('figcaption')?.textContent || '' }
  }`, 30)
  if (!inspected) console.log('DIAGNOSIS', JSON.stringify(await evaluate(`() => { const box = document.querySelector('#scene-workspace .ws-build-failure'); const details = box?.querySelector('.review-disclosure'); const panel = box?.querySelector('.ws-checks'); const images = [...(panel?.querySelectorAll('img') || [])]; return { open: details?.open, panel: Boolean(panel), checks: panel?.querySelectorAll('.ws-check').length, images: images.map(image => ({ complete: image.complete, natural: image.naturalWidth, src: image.getAttribute('src'), rect: image.getBoundingClientRect().height })) } }`)))
  check(inspected?.attempts.join('|') === 'Attempt 6 of 6|Attempt 5 of 6|Attempt 4 of 6|Attempt 3 of 6|Attempt 2 of 6|Attempt 1 of 6' && inspected.labels.join('|') === 'First seek|Second seek' && inspected.regions === 2 && /seeked twice: \d+ pixels differ, within x \d+–\d+, y \d+–\d+\. Layer “marker” is at x/.test(inspected.caption), `every check can be inspected, newest first, each seek's two frames with where they differ outlined (${JSON.stringify(inspected && { ...inspected, caption: inspected.caption.slice(0, 120) })})`)
  await shot('01-could-not-be-verified')

  // ——— A reload keeps it ———
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  const reloaded = await waitFor(`() => { const seen = (${failureNotice})(); return seen && seen.kind === 'unverified' ? seen : null }`, 60)
  check(reloaded?.text === notice?.text && reloaded.inspect === 'Inspect the 6 checks', 'after a reload the scene says the same, with the same checks')

  // ——— Approved without a preview and produced: the failure is history ———
  await clickText('#scene-workspace .sw-actions .button', `Approve r${plan.revision} without a preview`)
  check(Boolean(await until(async () => (await overview(videoId)).scenes[0].view.reviewed?.id === plan.id, 30)), 'the plan is approved without a preview')
  await focusApp()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Produce the scene' || null`, 30)
  await clickText('#scene-workspace .sw-actions .button', 'Produce the scene')
  const produced = await until(async () => { const production = (await overview(videoId)).scenes[0].production; return production?.ready ? production : null }, 180)
  check(Boolean(produced?.ready), 'the scene is produced from the approved plan')
  await focusApp()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Review the output' || null`, 30)
  await clickText('#scene-workspace .sw-actions .button', 'Review the output')
  const history = await waitFor(`() => { const seen = (${failureNotice})(); return seen && seen.history && document.querySelector('.scene-stage-modes .is-active')?.dataset.stageMode === 'output' ? seen : null }`, 40)
  check(Boolean(history) && history.role === 'status' && /^The preview of r\d+ could not be verified after 6 attempts\. It is kept in the preview’s history; the stage plays the scene’s production\.$/.test(history.text) && !/keeps the reference/.test(history.text) && history.buttons.length === 0 && history.inspect === 'Inspect the 6 checks', `with the production on the stage, the failed preview is history — it never says the stage keeps the reference (${history?.text})`)
  await shot('02-history-while-the-production-plays')

  // ——— Asked for again, the sketch is given the last check, and passes ———
  const again = (await post(`/api/planning/${encodeURIComponent(videoId)}/scenes/${encodeURIComponent(sceneId)}/preview`, { again: true })).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Sketch Scene', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(again.record.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  const repaired = await until(async () => { const preview = (await overview(videoId)).scenes[0].preview; return preview?.latest.id === again.record.id && ['ready', 'failed'].includes(preview.latest.status) ? preview : null }, 120)
  const retryRun = (await api('/api/runs')).body.runs.find(run => run.route === 'Sketch Scene' && run.id !== sketchRun?.id && !runsBefore.includes(run.id))
  const seen = retryRun ? JSON.parse(await readFile(join(retryRun.projectDir, 'planning', 'last-check-seen.json'), 'utf8').catch(() => 'null')) : null
  check(Boolean(seen) && seen.told && /refused 6 times: The preview could not be verified after 6 attempts/.test(seen.lastCheck) && seen.frames.length >= 2 && seen.frames.every(entry => entry.exists), `the new sketch was given the last check and its frames (${JSON.stringify(seen && { told: seen.told, frames: seen.frames.length })})`)
  check(repaired?.latest.status === 'ready' && repaired.ready?.checked?.reseeks > 0 && !repaired.latest.validation, `repaired on the timeline, it passes the same, unchanged check first time (${repaired?.latest.status}, ${repaired?.ready?.checked?.reseeks} reseeks)`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PREVIEW EXHAUSTED CHECK FAIL (${failures})` : 'PREVIEW EXHAUSTED CHECK PASS')
process.exitCode = failures ? 1 : 0
