// The video scene workspace (U2 of the scene workspace plan) — an
// engineering fixture: the harness is a stub, so this proves the layout and
// the workflow's machinery, never a plan's quality.
//
// A video notebook opens on its scenes around one stage. A scene planned
// with eight moments — one a long technical paragraph, one a long
// identifier — stays usable at 1440 × 900 and 1280 × 800: the stage keeps
// most of the width, nothing is clipped or scrolls sideways, every moment is
// reachable from one compact row, and one moment reads in the inspector.
// The scene is planned, inspected, approved and its recording guide opened
// without leaving the workspace; a reload comes back to the same scene; the
// notebook is still there as the other view, and a presentation is as it was.
// The plan's concrete example reads in one line under its takeaway, and the
// stage can be looked at as small as a phone shows it (Q01 of the
// project-flow fix verification).
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
const root = await mkdtemp(join(tmpdir(), 'studio-scene-workspace-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// ——— The stub harness: a brief, then a seven-moment plan of long prose ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-workspace', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-workspace', result: 'stub done' }); process.exit(code) }
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
      purpose: { deliverable: 'Narrated technical explainer', audience: 'Developers', message: 'The kernel sends each token to its experts and brings the results home.', language: 'en', requestedSeconds: context.requestedSeconds, styleConstraints: [] },
      source: { revisionRef: context.sourceRevision, narrativeRef: context.narrativeRevision, wordingPolicy: context.wordingPolicy, coverage: 'full', limitations: [] },
      evidence: [{ id: 'ev-1', kind: 'source', text: quote, locator: '¶1' }],
      entities: [{ id: 'kernel', name: 'Kernel', role: 'Moves tokens between GPUs', interactions: [], evidenceRefs: ['ev-1'], legacyObjectIds: [] }],
      units: pages.map((page, index) => ({ id: 'u' + (index + 1), question: 'What does ' + page.title + ' do?', explain: 'It moves tokens.', evidenceRefs: ['ev-1'], entities: ['kernel'], conditions: [], demonstration: null, observations: [], communicationNeeds: [{ need: 'See ' + page.title + ' work', why: 'It is the point', basis: 'suggestion' }], preserve: [], originScenes: [page.scene], dependsOn: [] })),
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
  } else {
    const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
    const things = (cast.entries || []).filter(entry => entry.libraryKey && entry.verification.status === 'verified').slice(0, 2)
    const objects = things.map((entry, index) => ({ entity: 'thing-' + (index + 1), role: entry.label, appearance: 'The page\'s own ' + entry.label, performance: 'It does its job in view', asset: { status: 'reuse', ref: entry.libraryKey, reason: 'The page already draws it with its parts' } }))
    const actors = objects.map(object => object.entity)
    // Seven moments as long as the ones the review read.
    const long = [
      ['The layer\'s starting point', 'Node A\'s frame and its eight GPU tiles settle onto the ground, then tokens t1–t3 appear on the source GPU, each carrying two expert tags; a thin rule marks the edge of the node, and Node B waits, dimmed, to the right.', 'In a mixture-of-experts layer, every token is sent to the experts chosen for it, and the answers have to come back to where the token started.', 'the tokens on the source GPU and their two expert tags each', { content: 'Node A · GPU labels · t1 t2 t3 · expert tags e1–e8 on every token copy', role: 'label' }],
      ['Dispatch: tokens go out to their experts', 'Six token copies leave the source GPU at once: three travel over NVLink to GPUs inside Node A, three cross the RDMA link to GPUs in Node B; each copy lands on the tile of the expert that will process it, and the routes stay drawn behind them.', 'Dispatch sends each copy to its expert — over NVLink when the expert is in the same node, over RDMA when it is on another node.', 'the two kinds of route, and which copies take each', { content: 'NVLink (same node) · RDMA (other node)', role: 'label' }],
      ['Experts work where they are', 'Each receiving GPU tile pulses once while its copy is processed; nothing moves between GPUs, and the source GPU sits empty with a faint outline where its tokens were.', 'The experts compute in place; the kernel only moved the data, it did not change what the experts do.', 'the pulsing expert tiles', null],
      ['Combine: results come home', 'Six result copies travel back along the same routes they came, NVLink inside Node A and RDMA from Node B, and merge on the source GPU into three finished tokens.', 'Combine brings every result back to the source GPU and merges them, so the layer ends where it began.', 'the results arriving back on the source GPU', null],
      ['Why two routes matter', 'The camera pulls back to show both nodes whole; the NVLink routes brighten while the RDMA route stays thinner and longer, and a small legend names the bandwidth of each.', 'NVLink inside a node is much faster than RDMA between nodes, which is why the kernel keeps as much traffic as it can inside the node.', 'the difference in route thickness and the legend', { content: 'NVLink ≈ 900 GB/s · RDMA ≈ 50 GB/s per NIC (illustrative, from the source)', role: 'label' }],
      ['The count stays honest', 'A counter beside the source GPU tallies copies out and results back: six out, six back, three tokens finished; nothing is created or lost on the way.', 'Every copy that goes out comes back as a result, so the count at the end matches the count at the start.', 'the counter and its final tally', null],
      ['Back to the whole layer', 'The two nodes shrink to one row of a larger fabric diagram, with the dispatch-and-combine routes kept as a faint pattern across it, ready for the next scene about the transfer engine.', 'This dispatch and combine happens in every mixture-of-experts layer, for every batch, which is why it has to be fast.', 'the whole fabric and the faint route pattern', null],
      ['fabric_lib::transfer_engine::RdmaPointToPointDispatchCombineKernelWithNvlinkAggregationAndConnectX7Offload', 'The transfer engine\'s full identifier types itself out along the top of the frame, fabric_lib::transfer_engine::RdmaPointToPointDispatchCombineKernelWithNvlinkAggregationAndConnectX7Offload, and under it every stage of one batch plays in order: the dispatch writes into peer memory over NVLink for the four experts inside Node A, the staged copies for Node B are posted to two ConnectX-7 network cards in parallel, the receive side polls its completion queue while the experts run, and the combine step reverses each route so that the source GPU\'s output tensor fills from both nodes before the next layer reads it — all while the GPU keeps computing, because the network cards move the bytes on their own.', 'The whole path, named as the code names it, from the first copy out to the last result home.', 'the identifier, then each stage as it lights', { content: 'fabric_lib::transfer_engine::RdmaPointToPointDispatchCombineKernelWithNvlinkAggregationAndConnectX7Offload', role: 'label' }],
    ]
    const moments = long.map(([title, change, guide, attention, text], index) => ({ id: 'm' + (index + 1), title, purpose: 'The viewer needs to see ' + title.toLowerCase() + ' before the next step makes sense, and notice where each copy goes.', observation: change, narration: { job: 'Say what happens', guide }, objects: actors.length ? { change, actors } : null, text, presenter: { visibility: index === 0 || index === 6 ? 'shared' : 'hidden', reason: 'Suggested' }, camera: { treatment: index === 4 ? 'pull back' : 'hold', subject: 'the fabric', reason: 'Keep the map' }, audio: null, attention, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: [3, 4.5, 3, 4, 4, 3, 3, 6][index] }))
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does the MoE kernel do, and which link does it use for each hop?',
      takeaway: 'Dispatch sends each token out to the GPUs holding its experts and combine brings the results home; the kernel carries a hop over NVLink when the expert is in the same node and over RDMA when it is on another node.',
      evidenceRefs: ['ev-1'], development: 'Show the tokens leave, work, and return, then why the routes differ.',
      demonstration: { text: 'Two nodes of eight GPUs. A source GPU in Node A holds tokens t1–t3, and each token has two expert GPUs: one in Node A and one in Node B. Dispatch sends out six token copies (three stay in the node, three cross to Node B); combine brings six results back and merges them into three finished tokens on the source GPU.', basis: 'source', example: { before: 'Token t1 waits on the source GPU in Node A', action: 'Dispatch sends its two copies to experts e3 and e7', after: 'e3 in Node A and e7 in Node B each hold a copy of t1', unchanged: null, observed: 'Combine brings both results back to t1 on the source GPU', later: null } },
      ledger: null,
      moments, objects, treatments: { presenter: 'Opens and closes beside the map', text: 'Labels only', camera: 'Holds, then pulls back once' },
      skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
      requirements: { assets: [], takes: [], decisions: [] },
      continuity: { entry: 'The page in view', exit: 'The whole fabric', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
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
  if (!process.env.SCENE_WORKSPACE_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_WORKSPACE_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_WORKSPACE_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)

const size = (width, height) => post('/__window', { width, height }).then(response => response.body)
const click = selector => evaluate(`() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true }`)

// What the workspace shows, measured where it is.
const measure = `async () => {
  const root = document.querySelector('#scene-workspace')
  if (!root || root.hidden) return null
  const box = element => { const rect = element.getBoundingClientRect(); return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) } }
  const name = element => element.tagName.toLowerCase() + (typeof element.className === 'string' && element.className ? '.' + element.className.trim().split(/\\s+/).join('.') : '') + ' “' + (element.textContent || '').trim().slice(0, 32) + '”'
  const panel = root.querySelector('.sw-panel')
  const outside = []
  const clipped = []
  for (const scope of [root.querySelector('.sw-inspector'), root.querySelector('.sw-head')]) {
    if (!scope || !scope.getClientRects().length) continue
    const limit = scope.getBoundingClientRect()
    for (const element of scope.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const style = getComputedStyle(element)
      if (rect.right > limit.right + 1 || rect.left < limit.left - 1) outside.push(name(element) + ' ' + Math.round(rect.left) + '–' + Math.round(rect.right) + ' of ' + Math.round(limit.left) + '–' + Math.round(limit.right))
      if (style.display !== 'inline' && style.textOverflow !== 'ellipsis' && !['TEXTAREA', 'SELECT', 'PRE'].includes(element.tagName) && element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'auto') clipped.push(name(element) + ' ' + element.scrollWidth + '>' + element.clientWidth)
    }
  }
  const workspace = document.querySelector('.studio-workspace')
  const stage = root.querySelector('.sw-stage-frame')
  const primary = root.querySelector('.sw-actions .button.primary')
  const visibleInView = element => { if (!element) return false; const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth }
  return {
    window: outerWidth + '×' + outerHeight,
    width: Math.round(root.getBoundingClientRect().width),
    stage: box(stage),
    stageShare: Math.round(stage.getBoundingClientRect().width / root.getBoundingClientRect().width * 100),
    rail: box(root.querySelector('.sw-rail')),
    inspector: root.querySelector('.sw-inspector').getClientRects().length ? box(root.querySelector('.sw-inspector')) : null,
    outside: outside.slice(0, 8),
    clipped: clipped.slice(0, 8),
    horizontal: { workspace: workspace.scrollWidth - workspace.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, panel: panel ? panel.scrollWidth - panel.clientWidth : 0 },
    moments: [...root.querySelectorAll('.sw-moment')].map(chip => chip.querySelector('.sw-moment-title').textContent),
    lastMomentReachable: (() => { const row = root.querySelector('.sw-moments'); const chips = row?.querySelectorAll('.sw-moment'); if (!chips?.length) return false; const last = chips[chips.length - 1]; last.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = last.getBoundingClientRect(); const rr = row.getBoundingClientRect(); return r.right <= rr.right + 1 && r.left >= rr.left - 1 })(),
    primary: primary ? { label: primary.textContent, inView: visibleInView(primary) } : null,
    revision: root.querySelector('.ws-revision')?.selectedOptions[0]?.textContent || root.querySelector('.sw-revision-slot')?.textContent || '',
    scenes: [...root.querySelectorAll('.sw-scene')].map(scene => ({ id: scene.dataset.scene, state: scene.querySelector('.sw-scene-state')?.textContent || '', thumb: Boolean(scene.querySelector('img')?.src), selected: scene.classList.contains('is-selected') })),
    tab: root.querySelector('.sw-tabs [aria-selected="true"]')?.textContent || '',
  }
}`

try {
  await launch()
  // ——— A base of two designed pages and its video ———
  const narrative = 'A mixture-of-experts layer sends each token to the experts chosen for it. The kernel dispatches token copies over NVLink inside a node and over RDMA between nodes.\n\nCombine brings the results home.'
  const read = await post('/api/source/read', { narrative, title: 'fabric-lib: RDMA point-to-point communication', wordingPolicy: 'draft' })
  const snapshotId = read.body.snapshot.id
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `workspace-base-${Date.now().toString(36)}`, title: 'fabric-lib: RDMA point-to-point communication', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'fabric-lib' },
    theme: { version: 1, id: 'fabric-workspace', name: 'fabric-lib', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      { type: 'paragraph', attrs: { id: 'p-intro' }, content: [{ type: 'text', text: 'How a mixture-of-experts layer moves its tokens between GPUs.' }] },
      await page('b04', 'Dispatch and combine', '05_request_rate_limiter.svg', 'In a mixture-of-experts layer, every token is sent to the experts chosen for it.\n\nCombine brings the results home.'),
      await page('b05', 'How the kernel stays out of the way', '06_concurrent_requests_limiter.svg', 'The kernel only moves data.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'fabric-lib: RDMA point-to-point communication', readAt: new Date().toISOString(), snapshotId },
    outline: { title: 'fabric-lib: RDMA point-to-point communication', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `workspace-${Date.now()}`, title: 'fabric-lib · video' })
  const videoId = fork.body.project.id
  check(Boolean(await openNotebook(videoId, 'fabric-lib · video')), 'the video notebook opens')
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })

  // ——— A video opens on its scenes, around one stage ———
  const opened = await waitFor(`() => { const root = document.getElementById('scene-workspace'); return root && !root.hidden && document.querySelectorAll('#scene-workspace .sw-scene').length === 2 ? { notebook: getComputedStyle(document.querySelector('.notebook-document')).display, scenesTab: document.getElementById('workspace-tab-scenes').getAttribute('aria-pressed'), stage: Boolean(document.querySelector('#scene-workspace .sw-stage-frame #scene-stage')), bar: Boolean(document.querySelector('#scene-workspace .sw-stage-bar #scene-stage-bar')), primary: document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent || '' } : null }`, 60)
  check(opened?.notebook === 'none' && opened.scenesTab === 'true' && opened.stage && opened.bar, `a video notebook opens on its scenes, the stage in the middle, the notebook set aside (${JSON.stringify(opened)})`)
  check(opened?.primary === 'Prepare the brief', `before any plan, the one action is the brief (${JSON.stringify(opened?.primary)})`)
  await shot('01-opened-needs-brief')
  await click('#scene-workspace .sw-actions .button.primary')
  const briefReady = await until(async () => { const current = await overview(videoId); return current.brief.current || (current.brief.latest?.status === 'failed' ? current.brief.latest : null) }, 90)
  check(briefReady?.status === 'ready', 'the brief is prepared from the workspace')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const planAction = await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button && button.textContent === 'Plan the scene' && !button.disabled ? button.textContent : null }`, 30)
  check(planAction === 'Plan the scene', `with the brief ready, the one action is to plan the scene (${planAction})`)
  // Who speaks is chosen in the scene's Record tab, before or after planning.
  await click('#sw-tab-record')
  const undecided = await waitFor(`() => { const choice = document.querySelector('#scene-workspace .ws-delivery'); return choice ? { buttons: [...choice.querySelectorAll('button')].map(button => button.textContent + (button.getAttribute('aria-checked') === 'true' ? ' *' : '')), note: choice.nextElementSibling?.textContent || '' } : null }`, 10)
  check(JSON.stringify(undecided?.buttons) === '["You present it","Generated voice","Silent"]' && /^Not chosen yet/.test(undecided.note), `the Record tab asks who speaks, and says it is not chosen yet (${JSON.stringify(undecided)})`)
  await evaluate(`() => { [...document.querySelectorAll('#scene-workspace .ws-delivery button')].find(button => button.textContent === 'You present it').click(); return true }`)
  const presented = await until(async () => (await overview(videoId)).scenes[0].delivery === 'human', 20)
  const chosen = await waitFor(`() => document.querySelector('#scene-workspace .ws-delivery [aria-checked="true"]')?.textContent || null`, 10)
  check(presented && chosen === 'You present it', `choosing "You present it" saves it for this scene (${chosen})`)
  await click('#sw-tab-story')
  await click('#scene-workspace .sw-actions .button.primary')
  // Planning shows as activity, never as a disabled approval form.
  const planningSeen = await waitFor(`() => { const activity = document.querySelector('#scene-workspace .ws-activity'); return activity ? { text: activity.textContent, primary: document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent || null, story: document.querySelector('#scene-workspace .sw-panel')?.textContent || '' } : null }`, 20)
  const planned = await until(async () => (await overview(videoId)).scenes[0].view.current, 90)
  check(planned?.status === 'candidate' && planned.content?.moments?.length === 8, `the scene is planned with eight moments (${planned?.content?.moments?.length})`)
  if (planningSeen) check(/^Planning r1…/.test(planningSeen.text) && planningSeen.primary === null && !/No plan yet/.test(planningSeen.story), `while it plans, the workspace shows it as activity, with no action to take and no "no plan yet" (${JSON.stringify(planningSeen)})`)
  await waitFor(`() => document.querySelectorAll('#scene-workspace .sw-moment').length === 8 ? true : null`, 30)
  // Q01 of the project-flow fix verification: the plan's concrete example
  // reads in one line under its takeaway; and the stage can be looked at
  // as small as a phone shows it.
  await click('#sw-tab-story')
  const exampleLine = await waitFor(`() => document.querySelector('#scene-workspace [data-review-example]')?.textContent || null`, 20)
  check(exampleLine === 'Concrete example. Token t1 waits on the source GPU in Node A → Dispatch sends its two copies to experts e3 and e7 → Combine brings both results back to t1 on the source GPU', `the plan's concrete example reads in one line under its takeaway (${JSON.stringify(exampleLine)})`)
  await shot('01c-concrete-example')
  await click('#scene-workspace .sw-phone')
  const phone = await waitFor(`() => { const frame = document.querySelector('#scene-workspace .sw-stage-frame'); const button = document.querySelector('#scene-workspace .sw-phone'); return button?.getAttribute('aria-pressed') === 'true' ? { width: Math.round(frame.getBoundingClientRect().width), label: button.textContent } : null }`, 10)
  await shot('01d-phone-size')
  await click('#scene-workspace .sw-phone')
  const fullSize = await waitFor(`() => { const frame = document.querySelector('#scene-workspace .sw-stage-frame'); return document.querySelector('#scene-workspace .sw-phone')?.getAttribute('aria-pressed') === 'false' ? Math.round(frame.getBoundingClientRect().width) : null }`, 10)
  check(Boolean(phone) && phone.width <= 390 && phone.label === 'Full size' && fullSize > 600, `Phone size draws the stage at a phone's width, and Full size brings it back (${JSON.stringify({ phone, fullSize })})`)

  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await size(width, height)
    await sleep(1000)
    const seen = await evaluate(measure)
    const at = `at ${seen?.window}`
    check(seen?.window === `${width}×${height}`, `the window is ${width} × ${height}`)
    check(width < 1400 || seen.stageShare >= 60, `${at} the stage keeps at least 60% of the workspace's width (${seen?.stageShare}%: ${JSON.stringify({ stage: seen?.stage, rail: seen?.rail, inspector: seen?.inspector })})`)
    check(seen?.horizontal.workspace <= 0 && seen.horizontal.page <= 0 && seen.horizontal.panel <= 0, `${at} nothing scrolls sideways (${JSON.stringify(seen?.horizontal)})`)
    check(seen?.outside.length === 0 && seen.clipped.length === 0, `${at} nothing in the header or inspector is clipped or sticks out (${JSON.stringify({ outside: seen?.outside, clipped: seen?.clipped })})`)
    check(seen?.moments.length === 8 && seen.lastMomentReachable, `${at} all eight moments sit in one row under the stage, the last one reachable (${JSON.stringify(seen?.moments.map(title => title.slice(0, 24)))})`)
    check(seen?.primary?.label === 'Preview r1' && seen.primary.inView && /^Plan r1 · candidate/.test(seen.revision), `${at} one revision control and one action for it, in view (${JSON.stringify({ primary: seen?.primary, revision: seen?.revision })})`)
    check(seen?.scenes.length === 2 && seen.scenes.every(scene => scene.thumb) && seen.scenes[0].selected && seen.scenes[0].state === 'Review r1' && seen.scenes[1].state === 'Plan it', `${at} the rail lists each scene with its page and the one thing it needs (${JSON.stringify(seen?.scenes)})`)
    await shot(`${width}-02-candidate`)
    // The last moment — the long identifier and the long paragraph — opens in the inspector.
    await evaluate(`() => { const chips = document.querySelectorAll('#scene-workspace .sw-moment'); chips[chips.length - 1].click(); return true }`)
    const last = await waitFor(`() => { const title = document.querySelector('#scene-workspace .ws-moment-title'); return title && /^fabric_lib::/.test(title.textContent) ? { tab: document.querySelector('#scene-workspace .sw-tabs [aria-selected="true"]')?.textContent, count: document.querySelector('#scene-workspace .ws-moment-count')?.textContent, fields: [...document.querySelectorAll('#scene-workspace .ws-moment > .ws-moment-fields dt')].map(entry => entry.textContent), selected: document.querySelector('#scene-workspace .sw-moment.is-selected .sw-moment-number')?.textContent } : null }`, 10)
    check(last?.tab === 'Moment' && last.count === 'Moment 8 of 8' && JSON.stringify(last.fields) === JSON.stringify(['On screen', 'Spoken line', 'Viewer focus']) && last.selected === '8', `${at} choosing the last moment opens it alone in the inspector: on screen, spoken line, viewer focus (${JSON.stringify(last)})`)
    const withMoment = await evaluate(measure)
    check(withMoment?.outside.length === 0 && withMoment.clipped.length === 0 && withMoment.horizontal.panel <= 0 && withMoment.primary?.inView, `${at} the long identifier and paragraph wrap: nothing clipped, the action still in view (${JSON.stringify({ outside: withMoment?.outside, clipped: withMoment?.clipped, horizontal: withMoment?.horizontal, primary: withMoment?.primary })})`)
    await shot(`${width}-03-last-moment`)
    await evaluate(`() => { document.querySelector('#scene-workspace [data-focus^="moment-previous:"]').click(); return true }`)
    const previous = await waitFor(`() => document.querySelector('#scene-workspace .ws-moment-count')?.textContent === 'Moment 7 of 8' ? document.querySelector('#scene-workspace .sw-moment.is-selected .sw-moment-number')?.textContent : null`, 10)
    check(previous === '7', `${at} Previous steps to moment 7, in the row too (${previous})`)
  }
  // ——— The context, in a drawer: briefs, evidence, the cast, how it was made ———
  await size(1440, 900)
  await sleep(800)
  await click('#scene-workspace .sw-context-open')
  const drawer = await waitFor(`() => { const context = document.querySelector('#scene-workspace .sw-context'); return context && !context.hidden && document.activeElement?.closest('.sw-context') ? { tabs: [...context.querySelectorAll('.sw-context-tabs button')].map(button => button.textContent), focus: document.activeElement?.getAttribute('data-focus') || '' } : null }`, 10)
  check(JSON.stringify(drawer?.tabs) === '["Brief","Explanation","Cast","Run details"]' && drawer.focus === 'sw-context:brief', `Context opens a drawer with the briefs, the cast and the run details, the keyboard on it (${JSON.stringify(drawer)})`)
  await click('#scene-workspace [data-focus="sw-context:cast"]')
  const cast = await waitFor(`() => document.querySelector('#scene-workspace .sw-context .review-cast-tally')?.textContent || null`, 10)
  check(/^The designed slide's \d+ objects: /.test(cast || ''), `its Cast lists the designed slide's objects, each with the plan's decision (${cast})`)
  await click('#scene-workspace [data-focus="sw-context:details"]')
  const details = await waitFor(`() => { const body = document.querySelector('#scene-workspace .sw-context .ws-context-body.is-details'); return body ? { text: body.querySelector('p')?.textContent || '', planText: Boolean([...body.querySelectorAll('summary')].find(summary => /full text/.test(summary.textContent))), workspace: Boolean(body.querySelector('[data-focus^="workspace:"]')) } : null }`, 10)
  check(/^Plan r1 · candidate · claude-code/.test(details?.text || '') && details.planText && details.workspace, `its Run details say how the plan was made, keep the plan's full text, and reach the planning workspace (${JSON.stringify(details)})`)
  await shot('1440-04-context')
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-context').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true }`)
  const closed = await waitFor(`() => document.querySelector('#scene-workspace .sw-context').hidden ? document.activeElement?.getAttribute('data-focus') || 'none' : null`, 10)
  check(closed === 'sw-context', `Escape closes the drawer and gives the keyboard back to Context (${closed})`)

  // ——— Approve, without a preview: an explicit choice that starts nothing ———
  await evaluate(`() => { [...document.querySelectorAll('#scene-workspace .sw-actions .button')].find(button => button.textContent === 'Approve r1 without a preview').click(); return true }`)
  const approved = await until(async () => (await overview(videoId)).scenes[0].view.reviewed, 30)
  check(approved?.id === planned.id, 'the plan is approved from the workspace')
  const afterApproval = await waitFor(`() => { const primary = document.querySelector('#scene-workspace .sw-actions .button.primary'); const revision = document.querySelector('#scene-workspace .ws-revision')?.selectedOptions[0]?.textContent || ''; return primary && /approved/.test(revision) ? { primary: primary.textContent, revision, produce: [...document.querySelectorAll('#scene-workspace .sw-actions .button')].filter(button => /Produce/.test(button.textContent)).map(button => ({ label: button.textContent, disabled: button.disabled, title: button.title })), state: document.querySelector('#scene-workspace .sw-scene.is-selected .sw-scene-state')?.textContent } : null }`, 20)
  check(afterApproval?.primary === 'Record the scene' && afterApproval.revision === 'Plan r1 · approved' && afterApproval.produce.length === 1 && afterApproval.produce[0].disabled && /take/.test(afterApproval.produce[0].title) && afterApproval.state === 'Record it', `approved, a scene you present asks for your take first; producing waits for it, and says so (${JSON.stringify(afterApproval)})`)
  // Approved, the Output tab joins the inspector: still nothing clipped, and
  // the workspace's action is the one primary — the notebook's steps back.
  const approvedLayout = await evaluate(measure)
  const tabs = await evaluate(`() => [...document.querySelectorAll('#scene-workspace .sw-tabs [role="tab"]')].map(tab => tab.textContent)`)
  check(approvedLayout?.outside.length === 0 && approvedLayout.clipped.length === 0 && JSON.stringify(tabs) === '["Story","Moment","Record","Output"]', `approved, the inspector's four tabs and the header fit (${JSON.stringify({ outside: approvedLayout?.outside, clipped: approvedLayout?.clipped, tabs })})`)
  const primaries = await evaluate(`() => { const green = element => getComputedStyle(element).backgroundColor === 'rgb(22, 163, 74)'; return { workspace: [...document.querySelectorAll('#scene-workspace .button.primary')].filter(element => element.getClientRects().length && green(element)).map(element => element.textContent), chrome: [...document.querySelectorAll('.topbar .button, .commandbar .button')].filter(element => element.getClientRects().length && green(element)).map(element => element.textContent.trim()) } }`)
  check(primaries.workspace.length === 1 && primaries.chrome.length === 0, `in the workspace the scene's action is the one primary; the notebook's next step steps back (${JSON.stringify(primaries)})`)
  const runs = await api(`/api/planning/${encodeURIComponent(videoId)}`).then(response => response.body.records.filter(record => ['preview', 'production'].includes(record.kind)).length)
  check(runs === 0, `approving started nothing: no preview, no production (${runs})`)
  // The recording guide, in the same workspace: the plan's lines first.
  await evaluate(`() => { [...document.querySelectorAll('#scene-workspace .sw-actions .button')].find(button => button.textContent === 'Record the scene').click(); return true }`)
  const guide = await waitFor(`() => { const record = document.querySelector('#scene-workspace .ws-record'); return record && document.querySelector('#sw-tab-record')?.getAttribute('aria-selected') === 'true' ? { lines: record.querySelectorAll('.review-guide-lines li').length, usePlan: Boolean(record.querySelector('[data-focus^="use-plan-script:"]')), focus: document.activeElement?.getAttribute('data-focus') || '', camera: document.getElementById('camera-dialog')?.open === true } : null }`, 10)
  check(guide?.lines === 8 && guide.usePlan && /^use-plan-script:/.test(guide.focus) && !guide.camera, `Record the scene opens its recording guide in the workspace: the plan's eight lines, and — since the notebook's script is older — using them first, with no camera started (${JSON.stringify(guide)})`)
  await click('#scene-workspace [data-focus^="use-plan-script:"]')
  const ready = await waitFor(`() => { const button = document.querySelector('#scene-workspace .ws-record [data-focus^="record:"]'); return button && !button.disabled ? button.textContent : null }`, 10)
  check(ready === 'Rehearse or record this scene', `with the plan's lines as the script, rehearsing or recording is one click away (${ready})`)
  await shot('1440-05-record')

  // ——— A reload comes back to the same scene, and the same tab ———
  const second = await evaluate(`() => document.querySelectorAll('#scene-workspace .sw-scene')[1].dataset.scene`)
  await click(`#scene-workspace .sw-scene[data-scene="${second}"]`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'How the kernel stays out of the way' ? true : null`, 10)
  await click('#sw-tab-record')
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  const restored = await waitFor(`() => { const root = document.getElementById('scene-workspace'); const title = root?.querySelector('.sw-title h2')?.textContent; return root && !root.hidden && title === 'How the kernel stays out of the way' ? { selected: root.querySelector('.sw-scene.is-selected')?.dataset.scene, tab: root.querySelector('.sw-tabs [aria-selected="true"]')?.textContent } : null }`, 60)
  check(restored?.selected === second && restored.tab === 'Record', `a reload opens the workspace on the same scene and tab (${JSON.stringify(restored)})`)

  // ——— The notebook is the other view, on the same scene ———
  await click('#scene-workspace .sw-back')
  const notebook = await waitFor(`() => { const root = document.getElementById('scene-workspace'); return root.hidden ? { document: getComputedStyle(document.querySelector('.notebook-document')).display, review: document.querySelector('.scene-review.is-expanded')?.dataset.reviewScene || '', stageHome: Boolean(document.querySelector('#player-shell #scene-stage')), notebookTab: document.getElementById('workspace-tab-notebook').getAttribute('aria-pressed') } : null }`, 10)
  check(notebook?.document !== 'none' && notebook.review === second && notebook.stageHome && notebook.notebookTab === 'true', `‹ Notebook shows the notebook on the same scene, its review open and the stage back beside it (${JSON.stringify(notebook)})`)
  await shot('1440-06-notebook')
  await click('#workspace-tab-scenes')
  const back = await waitFor(`() => { const root = document.getElementById('scene-workspace'); return !root.hidden && root.querySelector('.sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(second)} && Boolean(root.querySelector('.sw-stage-frame #scene-stage')) }`, 10)
  check(back === true, 'Scenes brings the workspace back on the same scene, with the stage')

  // ——— Narrower: the inspector becomes a drawer, then the detail goes under the stage ———
  await size(1024, 768)
  await sleep(1000)
  const tablet = await evaluate(`() => { const root = document.getElementById('scene-workspace'); const toggle = root.querySelector('.sw-inspector-toggle'); return { inspector: root.querySelector('.sw-inspector').getClientRects().length > 0, toggle: toggle ? getComputedStyle(toggle).display !== 'none' : false, page: document.documentElement.scrollWidth - document.documentElement.clientWidth } }`)
  check(!tablet.inspector && tablet.toggle && tablet.page <= 0, `at 1024 the inspector steps aside, opened from the header, and nothing scrolls sideways (${JSON.stringify(tablet)})`)
  await click('#scene-workspace .sw-inspector-toggle')
  const drawerOpen = await waitFor(`() => { const inspector = document.querySelector('#scene-workspace .sw-inspector'); return inspector.getClientRects().length > 0 ? getComputedStyle(inspector).position : null }`, 10)
  check(drawerOpen === 'absolute', `the inspector opens as a drawer over the stage (${drawerOpen})`)
  await shot('1024-07-inspector-drawer')
  await evaluate(`() => { document.querySelector('#scene-workspace .sw-inspector').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true }`)
  const drawerClosed = await waitFor(`() => document.querySelector('#scene-workspace .sw-inspector').getClientRects().length === 0 ? document.activeElement?.getAttribute('data-focus') || 'none' : null`, 10)
  check(drawerClosed === 'sw-inspector', `Escape closes it, the keyboard back on its button (${drawerClosed})`)
  await size(800, 900)
  await sleep(1000)
  const narrow = await evaluate(`() => { const root = document.getElementById('scene-workspace'); const stage = root.querySelector('.sw-stage-frame').getBoundingClientRect(); const inspector = root.querySelector('.sw-inspector').getBoundingClientRect(); return { stacked: inspector.top >= stage.bottom, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, stageWidth: Math.round(stage.width) } }`)
  check(narrow.stacked && narrow.page <= 0 && narrow.stageWidth > 500, `narrow, the scene's detail sits under the stage and nothing scrolls sideways (${JSON.stringify(narrow)})`)
  await shot('800-08-narrow')
  await size(1440, 900)

  // ——— A presentation is as it was: its document, no scenes view ———
  check(Boolean(await openNotebook(base.id, base.title)), 'the base notebook opens')
  const presentation = await waitFor(`() => ({ workspace: document.getElementById('scene-workspace').hidden, scenesTab: document.getElementById('workspace-tab-scenes').hidden, document: getComputedStyle(document.querySelector('.notebook-document')).display, stage: Boolean(document.querySelector('#player-shell #scene-stage')) })`, 20)
  check(presentation?.workspace && presentation.scenesTab && presentation.document !== 'none' && presentation.stage, `a presentation keeps its document view, with no scenes view (${JSON.stringify(presentation)})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE WORKSPACE CHECK FAIL (${failures})` : 'SCENE WORKSPACE CHECK PASS')
process.exitCode = failures ? 1 : 0
