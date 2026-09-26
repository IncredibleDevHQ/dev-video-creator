// Useful progress (U3 of the scene workspace plan) — an engineering fixture:
// the harness is a stub whose steps wait at gates the check opens, so each
// phase can be seen as it happens.
//
// A plan develops in named phases that move only on what the product
// confirmed: the run read its packet; it published its explanation, then its
// moments, as drafts shown "still being checked"; it handed the plan in, was
// refused and repaired it; the plan is ready to review. A reload keeps the
// phase and the draft; direction being typed survives the updates. Stopping
// reads "Cancelling…" until the run has stopped. A quota failure keeps the
// last draft read-only, says what happened and offers a retry and another
// harness. An approved plan stays on show while a newer one develops, and is
// offered once it lands. A late draft from a stopped run is refused.
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
const root = await mkdtemp(join(tmpdir(), 'studio-planning-progress-'))
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

// ——— The stub harness: a brief at once; a scene plan step by step ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-progress', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-progress', result: 'stub done' }); process.exit(code) }
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
const gate = async name => { const file = path.join(GATES, name); const until = Date.now() + 240000; while (!fs.existsSync(file) && Date.now() < until) await sleep(200) }
;(async () => {
  const projectDir = process.cwd()
  await rpc('initialize', { protocolVersion: '2024-11-05' })
  const inputs = JSON.parse(fs.readFileSync('motion/inputs.json', 'utf8'))
  const context = JSON.parse(fs.readFileSync('packet/CONTEXT.json', 'utf8'))
  const record = inputs.planning.recordId
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
    // A preview whose provider is overloaded: it read its packet — as the
    // sketch skill does, file by file, never asking for its context (BoltDB
    // review B05) — then fails.
    emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: path.join(projectDir, 'packet', 'PLAN.json') } }] } })
    await sleep(1500)
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: 'stub-progress', result: 'API Error: 529 Overloaded. Please try again later.' })
    shim.kill()
    process.exit(1)
  }
  // A scene plan: read the packet, then each step when its gate opens.
  const told = await tool('plan_context', { projectDir })
  fs.writeFileSync('planning/context-answer.json', JSON.stringify(told))
  const scene = fs.readFileSync('packet/SCENE.md', 'utf8')
  await gate(record + '-explain')
  const explained = await tool('plan_publish_draft', { projectDir, section: 'explanation', question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.' })
  fs.writeFileSync('planning/draft-answer.json', JSON.stringify(explained))
  if (/QUOTA/.test(scene)) {
    // Out of credits: the provider's own words, and the run ends.
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: 'stub-progress', result: 'API Error: Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' })
    shim.kill()
    process.exit(1)
  }
  await gate(record + '-moments')
  const titles = ['Set the scene', 'The limit bites', 'Back to the viewer']
  await tool('plan_publish_draft', { projectDir, section: 'moments', moments: titles.map((title, index) => ({ id: 'm' + (index + 1), title, summary: title + ', on screen.' })) })
  await gate(record + '-submit')
  const brief = (await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()).record.content
  const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
  const cast = JSON.parse(fs.readFileSync('packet/VISUAL_CAST.json', 'utf8'))
  const moment = (id, title, visibility) => ({ id, title, purpose: 'The viewer needs to see it', observation: title, narration: { job: 'Say what happens', guide: title + '.' }, objects: null, text: null, presenter: { visibility, reason: 'Suggested' }, camera: { treatment: 'hold', subject: 'the scene', reason: 'Keep the map' }, audio: null, attention: title, recipes: [], evidenceRefs: ['ev-1'], estimateSeconds: 4 })
  const treatment = moments => ({
    schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
    question: 'What does this limiter do?', takeaway: 'It turns excess load away before it hurts.', evidenceRefs: ['ev-1'], development: 'Show the limit biting.', demonstration: null, ledger: null,
    moments, objects: (cast.entries || []).filter(entry => context.scene.originScenes.includes(entry.page) && entry.verification.status === 'verified' && entry.libraryKey).map(entry => ({ entity: 'page-' + entry.id, role: entry.label, appearance: 'Not shown', performance: 'None', asset: { status: 'omit', ref: entry.libraryKey, reason: 'Not needed for this scene' } })),
    treatments: { presenter: 'Opens on camera', text: 'None', camera: 'Holds' },
    skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }],
    requirements: { assets: [], takes: [], decisions: [] },
    continuity: { entry: 'The page in view', exit: 'The limit holding', incoming: { kind: 'self-contained' }, outgoing: { kind: 'self-contained' } }, unresolved: [],
    coverage: units.flatMap(unit => brief.units.find(entry => entry.id === unit).communicationNeeds.map(need => ({ unit, need: need.need, moments: ['m1'] }))),
    rosterProposal: null, delivery: { voice: context.delivery || 'undecided', note: '' },
  })
  // First a plan with no moments: the product refuses it.
  fs.writeFileSync('planning/treatment.json', JSON.stringify(treatment([])))
  const first = await tool('plan_submit_treatment', { projectDir })
  fs.writeFileSync('planning/first-answer.json', JSON.stringify(first))
  await gate(record + '-repair')
  fs.writeFileSync('planning/treatment.json', JSON.stringify(treatment(titles.map((title, index) => moment('m' + (index + 1), title, index === 0 ? 'full' : 'hidden')))))
  const answer = await tool('plan_submit_treatment', { projectDir })
  if (!answer.accepted) process.stderr.write('stub plan refused: ' + JSON.stringify(answer) + '\n')
  shim.kill()
  finish(0)
})().catch(error => { console.error(error); finish(1) })
`.replace('GATES', JSON.stringify(gates))
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
  if (!process.env.PLANNING_PROGRESS_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.PLANNING_PROGRESS_SHOTS, { recursive: true })
  await writeFile(join(process.env.PLANNING_PROGRESS_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
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

const clickText = (selector, text) => evaluate(`() => { const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(entry => entry.textContent.trim() === ${JSON.stringify(text)}); if (!element) return false; element.click(); return true }`)
const pickScene = sceneId => click(`#scene-workspace .sw-scene[data-scene="${sceneId}"]`)
const open = name => writeFile(join(gates, name), 'go')
// The phases the workspace shows for a run, and what it says is happening.
const progressNow = `() => {
  const box = document.querySelector('#scene-workspace .sw-panel .ws-progress')
  if (!box) return null
  return {
    phases: [...box.querySelectorAll('.ws-phases li')].map(li => li.dataset.phase + ':' + li.dataset.state).join(' '),
    now: box.querySelector('.ws-progress-now')?.textContent || '',
    time: box.querySelector('.ws-progress-time')?.textContent || '',
    who: box.querySelector('.ws-progress-who')?.textContent || '',
    draft: (() => { const draft = document.querySelector('#scene-workspace .sw-panel .ws-draft'); return draft ? { label: draft.querySelector('.ws-draft-label')?.textContent || '', question: draft.querySelector('.ws-draft-question')?.textContent || '', moments: [...draft.querySelectorAll('.ws-draft-moments li')].map(li => li.textContent) } : null })(),
    header: document.querySelector('#scene-workspace .sw-status')?.textContent || '',
  }
}`
const latestOf = async (videoId, sceneId) => (await overview(videoId)).scenes.find(scene => scene.id === sceneId)?.view.latest

