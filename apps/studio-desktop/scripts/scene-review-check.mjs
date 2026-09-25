// Scene review inside the video notebook (P2) — an engineering fixture: the
// harness is a stub, so this proves the machinery, never a plan's quality.
//
// A video forked from a rich base (three pages the page-master skill drew
// for the Stripe rate-limiting article) is planned from the notebook: each
// scene block carries its review strip, the selected scene opens its review
// beside the stage, which shows the page as a labelled wireframe reference
// and highlights what a selected moment is about. One scene is approved,
// another left as a candidate; a revision is compared with the approved
// one; the recording guide and the production explanation are there; and
// after a restart both scenes read as they were left. Nothing downstream
// starts: only planning runs, no production.
//
// The stub `claude` speaks MCP through the real stdio shim and submits
// through the planning tools; its scene plans reuse the page's cast by
// library key and change with the creator's direction.
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
const root = await mkdtemp(join(tmpdir(), 'studio-scene-review-'))
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
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-review', model: flag('--model') || 'stub-cli-default' })
const finish = code => { emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-review', result: 'stub done' }); process.exit(code) }
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

// ——— The app, relaunched on the same data to prove what survives ———
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
  if (!process.env.SCENE_REVIEW_SHOTS) return
  // The selected scene at the top of the notebook, its review below it.
  await evaluate(`() => { const node = document.querySelector('#editor .tiptap > .selected-block'); if (node) node.scrollIntoView({ block: 'start' }); return true }`).catch(() => {})
  await sleep(900)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_REVIEW_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_REVIEW_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
const selectScene = index => evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return node.id }`)
const reviewOf = index => evaluate(`() => {
  const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[${index}]
  const review = document.querySelector('.scene-review[data-review-scene="' + node.id + '"]')
  if (!review) return null
  return {
    expanded: review.classList.contains('is-expanded'),
    strip: [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent),
    thumbs: review.querySelectorAll('.review-strip-cast img').length,
    panel: Boolean(review.querySelector('.review-panel')),
    question: review.querySelector('.review-question')?.textContent || '',
    cast: [...review.querySelectorAll('.review-cast-item')].map(item => ({ entity: item.querySelector('strong')?.textContent, image: Boolean(item.querySelector('img')) })),
    moments: [...review.querySelectorAll('.review-moment-head strong')].map(entry => entry.textContent),
    approve: review.querySelector('[data-focus^="approve:"]')?.textContent || '',
    approveDisabled: review.querySelector('[data-focus^="approve:"]')?.disabled,
  }
}`)

try {
  await launch()
  // ——— A rich base and its video ———
  const narrative = 'Rate limiters keep an API alive under load. The concurrency limiter lets only twenty requests run at once.\n\nA token bucket refills at a steady rate.'
  const read = await post('/api/source/read', { narrative, title: 'Scaling your API with rate limiters', wordingPolicy: 'draft' })
  const snapshotId = read.body.snapshot.id
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `review-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-review', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b05', 'Request rate limiter', '05_request_rate_limiter.svg', 'Rate limiters keep an API alive under load.'),
      await page('b06', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', 'The concurrency limiter lets only twenty requests run at once.\n\nThe rest wait their turn.'),
    ] },
    source: { kind: 'narrative', url: '', site: '', title: 'Scaling your API with rate limiters', readAt: new Date().toISOString(), snapshotId },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 60, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the rich base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `review-${Date.now()}`, title: 'Rate limiters · video' })
  const videoId = fork.body.project.id
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the video notebook opens')
  await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } }) })

  // Every scene block carries its review strip; the brief comes first.
  const strips = await waitFor(`() => { const all = [...document.querySelectorAll('.scene-review')]; return all.length === 2 ? all.map(review => [...review.querySelectorAll('.review-chip')].map(chip => chip.textContent)) : null }`)
  check(Boolean(strips) && strips.every(chips => chips.includes('Plan: Needs the brief') && chips.includes('Output: not produced')), `each scene block carries its review strip (${JSON.stringify(strips)})`)
  const { record: briefRecord } = (await post(`/api/planning/${videoId}/brief`)).body
  await evaluate(`() => window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Prepare Brief', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(briefRecord.id)} }, model: 'claude-opus-5-5' } }).then(() => true)`)
  const briefReady = await until(async () => { const current = await overview(videoId); return current.brief.current || (current.brief.latest?.status === 'failed' ? current.brief.latest : null) }, 90)
  check(briefReady?.status === 'ready', `the brief is prepared${briefReady?.status === 'failed' ? ` (failed: ${briefReady.error?.message} ${briefReady.error?.providerStatus || ''})` : ''}`)
  await until(async () => (await overview(videoId)).visualCast.status === 'ready', 90)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)

  // ——— The concurrency scene, opened beside its stage ———
  await selectScene(1)
  const opened = await waitFor(`() => document.querySelector('.scene-review.is-expanded .review-panel') && !document.getElementById('scene-stage').hidden ? true : null`)
  check(Boolean(opened), 'selecting a scene opens its review below the block, beside the stage')
  const stage = await evaluate(`() => ({ mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, note: document.getElementById('scene-stage-note').textContent, pool: Boolean(document.querySelector('#scene-stage-reference svg [id="s06-node-concurrency-cap"]')) })`)
  check(stage.mode === 'Wireframe reference' && /not a preview of its motion/.test(stage.note) && stage.pool, `the stage starts on the page, labelled as a reference, not a preview (${JSON.stringify(stage)})`)
  const beforePlan = await reviewOf(1)
  check(beforePlan.expanded && beforePlan.thumbs >= 3, `the strip shows the cast the page offers (${beforePlan.thumbs} thumbnails)`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const planned = await until(async () => (await overview(videoId)).scenes[1].view.current, 90)
  check(planned?.status === 'candidate', 'Plan the scene makes a candidate from the notebook')
  const review = await waitFor(`() => { const panel = document.querySelector('.scene-review.is-expanded .review-panel'); return panel && panel.querySelector('.review-question') ? true : null }`)
  const state = await reviewOf(1)
  check(Boolean(review) && state.question === 'What does this limiter do?' && state.moments.length === 3 && state.cast.length === 2 && state.cast.every(item => item.image), `the review shows the plan, its moments and the cast it reuses (${JSON.stringify(state)})`)
  check(state.strip.includes(`Plan: Candidate r${planned.revision}`) && state.strip.includes('Recording: guide ready · no take yet'), `the strip reads the candidate and the recording state (${state.strip})`)
  // A moment points at what it is about on the page.
  await evaluate(`() => { document.querySelectorAll('.scene-review.is-expanded .review-moment-head')[1].click(); return true }`)
  const highlight = await waitFor(`() => { const hits = [...document.querySelectorAll('#scene-stage-reference .stage-hit')].map(element => element.id); return hits.length ? { hits, note: document.getElementById('scene-stage-note').textContent } : null }`, 10)
  check(Boolean(highlight) && /Highlighted: what this moment is about/.test(highlight.note), `selecting a moment highlights what it is about on the page (${JSON.stringify(highlight)})`)
  // Reading down the review, the stage stays in view beside it, and what it
  // shows is said under the frame — nothing is drawn over the page.
  const follows = await evaluate(`async () => {
    document.querySelector('.scene-review.is-expanded .review-panel').scrollIntoView({ block: 'end' })
    await new Promise(resolve => setTimeout(resolve, 600))
    const viewport = document.querySelector('.studio-workspace').getBoundingClientRect()
    const stage = document.getElementById('scene-stage').getBoundingClientRect()
    const block = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1].getBoundingClientRect()
    const frame = document.getElementById('scene-stage')
    return { blockAbove: block.bottom < viewport.top, stageInView: stage.top >= viewport.top - 1 && stage.bottom <= viewport.bottom + 1, clear: !frame.contains(document.querySelector('.scene-stage-modes')) && !frame.contains(document.getElementById('scene-stage-note')) }
  }`)
  check(follows.stageInView && follows.clear, `the stage stays in view beside the review, with nothing over the page (${JSON.stringify(follows)})`)
  await shot('01-scene-review')

  // Approve it: this scene alone, and nothing starts.
  const runsBefore = (await api('/api/runs')).body.runs.length
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]').click(); return true }`)
  const approved = await until(async () => (await overview(videoId)).scenes[1].view.reviewed, 30)
  check(approved?.id === planned.id && approved.approval?.castId && approved.approval.fingerprint === planned.fingerprint, `approval pins the plan with what it was made from (${JSON.stringify(approved?.approval)})`)
  await sleep(1500)
  check((await api('/api/runs')).body.runs.length === runsBefore, 'approving starts no run')
  check(Boolean(await waitFor(`() => /^r\\d+ approved ✓$/.test(document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]')?.textContent || '') || null`, 20)), 'the review reads Approved')

  // The recording guide and the production explanation.
  const guide = await evaluate(`() => {
    const details = document.querySelector('.scene-review.is-expanded [data-review-open^="guide:"]')
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    return { lines: [...details.querySelectorAll('.review-guide > div ol li')].map(item => item.textContent), steps: [...details.querySelectorAll('.review-guide > ol li')].map(item => item.textContent), record: Boolean(details.querySelector('[data-focus^="record:"]')) }
  }`)
  check(guide.lines.length === 2 && guide.steps.some(step => /keep speaking; the graphics take the frame/.test(step)) && guide.record, `the recording guide gives the lines, where the speaker is and a way to record (${JSON.stringify(guide)})`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="produce:"]').click(); return true }`)
  const production = await waitFor(`() => document.querySelector('.scene-review.is-expanded .review-production')?.textContent || null`, 10)
  check(/approved plan \(r\d+\)/.test(production || '') && /Production is not part of this build yet\. Approving a plan never starts it\./.test(production || ''), 'Produce scene is its own action, and says what it needs and that it does not run yet')
  await shot('02-approved-guide')

  // Revise with direction, and compare the new candidate with the approved plan.
  await evaluate(`() => { const box = document.querySelector('.scene-review.is-expanded [data-focus^="direction:"]'); box.value = 'Push in on the limit when it bites'; box.dispatchEvent(new Event('input')); document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const revised = await until(async () => { const view = (await overview(videoId)).scenes[1].view; return view.current?.id !== planned.id && view.current?.status === 'candidate' && view.current }, 90)
  check(Boolean(revised), 'revising with direction makes a new candidate; the approved plan stays')
  check((await overview(videoId)).scenes[1].view.reviewed?.id === planned.id, 'the approved plan is still the approved one')
  const compared = await evaluate(`async () => {
    for (let i = 0; i < 40 && !document.querySelector('.scene-review.is-expanded [data-review-open^="compare:"]'); i++) await new Promise(r => setTimeout(r, 250))
    const details = document.querySelector('.scene-review.is-expanded [data-review-open^="compare:"]')
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    const picker = details.querySelector('select')
    picker.value = ${JSON.stringify(planned.id)}
    picker.dispatchEvent(new Event('change'))
    await new Promise(r => setTimeout(r, 500))
    const again = document.querySelector('.scene-review.is-expanded [data-review-open^="compare:"]')
    return [...again.querySelectorAll('.review-diff li strong')].map(item => item.textContent)
  }`)
  check(compared.some(text => /Changed: The limit bites: camera/.test(text)), `the comparison names the moment whose camera changed (${JSON.stringify(compared)})`)
  await shot('03-compare')

  // The first scene: planned, left as a candidate.
  await selectScene(0)
  await waitFor(`() => document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]:not([disabled])') ? true : null`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const first = await until(async () => (await overview(videoId)).scenes[0].view.current, 90)
  check(first?.status === 'candidate', 'the other scene is planned and left unapproved')

  // ——— After a restart, both scenes read as they were left ———
  await quit()
  await launch()
  check(Boolean(await openNotebook(videoId, 'Rate limiters · video')), 'the app restarts on the video notebook')
  const afterRestart = await waitFor(`() => { const all = [...document.querySelectorAll('.scene-review')].map(review => [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent)); return all.length === 2 && all[0].some(chip => chip.startsWith('Plan:')) ? all : null }`, 60)
  check(afterRestart?.[0]?.includes(`Plan: Candidate r${first.revision}`), `the unapproved scene is still a candidate after the restart (${afterRestart?.[0]})`)
  check(afterRestart?.[1]?.some(chip => chip === `Plan: Candidate r${revised.revision}`), `the approved scene shows its newer candidate (${afterRestart?.[1]})`)
  const kept = (await overview(videoId)).scenes[1].view
  check(kept.reviewed?.id === planned.id && kept.reviewed.approval?.castId, 'and its approval is intact, with its pin')
  await selectScene(1)
  const reopened = await waitFor(`() => [...document.querySelectorAll('.scene-review.is-expanded .review-revision')].map(button => button.textContent)`, 30)
  check(Boolean(reopened?.some(text => text === `r${planned.revision} approved`)), `reopening the scene shows the approved revision (${reopened})`)
  await shot('04-after-restart')

  // Nothing downstream; the base untouched.
  const runs = (await api('/api/runs')).body.runs
  check(runs.every(run => run.skill === 'video-planner'), `only planning runs ran (${[...new Set(runs.map(run => run.skill))]})`)
  const after = (await api(`/api/projects/${base.id}`)).body.project
  check(after.notebook.content[1].attrs.svg === base.notebook.content[1].attrs.svg, 'the base page is unchanged')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE REVIEW CHECK FAIL (${failures})` : 'SCENE REVIEW CHECK PASS')
process.exitCode = failures ? 1 : 0
