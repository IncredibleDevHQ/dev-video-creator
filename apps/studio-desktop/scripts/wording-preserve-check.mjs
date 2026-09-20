// Wording-preserve check (review finding #2): "Keep my wording" must survive
// the whole source journey. A stub kimi on PATH plans the outline through the
// real story-master harness run with the author's sentences verbatim, while a
// deterministic local model provider answers the scene dialogue writer with an
// unmistakably different rewrite. After the full wizard flow the saved scenes
// must still hold the authored sentences, the policy must survive a reopen,
// and the explainer build inputs must carry the policy and the narrative
// revision — no automatic replacement of approved words. Pattern per
// take-workflow-check.mjs (smoke app + /__eval) and build-fork-check.mjs
// (stub kimi on PATH); the local file store keeps the shared database out of
// the fixture, per local-store-check.mjs.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-wording-'))
const dataDir = join(root, 'data')

// The author's own sentences: the narrative, and — under Keep my wording —
// the outline's per-scene narration, word for word.
const SENTENCE_ONE = 'When a service recovers, every client retries at once and the surge knocks it straight back down.'
const SENTENCE_TWO = 'Jitter spreads those retries across a quiet window, so the service gets room to stay alive.'
const NARRATIVE = `# Retry storms\n\n${SENTENCE_ONE}\n\n${SENTENCE_TWO}`
// The fixture dialogue writer's answer: unmistakably not the author's words.
const REWRITE = 'THIS WAS REWRITTEN AUTOMATICALLY BY THE FIXTURE PROVIDER.'

// A deterministic local test provider, configured through the real Models
// setting: any writing request gets the rewrite, so a finish that consults it
// cannot be mistaken for one that preserved the author's words.
let dialogueCalls = 0
const provider = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/v1/chat/completions') {
    dialogueCalls += 1
    const window = { say: REWRITE, title: 'Rewritten', parts: [], hero: '', intent: '', camera: [], layout: 'page' }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ windows: [window] }) } }] }))
    return
  }
  if (request.method === 'GET' && request.url === '/v1/models') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'fixture' }] }))
    return
  }
  response.writeHead(404)
  response.end()
})
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve))
const providerPort = provider.address().port

