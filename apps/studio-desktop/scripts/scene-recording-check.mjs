// Delivery in context (U5 of the scene workspace plan) — an engineering
// fixture: a stub harness prepares the brief and plans each scene at once.
//
// One scene is presented by the creator, the other spoken by a generated
// voice, side by side in one video. Recording opens beside the stage, in
// place of the inspector — not a modal — and asks for no device until the
// creator does; while it is open the scene cannot change under it. A kept
// take joins the scene's takes; another take is used only when asked, and
// that choice survives a reopen. A take plays on the stage; one whose file
// will not load says so, and a scene without a take says it has none. The
// generated scene says where its voice comes from and asks for no take.
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
const root = await mkdtemp(join(tmpdir(), 'studio-scene-recording-'))
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
emit({ type: 'system', subtype: 'init', session_id: 'stub-recording', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-recording', result: 'stub done' }); process.exit(code) }
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
  await tool('plan_context', { projectDir })
  const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
  const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
  const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
  const moment = (id, title, visibility) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility, reason: 'Suggested' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 4 })
  fs.writeFileSync('planning/treatment.json', JSON.stringify({
    schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
    question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show the limit biting.', demonstration: null, ledger: null,
    // A generated voice reserves no presenter: nobody is shown there.
    moments: [moment('m1', 'Requests arrive', context.delivery === 'human' ? 'full' : 'hidden'), moment('m2', 'The limit bites', 'hidden')],
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

// A real two-second take with sound, when ffmpeg is here to make one.
const clipPath = join(root, 'take.webm')
const ffmpeg = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libopus', '-shortest', clipPath])
const clip = ffmpeg.status === 0 ? await readFile(clipPath).catch(() => null) : null

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
  if (!process.env.SCENE_RECORDING_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_RECORDING_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_RECORDING_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
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
// Device requests, counted, never granted a real camera.
const installDevices = () => evaluate(`() => {
  window.__gumCalls = []
  const stub = { getUserMedia: constraints => { window.__gumCalls.push(constraints || {}); return Promise.resolve(new MediaStream()) } }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: stub })
  return true
}`)
// The scene's takes as the Record tab lists them.
const takesShown = `() => [...document.querySelectorAll('#scene-workspace .sw-panel .ws-take')].map(row => ({
  id: row.dataset.take,
  head: row.querySelector('.ws-take-head')?.textContent || '',
  state: row.querySelector('.ws-take-state')?.textContent || '',
  used: Boolean(row.querySelector('.ws-take-used')),
  use: row.querySelector('[data-focus^="take-use:"]')?.textContent || '',
}))`
const capturing = `() => {
  const dialog = document.getElementById('camera-dialog')
  return {
    open: dialog.open,
    inWorkspace: Boolean(dialog.closest('#scene-workspace .sw-capture')),
    modal: dialog.matches(':modal'),
    head: document.querySelector('#scene-workspace .sw-capture-head')?.textContent || '',
    tabs: getComputedStyle(document.querySelector('#scene-workspace .sw-tabs')).display,
    stage: Boolean(document.querySelector('#scene-workspace .sw-stage-frame #scene-stage')) && getComputedStyle(document.getElementById('scene-stage')).display !== 'none',
    teleprompter: document.getElementById('presenter-script')?.value || '',
    audio: document.getElementById('audio-mode')?.value || '',
    calls: (window.__gumCalls || []).length,
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

  // ——— One scene presented, the other voiced: chosen per scene, then planned ———
  await recordTab()
  await waitFor(`() => document.querySelector('#scene-workspace .sw-panel .ws-delivery') ? true : null`, 20)
  await clickText('#scene-workspace .sw-panel .ws-delivery button', 'You present it')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s1)?.delivery === 'human', 20)
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-panel .ws-delivery') ? true : null`, 20)
  await clickText('#scene-workspace .sw-panel .ws-delivery button', 'Generated voice')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s2)?.delivery === 'generated', 20)
  for (const scene of [s2, s1]) {
    await pickScene(scene)
    await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
    await click('#scene-workspace .sw-actions .button.primary')
    await until(async () => (await overview(videoId)).scenes.find(entry => entry.id === scene)?.view.latest?.status === 'candidate', 90)
  }
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Request rate limiter' ? true : null`, 20)
  await recordTab()

  // ——— Before any take: guidance, and no media claimed ———
  const before = await waitFor(`() => { const none = document.querySelector('#scene-workspace .sw-panel .ws-take-none'); return none ? { none: none.textContent, guide: Boolean(document.querySelector('#scene-workspace .sw-panel .review-guide')) } : null }`, 30)
  check(/^No take yet\./.test(before?.none || '') && before.guide, `before a take, the scene says it has none; the guide is guidance (${JSON.stringify(before?.none)})`)
  // The teleprompter reads the plan's lines once they are the scene's script.
  if (await click('#scene-workspace [data-focus^="use-plan-script:"]')) await sleep(800)
  await waitFor(`() => { const button = document.querySelector('#scene-workspace [data-focus^="record:"]'); return button && !button.disabled ? true : null }`, 20)
  await shot('01-before-a-take')
  // Approved first, so that keeping a take is what producing waits for.
  await clickText('#scene-workspace .sw-actions .button', 'Approve r1 without a preview')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s1)?.view.reviewed, 30)

  // ——— Recording opens beside the stage, asking for nothing yet ———
  await installDevices()
  await click('#scene-workspace [data-focus^="record:"]')
  const opened = await waitFor(`() => { const now = (${capturing})(); return now.open ? now : null }`, 20)
  check(opened?.inWorkspace === true && opened.modal === false && opened.tabs === 'none' && /^Recording scene 1 · Request rate limiter/.test(opened.head), `recording opens in place of the inspector, not as a modal (${JSON.stringify({ inWorkspace: opened?.inWorkspace, modal: opened?.modal, tabs: opened?.tabs, head: opened?.head })})`)
  check(opened?.stage === true && /Requests arrive/.test(opened.teleprompter), `the scene stays on the stage, and the teleprompter reads its lines (${JSON.stringify({ stage: opened?.stage, teleprompter: opened?.teleprompter.slice(0, 60) })})`)
  check(opened?.calls === 0, `opening it asks for no camera or microphone (${opened?.calls} requests)`)
  check(opened?.audio === 'microphone', `a scene you present records your microphone by default (${opened?.audio})`)
  await click('#enable-camera')
  const asked = await waitFor(`() => (window.__gumCalls || []).length === 1 ? true : null`, 10)
  check(asked === true, 'the devices are asked for only when the creator enables the camera')
  // The capture lock: the scene and the view stay while it is open.
  await pickScene(s2)
  await click('#scene-workspace .sw-back')
  await sleep(600)
  const heldAt = await evaluate(`() => ({ title: document.querySelector('#scene-workspace .sw-title h2')?.textContent || '', workspace: !document.getElementById('scene-workspace').hidden, open: document.getElementById('camera-dialog').open })`)
  check(heldAt.title === 'Request rate limiter' && heldAt.workspace && heldAt.open, `while recording, another scene or the notebook waits (${JSON.stringify(heldAt)})`)
  await shot('02-recording-beside-the-stage')

  // ——— A kept take joins the scene's takes ———
  await evaluate(`() => { window.__timing.stageReview(); return true }`)
  const review = await waitFor(`() => !document.getElementById('take-review').hidden ? true : null`, 10)
  check(review === true, 'a stopped take waits for review, in the workspace')
  await click('#keep-take')
  const kept = await waitFor(`() => { const now = (${capturing})(); const takes = (${takesShown})(); return !now.open && takes.length === 1 ? { takes, tabs: now.tabs } : null }`, 60)
  check(Boolean(kept) && kept.tabs !== 'none' && kept.takes[0].used && /^v1/.test(kept.takes[0].head), `kept, the recording closes and the take is the scene's — v1, used (${JSON.stringify(kept?.takes)})`)
  // No refocus needed: what producing waits for is read again at once.
  const produceNow = await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Produce the scene' && !button.disabled ? true : null }`, 20)
  check(produceNow === true, `with its plan approved, a kept take makes producing the one action at once (${JSON.stringify({ header: await evaluate(`() => [...document.querySelectorAll('#scene-workspace .sw-actions .button')].map(button => button.textContent + (button.disabled ? ' [' + button.title + ']' : ''))`), waits: (await overview(videoId)).scenes.find(scene => scene.id === s1)?.productionWaits ?? null })})`)

  // ——— Another take; the choice between them is the creator's, and kept ———
  let v2 = null
  if (clip) {
    const asset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-project-id': videoId, 'x-block-id': s1 }, body: clip }).then(response => response.json())
    v2 = await evaluate(`() => window.__timing.archive(${JSON.stringify(s1)}, ${JSON.stringify({ url: asset.url, assetId: asset.assetId })}, 2000)`)
  } else {
    console.log('SKIP  no ffmpeg: the second take is a stand-in, and real playback is not checked')
    v2 = await evaluate(`() => window.__timing.standInTake(${JSON.stringify(s1)}, 2000)`)
  }
  const two = await waitFor(`() => { const takes = (${takesShown})(); return takes.length === 2 && takes[1].used ? takes : null }`, 30)
  check(Boolean(v2?.recordingId) && Boolean(two) && two[0].use === 'Use take v1' && !two[0].used, `a new take is used; the earlier one is kept and offered (${JSON.stringify(two?.map(take => ({ head: take.head, used: take.used, use: take.use })))})`)
  await click(`#scene-workspace [data-focus="take-use:${two?.[0]?.id}"]`)
  const chose = await waitFor(`() => { const takes = (${takesShown})(); return takes[0]?.used ? takes : null }`, 20)
  const saved = await until(async () => { const body = await api(`/api/projects/${videoId}`).then(r => r.body); return body?.project?.recordedBlocks?.[s1]?.recordingId === two?.[0]?.id ? true : null }, 30)
  check(Boolean(chose) && saved === true, 'using take v1 is the creator\'s choice, and it is saved')
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Request rate limiter' ? true : null`, 60)
  await recordTab()
  const reopened = await waitFor(`() => { const takes = (${takesShown})(); return takes.length === 2 ? takes : null }`, 30)
  check(reopened?.[0]?.used === true && reopened[1].use === 'Use take v2', `after a reopen, take v1 is still the one used (${JSON.stringify(reopened?.map(take => take.used))})`)

  // ——— Takes play on the stage; one whose file will not load says so ———
  if (clip) {
    await click(`#scene-workspace [data-focus="take-play:${reopened?.[1]?.id}"]`)
    // On top: what is seen at the middle of the stage is the take.
    const playing = await waitFor(`() => { const layer = document.querySelector('#scene-workspace .sw-take-layer'); const video = layer?.querySelector('video'); if (!layer || layer.hidden || !video || video.readyState < 2 || video.error) return null; const box = document.querySelector('#scene-workspace .sw-stage-frame').getBoundingClientRect(); const seen = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return { note: layer.querySelector('.sw-take-note')?.textContent || '', duration: video.duration, seen: seen === video, back: document.elementFromPoint(...(() => { const b = layer.querySelector('[data-focus="sw-take-close"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })())?.getAttribute('data-focus') || '' } }`, 20)
    check(Boolean(playing) && /^Take v2 · 00:02/.test(playing.note) && playing.duration > 1.5 && playing.seen && playing.back === 'sw-take-close', `take v2 plays on the stage, over it (${JSON.stringify(playing)})`)
    await shot('03-take-on-the-stage')
    await click('#scene-workspace [data-focus="sw-take-close"]')
    check(await waitFor(`() => document.querySelector('#scene-workspace .sw-take-layer')?.hidden ? true : null`, 5) === true, 'Back to the stage closes it')
  }
  await click(`#scene-workspace [data-focus="take-play:${reopened?.[0]?.id}"]`)
  const broken = await waitFor(`() => { const layer = document.querySelector('#scene-workspace .sw-take-layer'); const row = (${takesShown})()[0]; return layer?.classList.contains('is-failed') && /could not be loaded/.test(row?.state || '') ? { note: layer.querySelector('.sw-take-note')?.textContent || '', row: row.state } : null }`, 20)
  check(Boolean(broken) && /could not be loaded/.test(broken.note), `a take whose file will not load says so, on the stage and in its row (${JSON.stringify(broken)})`)
  await shot('04-take-that-will-not-load')
  await evaluate(`() => { document.getElementById('scene-workspace').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true }`)

  // ——— Escape closes a recording, and releases what it asked for ———
  await installDevices()
  await click('#scene-workspace [data-focus^="record:"]')
  await waitFor(`() => document.getElementById('camera-dialog').open ? true : null`, 10)
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-capture').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true }`)
  const escaped = await waitFor(`() => { const now = (${capturing})(); return !now.open && now.tabs !== 'none' ? now : null }`, 10)
  check(Boolean(escaped) && escaped.inWorkspace === false, 'Escape closes the recording, and the inspector returns')

  // ——— The generated scene: its voice, no take asked for ———
  await pickScene(s2)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Concurrent requests limiter' ? true : null`, 20)
  await recordTab()
  const voiced = await waitFor(`() => { const panel = document.querySelector('#scene-workspace .sw-panel'); return panel?.querySelector('.review-guide-lines') ? { text: panel.textContent, takes: Boolean(panel.querySelector('.ws-takes')), record: Boolean(panel.querySelector('[data-focus^="record:"]')) } : null }`, 20)
  check(Boolean(voiced) && /spoken by a generated voice when the scene is produced\. Nothing to record\./.test(voiced.text) && !voiced.takes && !voiced.record, `the generated scene says where its voice comes from, and asks for no take (${JSON.stringify({ takes: voiced?.takes, record: voiced?.record })})`)
  const rail = await evaluate(`() => [...document.querySelectorAll('#scene-workspace .sw-scene')].map(button => button.querySelector('.sw-scene-state')?.textContent || '')`)
  check(rail.length === 2 && rail.every(Boolean), `both scenes sit in one video, each with its own state (${JSON.stringify(rail)})`)
  await shot('05-generated-scene')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE RECORDING CHECK FAIL (${failures})` : 'SCENE RECORDING CHECK PASS')
process.exitCode = failures ? 1 : 0
