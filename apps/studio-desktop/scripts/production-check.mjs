// Scene production (P4) — an engineering fixture: the harness is a stub, so
// this proves the machinery, never a production's quality.
//
// Two scenes of a video are planned and approved: one delivered by a
// generated voice, one silent by choice. The next step produces the first:
// the product speaks the approved narration and measures it into the
// scene's clock before the run, then a "Produce Scene" run on the producer
// skill — offered only the production tools — builds the scene on that
// clock. Its first submission keeps the plan's estimates and a stand-in and
// is refused; the second is played in the pinned engine and lands. The
// stage plays it on its real clock; accepting renders it once, and the
// notebook then plays that render in the scene's place. With both scenes
// accepted the next step is the video's export, which renders each
// produced scene with its own sound — the voice where there is one, and
// silence where the creator chose it. The creator can put the notebook's
// own scene back and take the production again; approving a new plan
// leaves the accepted production playing, marked out of date.
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const fixtures = fileURLToPath(new URL('../../studio-v2/server/fixtures/visual-cast/', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-production-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness ———
// Each produced scene fills the frame with its own colour, so the export
// shows whose frames it plays: green for the voiced scene, blue for the silent one.
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-production', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-production', result: 'stub done' }); process.exit(code) }
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
  fs.writeFileSync('planning/stub-args.json', JSON.stringify({ allowedTools: flag('--allowedTools'), mcpUrl: mcp.env.STUDIO_MCP_URL }))
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
    // The boundary: a production run is offered only its own tools.
    fs.writeFileSync('planning/refused.json', JSON.stringify(await tool('plan_submit_treatment', { projectDir })))
    const id = context.composition.id
    const colour = clock.kind === 'silent' ? '#1d4ed8' : '#12a150'
    const titles = Object.fromEntries(plan.plan.moments.map(moment => [moment.id, moment.title]))
    const moments = clock.moments.map(moment => ({ id: moment.id, title: titles[moment.id], start: moment.start, end: moment.end }))
    const duration = clock.duration
    const clip = moment => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + Number((moment.end - moment.start).toFixed(3)) + '" data-track-index="0"><div class="title" data-sketch-layer="titles">' + moment.title + '</div></div>'
    const html = (list, length) => '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:' + colour + '}#root{position:relative;width:100%;height:100%;overflow:hidden;background:' + colour + ';font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font-size:72px;font-weight:700}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + length + '">' +
      list.map(clip).join('') +
      (clock.audio ? '<audio id="voice" src="' + clock.audio + '" data-start="0" data-duration="' + length + '" data-track-index="20"></audio>' : '') +
      '</div><script>window.__timelines = window.__timelines || {}\nconst tl = gsap.timeline({ paused: true })\n' +
      list.map(moment => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, " + moment.start + ")").join('\n') +
      '\nwindow.__timelines["' + id + '"] = tl</script></body></html>'
    const manifest = list => ({
      version: 1, kind: 'production', scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration: list[list.length - 1].end }, runtime: { hyperframes: '0.7.106' },
      clock: { kind: clock.kind, audio: clock.audio }, moments: list,
      layers: [{ id: 'titles', kind: 'text', label: 'Moment titles', moments: list.map(moment => moment.id) }],
      unmet: [],
    })
    fs.mkdirSync('production/audio', { recursive: true })
    if (clock.audio) fs.copyFileSync('packet/' + clock.audio, 'production/' + clock.audio)
    // First: the plan's estimates, not the clock — and a stand-in.
    let at = 0
    const estimated = plan.plan.moments.map(moment => { const start = at; at += moment.estimateSeconds; return { id: moment.id, title: moment.title, start, end: at } })
    const first = manifest(estimated)
    first.layers.push({ id: 'limiter', kind: 'object', label: 'Limiter', moments: [estimated[0].id], placeholder: 'A box for now' })
    fs.writeFileSync('production/manifest.json', JSON.stringify(first))
    fs.writeFileSync('production/index.html', html(estimated, at))
    fs.writeFileSync('planning/production-first.json', JSON.stringify(await tool('produce_submit_scene', { projectDir })))
    // Then on the clock, as it is.
    fs.writeFileSync('production/manifest.json', JSON.stringify(manifest(moments), null, 2))
    fs.writeFileSync('production/index.html', html(moments, duration))
    const answer = await tool('produce_submit_scene', { projectDir })
    fs.writeFileSync('planning/production-second.json', JSON.stringify(answer))
    if (!answer.accepted) process.stderr.write('stub production refused: ' + JSON.stringify(answer) + '\n')
  } else {
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const scene = fs.readFileSync('packet/SCENE.md', 'utf8')
    const slower = /slower/i.test(scene)
    const moment = (id, title) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility: 'hidden', reason: 'No presenter in this scene' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: slower ? 3 : 2 })
    const moments = [moment('m1', 'Requests arrive'), moment('m2', 'The limit bites'), moment('m3', 'Load stays safe')]
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show requests, then the limit biting.', demonstration: null, ledger: null,
      moments, objects: [], treatments: { presenter: 'Off camera', text: 'None', camera: 'Holds' },
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

