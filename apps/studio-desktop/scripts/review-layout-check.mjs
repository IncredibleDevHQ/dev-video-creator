// The scene review stays readable where it is used (F6 of the Perplexity
// review) — an engineering fixture: the harness is a stub, so this proves
// the layout, never a plan's quality.
//
// A video's scene is planned with seven moments of long prose and long
// chips, like the fabric-lib dispatch-and-combine plan the review read.
// Selected beside the stage, at 1440 × 900 and at 1280 × 800, its review:
// sets its own type, not the notebook's; clips nothing and overflows
// nothing; lists the whole sequence of moments in a compact list with one
// moment in detail; and has one revision/status control and one approval
// action, which is gone once the revision is approved.
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
const root = await mkdtemp(join(tmpdir(), 'studio-review-layout-'))
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
emit({ type: 'system', subtype: 'init', session_id: 'stub-layout', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-layout', result: 'stub done' }); process.exit(code) }
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
    ]
    const moments = long.map(([title, change, guide, attention, text], index) => ({ id: 'm' + (index + 1), title, purpose: 'The viewer needs to see ' + title.toLowerCase() + ' before the next step makes sense, and notice where each copy goes.', observation: change, narration: { job: 'Say what happens', guide }, objects: actors.length ? { change, actors } : null, text, presenter: { visibility: index === 0 || index === 6 ? 'shared' : 'hidden', reason: 'Suggested' }, camera: { treatment: index === 4 ? 'pull back' : 'hold', subject: 'the fabric', reason: 'Keep the map' }, audio: null, attention, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: [3, 4.5, 3, 4, 4, 3, 3][index] }))
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What does the MoE kernel do, and which link does it use for each hop?',
      takeaway: 'Dispatch sends each token out to the GPUs holding its experts and combine brings the results home; the kernel carries a hop over NVLink when the expert is in the same node and over RDMA when it is on another node.',
      evidenceRefs: ['ev-1'], development: 'Show the tokens leave, work, and return, then why the routes differ.',
      demonstration: { text: 'Two nodes of eight GPUs. A source GPU in Node A holds tokens t1–t3, and each token has two expert GPUs: one in Node A and one in Node B. Dispatch sends out six token copies (three stay in the node, three cross to Node B); combine brings six results back and merges them into three finished tokens on the source GPU.', basis: 'source' },
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
  if (!process.env.REVIEW_LAYOUT_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.REVIEW_LAYOUT_SHOTS, { recursive: true })
  await writeFile(join(process.env.REVIEW_LAYOUT_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)

// Everything the review draws, measured where it is: its type, anything
// clipped or sticking out, the moment list's size, and its controls.
const measure = `async () => {
  const review = document.querySelector('.scene-review.is-expanded')
  const panel = review?.querySelector('.review-panel')
  if (!panel) return null
  review.scrollIntoView({ block: 'start' })
  await new Promise(resolve => setTimeout(resolve, 500))
  const box = panel.getBoundingClientRect()
  const name = element => element.tagName.toLowerCase() + (element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\\s+/).join('.') : '') + ' “' + (element.textContent || '').trim().slice(0, 40) + '”'
  const outside = []
  const clipped = []
  for (const element of panel.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const style = getComputedStyle(element)
    if (rect.right > box.right + 1 || rect.left < box.left - 1) outside.push(name(element) + ' ' + Math.round(rect.left) + '–' + Math.round(rect.right) + ' of ' + Math.round(box.left) + '–' + Math.round(box.right))
    if (style.display !== 'inline' && style.textOverflow !== 'ellipsis' && element.tagName !== 'TEXTAREA' && element.tagName !== 'SELECT' && element.scrollWidth > element.clientWidth + 1) clipped.push(name(element) + ' ' + element.scrollWidth + '>' + element.clientWidth)
  }
  const font = element => element ? getComputedStyle(element).fontSize + '/' + getComputedStyle(element).lineHeight : ''
  const list = panel.querySelector('.review-moments')
  const workspace = document.querySelector('.studio-workspace')
  return {
    window: outerWidth + '×' + outerHeight,
    panelWidth: Math.round(box.width),
    columns: getComputedStyle(panel.querySelector('.review-grid')).gridTemplateColumns.split(' ').length,
    type: { takeaway: font(panel.querySelector('.review-column p:not(.review-question)')), question: font(panel.querySelector('.review-question')), moment: font(panel.querySelector('.review-moment-head')), list: getComputedStyle(list).paddingLeft },
    outside: outside.slice(0, 8),
    clipped: clipped.slice(0, 8),
    horizontal: { panel: panel.scrollWidth - panel.clientWidth, workspace: workspace ? workspace.scrollWidth - workspace.clientWidth : 0, page: document.documentElement.scrollWidth - document.documentElement.clientWidth },
    rows: panel.querySelectorAll('.review-moment-head').length,
    listHeight: Math.round(list?.getBoundingClientRect().height || 0),
    viewport: Math.round(workspace?.getBoundingClientRect().height || innerHeight),
    details: panel.querySelectorAll('.review-moment-detail').length,
    hint: panel.querySelector('.review-moment-hint')?.textContent || '',
    approve: [...panel.querySelectorAll('[data-focus^="approve:"]')].map(button => button.textContent),
    revisions: [...panel.querySelectorAll('.review-revision')].map(button => button.textContent + (button.classList.contains('is-selected') ? ' *' : '')),
    planChips: [...panel.querySelectorAll('.review-head .review-chip')].map(chip => chip.textContent).filter(text => text.startsWith('Plan:')),
  }
}`
const size = (width, height) => post('/__window', { width, height }).then(response => response.body)

try {
  await launch()
  // ——— A base of two pages and its video ———
  const narrative = 'A mixture-of-experts layer sends each token to the experts chosen for it. The kernel dispatches token copies over NVLink inside a node and over RDMA between nodes.\n\nCombine brings the results home.'
  const read = await post('/api/source/read', { narrative, title: 'fabric-lib: RDMA point-to-point communication', wordingPolicy: 'draft' })
  const snapshotId = read.body.snapshot.id
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `layout-base-${Date.now().toString(36)}`, title: 'fabric-lib: RDMA point-to-point communication', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'fabric-lib' },
    theme: { version: 1, id: 'fabric-layout', name: 'fabric-lib', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      { type: 'paragraph', attrs: { id: 'p-intro' }, content: [{ type: 'text', text: 'How a mixture-of-experts layer moves its tokens between GPUs.' }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dispatch, then combine.' }] }] }] },
      await page('b04', 'Dispatch and combine', '05_request_rate_limiter.svg', 'In a mixture-of-experts layer, every token is sent to the experts chosen for it.\n\nCombine brings the results home.'),
      await page('b05', 'How the kernel stays out of the way', '06_concurrent_requests_limiter.svg', 'The kernel only moves data.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'fabric-lib: RDMA point-to-point communication', readAt: new Date().toISOString(), snapshotId },
    outline: { title: 'fabric-lib: RDMA point-to-point communication', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `layout-${Date.now()}`, title: 'fabric-lib · video' })
  const videoId = fork.body.project.id
  check(Boolean(await openNotebook(videoId, 'fabric-lib · video')), 'the video notebook opens')
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  const briefReady = await until(async () => { const current = await overview(videoId); return current.brief.current || (current.brief.latest?.status === 'failed' ? current.brief.latest : null) }, 90)
  check(briefReady?.status === 'ready', 'the brief is prepared')
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)

  // ——— The seven-moment plan ———
  await selectScene(0)
  await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]:not([disabled])') ? true : null`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const planned = await until(async () => (await overview(videoId)).scenes[0].view.current, 90)
  check(planned?.status === 'candidate' && planned.content?.moments?.length === 7, `the scene is planned with seven moments (${planned?.content?.moments?.length})`)
  await waitFor(`() => document.querySelectorAll('.scene-review.is-expanded .review-moment-head').length === 7 ? true : null`, 30)

  // Picked from the rail, the review leads, at the top of the view.
  await selectScene(1)
  await sleep(500)
  const railPick = await evaluate(`async () => {
    const title = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[0].querySelector('.scene-title').textContent
    const chip = [...document.querySelectorAll('#notebook-timeline .notebook-timeline-chip')].find(entry => entry.title.endsWith(title))
    chip.click()
    await new Promise(resolve => setTimeout(resolve, 900))
    const top = document.querySelector('.studio-workspace').getBoundingClientRect().top
    const review = document.querySelector('.scene-review.is-expanded')
    const block = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[0]
    return { top: Math.round(top), review: Math.round(review.getBoundingClientRect().top), block: [Math.round(block.getBoundingClientRect().top), Math.round(block.getBoundingClientRect().bottom)], scroll: Math.round(document.querySelector('.studio-workspace').scrollTop) }
  }`)
  check(railPick.review >= railPick.top - 1 && railPick.review - railPick.top < 40 && railPick.block[1] > railPick.review, `picked from the rail, the scene's review is at the top of the view (${JSON.stringify(railPick)})`)

  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    const resized = await size(width, height)
    await sleep(900)
    await selectScene(0)
    await waitFor(`() => document.querySelector('.scene-review.is-expanded .review-question') ? true : null`, 20)
    const seen = await evaluate(measure)
    const at = `at ${seen?.window}`
    check(seen?.window === `${width}×${height}`, `the window is ${width} × ${height} (${JSON.stringify(resized)})`)
    check(seen?.type.takeaway === '13px/18.85px' && seen.type.question.startsWith('15px/') && seen.type.moment.startsWith('13px/') && seen.type.list === '3px', `${at} the review sets its own type, not the notebook's (${JSON.stringify(seen?.type)})`)
    check(seen?.outside.length === 0 && seen.clipped.length === 0, `${at} nothing in the review is clipped or sticks out of it (${JSON.stringify({ outside: seen?.outside, clipped: seen?.clipped })})`)
    check(seen?.horizontal.panel <= 0 && seen.horizontal.workspace <= 0 && seen.horizontal.page <= 0, `${at} nothing scrolls sideways (${JSON.stringify(seen?.horizontal)})`)
    check(seen?.rows === 7 && seen.details === 0 && /^Select a moment/.test(seen.hint) && seen.listHeight <= seen.viewport * 0.5, `${at} the seven moments are one compact list that fits in half the view (${seen?.listHeight}px of ${seen?.viewport}px), with no detail until one is chosen (${JSON.stringify({ rows: seen?.rows, details: seen?.details, columns: seen?.columns, panel: seen?.panelWidth })})`)
    check(seen?.approve.length === 1 && seen.approve[0] === `Approve r${planned.revision}` && seen.revisions.length === 1 && seen.revisions[0] === `r${planned.revision} candidate *` && seen.planChips.length === 0, `${at} one revision control and one approval action (${JSON.stringify({ approve: seen?.approve, revisions: seen?.revisions, planChips: seen?.planChips })})`)
    // The chrome (F10): one primary action — the scene's next step — the
    // title once, one AI entry, and nothing crowded out of either bar.
    const chrome = await evaluate(`() => {
      const visible = element => element && element.getClientRects().length > 0
      const title = document.getElementById('project-title').value
      const bars = ['.topbar', '.commandbar'].map(selector => { const bar = document.querySelector(selector); return bar.scrollWidth - bar.clientWidth })
      const clipped = [...document.querySelectorAll('.topbar button, .topbar a, .commandbar button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.right > innerWidth + 1 || box.left < -1 }).map(element => element.id || element.textContent.trim().slice(0, 20))
      return {
        primaries: [...document.querySelectorAll('.topbar .button.primary, .commandbar .button.primary')].filter(visible).map(element => element.textContent.trim()),
        next: document.getElementById('next-step').textContent,
        titles: [...document.querySelectorAll('.topbar *')].filter(visible).filter(element => !element.children.length && element.id !== 'project-title' && element.textContent.includes(title)).length,
        lineage: [...document.querySelectorAll('#notebook-lineage .notebook-lineage-segment')].map(element => element.textContent),
        ai: [...document.querySelectorAll('#open-ai-settings')].filter(visible).length,
        older: ['build-explainer', 'create-explainer', 'open-fullscreen'].filter(id => visible(document.getElementById(id))),
        bars,
        clipped,
      }
    }`)
    check(JSON.stringify(chrome.primaries) === '["Review scene 1"]' && chrome.titles === 0 && chrome.lineage.length === 1 && chrome.ai === 1 && chrome.older.length === 0 && chrome.bars.every(extra => extra <= 0) && chrome.clipped.length === 0, `${at} one primary action, the scene's next step; the title once; one AI entry; the older paths under Advanced; nothing clipped (${JSON.stringify(chrome)})`)
    await shot(`${width}-01-review`)

    // One moment in detail: why, what changes on screen, what is said.
    await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[1].click(); return true }`)
    const detail = await waitFor(`() => { const detail = document.querySelector('.scene-review.is-expanded .review-moment-detail'); const row = detail?.closest('.review-moment'); return detail ? { under: row?.classList.contains('is-selected') ? row.querySelector('.review-moment-head strong').textContent : '', label: detail.getAttribute('aria-label'), fields: [...detail.querySelectorAll('dt')].map(entry => entry.textContent), chips: [...detail.querySelectorAll('.review-chip')].map(entry => entry.textContent), count: document.querySelectorAll('.scene-review.is-expanded .review-moment-detail').length, rows: document.querySelectorAll('.scene-review.is-expanded .review-moment-head').length } : null }`, 10)
    check(detail?.count === 1 && detail.rows === 7 && detail.under === 'Dispatch: tokens go out to their experts' && detail.label === 'Moment 2 of 7: Dispatch: tokens go out to their experts' && JSON.stringify(detail.fields) === JSON.stringify(['Purpose', 'On screen', 'Narration', 'Attention']), `${at} a chosen moment opens alone, under its own line, with its purpose, what is on screen and what is said (${JSON.stringify(detail)})`)
    // As from the keyboard: the button has focus when it is pressed.
    await evaluate(`() => { const next = document.querySelector('.scene-review.is-expanded [data-focus^="moment-next:"]'); next.focus(); next.click(); return true }`)
    const stepped = await waitFor(`() => { const detail = document.querySelector('.scene-review.is-expanded .review-moment-detail'); return detail && /^Moment 3 of 7/.test(detail.getAttribute('aria-label')) ? { title: detail.closest('.review-moment').querySelector('.review-moment-head strong').textContent, focus: document.activeElement?.getAttribute('data-focus') || '', inView: (() => { const box = detail.getBoundingClientRect(); const view = document.querySelector('.studio-workspace').getBoundingClientRect(); return box.top >= view.top - 1 && box.bottom <= Math.min(innerHeight, document.getElementById('notebook-timeline')?.getBoundingClientRect().top || innerHeight) + 1 })() } : null }`, 10)
    check(stepped?.title === 'Experts work where they are' && /^moment-next:/.test(stepped.focus), `${at} Next steps to the following moment, keeping the keyboard where it was (${JSON.stringify(stepped)})`)
    // The last moment, opened from the list, is brought into view whole.
    await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[6].click(); return true }`)
    await sleep(900)
    const last = await evaluate(`() => { const detail = document.querySelector('.scene-review.is-expanded .review-moment-detail'); const box = detail.getBoundingClientRect(); const view = document.querySelector('.studio-workspace').getBoundingClientRect(); const floor = Math.min(innerHeight, document.getElementById('notebook-timeline')?.getBoundingClientRect().top || innerHeight); return { label: detail.getAttribute('aria-label'), top: Math.round(box.top), bottom: Math.round(box.bottom), viewTop: Math.round(view.top), floor: Math.round(floor) } }`)
    check(/^Moment 7 of 7/.test(last.label) && last.top >= last.viewTop - 1 && last.bottom <= last.floor + 1, `${at} the opened moment is scrolled into view (${JSON.stringify(last)})`)
    await shot(`${width}-02-moment`)
    const withDetail = await evaluate(measure)
    check(withDetail?.outside.length === 0 && withDetail.clipped.length === 0 && withDetail.details === 1, `${at} with a moment open, nothing is clipped or sticks out either (${JSON.stringify({ outside: withDetail?.outside, clipped: withDetail?.clipped })})`)
    await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[4].click(); return true }`)
    await sleep(400)
    const longChip = await evaluate(measure)
    check(longChip?.outside.length === 0 && longChip.clipped.length === 0, `${at} a moment with a long label chip wraps it (${JSON.stringify({ outside: longChip?.outside, clipped: longChip?.clipped })})`)
    await evaluate(`() => { const selected = document.querySelector('.scene-review.is-expanded .review-moment.is-selected .review-moment-head'); selected?.click(); return true }`)
    await sleep(300)
  }

  // ——— Approved: the one control says so; the approval action is gone ———
  await size(1440, 900)
  await sleep(600)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]').click(); return true }`)
  const approved = await until(async () => (await overview(videoId)).scenes[0].view.reviewed, 30)
  check(approved?.id === planned.id, 'the plan is approved')
  const after = await waitFor(`() => { const panel = document.querySelector('.scene-review.is-expanded .review-panel'); const revisions = [...(panel?.querySelectorAll('.review-revision') || [])].map(button => button.textContent); return revisions.some(text => text === 'r${planned.revision} approved') ? { revisions, approve: panel.querySelectorAll('[data-focus^="approve:"]').length, planChips: [...panel.querySelectorAll('.review-head .review-chip')].map(chip => chip.textContent).filter(text => text.startsWith('Plan:')) } : null }`, 20)
  check(after?.approve === 0 && after.planChips.length === 0, `approved, the revision control reads it once and no approval action is left (${JSON.stringify(after)})`)
  await shot('1440-03-approved')
  // Other scenes keep their compact strip, with the plan's state in it.
  const other = await evaluate(`() => [...document.querySelectorAll('.scene-review:not(.is-expanded) .review-strip .review-chip')].map(chip => chip.textContent)`)
  check(other.some(text => text.startsWith('Plan:')), `an unselected scene's strip still says where its plan stands (${JSON.stringify(other)})`)
  // ——— The base: its one next step is its video; the rest under Advanced ———
  check(Boolean(await openNotebook(base.id, base.title)), 'the base notebook opens')
  const baseStep = await waitFor(`() => { const button = document.getElementById('next-step'); return button.textContent === 'Open video' ? { label: button.textContent, title: button.title, primaries: [...document.querySelectorAll('.topbar .button.primary, .commandbar .button.primary')].filter(element => element.getClientRects().length).map(element => element.textContent.trim()) } : null }`, 30)
  check(baseStep?.label === 'Open video' && JSON.stringify([...baseStep.primaries].sort()) === '["Open video","Publish"]' && /fabric-lib · video/.test(baseStep.title), `the base leads with its video (${JSON.stringify(baseStep)})`)
  // Import's menu shows whole too: the command bar no longer clips it.
  const imports = await evaluate(`async () => {
    document.getElementById('import-menu-toggle').click()
    await new Promise(resolve => setTimeout(resolve, 300))
    const buttons = [...document.querySelectorAll('#import-menu-list button')].filter(element => element.getClientRects().length)
    const shown = buttons.filter(element => { const box = element.getBoundingClientRect(); const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return box.bottom <= innerHeight && Boolean(hit && element.contains(hit)) }).length
    document.getElementById('import-menu-toggle').click()
    return { items: buttons.length, shown }
  }`)
  check(imports.items > 0 && imports.shown === imports.items, `Import's menu shows every item whole (${JSON.stringify(imports)})`)
  const advanced = await evaluate(`async () => {
    document.getElementById('advanced-menu-toggle').click()
    await new Promise(resolve => setTimeout(resolve, 300))
    const list = document.getElementById('advanced-menu-list')
    const buttons = [...list.querySelectorAll('button')].filter(element => element.getClientRects().length)
    // Each item really shows: inside the window, and on top where it is.
    const shown = buttons.filter(element => { const box = element.getBoundingClientRect(); const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return box.top >= 0 && box.bottom <= innerHeight && box.right <= innerWidth && Boolean(hit && element.contains(hit)) }).length
    return { open: !list.hidden, expanded: document.getElementById('advanced-menu-toggle').getAttribute('aria-expanded'), shown, barScrolled: document.querySelector('.commandbar .actions').scrollTop + document.querySelector('.commandbar .actions').scrollLeft, next: document.getElementById('next-step').getClientRects().length > 0, items: buttons.map(element => ({ label: element.querySelector('.menu-label').textContent, note: element.querySelector('.menu-note').textContent })) }
  }`)
  check(advanced.open && advanced.expanded === 'true' && advanced.shown === 3 && advanced.barScrolled === 0 && advanced.next && advanced.items.map(item => item.label).join('|') === 'Open canvas|Create explainer…|Build explainer' && /does not use approved scene plans/.test(advanced.items[2]?.note || ''), `Advanced holds the older and other paths, each saying what it is (${JSON.stringify(advanced)})`)
  await shot('base-advanced')
  await evaluate(`() => { document.getElementById('advanced-menu-toggle').click(); return true }`)
  const documentType = await waitFor(`() => { const paragraph = document.querySelector('#editor .tiptap > p'); const list = document.querySelector('#editor .tiptap > ul'); if (!paragraph || !list) return null; const style = getComputedStyle(paragraph); return { paragraph: style.fontSize + '/' + style.lineHeight, item: getComputedStyle(list.querySelector('li')).fontSize + '/' + getComputedStyle(list.querySelector('li')).lineHeight, list: getComputedStyle(list).paddingLeft } }`, 30)
  check(documentType?.paragraph === '15px/26.25px' && documentType.item === '15px/26.25px' && documentType.list === '30px', `the notebook's paragraphs and lists keep the document's type (${JSON.stringify(documentType)})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `REVIEW LAYOUT CHECK FAIL (${failures})` : 'REVIEW LAYOUT CHECK PASS')
process.exitCode = failures ? 1 : 0