// A stub kimi on PATH: --version answers, a story-master run plans the outline
// from the run's own inputs (one scene per authored sentence, narration kept
// verbatim), and any other run simply ends. No real agent is ever spawned.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
let inputs = null
try { inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8')) } catch {}
if (inputs && inputs.source && typeof inputs.source.text === 'string') {
  const body = inputs.source.text.split('\\n').filter(line => line.trim() && !line.trim().startsWith('#')).join(' ')
  const sentences = (body.match(/[^.!?]+[.!?]+/g) || [body]).map(s => s.trim()).filter(Boolean)
  const scenes = sentences.slice(0, 3).map((sentence, index) => ({
    title: 'Scene ' + (index + 1),
    idea: sentence,
    kind: 'diagram',
    seconds: 12,
    parts: [{ label: 'Clients', kind: 'box', detail: 'retrying together' }, { label: 'Service', kind: 'box', detail: 'recovering' }],
    relations: [{ from: 'Clients', to: 'Service', verb: 'sends to' }],
    narration: sentence,
    source: [sentence],
  }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title: 'Retry storms', targetSeconds: scenes.length * 12, scenes, glossary: [] }))
  fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: scenes.length, wordingPolicy: inputs.wordingPolicy || 'preserve' }))
  emit({ role: 'assistant', content: 'Planned ' + scenes.length + ' scenes with the wording kept verbatim.' })
} else {
  emit({ role: 'assistant', content: 'stub run' })
}
emit({ role: 'meta', type: 'session.resume_hint', session_id: 'stub-session-wording' })
process.exit(0)
`,
)
await chmod(join(binDir, 'kimi'), 0o755)

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_DATA_DIR: dataDir,
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_PERSISTENCE: 'local',
    STUDIO_ENABLE_TEST_HOOKS: '1',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const projectBody = async id =>
  fetch(`${origin}/api/projects/${encodeURIComponent(id)}`).then(r => r.json()).then(body => body.project || null).catch(() => null)
const activeId = () => evaluate(`() => window.localStorage.getItem('incredible-studio-v2-active-project')`, 'active id')
const sceneScripts = project =>
  (project?.notebook?.content || [])
    .filter(node => node.type === 'scene')
    .map(node => ({ id: String(node.attrs?.id || ''), title: String(node.attrs?.title || ''), script: String(node.attrs?.script || ''), says: (Array.isArray(node.attrs?.windows) ? node.attrs.windows : []).map(w => String(w?.say || '')) }))

try {
  // The fixture itself answers the way the reviewer described: a dialogue
  // rewrite that is unmistakably not the author's narration.
  const sanity = await fetch(`http://127.0.0.1:${providerPort}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.json())
  check('fixture provider answers with the unmistakable rewrite', String(sanity.choices?.[0]?.message?.content || '').includes(REWRITE))
  // The sanity call above is this script's own; only the studio's calls count.
  dialogueCalls = 0

  const settings = await fetch(`${origin}/api/settings/models`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'custom', baseUrl: `http://127.0.0.1:${providerPort}/v1`, models: { writing: 'fixture', vision: 'fixture', coding: 'fixture' } }),
  }).then(r => r.json())
  check('the fixture provider is the studio model setting', settings.settings?.source === 'saved' && settings.settings?.baseUrl?.includes(String(providerPort)), JSON.stringify(settings.settings?.baseUrl || ''))

  // Boot the studio UI on a fresh notebook.
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  const booted = await waitFor(`() => Boolean(document.getElementById('app') && !document.getElementById('app').hidden && document.querySelector('#editor .ProseMirror'))`, 'boot')
  check('studio booted on a fresh notebook', Boolean(booted))

  // Present it myself → My own narrative → Keep my wording (the narrative
  // default, chosen explicitly here as the user would).
  await evaluate(`() => { document.getElementById('create-explainer').click(); return true }`, 'open chooser')
  await sleep(300)
  await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="human"]').click(); return true }`, 'choose human')
  await sleep(200)
  await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'own narrative')
  const dialogOpen = await waitFor(`() => document.getElementById('source-dialog')?.open === true`, 'source dialog')
  check('the source flow opens for the narrative', Boolean(dialogOpen))
  await evaluate(`() => { document.querySelector('#source-wording-segment [data-wording="preserve"]').click(); return true }`, 'keep my wording')

  // Read → outline (stub kimi through the harness) → pages → finish.
  await evaluate(`() => { const box = document.getElementById('source-narrative'); box.value = ${JSON.stringify(NARRATIVE)}; document.getElementById('source-read').click(); return true }`, 'read')
  const brandStep = await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')
  check('the narrative is read', Boolean(brandStep))
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline')
  const outlineStep = await waitFor(`() => !document.getElementById('source-step-outline')?.hidden`, 'outline step', 150)
  check('the story run plans the outline', Boolean(outlineStep))
  await evaluate(`() => { document.getElementById('source-make-pages').click(); return true }`, 'pages')
  const pagesStep = await waitFor(`() => !document.getElementById('source-step-pages')?.hidden`, 'pages step')
  check('the pages are made', Boolean(pagesStep))
  await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish')
  const finished = await waitFor(`async () => {
    if (document.getElementById('source-dialog')?.open) return null
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    return scenes.length >= 2 ? id : null
  }`, 'finish', 120)
  check('the wizard finishes into a notebook with both scenes', Boolean(finished), String(finished))

  const saved = finished ? await projectBody(finished) : null
  const scenes = sceneScripts(saved)
  check(
    'both saved scenes keep the authored sentences verbatim',
    scenes.length === 2 && scenes[0]?.script === SENTENCE_ONE && scenes[1]?.script === SENTENCE_TWO,
    JSON.stringify(scenes.map(scene => scene.script)).slice(0, 200),
  )
  check(
    'no saved scene carries the fixture rewrite',
    scenes.every(scene => !scene.script.includes('FIXTURE PROVIDER')),
    `dialogue writer consulted ${dialogueCalls}x`,
  )
  check(
    'the windows segment the authored words, not a replacement',
    scenes.length === 2 && scenes.every((scene, index) => scene.says.join(' ').replace(/\\s+/g, ' ').includes((index === 0 ? SENTENCE_ONE : SENTENCE_TWO).slice(0, 40))),
    JSON.stringify(scenes.map(scene => scene.says)).slice(0, 200),
  )
  check(
    'the story record keeps the policy and the narrative revision',
    saved?.story?.wordingPolicy === 'preserve' && typeof saved?.story?.narrativeId === 'string' && saved.story.narrativeId.length > 0,
    JSON.stringify(saved?.story || null),
  )
  const narrativeId = saved?.story?.narrativeId || ''

  // Reopen: the saved notebook reloads with the authored words untouched.
  await evaluate(`() => { location.reload(); return true }`, 'reopen')
  await waitFor(`() => Boolean(document.getElementById('app') && !document.getElementById('app').hidden && document.querySelector('#editor .ProseMirror'))`, 'reboot')
  const reopenedId = await activeId()
  const reopened = reopenedId ? await projectBody(reopenedId) : null
  const reopenedScenes = sceneScripts(reopened)
  check(
    'after reopen the scenes still hold the authored sentences',
    reopenedScenes.length === 2 && reopenedScenes[0]?.script === SENTENCE_ONE && reopenedScenes[1]?.script === SENTENCE_TWO && reopened?.story?.wordingPolicy === 'preserve',
    JSON.stringify(reopenedScenes.map(scene => scene.script)).slice(0, 200),
  )

  // Build: the fork navigates into the video notebook and resumes there; the
  // dispatched run's inputs must carry the policy and the narrative revision.
  await evaluate(`() => { document.getElementById('build-explainer').click(); return true }`, 'build')
  const buildRun = await (async () => {
    for (let i = 0; i < 120; i += 1) {
      const runs = await fetch(`${origin}/api/runs`).then(r => r.json()).then(body => body.runs || []).catch(() => [])
      const run = runs.find(candidate => candidate.route === 'Build Explainer')
      if (run) return run
      await sleep(500)
    }
    return null
  })()
  check('the build dispatches an explainer run (delivery never re-asked)', Boolean(buildRun), buildRun?.id || '')
  let inputs = null
  if (buildRun?.projectDir) {
    inputs = JSON.parse(await readFile(join(buildRun.projectDir, 'motion', 'inputs.json'), 'utf8').catch(() => 'null'))
  }
  check(
    'the build inputs carry the wording policy and the narrative revision',
    inputs?.story?.wordingPolicy === 'preserve' && inputs?.story?.narrativeId === narrativeId,
    JSON.stringify(inputs?.story || null),
  )
  const inputScripts = (inputs?.scenes || []).map(scene => String(scene?.script || ''))
  check(
    'the build receives the authored words for every scene',
    inputScripts.length === 2 && inputScripts.includes(SENTENCE_ONE) && inputScripts.includes(SENTENCE_TWO) && inputScripts.every(script => !script.includes('FIXTURE PROVIDER')),
    JSON.stringify(inputScripts).slice(0, 200),
  )
  check('the build inputs keep the human delivery choice', inputs?.delivery?.mode === 'human', JSON.stringify(inputs?.delivery || null))

  // Cleanup: every notebook this run touched (base, fresh source notebook and
  // the video fork) goes; the temp store removes the rest.
  const projects = await fetch(`${origin}/api/projects`).then(r => r.json()).then(body => (Array.isArray(body) ? body : body.projects) || []).catch(() => [])
  for (const entry of projects) {
    await fetch(`${origin}/api/projects/${encodeURIComponent(entry.id)}`, { method: 'DELETE' }).catch(() => {})
  }
  check('cleanup', true, `${projects.length} fixture notebooks deleted`)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  provider.closeAllConnections?.()
  provider.close()
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `WORDING PRESERVE CHECK FAIL (${failures})` : 'WORDING PRESERVE CHECK PASS')
process.exitCode = failures ? 1 : 0