try {
  await launch()
  const narrative = 'A rate limiter keeps an API alive when load spikes.\n\nIt refuses the excess before it hurts.'
  const read = await post('/api/source/read', { narrative, title: 'Rate limiters', wordingPolicy: 'draft' })
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `progress-base-${Date.now().toString(36)}`, title: 'Rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Rate limiters' },
    theme: { version: 1, id: 'progress', name: 'Rate limiters', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b04', 'Request rate limiter', '05_request_rate_limiter.svg', 'A limiter refuses the excess.'),
      await page('b05', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'It caps what runs at once.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'Rate limiters', readAt: new Date().toISOString(), snapshotId: read.body.snapshot.id },
    outline: { title: 'Rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `progress-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens on its scenes')
  const primary = await waitFor(`() => document.querySelector('#scene-workspace .sw-actions .button.primary')?.textContent === 'Prepare the brief' ? true : null`, 60)
  await click('#scene-workspace .sw-actions .button.primary')
  const briefReady = await until(async () => { const current = await overview(videoId); return current.brief.current || (current.brief.latest?.status === 'failed' ? current.brief.latest : null) }, 90)
  const briefNow = briefReady || (await overview(videoId)).brief.latest
  check(briefReady?.status === 'ready', `the brief is prepared (${JSON.stringify(briefReady?.status === 'ready' ? 'ready' : { primary: Boolean(primary) || await evaluate(`() => document.querySelector('#scene-workspace .sw-actions')?.textContent || ''`), status: briefNow?.status, error: briefNow?.error })})`)
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const [s1, s2] = (await overview(videoId)).scenes.map(scene => scene.id)

  // ——— A plan develops in phases the product confirmed ———
  await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  const r1 = await until(async () => { const latest = await latestOf(videoId, s1); return latest && latest.progress?.events?.some(event => event.milestone === 'context') ? latest : null }, 60)
  check(Boolean(r1), 'the run read its packet, and the product noted it')
  // The workspace reads the plans every few seconds: the packet read shows
  // on the next read, not before.
  const reading = await waitFor(`() => { const now = (${progressNow})(); return now && /reviewing:active/.test(now.phases) && /read its packet/.test(now.now) ? now : null }`, 30)
  check(reading?.phases === 'reviewing:active explanation:todo moments:todo checking:todo ready:todo' && /read its packet/.test(reading.now) && /Claude Code/.test(reading.who) && /^Planning r1/.test(reading.header), `planning shows its phase, what is happening, who runs it and in the header — and nothing it has not seen (${JSON.stringify(reading)})`)
  check(!reading || !/No plan yet/.test(await evaluate(`() => document.querySelector('#scene-workspace .sw-panel').textContent`)), 'no "no plan yet" while it plans')
  await shot('01-reviewing')
  await open(`${r1.id}-explain`)
  const explained = await waitFor(`() => { const now = (${progressNow})(); return now?.draft?.question ? now : null }`, 30)
  check(explained?.phases === 'reviewing:done explanation:done moments:active checking:todo ready:todo' && explained.draft.label === 'Draft · still being checked' && explained.draft.question === 'What does this limiter do?', `the explanation arrives as a draft, still being checked, and the phases move on (${JSON.stringify(explained)})`)
  // A reload keeps the phase and the draft.
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  const reloaded = await waitFor(`() => { const now = (${progressNow})(); return now?.draft?.question ? now : null }`, 60)
  check(reloaded?.phases === explained?.phases && reloaded.draft.question === explained.draft.question, `after a reload the same phase and draft are there (${JSON.stringify(reloaded?.phases)})`)
  // Direction typed while it plans survives the updates.
  await evaluate(`() => { const box = document.querySelector('#scene-workspace [data-focus^="direction:"]'); box.focus(); box.value = 'Hold on the refusal'; box.dispatchEvent(new Event('input', { bubbles: true })); return true }`)
  await open(`${r1.id}-moments`)
  const drafted = await waitFor(`() => { const now = (${progressNow})(); return now?.draft?.moments.length === 3 ? now : null }`, 30)
  const typed = await evaluate(`() => ({ value: document.querySelector('#scene-workspace [data-focus^="direction:"]').value, focused: document.activeElement?.getAttribute('data-focus') || '', chips: [...document.querySelectorAll('#scene-workspace .sw-moment.is-draft')].map(chip => chip.querySelector('.sw-moment-title').textContent) })`)
  check(Boolean(drafted) && /3 moments drafted/.test(drafted.now) && JSON.stringify(typed.chips) === '["Set the scene","The limit bites","Back to the viewer"]', `the moments arrive as drafts, in the inspector and under the stage (${JSON.stringify({ now: drafted?.now, chips: typed.chips })})`)
  check(typed.value === 'Hold on the refusal' && /^direction:/.test(typed.focused), `direction typed meanwhile is kept, and keeps the keyboard (${JSON.stringify(typed)})`)
  await shot('02-drafted')
  await open(`${r1.id}-submit`)
  const refused = await waitFor(`() => { const now = (${progressNow})(); return now && /problem/.test(now.now) ? now : null }`, 30)
  check(refused?.phases === 'reviewing:done explanation:done moments:active checking:todo ready:todo' && /^The check found \d+ problems?; the harness is fixing/.test(refused.now), `a refused plan shows the moments phase again, saying why (${JSON.stringify(refused)})`)
  await shot('03-repairing')
  await open(`${r1.id}-repair`)
  const planned = await until(async () => { const latest = await latestOf(videoId, s1); return latest?.status === 'candidate' ? latest : null }, 60)
  const settled = await waitFor(`() => document.querySelector('#scene-workspace .sw-panel .ws-question')?.textContent === 'What does this limiter do?' && !document.querySelector('#scene-workspace .sw-panel .ws-progress') && !document.querySelector('#scene-workspace .sw-panel .ws-draft') ? true : null`, 30)
  check(Boolean(planned) && settled === true, 'accepted, the plan replaces its draft, with no progress left on show')

  // ——— Stopping reads "Cancelling…" until the run has stopped ———
  await pickScene(s2)
  await waitFor(`() => { const button = document.querySelector('#scene-workspace .sw-actions .button.primary'); return button?.textContent === 'Plan the scene' && !button.disabled ? true : null }`, 30)
  await click('#scene-workspace .sw-actions .button.primary')
  const r2 = await until(async () => { const latest = await latestOf(videoId, s2); return latest?.status === 'running' && latest.progress?.events?.some(event => event.milestone === 'context') ? latest : null }, 60)
  await waitFor(`() => document.querySelector('#scene-workspace [data-focus^="ws-action:stop:"]') ? true : null`, 20)
  await click('#scene-workspace [data-focus^="ws-action:stop:"]')
  const cancelling = await waitFor(`() => { const button = document.querySelector('#scene-workspace [data-focus^="ws-action:stop:"]'); return button && button.textContent === 'Cancelling…' ? { disabled: button.disabled } : null }`, 5)
  check(cancelling?.disabled === true, `Stop reads "Cancelling…" while the run is being stopped (${JSON.stringify(cancelling)})`)
  const stopped = await until(async () => { const latest = await latestOf(videoId, s2); return latest?.status === 'failed' ? latest : null }, 60)
  const stoppedShown = await waitFor(`() => { const failure = document.querySelector('#scene-workspace .sw-panel .ws-failure'); return failure ? { kind: failure.dataset.failure, text: failure.textContent } : null }`, 30)
  check(Boolean(stopped) && stoppedShown?.kind === 'stopped' && /stopped/i.test(stoppedShown.text), `stopped, it says so — and the scene can be planned again (${JSON.stringify(stoppedShown)})`)
  // A late draft from the stopped run is refused and never shown.
  const late = await post(`/api/planning/records/${stopped.id}/draft`, { runId: stopped.runId, section: 'explanation', question: 'Late question?', takeaway: 'Late.' })
  const lateShown = await evaluate(`() => document.querySelector('#scene-workspace .sw-panel').textContent.includes('Late question?')`)
  check(late.status === 409 && !lateShown, `a late draft from the stopped run is refused and never shown (${late.status})`)

  // ——— Out of credits: the draft kept read-only, the error, a retry, another harness ———
  await evaluate(`() => { const box = document.querySelector('#scene-workspace [data-focus^="direction:"]'); box.value = 'QUOTA: show the cap'; box.dispatchEvent(new Event('input', { bubbles: true })); return true }`)
  await click('#scene-workspace [data-focus^="revise:"]')
  const r3 = await until(async () => { const latest = await latestOf(videoId, s2); return latest?.id !== stopped.id && latest?.progress?.events?.some(event => event.milestone === 'context') ? latest : null }, 60)
  await open(`${r3.id}-explain`)
  const quota = await until(async () => { const latest = await latestOf(videoId, s2); return latest?.id === r3.id && latest.status === 'failed' ? latest : null }, 60)
  const quotaShown = await waitFor(`() => { const failure = document.querySelector('#scene-workspace .sw-panel .ws-failure'); const draft = document.querySelector('#scene-workspace .sw-panel .ws-draft'); return failure && failure.dataset.failure === 'quota' ? { text: failure.textContent, recovery: [...failure.querySelectorAll('.ws-failure-recovery li')].map(li => li.textContent), buttons: [...failure.querySelectorAll('button')].map(button => button.textContent), draft: draft ? { label: draft.querySelector('.ws-draft-label')?.textContent, question: draft.querySelector('.ws-draft-question')?.textContent } : null } : null }`, 30)
  check(quota?.error?.category === 'quota' && /credit balance is too low/i.test(quotaShown?.text || ''), `out of credits: the provider's own words are shown (${JSON.stringify(quotaShown?.text?.slice(0, 160))})`)
  check(quotaShown?.recovery.some(line => /credits/.test(line)) && quotaShown.buttons.includes('Plan the scene again') && quotaShown.buttons.includes('Change the harness or model'), `with the ways on: a retry, and another harness or model (${JSON.stringify({ recovery: quotaShown?.recovery, buttons: quotaShown?.buttons })})`)
  check(quotaShown?.draft?.label === 'Draft from the run that failed · not checked' && quotaShown.draft.question === 'What does this limiter do?', `the last draft is kept, read-only, and said to be unchecked (${JSON.stringify(quotaShown?.draft)})`)
  await shot('04-quota')
  // Retry without the fault: a new attempt, planned in full.
  await evaluate(`() => { const box = document.querySelector('#scene-workspace [data-focus^="direction:"]'); box.value = 'Show the cap'; box.dispatchEvent(new Event('input', { bubbles: true })); return true }`)
  await clickText('#scene-workspace .sw-panel .ws-failure button', 'Plan the scene again')
  const r4 = await until(async () => { const latest = await latestOf(videoId, s2); return latest && latest.id !== r3.id && latest.progress?.events?.some(event => event.milestone === 'context') ? latest : null }, 60)
  for (const step of ['explain', 'moments', 'submit', 'repair']) await open(`${r4.id}-${step}`)
  const retried = await until(async () => { const latest = await latestOf(videoId, s2); return latest?.id === r4.id && latest.status === 'candidate' ? latest : null }, 90)
  check(Boolean(retried) && retried.revision > quota.revision, `the retry is a new attempt, planned in full (r${retried?.revision})`)

  // ——— An approved plan stays on show while a newer one develops ———
  await pickScene(s1)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-title h2')?.textContent === 'Request rate limiter' ? true : null`, 20)
  await clickText('#scene-workspace .sw-actions .button', 'Approve r1 without a preview')
  await until(async () => (await overview(videoId)).scenes.find(scene => scene.id === s1)?.view.reviewed, 30)
  await waitFor(`() => /^Plan r1 · approved/.test(document.querySelector('#scene-workspace .ws-revision')?.selectedOptions[0]?.textContent || '') ? true : null`, 20)
  await click('#scene-workspace [data-focus^="revise:"]')
  const next = await until(async () => { const latest = await latestOf(videoId, s1); return latest && latest.revision === 2 && latest.progress?.events?.some(event => event.milestone === 'context') ? latest : null }, 60)
  const developing = await waitFor(`() => ({ revision: document.querySelector('#scene-workspace .ws-revision')?.selectedOptions[0]?.textContent || '', header: document.querySelector('#scene-workspace .sw-status')?.textContent || '', question: document.querySelector('#scene-workspace .sw-panel .ws-question')?.textContent || '' })`, 10)
  check(/^Plan r1 · approved/.test(developing?.revision || '') && /^Planning r2/.test(developing.header) && developing.question === 'What does this limiter do?', `while r2 develops the approved r1 stays on show (${JSON.stringify(developing)})`)
  for (const step of ['explain', 'moments', 'submit', 'repair']) await open(`${next.id}-${step}`)
  await until(async () => { const latest = await latestOf(videoId, s1); return latest?.id === next.id && latest.status === 'candidate' ? latest : null }, 90)
  const offered = await waitFor(`() => { const review = [...document.querySelectorAll('#scene-workspace .sw-actions .button')].find(button => button.textContent === 'Review r2'); return review ? { revision: document.querySelector('#scene-workspace .ws-revision')?.selectedOptions[0]?.textContent || '' } : null }`, 30)
  check(/^Plan r1 · approved/.test(offered?.revision || ''), `r2 landed: the approved r1 is still on show, and r2 is offered (${JSON.stringify(offered)})`)
  await clickText('#scene-workspace .sw-actions .button', 'Review r2')
  const shownR2 = await waitFor(`() => /^Plan r2 · candidate/.test(document.querySelector('#scene-workspace .ws-revision')?.selectedOptions[0]?.textContent || '') ? true : null`, 10)
  check(shownR2 === true, 'Review r2 shows it')
  await shot('05-offered-r2')

  // ——— A preview that cannot be built says where it failed, and offers it again ———
  await click(`#scene-workspace [data-focus="ws-action:preview:${s1}"]`)
  const buildFailed = await waitFor(`() => { const failure = document.querySelector('#scene-workspace .sw-stage-activity .ws-build-failure'); return failure ? { kind: failure.dataset.failure, text: failure.querySelector('p')?.textContent || '', provider: failure.querySelector('.ws-failure-provider')?.textContent || '', button: failure.querySelector('button')?.textContent || '', stage: document.querySelector('#scene-stage-bar .scene-stage-modes button[aria-pressed="true"]')?.textContent || '' } : null }`, 90)
  check(buildFailed?.kind === 'rate-limit' && /^The preview of r2 failed while building the animated preview\./.test(buildFailed.text) && /The stage keeps the reference\.$/.test(buildFailed.text), `a failed preview says the phase it failed in, and what the stage keeps (${JSON.stringify(buildFailed)})`)
  check(/529 Overloaded/.test(buildFailed?.provider || '') && buildFailed?.button === 'Preview r2 again', `with the provider's words and a concrete retry (${JSON.stringify({ provider: buildFailed?.provider, button: buildFailed?.button })})`)
  const previewRecord = (await api(`/api/planning/${encodeURIComponent(videoId)}`)).body.records.filter(record => record.kind === 'preview' && record.subject === s1).sort((a, b) => b.revision - a.revision)[0]
  check(previewRecord?.progress?.events?.some(event => event.milestone === 'context'), `the preview's reading of its packet was seen, though its harness never asked for its context (${(previewRecord?.progress?.events || []).map(event => event.milestone).join(', ')})`)
  await shot('06-preview-failed')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `PLANNING PROGRESS CHECK FAIL (${failures})` : 'PLANNING PROGRESS CHECK PASS')
process.exitCode = failures ? 1 : 0
