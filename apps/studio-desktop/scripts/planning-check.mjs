// Planning (M0) regression check — an engineering fixture, not acceptance
// evidence: the harness here is a stub, so this proves the machinery, never
// the quality of a plan.
//
// It boots the app on a scratch data dir with a stub `claude` CLI. The stub
// speaks MCP through the real stdio shim, so it sees exactly the tools a
// planning run is offered, tries a build tool and records the refusal, reads
// the packet the product materialised, and submits a brief or a scene plan
// through the planning tools. The check drives the creator's path through the
// real workspace UI and asserts:
//   - a planning run is offered only the plan_* tools; others are refused;
//     Claude Code plans with no shell in its allow-list
//   - the fork's packet carries the retained source, paragraph-numbered
//   - a brief with an invented quotation is refused, a grounded one lands
//   - a plan lands as a candidate; a plan whose direction changed while it
//     ran is kept as superseded, never current
//   - a run that exits without submitting leaves its record failed, with the
//     provider's own message as its last status; the reviewed plan survives
//   - marking reviewed persists across a full reload
//   - nothing downstream starts: no build, drawing or export runs
//   - the base shows its video's planning read-only
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const root = await mkdtemp(join(tmpdir(), 'studio-planning-check-'))
const dataDir = join(root, 'data')
const binDir = join(root, 'bin')
const controlPath = join(root, 'stub-control.json')
await mkdir(dataDir, { recursive: true })
await mkdir(binDir, { recursive: true })

const failures = []
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) failures.push(message)
}

