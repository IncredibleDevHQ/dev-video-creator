// Output parity, read in one place (U6 of the scene workspace plan) — an
// engineering fixture: a stub harness prepares the brief, plans the scene and
// sketches it at once.
//
// Under the stage the moments row expands into the scene's timeline, in its
// place: the moments, who is heard, whether the presenter is in the picture,
// the text, the camera and the sound, and — once a preview plays — the
// layers the composition declared, on its clock. It is read-only and says
// what it is timed by. The playhead follows the stage; a moment seeks it; the
// keyboard keeps its place while the stage plays; the choice survives a
// reload; nothing overflows at 1280.
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
const root = await mkdtemp(join(tmpdir(), 'studio-scene-timeline-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness: a brief, then each scene's plan, at once ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-timeline', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-timeline', result: 'stub done' }); process.exit(code) }
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
    // Evidence quotes the retained source exactly: its first sentence.
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
    shim.kill()
    return finish(0)
  }
  if (inputs.planning.route === 'Sketch Scene') {
    // A rough sketch of the plan: a title per moment, and a presenter stand-in.
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    fs.mkdirSync('sketch', { recursive: true })
    const id = context.composition.id
    const per = 3
    const moments = plan.plan.moments.map((moment, index) => ({ id: moment.id, title: moment.title, start: index * per, end: (index + 1) * per, estimated: true }))
    const duration = moments.length * per
    const clip = (moment, body) => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + (moment.end - moment.start) + '" data-track-index="0">' + body + '</div>'
    fs.writeFileSync('sketch/index.html', '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#0e0c17}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#0e0c17;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}' +
      '.title{position:absolute;left:120px;top:90px;color:#fff;font-size:60px;font-weight:600}.stand-in{position:absolute;right:120px;top:260px;width:420px;height:560px;border:4px dashed #f472b6;border-radius:24px;color:#f472b6;font-size:32px;display:flex;align-items:center;justify-content:center}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + duration + '">' +
      moments.map((moment, index) => clip(moment, '<div class="title" data-sketch-layer="titles">' + moment.title + '</div>' + (index === 0 ? '<div class="stand-in" data-sketch-layer="presenter">Presenter stand-in</div>' : ''))).join('') +
      '</div><script>window.__timelines = window.__timelines || {}\n' +
      'const tl = gsap.timeline({ paused: true })\n' +
      moments.map(moment => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8 }, " + moment.start + ")").join('\n') + '\n' +
      'window.__timelines["' + id + '"] = tl</script></body></html>')
    fs.writeFileSync('sketch/manifest.json', JSON.stringify({
      version: 1, scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration }, runtime: { hyperframes: '0.7.106' },
      moments,
      layers: [
        { id: 'titles', kind: 'text', label: 'Moment titles', moments: moments.map(moment => moment.id) },
        { id: 'presenter', kind: 'presenter', label: 'Presenter', moments: [moments[0].id], placeholder: 'Presenter stand-in: no take recorded' },
      ],
      provisional: ['Timing is estimated from the plan — no voice or take yet', 'Presenter stand-in: no take recorded'],
    }, null, 2))
    const answer = await tool('plan_submit_sketch', { projectDir })
    if (!answer.accepted) process.stderr.write('stub sketch refused: ' + JSON.stringify(answer) + '\n')
    shim.kill()
    return finish(0)
  }
  if (inputs.planning.route === 'Produce Scene') {
    await tool('produce_context', { projectDir })
    const plan = JSON.parse(fs.readFileSync('packet/PLAN.json', 'utf8'))
    const clock = JSON.parse(fs.readFileSync('packet/CLOCK.json', 'utf8'))
    const id = context.composition.id
    const titles = Object.fromEntries(plan.plan.moments.map(moment => [moment.id, moment.title]))
    const moments = clock.moments.map(moment => ({ id: moment.id, title: titles[moment.id], start: moment.start, end: moment.end }))
    // Eight objects beside the titles (B08 of the BoltDB review): more
    // layers than the timeline once drew, the copies among the last.
    const objects = [['old-root', 'Old root', [0, 1, 2]], ['old-branch', 'Old branch', [0, 1, 2]], ['old-leaf', 'Old leaf', [0, 1, 2]], ['reader', 'Reader', [0]], ['writer', 'Writer', [1, 2]], ['new-leaf', 'New leaf', [1]], ['copied-branch', 'Copied branch', [1, 2]], ['new-root', 'New root', [2]]]
    const clip = (moment, index) => '<div id="' + moment.id + '" class="clip" data-start="' + moment.start + '" data-duration="' + Number((moment.end - moment.start).toFixed(3)) + '" data-track-index="0"><div class="title" data-sketch-layer="titles">' + moment.title + '</div>' +
      objects.filter(([, , at]) => at.includes(index)).map(([layer, label], row) => '<div class="obj" data-sketch-layer="' + layer + '" style="top:' + (260 + row * 70) + 'px">' + label + '</div>').join('') + '</div>'
    fs.mkdirSync('production/audio', { recursive: true })
    if (clock.audio) fs.copyFileSync('packet/' + clock.audio, 'production/' + clock.audio)
    fs.writeFileSync('production/index.html', '<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script><style>' +
      'html,body{margin:0;background:#1d4ed8}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#1d4ed8;font-family:system-ui,sans-serif}.clip{position:absolute;inset:0}.title{position:absolute;left:120px;top:90px;color:#fff;font-size:72px;font-weight:700}.obj{position:absolute;left:160px;color:#fff;font-size:36px}</style></head><body>' +
      '<div id="root" data-composition-id="' + id + '" data-start="0" data-width="1920" data-height="1080" data-duration="' + clock.duration + '">' + moments.map(clip).join('') +
      (clock.audio ? '<audio id="voice" src="' + clock.audio + '" data-start="0" data-duration="' + clock.duration + '" data-track-index="20"></audio>' : '') +
      '</div><script>window.__timelines = window.__timelines || {}\nconst tl = gsap.timeline({ paused: true })\n' +
      moments.map(moment => "tl.fromTo('#" + moment.id + " .title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, " + moment.start + ")").join('\n') +
      '\nwindow.__timelines["' + id + '"] = tl</script></body></html>')
    fs.writeFileSync('production/manifest.json', JSON.stringify({
      version: 1, kind: 'production', scene: context.scene.id, plan: { record: plan.record, revision: plan.revision },
      composition: { id, width: 1920, height: 1080, fps: 30, duration: clock.duration }, runtime: { hyperframes: '0.7.106' },
      clock: { kind: clock.kind, audio: clock.audio }, moments,
      layers: [{ id: 'titles', kind: 'text', label: 'Moment titles', moments: moments.map(moment => moment.id) }, ...objects.map(([id, label, at]) => ({ id, kind: 'object', label, moments: at.map(index => moments[index].id) }))],
      unmet: [],
    }, null, 2))
    const answer = await tool('produce_submit_scene', { projectDir })
    if (!answer.accepted) process.stderr.write('stub production refused: ' + JSON.stringify(answer) + '\n')
    shim.kill()
    return finish(0)
  }
  await tool('plan_context', { projectDir })
  const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
  const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
  const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
  const moment = (id, title, visibility) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility, reason: 'Suggested' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 4 })
  fs.writeFileSync('planning/treatment.json', JSON.stringify({
    schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
    question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show the limit biting.', demonstration: null, ledger: null,
    // Only a scene the creator presents shows them.
    moments: [
      { ...moment('m1', 'Requests arrive', context.delivery === 'human' ? 'full' : 'hidden'), text: { content: 'N requests per second', role: 'label' } },
      { ...moment('m2', 'The limit bites', 'hidden'), camera: { treatment: 'push in', subject: 'the cap', reason: 'Show the refusal' }, audio: { cue: 'A refusal click', reason: 'Mark the refusal' } },
      moment('m3', 'Back to the viewer', context.delivery === 'human' ? 'shared' : 'hidden'),
    ],
    objects: (cast.entries || []).filter(entry => context.scene.originScenes.includes(entry.page) && entry.verification.status === 'verified' && entry.libraryKey).map(entry => ({ entity: 'page-' + entry.id, role: entry.label, appearance: 'Not shown', performance: 'None', asset: { status: 'omit', ref: entry.libraryKey, reason: 'Not needed for this scene' } })),
    treatments: { presenter: 'Opens on camera', text: 'None', camera: 'Holds' },
    skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
    requirements: { assets: [], takes: [], decisions: [] },
    continuity: { entry: 'The page in view', exit: 'The limit holding', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
    coverage: units.flatMap(unit => brief.units.find(entry => entry.id === unit).communicationNeeds.map(need => ({ unit, need: need.need, moments: ['m1'] }))),
    rosterProposal: null, delivery: { voice: context.delivery || 'undecided', note: '' },
  }))
  const answer = await tool('plan_submit_treatment', { projectDir })
  if (!answer.accepted) process.stderr.write('stub plan refused: ' + JSON.stringify(answer) + '\n')
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
  if (!process.env.SCENE_TIMELINE_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_TIMELINE_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_TIMELINE_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const click = selector => evaluate(`() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true }`)
const clickText = (selector, text) => evaluate(`() => { const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(entry => entry.textContent.trim() === ${JSON.stringify(text)}); if (!element) return false; element.click(); return true }`)
const pickScene = sceneId => click(`#scene-workspace .sw-scene[data-scene="${sceneId}"]`)
const title = () => evaluate(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent || ''`)
const recordTab = () => click('#scene-workspace [data-focus="sw-tab:record"]')
// The stage's player is ready once its play button is.
const playable = () => waitFor(`() => { const play = document.querySelector('#scene-workspace .sw-play'); return play && !play.disabled ? true : null }`, 30)
// The timeline as it is drawn.
const timelineNow = `() => {
  const box = document.querySelector('#scene-workspace .sw-timeline')
  if (!box) return null
  const tracks = [...box.querySelectorAll('.sw-timeline-tracks > .sw-track')]
  const cells = Object.fromEntries(tracks.map(track => [track.querySelector('.sw-track-label').textContent, [...track.querySelectorAll('.sw-cell')].map(cell => cell.textContent.trim())]))
  return {
    row: Boolean(document.querySelector('#scene-workspace .sw-moments')),
    tracks: tracks.map(track => track.querySelector('.sw-track-label').textContent),
    cells,
    layers: [...box.querySelectorAll('.sw-track-group .sw-track-label')].map(label => label.textContent),
    layerCaption: box.querySelector('.sw-track-caption')?.textContent || '',
    placeholders: box.querySelectorAll('.sw-cell.is-placeholder').length,
    ruler: [...box.querySelectorAll('.sw-timeline-ruler span')].map(span => span.textContent).join('|'),
    note: box.querySelector('.sw-timeline-note')?.textContent || '',
    playhead: box.classList.contains('has-playhead'),
    at: Number(box.style.getPropertyValue('--at') || 0),
    current: box.querySelector('.sw-cell-moment.is-current')?.dataset.moment || '',
    selected: box.querySelector('.sw-cell-moment.is-selected')?.dataset.moment || '',
    time: Number((document.querySelector('#scene-workspace .sw-clock')?.textContent || '').split('s')[0]) || 0,
  }
}`

try {
  await launch()
  const narrative = 'A rate limiter keeps an API alive when load spikes.\n\nIt refuses the excess before it hurts.'
  const read = await post('/api/source/read', { narrative, title: 'Rate limiters', wordingPolicy: 'draft' })
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `recording-base-${Date.now().toString(36)}`, title: 'Rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Rate limiters' },
    theme: { version: 1, id: 'recording', name: 'Rate limiters', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b04', 'Request rate limiter', '05_request_rate_limiter.svg', 'A limiter refuses the excess.'),
      await page('b05', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'It caps what runs at once.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'Rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `recording-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens on its scenes')
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Prepare the brief' ? true : null`, 60)
  await click('#scene-workspace .sw-actions .button.primary')
  const brief = await until(async () => { const current = await overview(videoId); return current.brief.current || (current.brief.latest?.status === 'failed' ? current.brief.latest : null) }, 90)
  check(brief?.status === 'ready', 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const [s1, s2] = (await overview(videoId)).scenes.map(scene => scene.id)

  // ——— A scene you present, planned ———
  await recordTab()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-panel .ws-delivery') ? true : null`, 20)
  await clickText('#scene-workspace .sw-panel .ws-delivery button', 'You present it')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s1)?.delivery === 'human', 20)
  await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  await until(async () => (await overview(videoId)).scenes.find(entry => entry.id === s1)?.view.latest?.status === 'candidate', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)

  // ——— The timeline takes the moments row's place ———
  await waitFor(`() => document.querySelector('#scene-workspace [data-focus="sw-timeline"]') ? true : null`, 30)
  await click('#scene-workspace [data-focus="sw-timeline"]')
  const planned = await waitFor(`() => (${timelineNow})()?.tracks.length ? (${timelineNow})() : null`, 20)
  check(Boolean(planned) && planned.row === false && JSON.stringify(planned.tracks) === '["Moments","Voice","Presenter","Text","Camera","Sound"]', `expanded, the timeline replaces the moments row, one lane per kind of thing (${JSON.stringify(planned?.tracks)})`)
  check(JSON.stringify(planned?.cells.Presenter) === '["On camera","Voice only","Beside the graphics"]' && JSON.stringify(planned?.cells.Text) === '["N requests per second"]' && JSON.stringify(planned?.cells.Sound) === '["A refusal click"]' && planned?.cells.Voice?.[0] === 'Requests arrive.', `each moment says who is heard, whether the presenter is in the picture, and its text, camera and sound (${JSON.stringify(planned?.cells)})`)
  check(/^Timed by plan r1's estimates · layers show while a preview or the produced scene plays · read-only$/.test(planned?.note || '') && !planned.playhead, `before a preview it says it is the plan's estimates, and read-only (${JSON.stringify(planned?.note)})`)
  await shot('01-timeline-from-the-plan')

  // ——— On the sketch's clock, with the layers it declared ———
  await click(`#scene-workspace [data-focus="ws-action:preview:${s1}"]`)
  const sketched = await waitFor(`() => { const now = (${timelineNow})(); return now && /the sketch of plan r1/.test(now.note) ? now : null }`, 90)
  check(Boolean(sketched) && JSON.stringify(sketched.tracks) === '["Moments","Voice","Presenter","Text","Camera","Sound"]' && JSON.stringify(sketched.layers) === '["Moment titles","Presenter"]' && sketched.layerCaption === 'Layers · sketch' && sketched.placeholders === 1 && sketched.ruler === '0.0s|9.0s', `a preview on the stage times it by its sketch, with the layers it declared apart — a stand-in marked (${JSON.stringify(sketched && { tracks: sketched.tracks, layers: sketched.layers, caption: sketched.layerCaption, placeholders: sketched.placeholders, ruler: sketched.ruler, note: sketched.note })})`)
  await playable()
  await click('#scene-workspace .sw-play')
  const moving = await waitFor(`() => { const now = (${timelineNow})(); return now?.playhead && now.at > 0.05 && now.current ? now : null }`, 20)
  check(Boolean(moving), `playing, the playhead follows the stage and the moment on now is marked (${JSON.stringify(moving && { at: moving.at, current: moving.current })})`)
  // The keyboard keeps its place while the stage plays and redraws.
  await evaluate(`() => { document.querySelector('#scene-workspace [data-focus="sw-play"]').focus(); return true }`)
  await sleep(1500)
  const kept = await evaluate(`() => document.activeElement?.getAttribute('data-focus') || ''`)
  check(kept === 'sw-play', `the play button keeps the keyboard through the redraws (${JSON.stringify(kept)})`)
  await click('#scene-workspace .sw-play')
  await sleep(300)
  await click('#scene-workspace .sw-cell-moment[data-moment="m3"]')
  const sought = await waitFor(`() => { const now = (${timelineNow})(); return now?.selected === 'm3' && now.time >= 6 && now.time < 7 ? now : null }`, 20)
  check(Boolean(sought), `a moment on the timeline seeks the stage there (${JSON.stringify(sought && { selected: sought.selected, time: sought.time })})`)
  await shot('02-timeline-on-the-sketch')

  // ——— The choice survives a reload; nothing overflows at 1280 ———
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  const back = await waitFor(`() => (${timelineNow})()?.tracks.length ? (${timelineNow})() : null`, 60)
  check(Boolean(back) && back.row === false, 'after a reload the timeline is still expanded')
  await post('/__window', { width: 1280, height: 800 })
  await sleep(800)
  const narrow = await evaluate(`() => ({ page: document.scrollingElement.scrollWidth <= window.innerWidth + 1, timeline: (() => { const box = document.querySelector('#scene-workspace .sw-timeline'); return box ? box.scrollWidth <= box.clientWidth + 1 : false })() })`)
  check(narrow.page && narrow.timeline, `at 1280 neither the page nor the timeline overflows (${JSON.stringify(narrow)})`)
  await shot('03-timeline-at-1280')
  await post('/__window', { width: 1440, height: 900 })
  await click('#scene-workspace [data-focus="sw-timeline"]')
  const row = await waitFor(`() => document.querySelector('#scene-workspace .sw-moments') && !document.querySelector('#scene-workspace .sw-timeline') ? true : null`, 10)
  check(row === true, 'folded, the moments row is back')

  // ——— A produced scene: the timeline on its measured clock ———
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  await recordTab()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-panel .ws-delivery') ? true : null`, 20)
  await clickText('#scene-workspace .sw-panel .ws-delivery button', 'Silent')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s2)?.delivery === 'silent', 20)
  await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  await until(async () => (await overview(videoId)).scenes.find(entry => entry.id === s2)?.view.latest?.status === 'candidate', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await waitFor(`() => [...document.querySelectorAll('#scene-workspace .sw-actions .button')].some(button => button.textContent === 'Approve r1 without a preview') ? true : null`, 30)
  await clickText('#scene-workspace .sw-actions .button', 'Approve r1 without a preview')
  await until(async () => (await overview(videoId)).scenes.find(entry => entry.id === s2)?.view.reviewed, 30)
  await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Produce the scene' && !button.disabled ? true : null }`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  const made = await until(async () => (await overview(videoId)).scenes.find(entry => entry.id === s2)?.production?.ready, 120)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Review the output' ? true : null`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  await click('#scene-workspace [data-focus="sw-timeline"]')
  const producedNow = await waitFor(`() => { const now = (${timelineNow})(); return now && /^On the clock of/.test(now.note) ? now : null }`, 30)
  check(Boolean(made) && producedNow?.note === "On the clock of the plan's timing, silent · read-only" && JSON.stringify(producedNow.tracks) === '["Moments","Text","Camera","Sound"]' && JSON.stringify(producedNow.layers) === '["Text · 1","Objects · 8"]' && producedNow.layerCaption === 'Layers · produced sceneShow all 9 layers', `the produced scene's timeline is on its measured clock, with its own layers — nine, grouped by kind, none dropped — and no voice or presenter in a silent scene (${JSON.stringify(producedNow && { note: producedNow.note, tracks: producedNow.tracks, layers: producedNow.layers, caption: producedNow.layerCaption })})`)
  // B08 of the BoltDB review: every layer one click away, each a bar that
  // seeks the stage, and the layers of the moment chosen standing out.
  await click('#scene-workspace [data-focus="sw-layers"]')
  const allLayers = await waitFor(`() => { const now = (${timelineNow})(); return now && now.layers.length === 9 ? now.layers : null }`, 10)
  check(JSON.stringify(allLayers) === '["Moment titles","Old root","Old branch","Old leaf","Reader","Writer","New leaf","Copied branch","New root"]', `every layer is shown on asking, the copies too (${JSON.stringify(allLayers)})`)
  const newLeafAt = made.summary.moments[1].start
  await evaluate(`() => { const track = [...document.querySelectorAll('#scene-workspace .sw-track-group .sw-track')].find(entry => entry.querySelector('.sw-track-label').textContent === 'New leaf'); track.querySelector('.sw-cell-layer').click(); return true }`)
  const leafSought = await waitFor(`() => { const now = (${timelineNow})(); return now && Math.abs(now.time - ${newLeafAt}) < 0.3 ? now.time : null }`, 10)
  check(leafSought !== null, `a layer's bar seeks the stage to where it starts (New leaf at ${newLeafAt}s: ${leafSought}s)`)
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-cell-moment[data-moment="${made.summary.moments[2].id}"]').click(); return true }`)
  const lit = await waitFor(`() => { const lit = [...document.querySelectorAll('#scene-workspace .sw-track-group .sw-track.is-in-moment .sw-track-label')].map(label => label.textContent); return lit.length ? lit : null }`, 10)
  check(JSON.stringify(lit) === '["Moment titles","Old root","Old branch","Old leaf","Writer","Copied branch","New root"]', `choosing a moment marks the layers in it (${JSON.stringify(lit)})`)
  await shot('04b-every-layer')
  await click('#scene-workspace [data-focus="sw-layers"]')
  const regrouped = await waitFor(`() => { const now = (${timelineNow})(); return now && now.layers.length === 2 ? now.layers : null }`, 10)
  check(JSON.stringify(regrouped) === '["Text · 1","Objects · 8"]', `and grouped again by kind (${JSON.stringify(regrouped)})`)
  await playable()
  await click('#scene-workspace .sw-play')
  const producedPlaying = await waitFor(`() => { const now = (${timelineNow})(); return now?.playhead && now.at > 0.02 ? now : null }`, 20)
  check(Boolean(producedPlaying), 'the produced scene plays under the same playhead')
  await click('#scene-workspace .sw-play')
  // On the stage, the header's action is to accept what it plays.
  const accept = await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === "Accept as the scene's output" ? true : null`, 10)
  check(accept === true, 'with the produced scene on the stage, the one action is to accept it')
  await shot('04-timeline-on-the-produced-scene')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE TIMELINE CHECK FAIL (${failures})` : 'SCENE TIMELINE CHECK PASS')
process.exitCode = failures ? 1 : 0
