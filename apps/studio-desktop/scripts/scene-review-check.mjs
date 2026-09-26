// Scene review inside the video notebook (P2) — an engineering fixture: the
// harness is a stub, so this proves the machinery, never a plan's quality.
//
// A video forked from a rich base (three pages the page-master skill drew
// for the Stripe rate-limiting article) is planned from the notebook: each
// scene block carries its review strip, the selected scene opens its review
// beside the stage, which shows the page as a labelled wireframe reference
// and highlights what a selected moment is about. One scene is approved,
// another left as a candidate; a revision is compared with the approved
// one; the recording guide and what production waits for are there; and
// after a restart both scenes read as they were left. Nothing downstream
// starts: only planning runs — production is the creator's own step.
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
const shot = async (name, focus = '') => {
  if (!process.env.SCENE_REVIEW_SHOTS) return
  // The selected scene at the top of the notebook, its review below it — or
  // the part of the review the shot is about.
  await evaluate(`() => { const node = (${JSON.stringify(focus)} && document.querySelector(${JSON.stringify(focus)})) || document.querySelector('.scene-review.is-expanded') || document.querySelector('#editor .tiptap > .selected-block'); if (node) node.scrollIntoView({ block: 'start' }); return true }`).catch(() => {})
  await sleep(900)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.SCENE_REVIEW_SHOTS, { recursive: true })
  await writeFile(join(process.env.SCENE_REVIEW_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)}`)
}
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
// The notebook's one next step (F10 of the Perplexity review).
const nextStep = () => evaluate(`() => { const button = document.getElementById('next-step'); return { label: button.textContent, action: button.dataset.action, scene: button.dataset.scene, disabled: button.disabled, hidden: button.hidden, primaries: [...document.querySelectorAll('.commandbar .button.primary, .topbar .button.primary')].filter(element => !element.hidden).map(element => element.id) } }`)
const nextStepIs = async (label, seconds = 20) => {
  let step = null
  for (let i = 0; i < seconds * 2; i++) {
    step = await nextStep().catch(() => null)
    if (step?.label === label) return step
    await sleep(500)
  }
  return step
}
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
    cast: [...review.querySelectorAll('.review-cast-item')].map(item => ({ entity: item.querySelector('strong')?.textContent, image: Boolean(item.querySelector('img')), decision: item.dataset.castDecision || null })),
    tally: review.querySelector('.review-cast-tally')?.textContent || '',
    moments: [...review.querySelectorAll('.review-moment-head strong')].map(entry => entry.textContent),
    approve: review.querySelector('[data-focus^="approve:"]')?.textContent || '',
    approveDisabled: review.querySelector('[data-focus^="approve:"]')?.disabled,
    revisions: [...review.querySelectorAll('.review-revision')].map(button => button.textContent),
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
  // A collapsed scene says where its plan stands in its strip; the selected
  // one in its revision control, labelled Plan (F6 of the Perplexity review).
  const strips = await waitFor(`() => { const all = [...document.querySelectorAll('.scene-review')]; return all.length === 2 ? all.map(review => [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent).concat([...review.querySelectorAll('.review-revisions .review-chip')].map(chip => 'Plan: ' + chip.textContent))) : null }`)
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
  check(Boolean(opened), 'selecting a scene opens its review beside the stage')
  // One next step leads (F10): the selected scene's, and it is the only
  // primary action; the older build waits under Advanced.
  const toPlan = await nextStepIs('Plan scene 2')
  check(toPlan?.label === 'Plan scene 2' && toPlan.action === 'plan' && !toPlan.disabled && JSON.stringify(toPlan.primaries) === '["next-step"]', `the one next step is to plan the selected scene (${JSON.stringify(toPlan)})`)
  // The plan leads (F7): the review sits above the block, and the block's
  // inherited dialogue folds to one line — one header, one status line.
  const order = await evaluate(`() => {
    const block = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]
    const review = document.querySelector('.scene-review.is-expanded')
    const visible = element => Boolean(element) && element.getBoundingClientRect().height > 0
    return {
      reviewFirst: Boolean(review.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING),
      folded: !visible(block.querySelector('.block-dialogue')) && !visible(block.querySelector('.scene-poster')) && visible(block.querySelector('.scene-source-toggle')),
      toggle: block.querySelector('.scene-source-toggle')?.innerText || '',
      blockHeight: Math.round(block.getBoundingClientRect().height),
      strips: review.querySelectorAll('.review-strip').length,
      inline: Boolean(review.querySelector('.review-head .review-strip.is-inline')),
    }
  }`)
  check(order.reviewFirst && order.folded && order.toggle === 'Edit source dialogue' && order.blockHeight < 80 && order.strips === 1 && order.inline, `the review leads, above its block folded to one line with its one status line in the header (${JSON.stringify(order)})`)
  const stage = await evaluate(`() => ({ mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, note: document.getElementById('scene-stage-note').textContent, pool: Boolean(document.querySelector('#scene-stage-reference svg [id="s06-node-concurrency-cap"]')) })`)
  check(stage.mode === 'Designed slide' && /not a preview of its motion/.test(stage.note) && stage.pool, `the stage starts on the page, labelled as a reference, not a preview (${JSON.stringify(stage)})`)
  const beforePlan = await reviewOf(1)
  check(beforePlan.expanded && beforePlan.thumbs >= 3, `the strip shows the cast the page offers (${beforePlan.thumbs} thumbnails)`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="revise:"]').click(); return true }`)
  const planned = await until(async () => (await overview(videoId)).scenes[1].view.current, 90)
  check(planned?.status === 'candidate', 'Plan the scene makes a candidate from the notebook')
  const review = await waitFor(`() => { const panel = document.querySelector('.scene-review.is-expanded .review-panel'); return panel && panel.querySelector('.review-question') ? true : null }`)
  const state = await reviewOf(1)
  // Each object of the designed slide shows the plan's decision: two used, the rest omitted.
  const used = state?.cast.filter(item => item.decision === 'use') || []
  check(Boolean(review) && state.question === 'What does this limiter do?' && state.moments.length === 3 && used.length === 2 && used.every(item => item.image) && state.cast.every(item => item.decision === 'use' || item.decision === 'omit') && /^The designed slide's \d+ objects: 2 used, \d+ omitted\.$/.test(state.tally), `the review shows the plan, its moments, and a decision for each of the slide's objects (${JSON.stringify(state && { tally: state.tally, cast: state.cast.map(item => `${item.entity}:${item.decision}`) })})`)
  // The plan's state is said once, by its revision control (F6 of the
  // Perplexity review); the status line keeps the rest.
  const toReview = await nextStepIs('Review scene 2')
  check(toReview?.label === 'Review scene 2' && toReview.action === 'review', `planned, the next step is to review it (${JSON.stringify(toReview)})`)
  check(state.revisions.includes(`r${planned.revision} candidate`) && !state.strip.some(chip => chip.startsWith('Plan:')) && state.strip.includes('Recording: guide ready · no take yet'), `the revision control reads the candidate, the status line the recording state (${JSON.stringify({ revisions: state.revisions, strip: state.strip })})`)
  // The first screen of a selected scene (R6, F7), reached as the review
  // reached it: another scene selected, then this one picked from the rail
  // in the 1440 × 900 window. Its title, what it explains, its first moment,
  // its revision, the preview and approve actions and the stage show
  // without scrolling, and nothing inherited stands before them.
  await selectScene(0)
  await sleep(400)
  const firstScreen = await evaluate(`async () => {
    const title = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1].querySelector('.scene-title').textContent
    const chip = [...document.querySelectorAll('#notebook-timeline .notebook-timeline-chip')].find(entry => entry.title.endsWith(title))
    chip.click()
    await new Promise(resolve => setTimeout(resolve, 900))
    const top = document.querySelector('.studio-workspace').getBoundingClientRect().top
    const bottom = Math.min(innerHeight, document.getElementById('notebook-timeline').getBoundingClientRect().top)
    const seen = element => { const box = element?.getBoundingClientRect(); return Boolean(box) && box.height > 0 && box.top >= top - 1 && box.bottom <= bottom + 1 }
    const review = document.querySelector('.scene-review.is-expanded')
    const block = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]
    return {
      window: outerWidth + '×' + outerHeight,
      height: Math.round(bottom - top),
      title: seen(review.querySelector('.review-head h3')),
      status: seen(review.querySelector('.review-head .review-strip')),
      question: seen(review.querySelector('.review-question')),
      moment: seen(review.querySelector('.review-moment-head')),
      revision: seen(review.querySelector('.review-revision')),
      preview: seen(review.querySelector('[data-focus^="preview:"]')),
      action: seen(review.querySelector('[data-focus^="approve:"]')),
      stage: seen(document.getElementById('scene-stage')),
      nothingBefore: review.getBoundingClientRect().top >= top - 1 && review.getBoundingClientRect().top - top < 40 && !(block.getBoundingClientRect().bottom <= review.getBoundingClientRect().top),
      at: { top: Math.round(top), review: Math.round(review.getBoundingClientRect().top), block: [Math.round(block.getBoundingClientRect().top), Math.round(block.getBoundingClientRect().bottom)] },
    }
  }`)
  check(firstScreen.window === '1440×900' && Object.entries(firstScreen).every(([key, value]) => key === 'height' || key === 'window' || key === 'at' || value), `picked from the rail, the scene's first screen shows its title, status, what it explains, a moment, its revision, preview and approve, and the stage — the plan first (${JSON.stringify(firstScreen)})`)
  await shot('00-first-screen')
  // The inherited dialogue is one click away, and folds again.
  const unfolded = await evaluate(`async () => {
    const block = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]
    block.querySelector('.scene-source-toggle').click()
    await new Promise(resolve => setTimeout(resolve, 300))
    const again = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]
    const open = { dialogue: again.querySelector('.block-dialogue').getBoundingClientRect().height > 0, edit: again.querySelector('[data-slide-action="edit"]').getBoundingClientRect().height > 0, toggle: again.querySelector('.scene-source-toggle').innerText }
    again.querySelector('.scene-source-toggle').click()
    await new Promise(resolve => setTimeout(resolve, 300))
    const last = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]
    return { ...open, foldedAgain: last.querySelector('.block-dialogue').getBoundingClientRect().height === 0, reviewKept: Boolean(document.querySelector('.scene-review.is-expanded .review-question')) }
  }`)
  check(unfolded.dialogue && unfolded.edit && unfolded.toggle === 'Fold source dialogue' && unfolded.foldedAgain && unfolded.reviewKept, `Edit source dialogue unfolds the inherited dialogue and its editor, and folds it again (${JSON.stringify(unfolded)})`)
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
  await shot('01b-object-decisions', '.scene-review.is-expanded [data-review-cast]')

  // Approve it: this scene alone, and nothing starts.
  const runsBefore = (await api('/api/runs')).body.runs.length
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]').click(); return true }`)
  const approved = await until(async () => (await overview(videoId)).scenes[1].view.reviewed, 30)
  check(approved?.id === planned.id && approved.approval?.castId && approved.approval.fingerprint === planned.fingerprint, `approval pins the plan with what it was made from (${JSON.stringify(approved?.approval)})`)
  await sleep(1500)
  check((await api('/api/runs')).body.runs.length === runsBefore, 'approving starts no run')
  const toRecord = await nextStepIs('Record scene 2')
  check(toRecord?.label === 'Record scene 2' && toRecord.action === 'record', `approved and presented by the creator, the next step is to record it (${JSON.stringify(toRecord)})`)
  check(Boolean(await waitFor(`() => document.querySelector('.scene-review.is-expanded .review-revision.is-selected')?.textContent === 'r${planned.revision} approved' && !document.querySelector('.scene-review.is-expanded [data-focus^="approve:"]') || null`, 20)), 'the review reads Approved once, in its revision control, with no approval action left')

  // The recording guide and the production explanation.
  const guide = await evaluate(`() => {
    const details = document.querySelector('.scene-review.is-expanded [data-review-open^="guide:"]')
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    return { heading: details.querySelector('.review-guide h6')?.textContent || '', lines: [...details.querySelectorAll('.review-guide-lines li')].map(item => item.textContent), steps: [...details.querySelectorAll('.review-guide > ol li')].map(item => item.textContent), older: Boolean(details.querySelector('.review-script-change')), record: details.querySelector('[data-focus^="record:"]')?.disabled }
  }`)
  // The lines are the approved plan's narration, in its order (R4) — not
  // the notebook's older script, which recording would otherwise follow.
  check(guide.lines.join('|') === 'Set the scene.|The limit bites.|Back to the viewer.' && /plan r\d+'s narration, in its order/.test(guide.heading) && guide.steps.some(step => /keep speaking; the graphics take the frame/.test(step)), `the recording guide follows the approved plan's lines and says where the speaker is (${JSON.stringify(guide)})`)
  check(guide.older && guide.record === true, `recording waits until the scene's script says what the plan says (${JSON.stringify({ older: guide.older, recordDisabled: guide.record })})`)
  const scriptBefore = (await api(`/api/projects/${videoId}`)).body.project.notebook.content.filter(node => node.type === 'scene')[1].attrs.script
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="use-plan-script:"]').click(); return true }`)
  const adopted = await until(async () => {
    const scene = (await api(`/api/projects/${videoId}`)).body.project.notebook.content.filter(node => node.type === 'scene')[1]
    return scene.attrs.scriptSource?.treatment ? scene.attrs : null
  }, 20)
  check(adopted?.script === 'Set the scene.\n\nThe limit bites.\n\nBack to the viewer.' && adopted.scriptSource.treatment === planned.id && adopted.scriptSource.revision === planned.revision && adopted.scriptSource.previous === scriptBefore, `the plan's lines become the scene's script, with where they came from and the words they replaced (${JSON.stringify(adopted?.scriptSource)})`)
  const afterAdopt = await waitFor(`() => { const details = document.querySelector('.scene-review.is-expanded [data-review-open^="guide:"]'); const record = details?.querySelector('[data-focus^="record:"]'); return record && !record.disabled && !details.querySelector('.review-script-change') ? true : null }`, 20)
  check(Boolean(afterAdopt), 'with the plan\'s lines as the script, the scene can be rehearsed and recorded')
  const stillApproved = (await overview(videoId)).scenes[1].view
  check(stillApproved.state === 'reviewed' && stillApproved.reviewed?.id === planned.id && !stillApproved.staleBecause, `taking the approved plan's own lines leaves it approved and fresh (${stillApproved.state}${stillApproved.staleBecause ? ` — ${stillApproved.staleBecause}` : ''})`)
  // Publish on a video notebook of two scenes (F6 of the fresh E2E review):
  // the stage used to cover the notebook's composition and hide the finalize
  // bar. Publish asks what to export first (BoltDB review B09); the walk
  // visits the switchovers between the blocks chosen, the stage aside for
  // all of it; the summary says what the export is, and a draft MP4 is
  // exported.
  await selectScene(1)
  check(Boolean(await waitFor(`() => document.getElementById('player-shell').classList.contains('has-scene-stage') ? true : null`, 20)), 'the selected scene shows its stage before publishing')
  await evaluate(`() => { document.getElementById('render-video').click(); return true }`)
  const scope = await waitFor(`() => document.getElementById('publish-dialog').open ? { options: [...document.querySelectorAll('#publish-scope-options .publish-scope-option')].map(option => option.dataset.scope + (option.querySelector('input').checked ? '*' : '')), kind: document.getElementById('publish-export-kind').textContent, switchovers: document.getElementById('publish-switchovers').textContent, start: document.getElementById('start-publish').textContent, walking: !document.getElementById('finalize-bar').hidden } : null`, 20)
  check(scope?.options.join('|') === 'scene|all*|chosen' && !scope.walking, `Publish opens on what to export — this scene, the whole notebook (no production is accepted) or chosen blocks — before any walk (${JSON.stringify(scope)})`)
  check(/not the approved scene plans/.test(scope?.kind || '') && !/rich build|Build explainer/.test(scope?.kind || ''), `the summary says the export is the notebook's own composition, not the approved plans, and nothing of the older rich build (${scope?.kind})`)
  check(scope?.switchovers === '1 switchover between the blocks you export. Next, it plays on the video, to set how each block enters.' && scope.start === 'Review 1 switchover →', `the switchover between the two scenes comes next (${scope?.start})`)
  await evaluate(`() => { document.getElementById('start-publish').click(); return true }`)
  const walk = await waitFor(`() => {
    const bar = document.getElementById('finalize-bar')
    const shell = document.getElementById('player-shell')
    if (!bar || bar.hidden || getComputedStyle(bar).display === 'none') return null
    return { dialog: document.getElementById('publish-dialog').open, stage: shell.classList.contains('has-scene-stage'), finalize: shell.classList.contains('canvas-finalize-mode'), step: document.getElementById('finalize-step').textContent, next: document.getElementById('finalize-next').textContent }
  }`, 20)
  check(Boolean(walk) && !walk.dialog && !walk.stage && walk.finalize && walk.step === 'Switchover 1 of 1' && walk.next === 'Back to Publish →', `the walk plays the switchover on the notebook's own composition, the stage aside (${JSON.stringify(walk)})`)
  await shot('02c-publish-walk')
  await evaluate(`() => { document.getElementById('finalize-next').click(); return true }`)
  const walkedBack = await waitFor(`() => document.getElementById('publish-dialog').open ? { switchovers: document.getElementById('publish-switchovers').textContent, start: document.getElementById('start-publish').textContent, scope: document.querySelector('#publish-scope-options input:checked')?.value } : null`, 20)
  check(walkedBack?.switchovers === '1 switchover between the blocks you export, reviewed.' && walkedBack.scope === 'all', `back in Publish, the switchover is reviewed and the choice kept (${JSON.stringify(walkedBack)})`)
  // F9 of the Perplexity review: its words are not its voice. Neither scene
  // has a take or a voice yet: the summary says so, block by block, and the
  // action is an explicit silent draft.
  const audio = await evaluate(`() => ({ line: document.getElementById('publish-audio').textContent, button: document.getElementById('start-publish').textContent, chips: [...document.querySelectorAll('#publish-block-list .publish-audio-chip')].map(chip => chip.dataset.audio + ':' + chip.textContent) })`)
  check(/^Audio: no block has a take or a voice — this exports a silent draft\. 2 blocks have words that are not voiced\./.test(audio.line) && audio.button === 'Export silent draft' && audio.chips.length === 2 && audio.chips.every(chip => chip === 'missing:no audio — its words have no voice or take'), `Publish says which blocks will be silent, and offers a silent draft explicitly (${JSON.stringify(audio)})`)
  await evaluate(`() => { document.getElementById('start-publish').click(); return true }`)
  const exported = await waitFor(`() => { const result = document.getElementById('render-result'); return result && !result.hidden ? document.getElementById('download-render').href : null }`, 300)
  const mp4 = exported ? await fetch(exported).then(async response => ({ status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength })) : null
  if (!mp4) {
    const jobId = await evaluate(`() => localStorage.getItem('studio.export:' + ${JSON.stringify(videoId)})`).catch(() => null)
    const job = jobId ? (await api(`/api/exports/${jobId}`)).body?.job : null
    const ui = await evaluate(`() => ({ button: document.getElementById('start-publish').textContent, toast: document.querySelector('.toast, #toast')?.textContent || '' })`).catch(() => null)
    console.log('EXPORT DIAGNOSIS', JSON.stringify({ jobId, status: job?.status, errorTail: String(job?.error || '').slice(-1500), ui }))
  }
  check(mp4?.status === 200 && /video\/mp4/.test(mp4.type || '') && mp4.bytes > 10000, `the two-scene video notebook exports a draft MP4 (${JSON.stringify(mp4)})`)
  const silentLabel = await evaluate(`() => document.getElementById('publish-count').textContent`)
  const exportedJob = (await api(`/api/exports/${await evaluate(`() => localStorage.getItem('studio.export:' + ${JSON.stringify(videoId)})`)}`)).body?.job
  check(/silent draft, no audio$/.test(silentLabel) && exportedJob?.audio?.silentDraft === true && exportedJob.audio.missing === 2, `the export says it is a silent draft, and its record carries what each block sounds like (${silentLabel}; ${JSON.stringify(exportedJob?.audio && { voiced: exportedJob.audio.voiced, missing: exportedJob.audio.missing })})`)
  await evaluate(`() => { document.getElementById('publish-dialog').close(); if (document.getElementById('player-shell').classList.contains('canvas-open')) document.getElementById('canvas-fullscreen').click(); return true }`)
  const stageBack = await waitFor(`() => { const shell = document.getElementById('player-shell'); return shell.classList.contains('has-scene-stage') && !shell.classList.contains('canvas-open') ? true : null }`, 20)
  check(Boolean(stageBack), 'after the export, the scene review\'s stage is back beside the notebook')

  // A take spoken against those lines keeps each line's fingerprint. When
  // one line changes, the review names that line alone for a new take (R4).
  const fnv = text => { let hash = 0x811c9dc5; for (const character of text) { hash ^= character.codePointAt(0) || 0; hash = Math.imul(hash, 0x01000193) >>> 0 } return hash.toString(16).padStart(8, '0') }
  const linesOf = script => script.split(/\n\s*\n/).map(part => part.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const takeScene = (await api(`/api/projects/${videoId}`)).body.project.notebook.content.filter(node => node.type === 'scene')[1]
  const takeAsset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-project-id': videoId, 'x-block-id': takeScene.attrs.id }, body: Buffer.from('a take of the plan lines') }).then(response => response.json())
  const spokenLines = linesOf(takeScene.attrs.script)
  const committed = await post('/api/recordings/commit', { projectId: videoId, blockId: takeScene.attrs.id, assetId: takeAsset.assetId, mediaUrl: takeAsset.url, durationMs: 9000, role: 'presenter', script: { hash: fnv(spokenLines.join('\n')), lines: spokenLines.map(fnv), treatment: planned.id, revision: planned.revision } })
  check(committed.body?.recording?.script?.lines?.length === spokenLines.length, `a take keeps each line's fingerprint (${JSON.stringify(committed.body?.recording?.script)})`)
  const recordingChip = () => waitFor(`() => [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent).find(text => text.startsWith('Recording:')) || null`, 30)
  const withScript = async change => {
    // Away from the open notebook, so nothing it saves overwrites the edit.
    await openNotebook(base.id, base.title)
    const expected = (await api(`/api/projects/${videoId}`)).body.project
    const doc = JSON.parse(JSON.stringify(expected))
    const target = doc.notebook.content.filter(node => node.type === 'scene')[1]
    target.attrs.script = change(target.attrs.script)
    const saved = (await api(`/api/projects/${videoId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: doc, expectedProject: expected }) })).status === 200
    await openNotebook(videoId, 'Rate limiters · video')
    await selectScene(1)
    return saved
  }
  await withScript(script => script)
  const matching = await recordingChip()
  check(matching === 'Recording: take matches the script', `the take matches the script it was spoken against (${matching})`)
  check(await withScript(script => script.replace('The limit bites.', 'The limit bites, hard.')), 'the creator rewords one line of the scene')
  const flaggedChip = await recordingChip()
  const flagged = await waitFor(`() => {
    const details = document.querySelector('.scene-review.is-expanded [data-review-open^="guide:"]')
    if (!details) return null
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    const note = details.querySelector('.review-take-lines')
    return note ? { text: note.querySelector('p').textContent, lines: [...note.querySelectorAll('li')].map(item => item.textContent) } : null
  }`, 20)
  check(flaggedChip === 'Recording: 1 line to re-record' && flagged?.lines?.join('|') === 'The limit bites, hard.' && /still covers the other lines/.test(flagged.text), `only the reworded line reads as needing a new take (${flaggedChip} · ${JSON.stringify(flagged)})`)
  await shot('02b-take-lines')
  check(await withScript(script => script.replace('The limit bites, hard.', 'The limit bites.')), 'the line is put back')
  const restored = await recordingChip()
  check(restored === 'Recording: take matches the script', `with the words put back, the take matches again (${restored})`)
  const production = await evaluate(`() => {
    const details = document.querySelector('.scene-review.is-expanded [data-review-open^="production:"]')
    if (!details) return null
    const closed = !details.open
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    const produce = document.querySelector('.scene-review.is-expanded [data-focus^="produce:"]')
    return { closed, summary: details.querySelector('summary').textContent, text: document.querySelector('.scene-review.is-expanded .review-production')?.textContent || '', button: produce?.textContent || '', disabled: Boolean(produce?.disabled) }
  }`)
  // P4: production is the creator's own step. Approving started none, and
  // until the scene's delivery is chosen the step waits, saying why.
  check(production && !production.closed && production.summary === 'Produced scene' && /^Produce scene from r\d+$/.test(production.button) && production.disabled && /Choose how this scene is delivered/.test(production.text) && /does not use approved plans/.test(production.text) && !(await overview(videoId)).scenes.some(scene => scene.production), `production waits for the creator, and says what it needs; approving started none (${JSON.stringify(production)})`)
  const chrome = await evaluate(`() => ({ rail: [...document.querySelectorAll('.notebook-timeline-chip strong')].map(item => item.textContent), create: getComputedStyle(document.getElementById('create-explainer')).display, build: document.getElementById('build-explainer').querySelector('.menu-label').textContent, buildTitle: document.getElementById('build-explainer').title, underAdvanced: Boolean(document.getElementById('build-explainer').closest('#advanced-menu-list')) })`)
  check(chrome.rail.join('|') === 'Request rate limiter|Concurrent requests limiter', `the scene rail names its scenes (${chrome.rail})`)
  check(chrome.create === 'none' && chrome.build === 'Build whole notebook' && chrome.underAdvanced && /does not use approved scene plans/.test(chrome.buildTitle), `a video notebook shows its own workflow; the older build waits under Advanced and says what it is (${JSON.stringify(chrome)})`)
  // The notebook fits its window, the stage large enough to judge, the rail
  // in its own band (R7).
  const fit = await evaluate(`() => {
    const rail = document.getElementById('notebook-timeline').getBoundingClientRect()
    const workspace = document.querySelector('.studio-workspace').getBoundingClientRect()
    const hidden = [...document.querySelectorAll('.commandbar .actions > *, .topbar-actions > *')].filter(element => element.offsetParent && element.getBoundingClientRect().right > innerWidth + 1).map(element => element.textContent.trim().slice(0, 24))
    return { width: innerWidth, sideways: document.documentElement.scrollWidth > innerWidth, hidden, stage: Math.round(document.getElementById('player-shell').getBoundingClientRect().width), railOverDocument: rail.top < workspace.bottom - 1 }
  }`)
  check(!fit.sideways && fit.hidden.length === 0 && !fit.railOverDocument && fit.stage >= Math.min(560, fit.width * 0.38), `the notebook fits its window, with a stage large enough to judge (${JSON.stringify(fit)})`)
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

  // The workspace opens on the scene and revision being reviewed, and hands
  // its selection back when it closes (R8).
  await evaluate(`() => { [...document.querySelectorAll('.scene-review.is-expanded .review-revision')].find(button => /^r1 /.test(button.textContent)).click(); return true }`)
  await waitFor(`() => document.querySelector('.scene-review.is-expanded .review-revision.is-selected')?.textContent.startsWith('r1 ') || null`, 10)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="workspace:"]').click(); return true }`)
  const inWorkspace = await waitFor(`() => {
    if (!document.getElementById('planning-dialog').open) return null
    const scene = document.querySelector('#planning-workspace .planning-scene.is-selected strong')?.textContent
    const version = document.querySelector('#planning-workspace .planning-version.is-selected')?.textContent
    return scene && version ? { scene, version } : null
  }`, 30)
  check(inWorkspace?.scene === 'Concurrent requests limiter' && /^r1 approved/.test(inWorkspace.version || ''), `the workspace opens on the scene and revision being reviewed (${JSON.stringify(inWorkspace)})`)
  await evaluate(`() => { [...document.querySelectorAll('#planning-workspace .planning-scene')].find(button => button.querySelector('strong')?.textContent === 'Request rate limiter').click(); return true }`)
  await waitFor(`() => document.querySelector('#planning-workspace .planning-scene.is-selected strong')?.textContent === 'Request rate limiter' || null`, 10)
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-close').click(); return true }`)
  const back = await waitFor(`() => { const review = document.querySelector('.scene-review.is-expanded'); return !document.getElementById('planning-dialog').open && review ? review.querySelector('.review-panel h3')?.textContent || null : null }`, 20)
  check(back === 'Request rate limiter', `closing the workspace brings the notebook to the scene it was showing (${back})`)

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
  // Collapsed, a scene's strip says where its plan stands; the selected one
  // says it in its revision control.
  const afterRestart = await waitFor(`() => { const all = [...document.querySelectorAll('.scene-review')].map(review => [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent).concat([...review.querySelectorAll('.review-revision')].map(button => 'Plan: ' + button.textContent))); return all.length === 2 && all.every(chips => chips.some(chip => chip.startsWith('Plan:'))) ? all : null }`, 60)
  check(Boolean(afterRestart?.[0]?.some(chip => chip === `Plan: Candidate r${first.revision}` || chip === `Plan: r${first.revision} candidate`)), `the unapproved scene is still a candidate after the restart (${afterRestart?.[0]})`)
  check(Boolean(afterRestart?.[1]?.some(chip => chip === `Plan: Candidate r${revised.revision}` || chip === `Plan: r${revised.revision} candidate`)), `the approved scene shows its newer candidate (${afterRestart?.[1]})`)
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

  // ——— F1 of the Perplexity review: the base designs a page afterwards ———
  // The first page gains its designed artwork after the video was made. Its
  // scene is offered the newer page — compared on the stage, taken only when
  // asked — and is then planned from it alone: the other scene's approval,
  // plans and takes stay as they are.
  const GPU = '<g id="s05-node-gpu" data-role="node" data-kind="box" data-entity="service" data-object-id="obj-gpu-17"><rect id="s05-node-gpu-box" x="940" y="170" width="260" height="200" rx="12" fill="#22c55e" fill-opacity="0.10" stroke="#22c55e" stroke-opacity="0.55" stroke-width="1.5"/><g id="s05-node-gpu-art" data-appearance-for="s05-node-gpu"><g transform="translate(1048,186) scale(1.8333)" fill="none" stroke="#22c55e" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14v10h-14z"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M2 10h3M2 14h3M19 10h3M19 14h3"/></g></g><text x="1070" y="282" font-size="24" fill="#ffffff" text-anchor="middle">GPU</text></g>'
  const storedBase = after
  const designedBase = structuredClone(storedBase)
  // Designed, the page keeps the schematic it was designed from beside it.
  const SCHEMATIC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect id="schematic-frame" width="1280" height="720" fill="#ffffff"/><text x="80" y="120" font-size="40">Request rate limiter · schematic</text></svg>'
  designedBase.notebook.content[0].attrs = { ...designedBase.notebook.content[0].attrs, svg: storedBase.notebook.content[0].attrs.svg.replace('</svg>', `${GPU}</svg>`), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5', runId: 'run-later' }, schematic: { svg: SCHEMATIC, program: null } }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: designedBase, expectedProject: storedBase }) })).status === 200, 'the base designs its first page after the video was made')
  const videoBefore = (await api(`/api/projects/${videoId}`)).body.project
  const otherBefore = (await overview(videoId)).scenes[1].view
  const reported = (await overview(videoId)).scenes[0].reference
  check(reported?.newer?.kind === 'designed' && reported.newer.svg.includes('obj-gpu-17') && reported.kind === 'designed' && !reported.adopted, `the video's overview reports the base's newer page for that scene (${JSON.stringify(reported && { kind: reported.kind, revision: reported.revision, newer: reported.newer && { kind: reported.newer.kind, revision: reported.newer.revision, by: reported.newer.by } })})`)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await selectScene(0)
  const offered = await waitFor(`() => { const notice = document.querySelector('.scene-review.is-expanded [data-review-reference="newer"]'); return notice ? { text: notice.textContent, chips: [...document.querySelectorAll('.scene-review.is-expanded .review-strip .review-chip')].map(chip => chip.textContent) } : null }`, 60)
  check(/The base has a newer designed slide for this scene, by Claude Code/.test(offered?.text || '') && offered.chips.includes('Page: designed slide') && offered.chips.includes('Base has a newer designed slide'), `the scene is offered the base's newer designed slide (${JSON.stringify(offered)})`)
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="compare-reference:"]').click(); return true }`)
  const comparedStage = await waitFor(`() => { const active = document.querySelector('.scene-stage-modes .is-active'); const svg = document.querySelector('#scene-stage-reference svg'); return active?.dataset.stageMode === 'base' ? { mode: active.textContent, gpu: Boolean(svg?.querySelector('[data-object-id="obj-gpu-17"]')), note: document.getElementById('scene-stage-note').textContent } : null }`, 20)
  check(comparedStage?.mode === "Base's designed slide" && comparedStage.gpu && /^The base's designed slide for this scene, by Claude Code/.test(comparedStage.note), `the stage compares the base's designed slide (${JSON.stringify(comparedStage)})`)
  await shot('05-compare-base-slide')
  check(!(await api(`/api/projects/${videoId}`)).body.project.notebook.content.filter(node => node.type === 'scene')[0].attrs.reference, 'comparing takes nothing')
  await evaluate(`() => { document.querySelector('.scene-review.is-expanded [data-focus^="adopt-reference:"]').click(); return true }`)
  const adoptedScene = await until(async () => { const scene = (await overview(videoId)).scenes[0]; return scene.reference?.adopted ? scene : null }, 60)
  check(adoptedScene?.reference?.kind === 'designed' && adoptedScene.reference.newer === null && adoptedScene.view.state === 'stale' && /the scene's page reference changed/.test(adoptedScene.view.staleBecause || ''), `the scene takes the designed slide, and its plan made from the old page reads as out of date (${JSON.stringify({ kind: adoptedScene?.reference?.kind, adopted: adoptedScene?.reference?.adopted, state: adoptedScene?.view.state, why: adoptedScene?.view.staleBecause })})`)
  const stageNow = await waitFor(`() => { const svg = document.querySelector('#scene-stage-reference svg'); const active = document.querySelector('.scene-stage-modes .is-active'); return svg?.querySelector('[data-object-id="obj-gpu-17"]') && active?.dataset.stageMode === 'reference' ? { mode: active.textContent, offersBase: !document.querySelector('[data-stage-mode="base"]').hidden, note: document.getElementById('scene-stage-note').textContent, notice: Boolean(document.querySelector('.scene-review.is-expanded [data-review-reference]')) } : null }`, 30)
  check(stageNow?.mode === 'Designed slide' && stageNow.offersBase === false && /adopted from the base/.test(stageNow.note) && !stageNow.notice, `the stage shows the scene's adopted designed slide, and nothing more is offered (${JSON.stringify(stageNow)})`)
  await shot('06-adopted-designed-slide')
  // Both references are kept: the stage offers the schematic beside the slide.
  await evaluate(`() => { const button = document.querySelector('[data-stage-mode="schematic"]'); if (!button || button.hidden) return false; button.click(); return true }`)
  const structure = await waitFor(`() => { const active = document.querySelector('.scene-stage-modes .is-active'); const svg = document.querySelector('#scene-stage-reference svg'); return active?.dataset.stageMode === 'schematic' ? { mode: active.textContent, schematic: Boolean(svg?.querySelector('#schematic-frame')), note: document.getElementById('scene-stage-note').textContent } : null }`, 20)
  check(structure?.mode === 'Schematic' && structure.schematic && /^The schematic this scene's designed slide was made from/.test(structure.note), `the scene keeps the schematic beside its designed slide, on the stage (${JSON.stringify(structure)})`)
  await shot('06b-schematic-kept')
  await evaluate(`() => { document.querySelector('[data-stage-mode="reference"]').click(); return true }`)
  const otherAfter = (await overview(videoId)).scenes[1].view
  check(otherAfter.reviewed?.id === otherBefore.reviewed?.id && otherAfter.current?.id === otherBefore.current?.id && otherAfter.state === otherBefore.state && !otherAfter.staleBecause, `the other scene's approval and plans are untouched (${otherAfter.state})`)
  const videoAfter = (await api(`/api/projects/${videoId}`)).body.project
  check(JSON.stringify(Object.keys(videoAfter.recordedBlocks || {}).sort()) === JSON.stringify(Object.keys(videoBefore.recordedBlocks || {}).sort()) && JSON.stringify(videoAfter.recordedBlocks || {}) === JSON.stringify(videoBefore.recordedBlocks || {}), 'recordings are untouched')
  // The next plan of this scene is handed the designed slide and its artwork.
  const replan = (await post(`/api/planning/${videoId}/scenes/${adoptedScene.id}`)).body.record
  const replanPacket = (await api(`/api/planning/records/${replan.id}/packet`)).body
  const replanCast = JSON.parse(replanPacket.files['packet/VISUAL_CAST.json'])
  const gpuEntry = replanCast.entries.find(entry => entry.objectId === 'obj-gpu-17')
  check(replanPacket.files['packet/references/page.svg'].includes('data-object-id="obj-gpu-17"') && Boolean(gpuEntry) && /~/.test(replanCast.cast || ''), `the planning packet carries the designed slide and its GPU artwork by object id, from the cast revision that includes it (${JSON.stringify(gpuEntry && { label: gpuEntry.label, objectId: gpuEntry.objectId, page: gpuEntry.page, node: gpuEntry.node })}; cast ${replanCast.cast})`)
  check(replan.inputs.reference === adoptedScene.reference.revision, 'the new plan pins the adopted page')
  check(replanPacket.files['packet/references/schematic.svg']?.includes('schematic-frame') && JSON.parse(replanPacket.files['packet/CONTEXT.json']).references?.schematic === 'references/schematic.svg', 'the planning packet carries both references: the designed slide and its schematic')
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  await quit()
  spawn('pkill', ['-f', stubPath])
  await rm(root, { recursive: true, force: true }).catch(() => {})
}
console.log(failures ? `SCENE REVIEW CHECK FAIL (${failures})` : 'SCENE REVIEW CHECK PASS')
process.exitCode = failures ? 1 : 0