// ——— The stub harness ———
const stub = String.raw`#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const args = process.argv.slice(2)
const flag = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : '' }
const control = JSON.parse(fs.readFileSync(${JSON.stringify(controlPath)}, 'utf8'))
const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
emit({ type: 'system', subtype: 'init', session_id: 'stub-plan' })
const report = { allowedTools: flag('--allowedTools'), mode: control.mode }
const finish = code => {
  fs.mkdirSync('planning', { recursive: true })
  fs.writeFileSync(path.join('planning', 'stub-report.json'), JSON.stringify(report, null, 2))
  emit({ type: 'result', subtype: code ? 'error' : 'success', session_id: 'stub-plan', result: 'stub done' })
  process.exit(code)
}
if (control.mode === 'fail') {
  process.stderr.write('stub provider: weekly usage limit reached\n')
  finish(1)
}
const mcp = JSON.parse(fs.readFileSync(flag('--mcp-config'), 'utf8')).mcpServers.studio
report.mcpUrl = mcp.env.STUDIO_MCP_URL
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
;(async () => {
  const projectDir = process.cwd()
  await rpc('initialize', { protocolVersion: '2024-11-05' })
  report.tools = (await rpc('tools/list', {})).result.tools.map(entry => entry.name).sort()
  report.refused = await tool('explainer_export', { projectDir })
  report.context = await tool('plan_context', { projectDir })
  const inputs = JSON.parse(fs.readFileSync('motion/inputs.json', 'utf8'))
  report.packet = inputs.packet.files
  const context = JSON.parse(fs.readFileSync('packet/CONTEXT.json', 'utf8'))
  fs.mkdirSync('planning', { recursive: true })
  if (inputs.planning.route === 'Prepare Brief') {
    const source = fs.readFileSync('packet/SOURCE.md', 'utf8')
    report.numberedSource = /¶1  /.test(source)
    const paragraphs = source.split(/\n\n/).filter(p => /^¶\d+  /.test(p)).map(p => p.replace(/^¶\d+  /, ''))
    const quote = paragraphs[0].split(/(?<=[.!?])\s/)[0]
    const pages = context.basePages
    const brief = invented => ({
      schemaVersion: 1,
      purpose: { deliverable: 'Narrated technical explainer', audience: 'Developers', message: 'A stub message', language: 'en', requestedSeconds: context.requestedSeconds, styleConstraints: [] },
      source: { revisionRef: context.sourceRevision, narrativeRef: context.narrativeRevision, wordingPolicy: context.wordingPolicy, coverage: 'full', limitations: [] },
      evidence: [{ id: 'ev-1', kind: 'source', text: invented ? 'A sentence the article never said about planning checks.' : quote, locator: '¶1' }],
      entities: [{ id: 'thing', name: 'Thing', role: 'The subject', interactions: [], evidenceRefs: ['ev-1'], legacyObjectIds: [] }],
      units: [{ id: 'u1', question: 'What is it?', explain: 'It is the subject.', evidenceRefs: ['ev-1'], entities: ['thing'], conditions: [], demonstration: null, observations: [], communicationNeeds: [{ need: 'See the subject', why: 'It is the point', basis: 'suggestion' }], preserve: [], originScenes: pages.map(page => page.scene), dependsOn: [] }],
      progression: [{ unit: 'u1', note: 'only', ordering: 'editorial' }],
      narrative: { approvedLines: [], terminology: [], omissions: [] },
      material: { themeRef: context.themeRef, baseNotebookRef: context.baseNotebook, baseRevision: context.baseRevision, assetRefs: [], takeRefs: [] },
      delivery: { sceneDecisions: context.sceneDecisions, unresolved: 'Per scene.' },
      creativeGuidance: [], openDecisions: ['Everything creative'], uncertainty: [],
      route: { workflow: 'general-video', reason: 'Narrated explainer' },
      coverage: pages.map(page => ({ scene: page.scene, units: ['u1'] })),
    })
    fs.writeFileSync('planning/brief.json', JSON.stringify(brief(true)))
    report.invented = await tool('plan_submit_brief', { projectDir })
    fs.writeFileSync('planning/brief.json', JSON.stringify(brief(false)))
    report.submitted = await tool('plan_submit_brief', { projectDir })
  } else {
    const record = await (await fetch(origin + '/api/planning/records/' + context.briefRecord)).json()
    const brief = record.record.content
    const units = brief.coverage.filter(entry => context.scene.originScenes.includes(entry.scene)).flatMap(entry => entry.units)
    const needs = units.flatMap(unit => brief.units.find(entry => entry.id === unit).communicationNeeds.map(need => ({ unit, need: need.need, moments: ['m1'] })))
    if (control.delayMs) await sleep(control.delayMs)
    fs.writeFileSync('planning/treatment.json', JSON.stringify({
      schemaVersion: 1, scene: context.scene.id, originScenes: context.scene.originScenes, units: [...new Set(units)],
      question: 'What is it?', takeaway: 'It is the subject.', evidenceRefs: ['ev-1'], development: 'Show it, then name it.', demonstration: null,
      moments: [{ id: 'm1', title: 'Show it', purpose: 'The viewer needs to see it', observation: 'It appears', narration: { job: 'Name it', guide: 'This is the subject.' }, objects: { change: 'It settles into view', actors: ['thing'] }, text: null, presenter: null, camera: { treatment: 'hold', subject: 'thing', reason: 'Nothing to follow yet' }, audio: null, attention: 'the thing', recipes: [{ id: 'coordinate-target-zoom', catalog: 'rule', purpose: 'Look closer', channel: 'camera', controls: ['world'] }], evidenceRefs: ['ev-1'], estimateSeconds: 5 }],
      objects: [], treatments: { presenter: 'Undecided', text: 'None', camera: 'Hold' },
      skills: [{ skill: 'hyperframes-creative', references: ['skills/hyperframes-creative/references/beat-direction.md'], why: 'Rhythm' }, { skill: 'hyperframes-animation', references: ['skills/hyperframes-animation/rules-index.md'], why: 'Recipe' }],
      requirements: { assets: [], takes: [], decisions: [] }, continuity: { entry: 'Empty', exit: 'The thing in view' }, unresolved: [],
      coverage: needs, rosterProposal: null, delivery: { voice: context.delivery || 'undecided', note: '' },
    }))
    report.submitted = await tool('plan_submit_treatment', { projectDir })
  }
  shim.kill()
  finish(0)
})().catch(error => { report.error = String(error); finish(1) })
`
const stubPath = join(binDir, 'claude')
await writeFile(stubPath, stub)
await chmod(stubPath, 0o755)
const setMode = mode => writeFile(controlPath, JSON.stringify(mode))
await setMode({ mode: 'plan' })