// ——— The app ———
let child
let origin
const launch = async () => {
  child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_CLAUDE_BIN: stubPath, FISH_AUDIO_API_KEY: '' },
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
  if (!process.env.PRODUCTION_SHOTS) return
  await sleep(900)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.PRODUCTION_SHOTS, { recursive: true })
  await writeFile(join(process.env.PRODUCTION_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const saved = id => api(`/api/projects/${encodeURIComponent(id)}`).then(r => r.body.project)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)
const focusApp = () => evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
const click = selector => waitFor(`() => { const button = document.querySelector(${JSON.stringify(selector)}); if (!button || button.disabled) return null; button.click(); return true }`, 60)
const nextStep = () => evaluate(`() => { const button = document.getElementById('next-step'); return { label: button.textContent, title: button.title, action: button.dataset.action, scene: button.dataset.scene, disabled: button.disabled, hidden: button.hidden } }`)
const waitStep = async (label, seconds = 30) => {
  await focusApp()
  return waitFor(`() => { const button = document.getElementById('next-step'); return !button.hidden && button.textContent === ${JSON.stringify(label)} ? { label: button.textContent, title: button.title, action: button.dataset.action, scene: button.dataset.scene, disabled: button.disabled } : null }`, seconds)
}
const ffprobe = args => {
  const run = spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error('ffprobe: ' + run.stderr.slice(0, 160))
  return run.stdout.trim()
}
// The average colour of a patch of one frame, as [r, g, b].
const colourAt = (path, seconds) => {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', path, '-frames:v', '1', '-vf', 'crop=60:60:1600:640,scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  if (run.status !== 0 || run.stdout.length < 3) throw new Error('ffmpeg frame: ' + String(run.stderr).slice(0, 160))
  return [...run.stdout.subarray(0, 3)]
}
const near = (colour, hex) => {
  const want = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16))
  return colour.every((value, index) => Math.abs(value - want[index]) < 28)
}
// The loudest sample of an interval of the export's sound, in dB.
const loudness = (path, start, length) => {
  const run = spawnSync('ffmpeg', ['-v', 'info', '-ss', String(start), '-t', String(length), '-i', path, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' })
  const max = /max_volume: (-?[\d.]+|-inf) dB/.exec(run.stderr)
  return max ? (max[1] === '-inf' ? -Infinity : Number(max[1])) : null
}

try {
  await launch()
  // ——— A base of two pages, its video, a brief, and two approved plans ———
  const narrative = 'Rate limiters keep an API alive under load. The concurrency limiter lets only twenty requests run at once.\n\nA token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `production-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-production', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b06', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'The concurrency limiter lets only twenty requests run at once.'),
      await page('b10', 'The token bucket', '10_the_token_bucket.svg', 'A token bucket refills at a steady rate.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `production-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  // Each scene's delivery comes first: a plan is made for it.
  const sceneIds = (await overview(videoId)).scenes.map(scene => scene.id)
  const deliver = (subject, delivery) => api(`/api/planning/${videoId}/inputs`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, delivery }) })
  check((await deliver(sceneIds[0], 'generated')).status === 200 && (await deliver(sceneIds[1], 'silent')).status === 200, 'scene 1 is delivered by a generated voice, scene 2 is silent by choice')
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens')
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  check(Boolean(await until(async () => (await overview(videoId)).brief.current, 90)), 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  const approve = async index => {
    await focusApp()
    await selectScene(index)
    await click('.scene-review.is-expanded [data-focus^="revise:"]')
    const plan = await until(async () => { const view = (await overview(videoId)).scenes[index].view; return view.current?.status === 'candidate' && view.current }, 90)
    await click('.scene-review.is-expanded [data-focus^="approve:"]')
    return until(async () => { const view = (await overview(videoId)).scenes[index].view; return view.reviewed?.id === plan?.id && view.reviewed }, 30)
  }
  const plan1 = await approve(0)
  const plan2 = await approve(1)
  check(Boolean(plan1 && plan2), `both scenes are planned and approved (r${plan1?.revision}, r${plan2?.revision})`)
  const runsBefore = (await api('/api/runs')).body.runs.map(run => run.id)

  // ——— The next step produces the approved scene ———
  await selectScene(0)
  const produceStep = await waitStep('Produce scene 1')
  check(produceStep?.action === 'produce' && produceStep.scene === sceneIds[0] && !produceStep.disabled, `the next step is to produce scene 1 from its approved plan (${JSON.stringify(produceStep)})`)
  const before = await evaluate(`() => { const review = document.querySelector('.scene-review.is-expanded [data-review-production]'); return review ? { text: review.textContent, button: review.querySelector('[data-focus^="produce:"]')?.textContent } : null }`)
  check(before?.button === `Produce scene from r${plan1.revision}` && /Output: not produced/.test(await evaluate(`() => document.querySelector('.scene-review.is-expanded .review-strip')?.textContent || ''`)), `the review offers production of the approved plan, and says nothing is produced (${before?.button})`)
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  const produced1 = await until(async () => { const production = (await overview(videoId)).scenes[0].production; return production?.ready ? production : null }, 180)
  check(Boolean(produced1?.ready?.current) && produced1.ready.of.record === plan1.id, `the scene is produced from its approved plan (${JSON.stringify(produced1?.ready?.of)})`)
  const productionRun = (await api('/api/runs')).body.runs.find(run => run.route === 'Produce Scene' && !runsBefore.includes(run.id))
  check(productionRun?.skill === 'scene-producer' && productionRun.status === 'done', `it ran as a Produce Scene run on the producer skill (${productionRun?.skill} ${productionRun?.status})`)
  const stubArgs = JSON.parse(await readFile(join(productionRun.projectDir, 'planning', 'stub-args.json'), 'utf8'))
  check(stubArgs.allowedTools === 'Read,Write,Edit,Glob,Grep,mcp__studio__produce_*' && /\/mcp\?scope=production$/.test(stubArgs.mcpUrl), `the run has no shell, and only the production tools (${stubArgs.allowedTools} · ${stubArgs.mcpUrl.replace(/^.*\/mcp/, '/mcp')})`)
  const refused = JSON.parse(await readFile(join(productionRun.projectDir, 'planning', 'refused.json'), 'utf8'))
  check(/not available to a production run/.test(refused.error || ''), `a planning tool is refused to it (${refused.error})`)
  const clock = JSON.parse(await readFile(join(productionRun.projectDir, 'packet', 'CLOCK.json'), 'utf8'))
  check(clock.kind === 'generated-voice' && clock.audio === 'audio/narration.mp3' && clock.provider === 'Local system voice' && clock.spoken.map(entry => entry.words).join(' ') === 'Requests arrive. The limit bites. Load stays safe.' && clock.moments.every((moment, index) => index === 0 || moment.start === clock.moments[index - 1].end), `the product spoke the approved narration and measured its clock before the run (${clock.duration}s: ${clock.moments.map(moment => `${moment.id} ${moment.start}–${moment.end}`).join(', ')})`)
  const first = JSON.parse(await readFile(join(productionRun.projectDir, 'planning', 'production-first.json'), 'utf8'))
  check(first.accepted === false && first.problems.some(problem => /^moment m1 must keep the clock/.test(problem)) && first.problems.some(problem => /^layer limiter is a placeholder/.test(problem)), `a production on the plan's estimates, with a stand-in, is refused with why (${first.problems?.slice(0, 2).join(' | ')})`)
  const record1 = (await api(`/api/planning/records/${produced1.ready.id}`)).body.record
  const proof1 = record1?.report?.verification
  check(record1?.status === 'ready' && /^[0-9a-f]{64}$/.test(proof1?.bundle || '') && proof1.loaded.some(path => path.endsWith('audio/narration.mp3')), `the accepted submission was played in the pinned engine, which loaded its sound (${proof1?.bundle?.slice(0, 12)})`)
  check(produced1.ready.summary.clock === 'generated-voice' && produced1.ready.summary.duration === clock.duration && produced1.ready.summary.moments.every((moment, index) => moment.start === clock.moments[index].start), `the production keeps the voice's clock (${produced1.ready.summary.duration}s)`)

  // ——— The stage plays it on its real clock ———
  const reviewStep = await waitStep('Review scene 1 output')
  check(reviewStep?.action === 'review-output', `the next step is to review what was produced (${reviewStep?.label})`)
  const chips = await waitFor(`() => { const chips = [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent); return chips.includes('Output: produced — review it') ? chips : null }`, 30)
  check(Boolean(chips), `the scene's strip says it is produced and waits for review (${chips})`)
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  const stage = await waitFor(`() => {
    const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)')
    // The produced scene once its player has taken the stage.
    if (!player || document.getElementById('scene-stage-preview').hidden || player.getAttribute('src') !== ${JSON.stringify(`${produced1.ready.url}?e=0`)}) return null
    const output = document.querySelector('[data-stage-mode="output"]')
    return { src: player.getAttribute('src'), mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, enabled: !output.disabled, note: document.getElementById('scene-stage-note').textContent, moments: [...document.querySelectorAll('.scene-stage-moment')].map(button => button.textContent), clock: document.querySelector('.scene-stage-clock').textContent }
  }`, 30)
  check(stage?.src === `${produced1.ready.url}?e=0` && stage.mode === 'Produced scene' && stage.enabled, `the stage plays the produced scene, with no edits yet (${JSON.stringify(stage && { src: stage.src, mode: stage.mode })})`)
  check(stage?.note === `Produced from plan r${plan1.revision}, on a generated voice · not accepted yet` && stage.moments.join('|') === 'Requests arrive|The limit bites|Load stays safe' && !/est\./.test(stage.clock), `the stage says what it plays, on its real clock, not an estimate (${stage?.note} · ${stage?.clock})`)
  const noSketch = await evaluate(`() => document.querySelector('.scene-review.is-expanded .review-no-preview')?.textContent || ''`)
  check(noSketch === `No preview of r${plan1.revision} yet — it was produced without one.`, `the review does not claim the stage shows the page while it plays the production (${noSketch})`)
  const loaded = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)'); return player.duration > 0 ? player.duration : null }`, 40)
  check(Math.abs((loaded || 0) - clock.duration) < 0.25, `the engine loaded it for its clock's length (${loaded}s of ${clock.duration}s)`)
  const transport = await waitFor(`() => { const label = document.querySelector('.scene-stage-transport > button').getAttribute('aria-label'); return label === 'Play the produced scene' ? label : null }`, 20)
  check(Boolean(transport), `the transport names what it plays (${transport})`)
  await evaluate(`() => { document.querySelectorAll('.scene-stage-moment')[1].click(); return true }`)
  const seeked = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)'); return Math.abs(player.currentTime - ${clock.moments[1].start}) < 0.25 ? player.currentTime : null }`, 20)
  check(seeked !== null, `its timeline seeks to a moment on the clock (${seeked}s)`)
  await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[2].click(); return true }`)
  const followed = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player:not(.is-loading)'); return Math.abs(player.currentTime - ${clock.moments[2].start}) < 0.25 ? player.currentTime : null }`, 20)
  check(followed !== null, `selecting a moment in the review seeks the production (${followed}s)`)
  await shot('01-production-on-stage')

  // ——— Accepting renders it once; the notebook plays that render ———
  await click('.scene-review.is-expanded [data-focus^="accept-production:"]')
  const accepted1 = await until(async () => { const project = await saved(videoId); return project?.producedScenes?.[sceneIds[0]] ? project.producedScenes[sceneIds[0]] : null }, 180)
  check(accepted1?.productionId === produced1.ready.id && /^http:\/\/(127\.0\.0\.1|localhost):\d+\/objects\/.+\.mp4$/.test(accepted1.videoUrl) && accepted1.voiced === true && accepted1.plan.record === plan1.id && Math.abs(accepted1.durationMs - clock.duration * 1000) < 5, `accepting renders it and makes it the scene's output in the notebook (${JSON.stringify(accepted1 && { ...accepted1, videoUrl: accepted1.videoUrl.replace(/^.*\/objects\//, '/objects/') })})`)
  const render1 = await fetch(accepted1.videoUrl).then(async response => Buffer.from(await response.arrayBuffer()))
  await writeFile(join(root, 'scene-1.mp4'), render1)
  check(render1.subarray(4, 8).toString('latin1') === 'ftyp' && Boolean(ffprobe(['-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', join(root, 'scene-1.mp4')])), 'the render is an MP4 with the scene\'s sound')
  const reviewed = await waitFor(`() => {
    const review = document.querySelector('.scene-review.is-expanded')
    const chips = [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent)
    const output = review.querySelector('[data-review-output]')
    return chips.includes('Output: accepted') && output ? { chips, output: output.dataset.reviewOutput, text: output.textContent, toggle: review.querySelector('[data-focus^="use-production:"]')?.textContent, note: document.getElementById('scene-stage-note').textContent } : null
  }`, 30)
  check(reviewed?.output === 'plays' && reviewed.toggle === 'Play the notebook\'s own scene' && /· accepted$/.test(reviewed.note), `the review says the notebook plays it, and offers the notebook's own scene back (${JSON.stringify(reviewed && { output: reviewed.text, toggle: reviewed.toggle, note: reviewed.note })})`)
  const composition = await waitFor(`async () => {
    const src = document.getElementById('player')?.getAttribute('src')
    if (!src) return null
    const html = await fetch(src).then(response => response.text())
    const video = /<video class="recorded-take produced-scene clip"[^>]*>/.exec(html)
    return video ? { tag: video[0], audio: /<audio [^>]*src="[^"]*\\/objects\\/[^"]*\\.mp4"/.test(html) } : null
  }`, 30)
  check(Boolean(composition?.tag?.includes('/objects/')) && composition.audio, `the notebook's composition plays the render in the scene's place, with its sound (${composition?.tag?.replace(/src="[^"]*\/objects\//, 'src=".../objects/').slice(0, 160)})`)

  // ——— The silent scene, produced from its review ———
  await selectScene(1)
  await focusApp()
  await click('.scene-review.is-expanded [data-focus^="produce:"]')
  const produced2 = await until(async () => { const production = (await overview(videoId)).scenes[1].production; return production?.ready ? production : null }, 180)
  const run2 = (await api('/api/runs')).body.runs.find(run => run.route === 'Produce Scene' && run.id !== productionRun.id && !runsBefore.includes(run.id))
  const clock2 = run2 && JSON.parse(await readFile(join(run2.projectDir, 'packet', 'CLOCK.json'), 'utf8'))
  check(produced2?.ready?.summary.clock === 'silent' && clock2?.audio === null && clock2.duration === 6, `the silent scene keeps its plan's estimates, with no sound (${clock2?.duration}s)`)
  await focusApp()
  await click('.scene-review.is-expanded [data-focus^="accept-production:"]')
  const accepted2 = await until(async () => (await saved(videoId))?.producedScenes?.[sceneIds[1]] || null, 180)
  check(accepted2?.voiced === false, 'the silent scene is accepted, and carries no voice')

  // ——— With every scene produced, the export is the video ———
  const exportStep = await waitStep('Export video')
  check(exportStep?.action === 'export' && /Every scene plays the production you accepted/.test(exportStep.title), `the next step is the video's export (${exportStep?.title})`)
  await shot('02-both-produced')
  // Publish, as the creator does: the junction walk, the summary, the export.
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  check(Boolean(await waitFor(`() => { const bar = document.getElementById('finalize-bar'); return bar && !bar.hidden && getComputedStyle(bar).display !== 'none' ? true : null }`, 20)), 'the export step starts Publish')
  await evaluate(`() => { document.getElementById('finalize-next').click(); return true }`)
  const summary = await waitFor(`() => document.getElementById('publish-dialog').open ? { kind: document.getElementById('publish-export-kind').textContent, audio: document.getElementById('publish-audio').textContent, button: document.getElementById('start-publish').textContent, chips: [...document.querySelectorAll('#publish-block-list .publish-audio-chip')].map(chip => chip.dataset.audio + ':' + chip.textContent), stageAside: document.getElementById('scene-stage').hidden } : null`, 20)
  check(summary?.kind === 'Video export — every scene plays the production you accepted from its approved plan.' && summary.audio === 'Audio: 1 of 2 blocks voiced (1 produced scene). 1 silent by choice.' && summary.button === 'Publish video' && summary.chips.join('|') === 'produced:produced scene, with its voice|silent-by-choice:silent by choice', `Publish says the export is the video, and what each scene sounds like (${JSON.stringify(summary)})`)
  check(summary?.stageAside === true, 'behind the summary is the notebook\'s own composition, the review stage aside')
  await shot('02b-publish-summary')
  await evaluate(`() => { document.getElementById('start-publish').click(); return true }`)
  const download = await waitFor(`() => { const result = document.getElementById('render-result'); return result && !result.hidden ? document.getElementById('download-render').href : null }`, 300)
  check(Boolean(download), 'the video exports')
  const jobId = await evaluate(`() => localStorage.getItem('studio.export:' + ${JSON.stringify(videoId)})`)
  const job = (await api(`/api/exports/${jobId}`)).body?.job
  const states = (job?.audio?.blocks || []).filter(block => sceneIds.includes(block.block)).map(block => block.state).join('|')
  check(job?.audio?.voiced === 1 && job.audio.missing === 0 && job.audio.silentDraft === false && states === 'produced|silent-by-choice', `the export's record says what each scene sounds like (${JSON.stringify(job?.audio && { voiced: job.audio.voiced, missing: job.audio.missing, states })})`)
  await evaluate(`() => { document.getElementById('publish-dialog').close(); if (document.getElementById('player-shell').classList.contains('canvas-open')) document.getElementById('canvas-fullscreen').click(); return true }`)
  const exported = join(root, 'export.mp4')
  await writeFile(exported, Buffer.from(await (await fetch(download)).arrayBuffer()))
  const length = Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', exported]))
  const expected = clock.duration + clock2.duration
  check(Math.abs(length - expected) < 0.6, `the video is the two produced scenes, back to back (${length.toFixed(2)}s, expected ${expected.toFixed(2)}s)`)
  const voiced = colourAt(exported, clock.duration / 2)
  const silent = colourAt(exported, clock.duration + clock2.duration / 2)
  check(near(voiced, '#12a150') && near(silent, '#1d4ed8'), `each scene plays its accepted production's frames (${voiced} · ${silent})`)
  const speech = loudness(exported, 0.2, clock.duration - 0.4)
  const hush = loudness(exported, clock.duration + 0.3, clock2.duration - 0.6)
  check(speech !== null && speech > -30 && hush !== null && hush < -60, `the voice plays in the voiced scene, and the silent scene is silent (${speech} dB · ${hush} dB)`)

  // ——— The notebook's own scene back, and the production again ———
  await selectScene(0)
  await focusApp()
  await click('.scene-review.is-expanded [data-focus^="use-production:"]')
  const released = await until(async () => { const project = await saved(videoId); return project && !project.producedScenes?.[sceneIds[0]] && project.producedScenes?.[sceneIds[1]] ? project : null }, 30)
  check(Boolean(released), 'the creator puts the notebook\'s own scene back; the other scene keeps its production')
  const draftStep = await waitStep('Export draft')
  check(/^1 of 2 scenes play the production you accepted/.test(draftStep?.title || ''), `the export is a draft again, and says which scenes are produced (${draftStep?.title})`)
  const kept = await waitFor(`() => { const output = document.querySelector('.scene-review.is-expanded [data-review-output]'); return output?.dataset.reviewOutput === 'kept' ? { text: output.textContent, toggle: document.querySelector('.scene-review.is-expanded [data-focus^="use-production:"]')?.textContent } : null }`, 30)
  check(kept?.toggle === 'Play the accepted production', `the review keeps the accepted production, and offers it again (${kept?.text})`)
  await click('.scene-review.is-expanded [data-focus^="use-production:"]')
  const again = await until(async () => (await saved(videoId))?.producedScenes?.[sceneIds[0]]?.productionId === produced1.ready.id, 30)
  check(Boolean(again) && Boolean(await waitStep('Export video')), 'taking the production again needs no new render, and the export is the video again')

  // ——— New direction, a new plan: the accepted production plays on, out of date ———
  await evaluate(`() => { const box = document.querySelector('.scene-review.is-expanded [data-focus^="direction:"]'); box.value = 'Slower, please'; box.dispatchEvent(new Event('input')); return true }`)
  await click('.scene-review.is-expanded [data-focus^="revise:"]')
  const r2 = await until(async () => { const view = (await overview(videoId)).scenes[0].view; return view.current?.id !== plan1.id && view.current?.status === 'candidate' && view.current }, 90)
  const planMoved = (await overview(videoId)).scenes[0].production?.accepted
  check(Boolean(r2) && planMoved?.current === false && /^its approved plan is stale — .*direction/.test(planMoved.staleBecause || ''), `the new direction makes the approved plan, and so its production, out of date (${planMoved?.staleBecause})`)
  await click('.scene-review.is-expanded [data-focus^="approve:"]')
  const outdated = await until(async () => { const production = (await overview(videoId)).scenes[0].production; return production?.accepted && /^it produces r/.test(production.accepted.staleBecause || '') ? production.accepted : null }, 30)
  check(/^it produces r\d+; the scene's approved plan is r\d+/.test(outdated?.staleBecause || ''), `approving it makes the accepted production out of date, with why (${outdated?.staleBecause})`)
  check((await saved(videoId))?.producedScenes?.[sceneIds[0]]?.productionId === produced1.ready.id, 'the notebook keeps playing the accepted production until the scene is produced again')
  const redo = await waitStep('Produce scene 1 again')
  check(redo?.action === 'produce', `the next step is to produce the scene again (${redo?.label})`)
  const outOfDate = await waitFor(`() => { const chips = [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent); return chips.includes('Output: accepted, out of date') ? chips : null }`, 30)
  check(Boolean(outOfDate), `the scene's strip says its output is out of date (${outOfDate})`)
  await shot('03-out-of-date')

  // ——— Nothing else ran ———
  const newRuns = (await api('/api/runs')).body.runs.filter(run => !runsBefore.includes(run.id))
  check(newRuns.filter(run => run.route === 'Produce Scene').length === 2 && newRuns.every(run => ['Produce Scene', 'Plan Scene'].includes(run.route)), `production ran only when asked (${newRuns.map(run => run.route)})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PRODUCTION CHECK FAIL (${failures})` : 'PRODUCTION CHECK PASS')
process.exitCode = failures ? 1 : 0
