// A scene you present, produced and edited (P5 and P6). This is an
// engineering fixture: the harness is a stub and the take is synthesized
// speech over a painted picture, so it proves the machinery, never a
// production's quality.
//
// P5 — producing the scene from the creator's take:
// - A scene the creator presents is planned: on camera, then graphics only
//   while the voice carries on, then beside the graphics.
// - The review asks for the plan's lines as the script. A take of them is
//   committed through the camera dialog's own archive step.
// - The next step produces the scene on the take's clock: the pinned
//   aligner hears each line. The stub's first submission plays the take
//   unmuted and is refused; the second lands. The take is supplied by the
//   product.
//
// P6 — the creator edits and exports it:
// - The creator nudges when the graphics' headline appears; the stage plays
//   the edit at once. Undo and redo walk it back and forth.
// - Accepting renders it with the edit. The export is the video: the take's
//   picture full frame, then the graphics with the voice still speaking,
//   then the picture beside the graphics. The headline appears where the
//   edit put it.
// - Reopened, the notebook still plays edit 3.
// - Producing the scene again carries the edit. A change the controls
//   cannot make goes to the producer as a note.
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
const root = await mkdtemp(join(tmpdir(), 'studio-presented-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}
const need = (command, args) => spawnSync(command, args, { stdio: 'ignore' }).status === 0
if (!need('uv', ['--version']) || !need('/usr/bin/say', ['-v', '?'])) {
  console.log('PRESENTED PRODUCTION CHECK SKIP: needs uv (the pinned aligner) and the macOS system voice')
  process.exit(0)
}

// The plan's lines, which the take speaks; and the second line as a newer
// plan says it, plainly.
const LINES = [
  'Every request passes through the limiter first.',
  'When the bucket is empty, the next request is turned away.',
  'That is how the limit keeps the service alive.',
]
const PLAIN = 'When the bucket is empty, the request is refused.'

// ——— The stub harness ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-presented', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-presented', result: 'stub done' }); process.exit(code) }
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
const LINES = ${JSON.stringify(LINES)}
const PLAIN = ${JSON.stringify(PLAIN)}
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
    const at = Object.fromEntries(clock.moments.map(moment => [moment.id, moment]))
    const title = Object.fromEntries(plan.plan.moments.map(moment => [moment.id, moment.title]))
    const duration = clock.duration
    const m2 = at.m2, m3 = at.m3
    const room = Math.floor((m2.end - m2.start - 0.25) * 100) / 100
    const controls = [{ id: 'm2-title', label: 'When the headline appears', kind: 'offset', moment: 'm2', default: 0.2, min: 0, max: room }]
    const clip = (moment, body, track) => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + Number((moment.end - moment.start).toFixed(3)) + '" data-track-index="' + track + '">' + body + '</div>'
    // The take full frame in m1, out of view in m2 while the voice carries
    // on, beside the graphics in m3: one picture, in step with the voice.
    const html = muted => '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#4c1d95}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#4c1d95;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}' +
      '.title{position:absolute;left:120px;top:90px;color:#fff;font-size:72px;font-weight:700}#presenter{position:absolute;top:0;left:0;width:1920px;height:1080px;overflow:hidden}#presenter video{width:100%;height:100%;object-fit:cover}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      clip(m2, '<div class="title" data-sketch-layer="titles">' + title.m2 + '</div>', 0) +
      clip(m3, '<div class="title" data-sketch-layer="titles">' + title.m3 + '</div>', 1) +
      '<div id="presenter" data-sketch-layer="presenter"><video id="take" src="' + clock.video + '"' + (muted ? ' muted' : '') + ' playsinline data-start="0" data-duration="' + duration + '" data-track-index="10"></video></div>' +
      '<audio id="voice" src="' + clock.audio + '" data-start="0" data-duration="' + duration + '" data-track-index="20"></audio>' +
      '</div><script>window.__timelines = window.__timelines || {}\nconst tl = gsap.timeline({ paused: true })\n' +
      "tl.to('#presenter', { opacity: 0, duration: 0.3 }, " + m2.start + ")\n" +
      "tl.fromTo('#m2 .title', { opacity: 0 }, { opacity: 1, duration: 0.3 }, " + m2.start + " + (window.__controls?.[\"m2-title\"] ?? 0.2))\n" +
      "tl.set('#presenter', { left: 960, width: 960 }, " + m3.start + ")\n" +
      "tl.to('#presenter', { opacity: 1, duration: 0.3 }, " + m3.start + ")\n" +
      "tl.fromTo('#m3 .title', { opacity: 0 }, { opacity: 1, duration: 0.3 }, " + m3.start + ")\n" +
      'window.__timelines["' + id + '"] = tl</script></body></html>'
    const manifest = {
      version: 1, kind: 'production', scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' },
      clock: { kind: clock.kind, audio: clock.audio }, moments: clock.moments.map(moment => ({ id: moment.id, title: title[moment.id], start: moment.start, end: moment.end })),
      layers: [{ id: 'presenter', kind: 'presenter', label: 'You', moments: ['m1', 'm3'] }, { id: 'titles', kind: 'text', label: 'Headlines', moments: ['m2', 'm3'] }],
      unmet: [], controls,
    }
    fs.mkdirSync('production', { recursive: true })
    fs.writeFileSync('production/manifest.json', JSON.stringify(manifest, null, 2))
    // First: the take's picture keeps its own sound — the voice would play twice.
    fs.writeFileSync('production/index.html', html(false))
    fs.writeFileSync('planning/production-first.json', JSON.stringify(await tool('produce_submit_scene', { projectDir })))
    fs.writeFileSync('production/index.html', html(true))
    const answer = await tool('produce_submit_scene', { projectDir })
    if (!answer.accepted) process.stderr.write('stub production refused: ' + JSON.stringify(answer) + '\n')
  } else {
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const moment = (id, title, say, visibility) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: say }, objects: null, text: null, presenter: { visibility, reason: 'The creator presents it' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 3 })
    const plainly = /plainly/i.test(fs.readFileSync('packet/SCENE.md', 'utf8'))
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Meet the limiter, see it bite, come back to the viewer.', demonstration: null, ledger: null,
      moments: [moment('m1', 'Meet the limiter', LINES[0], 'full'), moment('m2', 'The limit bites', plainly ? PLAIN : LINES[1], 'hidden'), moment('m3', 'Load stays safe', LINES[2], 'shared')],
      objects: [], treatments: { presenter: 'On camera, off for the mechanism, beside it to close', text: 'Headlines', camera: 'Holds' },
      skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
      requirements: { assets: [], takes: [], decisions: [] },
      continuity: { entry: 'The creator in view', exit: 'The creator beside the limit', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
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
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const saved = id => api(`/api/projects/${encodeURIComponent(id)}`).then(r => r.body.project)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)
const focusApp = () => evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
const click = selector => waitFor(`() => { const button = document.querySelector(${JSON.stringify(selector)}); if (!button || button.disabled) return null; button.click(); return true }`, 60)
const waitStep = async (label, seconds = 30) => {
  await focusApp()
  return waitFor(`() => { const button = document.getElementById('next-step'); return !button.hidden && button.textContent === ${JSON.stringify(label)} ? { label: button.textContent, title: button.title, action: button.dataset.action, disabled: button.disabled } : null }`, seconds)
}
const ffprobe = args => {
  const run = spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error('ffprobe: ' + run.stderr.slice(0, 160))
  return run.stdout.trim()
}
// The average colour of a patch of one frame, as [r, g, b].
const colourAt = (path, seconds, [x, y, w, h]) => {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', path, '-frames:v', '1', '-vf', `crop=${w}:${h}:${x}:${y},scale=1:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  if (run.status !== 0 || run.stdout.length < 3) throw new Error('ffmpeg frame: ' + String(run.stderr).slice(0, 160))
  return [...run.stdout.subarray(0, 3)]
}
const near = (colour, hex, tolerance = 30) => {
  const want = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16))
  return colour.every((value, index) => Math.abs(value - want[index]) < tolerance)
}
const loudness = (path, start, length) => {
  const run = spawnSync('ffmpeg', ['-v', 'info', '-ss', String(start), '-t', String(length), '-i', path, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' })
  const max = /max_volume: (-?[\d.]+|-inf) dB/.exec(run.stderr)
  return max ? (max[1] === '-inf' ? -Infinity : Number(max[1])) : null
}
// An element of the stage's composition, seeked to a time, as its own
// document reads it — once the composition there is loaded.
const stageOpacityAt = (seconds, selector) => evaluate(`async () => {
  const player = document.querySelector('#scene-stage-preview hyperframes-player')
  for (let i = 0; i < 60; i++) {
    const doc = player.iframe && player.iframe.contentDocument
    const element = doc && doc.querySelector(${JSON.stringify(selector)})
    if (element && player.duration > 0) {
      player.seek(${seconds})
      for (let j = 0; j < 20; j++) {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        if (Math.abs(player.currentTime - ${seconds}) < 0.05) return Number(doc.defaultView.getComputedStyle(element).opacity)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}`)

// A take of lines: the camera's picture (a colour, with a white box that
// moves, so its frames differ) and the creator's voice, with pauses.
const makeTake = async (lines = LINES, colour = '0xe11d48', name = 'take') => {
  const voice = join(root, `${name}.aiff`)
  const said = spawnSync('/usr/bin/say', ['-o', voice, lines.join(' [[slnc 800]] ')])
  if (said.status !== 0) throw new Error('say failed')
  const take = join(root, `${name}.webm`)
  const made = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${colour}:size=1280x720:rate=30`, '-i', voice, '-filter_complex', "[0:v]drawbox=x='mod(t*300,1180)':y=40:w=100:h=100:color=white:t=fill[v]", '-map', '[v]', '-map', '1:a', '-shortest', '-c:v', 'libvpx', '-deadline', 'realtime', '-b:v', '1500k', '-c:a', 'libopus', take])
  if (made.status !== 0) throw new Error('ffmpeg take failed: ' + String(made.stderr).slice(0, 200))
  return { path: take, seconds: Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', take])) }
}

try {
  await launch()
  const narrative = 'Rate limiters keep an API alive under load. A token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `presented-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-presented', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'b10', title: 'The token bucket', script: 'A token bucket refills at a steady rate.', directorNotes: 'The token bucket', sourcePassages: [], svg: await readFile(join(fixtures, '10_the_token_bucket.svg'), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } }] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `presented-${Date.now()}`, title: 'Rate limiters · presented' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  const sceneId = (await overview(videoId)).scenes[0].id
  check((await api(`/api/planning/${videoId}/inputs`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: sceneId, delivery: 'human' }) })).status === 200, 'the creator presents the scene')
  check(Boolean(await openNotebook(videoId, 'Rate limiters · presented')), 'the video notebook opens')
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  check(Boolean(await until(async () => (await overview(videoId)).brief.current, 90)), 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await focusApp()
  await selectScene(0)
  await click('.scene-review.is-expanded [data-focus^="revise:"]')
  const plan = await until(async () => { const view = (await overview(videoId)).scenes[0].view; return view.current?.status === 'candidate' && view.current }, 90)
  await click('.scene-review.is-expanded [data-focus^="approve:"]')
  check(Boolean(await until(async () => (await overview(videoId)).scenes[0].view.reviewed?.id === plan?.id, 30)), `the plan is approved: on camera, then graphics while the voice carries on, then beside them (r${plan?.revision})`)

  // ——— P5: before a take, the review and the next step say what is needed ———
  const noTake = await waitFor(`() => { const box = document.querySelector('.scene-review.is-expanded [data-review-production]'); const produce = box?.querySelector('[data-focus^="produce:"]'); return box && /Record and select a take of this scene first/.test(box.textContent) ? { disabled: produce?.disabled } : null }`, 30)
  check(noTake?.disabled === true, 'production waits for the creator\'s take, and says so')
  const recordStep = await waitStep('Record scene 1')
  check(recordStep?.action === 'record', `the next step is to record the scene (${recordStep?.title})`)
  // The plan's lines become the scene's script; the take is recorded against them.
  await click('.scene-review.is-expanded [data-focus^="use-plan-script:"]')
  const adopted = await waitFor(`() => { const node = document.querySelector('#editor .tiptap > [data-block-type="scene"]'); return node ? true : null }`, 10)
  check(Boolean(adopted) && (await until(async () => (await saved(videoId))?.notebook?.content?.find(node => node.attrs?.id === sceneId)?.attrs?.script === LINES.join('\n\n'), 30)), 'the plan\'s lines are the scene\'s script')
  const take = await makeTake()
  const asset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-asset-name': `camera-${sceneId}.webm`, 'x-project-id': videoId, 'x-block-id': sceneId }, body: await readFile(take.path) }).then(response => response.json())
  const committed = await evaluate(`() => window.__timing.archive(${JSON.stringify(sceneId)}, ${JSON.stringify({ url: asset.url, assetId: asset.assetId })}, ${Math.round(take.seconds * 1000)})`)
  check(committed?.role === 'presenter' && committed.script?.lines?.length === 3, `the take is committed as the scene's camera take, against the plan's lines (${take.seconds.toFixed(2)}s)`)
  await until(async () => (await saved(videoId))?.recordedBlocks?.[sceneId]?.recordingId === committed?.recordingId, 30)

  // ——— The next step produces it on the take's clock ———
  await selectScene(0)
  const produceStep = await waitStep('Produce scene 1', 40)
  check(produceStep?.action === 'produce' && !produceStep.disabled, `with the take in, the next step is to produce the scene (${produceStep?.title})`)
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  const produced = await until(async () => { const production = (await overview(videoId)).scenes[0].production; return production?.ready ? production.ready : null }, 240)
  const run = (await api('/api/runs')).body.runs.find(entry => entry.route === 'Produce Scene')
  const clock = run && JSON.parse(await readFile(join(run.projectDir, 'packet', 'CLOCK.json'), 'utf8'))
  check(produced?.summary.clock === 'take' && clock?.kind === 'take' && clock.audio === 'media/take.webm' && clock.presenter.map(entry => entry.visibility).join(',') === 'full,hidden,shared', `the scene is produced on the take's clock, with where the creator is in each moment (${JSON.stringify(clock?.moments)})`)
  check(clock?.moments[0].start === 0 && clock.moments[1].start > clock.spoken[0].spokenEnd && clock.moments[2].start > clock.spoken[1].spokenEnd && clock.moments[2].end === clock.duration && Math.abs(clock.duration - take.seconds) < 0.2, `each line is heard where the take says it; the scene lasts the take (${clock?.spoken.map(entry => `${entry.id}→${entry.spokenEnd}`).join(' ')}, ${clock?.duration}s)`)
  const first = JSON.parse(await readFile(join(run.projectDir, 'planning', 'production-first.json'), 'utf8'))
  check(first.accepted === false && first.problems.some(problem => /^the take's picture "media\/take.webm" must be muted/.test(problem)), `a picture that keeps its own sound is refused (${first.problems?.[0]})`)
  const record = (await api(`/api/planning/records/${produced.id}`)).body.record
  check(record?.report?.verification?.loaded.includes('media/take.webm') && !JSON.stringify(record.inputs.media || {}).includes('base64'), 'the pinned player played the take the product supplied')

  // ——— The stage plays it ———
  await focusApp()
  await click('.scene-review.is-expanded [data-focus^="show-production:"]')
  const stage = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); return player && !document.getElementById('scene-stage-preview').hidden && player.duration > 0 ? { src: player.getAttribute('src'), note: document.getElementById('scene-stage-note').textContent, markers: document.querySelectorAll('.scene-stage-marker').length } : null }`, 40)
  check(/\?e=0$/.test(stage?.src || '') && /^Produced from plan r\d+, on your take · not accepted yet$/.test(stage.note) && stage.markers === 1, `the stage plays it on the take, with where the headline's timing can be nudged (${JSON.stringify(stage)})`)
  const m2 = clock.moments[1]
  const before = await stageOpacityAt(m2.start + 0.7, '#m2 .title')
  check(before === 1, `the headline shows ${0.7}s into the graphics (opacity ${before})`)
  await shot('01-presented-on-stage')

  // ——— P6: a nudge, saved and played at once; undo and redo ———
  // Late enough that the headline is not there 0.7s in, early enough to show before m2 ends.
  const nudge = Math.min(Math.floor((m2.end - m2.start - 0.7) * 100) / 100, 1.2)
  await evaluate(`() => { const input = document.querySelector('.scene-review.is-expanded [data-focus$=":m2-title"][data-focus^="control:"]'); input.value = '${nudge}'; input.dispatchEvent(new Event('change')); return true }`)
  const edit1 = await until(async () => { const view = (await overview(videoId)).scenes[0].production.ready; return view.edits.revision === 1 ? view.edits : null }, 30)
  check(edit1?.values['m2-title'] === nudge, `the nudge is saved as edit 1 (${JSON.stringify(edit1?.values)})`)
  const reloaded = await waitFor(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); return /\\?e=1$/.test(player?.getAttribute('src') || '') && player.duration > 0 ? player.getAttribute('src') : null }`, 30)
  const after = await stageOpacityAt(m2.start + 0.7, '#m2 .title')
  check(Boolean(reloaded) && after === 0, `the stage plays the edit: the headline has not appeared ${0.7}s into the graphics (opacity ${after})`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="undo-edit:"]').click(); return true }`)
  const undone = await until(async () => { const view = (await overview(videoId)).scenes[0].production.ready; return view.edits.revision === 2 ? view.edits : null }, 30)
  check(undone && !('m2-title' in undone.values), `undo is saved as edit 2, the headline back at its default (${JSON.stringify(undone?.values)})`)
  await waitFor(`() => { const button = document.querySelector('.scene-review.is-expanded [data-focus^="redo-edit:"]'); return button && !button.disabled ? true : null }`, 20)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="redo-edit:"]').click(); return true }`)
  const redone = await until(async () => { const view = (await overview(videoId)).scenes[0].production.ready; return view.edits.revision === 3 ? view.edits : null }, 30)
  check(redone?.values['m2-title'] === nudge, `redo is saved as edit 3 (${JSON.stringify(redone?.values)})`)
  await shot('02-timing-edited')

  // ——— Accepted with the edit; the export is the video ———
  await click('.scene-review.is-expanded [data-focus^="accept-production:"]')
  const producedScene = await until(async () => (await saved(videoId))?.producedScenes?.[sceneId] || null, 240)
  check(producedScene?.productionId === produced.id && producedScene.edits === 3 && producedScene.voiced === true, `accepting renders it with edit 3, and the notebook plays that render (${JSON.stringify(producedScene && { edits: producedScene.edits, voiced: producedScene.voiced })})`)
  const exportStep = await waitStep('Export video')
  check(Boolean(exportStep), 'the next step is the video\'s export')
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  const summary = await waitFor(`() => document.getElementById('publish-dialog').open ? { kind: document.getElementById('publish-export-kind').textContent, audio: document.getElementById('publish-audio').textContent } : null`, 20)
  check(/^Video export/.test(summary?.kind || '') && summary.audio === 'Audio: 1 of 1 blocks voiced (1 produced scene).', `Publish exports the video, voiced by the produced scene (${JSON.stringify(summary)})`)
  await evaluate(`() => { document.getElementById('start-publish').click(); return true }`)
  const download = await waitFor(`() => { const result = document.getElementById('render-result'); return result && !result.hidden ? document.getElementById('download-render').href : null }`, 300)
  const exported = join(root, 'export.mp4')
  await writeFile(exported, Buffer.from(await (await fetch(download)).arrayBuffer()))
  await evaluate(`() => { document.getElementById('publish-dialog').close(); if (document.getElementById('player-shell').classList.contains('canvas-open')) document.getElementById('canvas-fullscreen').click(); return true }`)
  const [m1, , m3] = clock.moments
  const left = [300, 700, 80, 80]
  const right = [1500, 700, 80, 80]
  const title = [120, 95, 420, 60]
  const frames = {
    fullLeft: colourAt(exported, (m1.start + m1.end) / 2, left),
    fullRight: colourAt(exported, (m1.start + m1.end) / 2, right),
    hiddenRight: colourAt(exported, m2.start + 0.7, right),
    early: colourAt(exported, m2.start + 0.7, title),
    late: colourAt(exported, m2.start + nudge + 0.4, title),
    sharedLeft: colourAt(exported, m3.start + 1, left),
    sharedRight: colourAt(exported, m3.start + 1, right),
  }
  check(near(frames.fullLeft, '#e11d48') && near(frames.fullRight, '#e11d48'), `on camera, the take fills the frame (${frames.fullLeft} · ${frames.fullRight})`)
  check(near(frames.hiddenRight, '#4c1d95') && near(frames.sharedLeft, '#4c1d95') && near(frames.sharedRight, '#e11d48'), `the graphics take the frame, and the creator returns beside them (${frames.hiddenRight} · ${frames.sharedLeft} | ${frames.sharedRight})`)
  check(near(frames.early, '#4c1d95') && !near(frames.late, '#4c1d95', 12), `the export plays the edit: no headline ${0.7}s into the graphics, the headline once it is due (${frames.early} · ${frames.late})`)
  const voiceOnGraphics = loudness(exported, m2.start + 0.1, Math.max(0.5, clock.spoken[1].spokenEnd - m2.start - 0.2))
  check(voiceOnGraphics !== null && voiceOnGraphics > -30, `the voice carries on while the graphics fill the frame (${voiceOnGraphics} dB)`)
  const streams = ffprobe(['-show_entries', 'stream=codec_type', '-of', 'csv=p=0', exported])
  check(/video/.test(streams) && /audio/.test(streams) && Math.abs(Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', exported])) - clock.duration) < 0.6, 'the export is the take\'s length, with picture and sound')

  // ——— Reopened: the same edit, the same output ———
  check(Boolean(await openNotebook(videoId, 'Rate limiters · presented')), 'the notebook reopens')
  await selectScene(0)
  const reopened = await waitFor(`() => {
    const box = document.querySelector('.scene-review.is-expanded [data-review-production]')
    const input = box?.querySelector('[data-focus^="control:"]')
    return box && input ? { value: Number(input.value), plays: box.querySelector('[data-review-output]')?.dataset.reviewOutput, unrendered: Boolean(box.querySelector('[data-review-edits="unrendered"]')) } : null
  }`, 40)
  check(reopened?.value === nudge && reopened.plays === 'plays' && !reopened.unrendered, `reopened, the review shows edit 3, rendered into the output the notebook plays (${JSON.stringify(reopened)})`)

  // ——— Produced again: the edit is carried; a change it cannot make is asked for ———
  await click('.scene-review.is-expanded [data-focus^="produce:"]')
  const second = await until(async () => { const view = (await overview(videoId)).scenes[0].production.ready; return view && view.id !== produced.id ? view : null }, 240)
  check(second?.edits.values['m2-title'] === nudge && second.edits.carried?.applied?.includes('m2-title'), `a new production of the scene carries the edit (${JSON.stringify(second?.edits)})`)
  const carried = await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-review-carried]')?.textContent || null`, 30)
  check(/Carried from the scene's previous production: When the headline appears/.test(carried || ''), `the review says the edit was carried (${carried})`)
  await evaluate(`() => { const details = document.querySelector('.scene-review.is-expanded [data-review-open^="ask:"]'); if (details) { details.open = true; details.dispatchEvent(new Event('toggle')) } const field = document.querySelector('.scene-review.is-expanded [data-focus^="ask-change:"]'); field.value = 'Hold on the empty bucket a beat longer before the request is refused.'; return true }`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="ask-produce:"]').click(); return true }`)
  const asked = await until(async () => { const runs = (await api('/api/runs')).body.runs.filter(entry => entry.route === 'Produce Scene'); return runs.length >= 3 && runs.every(entry => entry.status === 'done' || entry.status === 'failed') ? runs : null }, 240)
  const newest = asked && asked.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0]
  const instructions = newest ? await readFile(join(newest.projectDir, 'packet', 'PRODUCTION.md'), 'utf8') : ''
  check(/## The creator asks for a change[\s\S]*> Hold on the empty bucket a beat longer before the request is refused\./.test(instructions), 'the change the controls cannot make goes to the producer, with a new production')
  // ——— A newer plan changes one line: only that line is recorded again ———
  await evaluate(`() => { const box = document.querySelector('.scene-review.is-expanded [data-focus^="direction:"]'); box.value = 'Say the refusal plainly'; box.dispatchEvent(new Event('input')); return true }`)
  await click('.scene-review.is-expanded [data-focus^="revise:"]')
  const plan2 = await until(async () => { const view = (await overview(videoId)).scenes[0].view; return view.current?.id !== plan.id && view.current?.status === 'candidate' && view.current }, 90)
  await click('.scene-review.is-expanded [data-focus^="approve:"]')
  check(Boolean(await until(async () => (await overview(videoId)).scenes[0].view.reviewed?.id === plan2?.id, 30)), `a newer plan with the second line said plainly is approved (r${plan2?.revision})`)
  await click('.scene-review.is-expanded [data-focus^="use-plan-script:"]')
  const lines2 = [LINES[0], PLAIN, LINES[2]]
  await until(async () => (await saved(videoId))?.notebook?.content?.find(node => node.attrs?.id === sceneId)?.attrs?.script === lines2.join('\n\n'), 30)
  await focusApp()
  const askedLine = await waitFor(`() => { const note = document.querySelector('.scene-review.is-expanded .review-take-lines'); const button = note?.querySelector('[data-focus^="record-pickup:"]'); return note && button ? { lines: [...note.querySelectorAll('li')].map(item => item.textContent), button: button.textContent, chip: [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent).find(text => /^Recording:/.test(text)) } : null }`, 30)
  check(askedLine?.lines.join('|') === PLAIN && askedLine.button === 'Record only this line' && askedLine.chip === 'Recording: 1 line to re-record', `only the changed line is asked for again (${JSON.stringify(askedLine)})`)
  await click('.scene-review.is-expanded [data-focus^="record-pickup:"]')
  const camera = await waitFor(`() => { const dialog = document.getElementById('camera-dialog'); return dialog?.open ? { prompt: document.getElementById('presenter-script').value, status: document.getElementById('camera-status').textContent } : null }`, 20)
  check(camera?.prompt === PLAIN && /^Pickup: record only this line/.test(camera.status || ''), `the camera opens on that line alone (${JSON.stringify(camera)})`)
  await evaluate(`() => { document.getElementById('camera-dialog').close(); return true }`)
  // The pickup (blue), through the camera dialog's own archive step.
  const pickupTake = await makeTake([PLAIN], '0x1d4ed8', 'pickup')
  const pickupAsset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-asset-name': `camera-${sceneId}-pickup.webm`, 'x-project-id': videoId, 'x-block-id': sceneId }, body: await readFile(pickupTake.path) }).then(response => response.json())
  const pickedUp = await evaluate(`() => window.__timing.archivePickup(${JSON.stringify(sceneId)}, ${JSON.stringify({ url: pickupAsset.url, assetId: pickupAsset.assetId })}, ${Math.round(pickupTake.seconds * 1000)}, ${JSON.stringify([PLAIN])})`)
  const stillSelected = (await saved(videoId))?.recordedBlocks?.[sceneId]?.recordingId
  check(pickedUp?.pickup === true && stillSelected === committed?.recordingId, 'the pickup is kept beside the take, which stays selected')
  const matched = await waitFor(`() => [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent).find(text => text === 'Recording: take and pickup match the script') || null`, 30)
  check(Boolean(matched), 'the take and the pickup together match the script')
  const againStep = await waitStep('Produce scene 1 again', 40)
  check(againStep?.action === 'produce' && !againStep.disabled, `the next step produces the scene again from them (${againStep?.title})`)
  const before3 = (await overview(videoId)).scenes[0].production.ready?.id
  await evaluate(`() => { document.getElementById('next-step').click(); return true }`)
  const produced3 = await until(async () => { const ready = (await overview(videoId)).scenes[0].production.ready; return ready && ready.id !== before3 && ready.of.record === plan2?.id ? ready : null }, 240)
  const run3 = (await api('/api/runs')).body.runs.filter(entry => entry.route === 'Produce Scene').sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0]
  const clock3 = run3 && JSON.parse(await readFile(join(run3.projectDir, 'packet', 'CLOCK.json'), 'utf8'))
  check(Boolean(produced3) && clock3?.provider === 'Your take, with a pickup' && clock3.spoken.map(entry => entry.words).join('|') === lines2.join('|'), `the scene is produced on your take and the pickup, joined (${JSON.stringify(clock3?.moments)})`)
  // The joined take plays the pickup's picture where its line is said, the take's elsewhere.
  const joined = join(root, 'joined.webm')
  await writeFile(joined, Buffer.from(await (await fetch(`${origin}${produced3.url.replace('index.html', 'media/take.webm')}`)).arrayBuffer()))
  const [p1, p2, p3] = clock3.moments
  const pictures = { first: colourAt(joined, p1.start + 0.6, [600, 500, 60, 60]), second: colourAt(joined, p2.start + 0.8, [600, 500, 60, 60]), third: colourAt(joined, p3.start + 0.8, [600, 500, 60, 60]) }
  check(near(pictures.first, '#e11d48') && near(pictures.second, '#1d4ed8') && near(pictures.third, '#e11d48'), `your take, then the pickup's line, then your take again (${pictures.first} · ${pictures.second} · ${pictures.third})`)
  check(Math.abs(Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', joined])) - clock3.duration) < 0.15, `the joined take is the scene's clock (${clock3.duration}s)`)
  const reviewIt = await waitFor(`() => [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent).find(text => /^Output:/.test(text)) || null`, 30)
  check(reviewIt === 'Output: produced — review it', `the new production waits for review before the older accepted one (${reviewIt})`)
  await shot('04-pickup')

  // Nothing here asked for a sketch: none is made, and no model is spent on one.
  const routes = (await api('/api/runs')).body.runs.map(entry => entry.route)
  check(!routes.includes('Sketch Scene'), `only the runs the creator asked for ran (${routes.join(', ')})`)
  await shot('03-carried')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PRESENTED PRODUCTION CHECK FAIL (${failures})` : 'PRESENTED PRODUCTION CHECK PASS')
process.exitCode = failures ? 1 : 0