// ——— The app ———
const child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_CLAUDE_BIN: stubPath },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let text = ''
  const timer = setTimeout(() => reject(new Error('the app did not start')), 120_000)
  child.stdout.on('data', chunk => {
    text += chunk.toString()
    const match = /STUDIO_ORIGIN (\S+)/.exec(text)
    if (match && /SMOKE PASS/.test(text)) { clearTimeout(timer); resolve(match[1]) }
  })
})
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json() }
}
const put = (path, body) => api(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const evaluate = async js => {
  const { body } = await post('/__eval', { js })
  if (!body.ok) throw new Error(body.error)
  return body.result
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (what, test, ms = 60_000) => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const value = await test()
    if (value) return value
    await sleep(700)
  }
  throw new Error(`timed out waiting for ${what}`)
}
// The title first shows whatever notebook boots; wait for the one asked for.
const reloadInto = async (id, title) => {
  await evaluate(`localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); localStorage.setItem('studio.planningHarness', 'claude-code'); location.reload(); true`).catch(() => {})
  await sleep(2500)
  await until(`the notebook "${title}" to open`, () => evaluate(`(document.getElementById('project-title') || {}).value === ${JSON.stringify(title)}`).catch(() => false))
}
const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
const clickText = text => evaluate(`(() => { const el = [...document.querySelectorAll('#planning-workspace button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); if (!el) return false; el.click(); return true })()`)
// Presses a workspace button once it is offered; the workspace renders after
// its records load, so a button can arrive a moment after the dialog opens.
const press = text => until(`"${text}"`, () => clickText(text), 20_000).then(() => true, () => false)
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(r => r.body)
// Optional window captures of the states a creator sees (PLANNING_CHECK_SHOTS=<dir>).
const shot = async name => {
  if (!process.env.PLANNING_CHECK_SHOTS) return
  await sleep(600)
  try {
    const response = await fetch(origin + '/__capture', { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(await response.text())
    await mkdir(process.env.PLANNING_CHECK_SHOTS, { recursive: true })
    await writeFile(join(process.env.PLANNING_CHECK_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.log(`note: capture ${name} skipped (${error instanceof Error ? error.message : error})`)
  }
}
const reportOf = async run => JSON.parse(await readFile(join(run.projectDir, 'planning', 'stub-report.json'), 'utf8'))

try {
  // A base notebook from a narrative, with two pages, then its video fork.
  const narrative = 'Planning checks keep a video honest. Every brief quotes what the source really says.\n\nA plan that arrives after its inputs changed is kept, but never shown as current.'
  const read = await post('/api/source/read', { narrative, title: 'Planning checks', wordingPolicy: 'draft' })
  const snapshotId = read.body.snapshot.id
  const page = (id, title) => ({ type: 'scene', attrs: { id, title, script: `${title}.`, directorNotes: title, sourcePassages: ['Every brief quotes what the source really says.'], svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#fff"/><text x="80" y="120" font-size="40">' + title + '</text></svg>' } })
  const base = {
    version: 1, id: 'planning-check-base', title: 'Planning checks', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { name: 'check', background: '#ffffff', surface: '#ffffff', text: '#111111', mutedText: '#555555', accent: '#16a34a', accentText: '#ffffff', fontFamily: 'Inter', headingFontFamily: 'Inter' },
    notebook: { type: 'doc', content: [page('b1', 'Quote the source'), page('b2', 'Keep late plans out')] },
    source: { kind: 'narrative', url: '', site: '', title: 'Planning checks', readAt: new Date().toISOString(), snapshotId },
    outline: { title: 'Planning checks', targetSeconds: 45, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await put(`/api/projects/${base.id}`, base)).status === 200, 'the base notebook is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `check-${Date.now()}`, title: 'Planning checks · video' })
  const videoId = fork.body.project.id
  check(Boolean(fork.body.project.derivedFrom?.snapshot), 'the video fork pins a base snapshot')

  // The creator opens the video and prepares its brief from the workspace.
  await reloadInto(videoId, 'Planning checks · video')
  check(await click('#open-planning'), 'Plan video opens the workspace')
  await until('the workspace', () => evaluate(`document.getElementById('planning-dialog').open`))
  check(await press('Prepare the brief'), 'the workspace offers Prepare the brief')
  const briefReady = await until('the brief', async () => (await overview(videoId)).brief.current, 90_000)
  const briefRun = (await api('/api/runs')).body.runs.find(run => run.route === 'Prepare Brief')
  const briefReport = await reportOf(briefRun)
  check(JSON.stringify(briefReport.tools) === JSON.stringify(['plan_assets', 'plan_context', 'plan_submit_brief', 'plan_submit_treatment']), `a planning run is offered only the planning tools (${briefReport.tools})`)
  check(/not available to a planning run/.test(briefReport.refused?.error || ''), 'a build tool is refused to a planning run')
  check(!/Bash/.test(briefReport.allowedTools) && /mcp__studio__plan_\*/.test(briefReport.allowedTools), `Claude Code plans without a shell (${briefReport.allowedTools})`)
  check(/scope=planning/.test(briefReport.mcpUrl), 'the run\'s tool URL carries its planning scope')
  check(briefReport.numberedSource === true && briefReport.packet.includes('packet/SOURCE.md'), 'the packet carries the retained source, paragraph-numbered')
  check(briefReport.invented?.accepted === false && /not a passage of the retained source/.test(JSON.stringify(briefReport.invented.problems)), 'an invented quotation is refused')
  check(briefReady.status === 'ready' && briefReady.adapter === 'claude-code', 'the grounded brief lands, with its harness recorded')
  await shot('01-brief-ready')

  // A scene plan lands as a candidate.
  const scenes = (await overview(videoId)).scenes
  check(scenes.every(scene => scene.view.state === 'ready-to-plan'), 'every scene is ready to plan')
  await evaluate(`document.querySelector('.planning-scene')?.click(); true`)
  check(await press('Generate creative plan'), 'Generate creative plan is offered')
  const planned = await until('a candidate', async () => (await overview(videoId)).scenes[0].view.current, 90_000)
  check(planned.status === 'candidate' && (planned.report?.constructionRisks || []).length > 0, 'the plan is a candidate, with its unproven recipe reported')
  await shot('02-candidate')

  // Direction changed while a plan runs: the late result never becomes current.
  await setMode({ mode: 'plan', delayMs: 6000 })
  const queued = (await post(`/api/planning/${videoId}/scenes/${scenes[0].id}`)).body.record
  await evaluate(`window.studioDesktop.harness.run({ adapter: 'claude-code', skill: 'video-planner', route: 'Plan Scene', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(queued.id)} } } }).then(() => true)`)
  await sleep(1500)
  await put(`/api/planning/${videoId}/inputs`, { subject: scenes[0].id, direction: 'Hold the camera still' })
  const late = await until('the late plan', async () => (await api(`/api/planning/records/${queued.id}`)).body.record.status !== 'running' && (await api(`/api/planning/records/${queued.id}`)).body.record, 60_000)
  check(late.status === 'superseded', `a plan whose direction changed while it ran is superseded (${late.status})`)
  check((await overview(videoId)).scenes[0].view.state === 'stale', 'the earlier candidate now reads as stale')
  await shot('03-stale')

  // A fresh candidate, reviewed.
  await setMode({ mode: 'plan' })
  await evaluate(`document.querySelector('.planning-scene')?.click(); true`)
  check(await press('Regenerate with direction'), 'Regenerate with direction is offered')
  const fresh = await until('a fresh candidate', async () => {
    const view = (await overview(videoId)).scenes[0].view
    return view.state === 'candidate' && view.current
  }, 90_000)
  await sleep(500)
  check(await press('Mark reviewed'), 'Mark reviewed is offered for a current candidate')
  const reviewed = await until('the review', async () => (await overview(videoId)).scenes[0].view.reviewed)
  check(reviewed.id === fresh.id, 'the candidate is the reviewed plan')
  await shot('04-reviewed')

  // A run that dies without submitting: failed, with the provider's word.
  await setMode({ mode: 'fail' })
  await evaluate(`document.querySelector('.planning-scene')?.click(); true`)
  await press('Regenerate with direction')
  const failed = await until('the failure', async () => {
    const view = (await overview(videoId)).scenes[0].view
    return view.state === 'failed' && view
  }, 60_000)
  check(/weekly usage limit/.test(failed.latest?.error?.providerStatus || '') && /without submitting/.test(failed.latest?.error?.message || ''), `a failed run says what happened and keeps the provider's own message (${failed.latest?.error?.providerStatus})`)
  check(failed.reviewed?.id === reviewed.id, 'the reviewed plan survives a failed regeneration')
  await shot('05-failed-reviewed-kept')

  // Everything survives a full reload.
  await reloadInto(videoId, 'Planning checks · video')
  await click('#open-planning')
  await until('the reopened workspace', () => evaluate(`document.querySelectorAll('.planning-scene').length > 0`))
  const reopened = await evaluate(`[...document.querySelectorAll('.planning-scene .planning-chip')].map(chip => chip.textContent)`)
  check(reopened[0] === 'Failed' && reopened[1] === 'Ready to plan', `the reopened workspace shows the same states (${reopened})`)
  check(await evaluate(`/reviewed r\\d+ kept/.test(document.querySelector('.planning-scene')?.textContent || '')`), 'the reopened workspace says the reviewed plan is kept')
  await shot('06-reopened')

  // Nothing downstream started.
  const runs = (await api('/api/runs')).body.runs
  check(runs.every(run => run.skill === 'video-planner'), `only planning runs ran (${[...new Set(runs.map(run => run.skill))]})`)
  const library = (await api('/api/appearance/library')).body.assets || []
  check(library.length === 0, 'no artwork was generated')

  // The base reads its video's planning, read-only.
  await reloadInto(base.id, base.title)
  await click('#open-planning')
  await until('the read-only view', () => evaluate(`document.querySelector('.planning-title .eyebrow')?.textContent || ''`))
  const readOnlyView = await evaluate(`({ eyebrow: document.querySelector('.planning-title .eyebrow')?.textContent, actions: [...document.querySelectorAll('#planning-workspace button')].filter(b => /Generate|Regenerate|Retry|Mark reviewed|Prepare/.test(b.textContent)).length, inputs: document.querySelectorAll('.planning-footer textarea, .planning-footer select').length, direction: document.querySelector('.planning-direction')?.textContent || '', open: [...document.querySelectorAll('#planning-workspace button')].some(b => b.textContent === 'Open the video notebook') })`)
  check(/read-only/.test(readOnlyView.eyebrow) && readOnlyView.actions === 0 && readOnlyView.inputs === 0 && /Hold the camera still/.test(readOnlyView.direction) && readOnlyView.open, 'the base shows the video\'s plans and direction read-only, with a way to the video')
  await shot('07-base-read-only')
} catch (error) {
  failures.push(String(error))
  console.error(error)
} finally {
  child.kill('SIGTERM')
}
console.log(failures.length ? `PLANNING CHECK FAIL (${failures.length})` : 'PLANNING CHECK PASS')
process.exit(failures.length ? 1 : 0)
