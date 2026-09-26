// Earlier-review P2 regression: a camera-dialog take is raw presenter
// footage, not a composed scene recording. It compiles to the scene's
// graphics plus the presenter overlay — never graphics replaced by the raw
// webcam — and the role survives the durable archive round trip. A composed
// scene recording (no role) still replaces its scene.
// Pattern per take-workflow-check.mjs (smoke app + __eval + real compile).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-presenter-take-'))
const PROJECT_ID = `presenter-take-${Date.now().toString(36)}`
const SCENE_ID = 'blk-presenter'
const LEGACY_ID = 'blk-legacy'

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
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
const evalInWindow = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
  }).then(r => r.json())
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await sleep(400)
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 90)}`)
}
const getProject = () => fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).then(b => b.project)
const compileHtml = async project => {
  const preview = await fetch(`${origin}/api/preview`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project),
  }).then(r => r.json())
  if (!preview.url) throw new Error(`preview failed: ${JSON.stringify(preview).slice(0, 200)}`)
  return fetch(`${origin}${preview.url}`).then(r => r.text())
}
const sceneTag = (html, nodeId) => {
  const match = html.match(new RegExp(`<section\\b[^>]*data-node-id="${nodeId}"`))
  return match ? match[0] : ''
}

const SVG = `<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><g id="part-a"><rect x="60" y="60" width="240" height="140" rx="10" fill="#4f46e5"/><text x="90" y="140" fill="#ffffff" font-size="28">queue</text></g></svg>`
const WINDOWS = [{ say: 'First the queue holds the work.', parts: ['part-a'], hero: 'part-a', layout: 'page' }]
const MOTION = {
  version: 2,
  steps: [
    { id: 'b1', title: 'Queue', explanation: WINDOWS[0].say, actions: [{ op: 'reveal', targets: ['part-a'], startMs: 0, durationMs: 300, ease: 'enter', persistence: 'state' }], motionWindowMs: 500, holdMs: 300 },
  ],
}

try {
  const project = {
    version: 1, derivedFrom: { notebook: 'fixture-base', kind: 'video' }, id: PROJECT_ID, title: 'Presenter take fixture', explainerDelivery: 'human',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Presenter take' }] },
      { type: 'scene', attrs: { id: SCENE_ID, title: 'Presenter scene', svg: SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`, structureApproved: true, windows: WINDOWS, motion: MOTION, script: WINDOWS[0].say } },
      { type: 'scene', attrs: { id: LEGACY_ID, title: 'Legacy scene', script: 'A composed scene recording.' } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); location.assign('/studio')`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)

  // The real camera-dialog keep path (MediaRecorder is unavailable headless,
  // so __timing.stageReview stages the recorder's own review step).
  await evalInWindow(`(() => {
    const chip = [...document.querySelectorAll('#scene-rail .scene-card')].find(b => b.textContent.includes('Presenter scene'))
    if (!chip) throw new Error('no scene chip')
    chip.click()
    document.getElementById('record-this-block').click()
  })()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === true`)
  await evalInWindow(`document.getElementById('audio-mode').value = 'microphone'`)
  await evalInWindow(`window.__timing.stageReview()`)
  await evalInWindow(`document.getElementById('keep-take').click()`)
  let archived = null
  for (let i = 0; i < 30; i += 1) {
    archived = await fetch(`${origin}/api/takes?projectId=${PROJECT_ID}`).then(r => r.json()).catch(() => null)
    if (archived?.takes?.length === 1) break
    await sleep(400)
  }
  const presenterTake = archived?.takes?.[0]
  check('the kept camera take is archived as raw presenter footage', presenterTake?.detail?.role === 'presenter', JSON.stringify(presenterTake?.detail || null))

  let doc = null
  for (let i = 0; i < 20; i += 1) {
    doc = await getProject().catch(() => null)
    if (doc?.recordedBlocks?.[SCENE_ID]) break
    await sleep(400)
  }
  const active = doc?.recordedBlocks?.[SCENE_ID]
  check(
    'the notebook carries the take with its presenter role and track',
    active?.role === 'presenter' && doc?.presenterTracks?.[SCENE_ID]?.[0]?.kind === 'human-camera',
    JSON.stringify({ role: active?.role, track: doc?.presenterTracks?.[SCENE_ID]?.[0]?.kind || null }),
  )

  // Suspend the editor before the fixture's external document writes. An
  // open editor correctly retains a conflicting draft when its baseline is
  // changed behind it; that conflict journey has its own regression.
  for (let i = 0; i < 40; i++) {
    if (await evalInWindow(`document.getElementById('save-state')?.textContent === 'Saved'`)) break
    await sleep(150)
  }
  await evalInWindow(`location.assign('/api/projects/${PROJECT_ID}')`)
  await sleep(300)

  // A composed scene recording (no role — the directed canvas capture) sits
  // on the second scene, so one compile sees both roles.
  const legacyAsset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-project-id': PROJECT_ID, 'x-block-id': LEGACY_ID }, body: Buffer.from('legacy take bytes') }).then(r => r.json())
  const legacyCommit = await fetch(`${origin}/api/recordings/commit`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: PROJECT_ID, blockId: LEGACY_ID, assetId: legacyAsset.assetId, mediaUrl: legacyAsset.url, durationMs: 4000 }),
  }).then(r => r.json())
  check('a commit without a role stays a composed scene recording', !legacyCommit.recording?.role, JSON.stringify(legacyCommit.recording?.role || null))
  doc = await getProject()
  doc.recordedBlocks[LEGACY_ID] = legacyCommit.recording
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: doc, expectedProject: (await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json())).project }) })

  const html = await compileHtml(doc)
  const presenterSection = sceneTag(html, SCENE_ID)
  const legacySection = sceneTag(html, LEGACY_ID)
  check(
    'the presenter take leaves the scene graphics in place',
    Boolean(presenterSection) && !presenterSection.includes('has-recorded-take') && html.includes('part-a'),
    presenterSection.slice(0, 120),
  )
  check(
    'the presenter take rides as the camera overlay with its voice',
    html.includes(`class="camera camera-kind-`) && html.includes(`src="${active.videoUrl}"`),
    String(active.videoUrl).slice(0, 80),
  )
  check('the raw webcam footage never replaces the scene', (html.match(/recorded-take clip/g) || []).length === 1, `${(html.match(/recorded-take clip/g) || []).length} recorded-take clips`)
  check(
    'a composed scene recording still replaces its scene',
    legacySection.includes('has-recorded-take'),
    legacySection.slice(0, 120),
  )

  // The role survives the durable archive round trip: strip the document's
  // takes AND presenter tracks, reload, and hydration restores a take that
  // still compiles to graphics + presenter overlay (the compiler falls back
  // to the recording itself when no presenter track was restored).
  const stripped = await getProject()
  delete stripped.recordedBlocks
  delete stripped.recordedBlockTakes
  stripped.presenterTracks = {}
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: stripped, expectedProject: (await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json())).project }) })
  await evalInWindow(`location.assign('/studio')`)
  await evalInWindow(`(() => new Promise(r => { const t = setInterval(() => { if (document.getElementById('project-title')?.value === 'Presenter take fixture') { clearInterval(t); r(true) } }, 400) }))()`)
  let rehydrated = null
  for (let i = 0; i < 30; i += 1) {
    const body = await getProject().catch(() => null)
    if (body?.recordedBlocks?.[SCENE_ID]) { rehydrated = body; break }
    await sleep(400)
  }
  check(
    'hydration restores the take with its presenter role',
    rehydrated?.recordedBlocks?.[SCENE_ID]?.role === 'presenter',
    JSON.stringify(rehydrated?.recordedBlocks?.[SCENE_ID] || { save: await evalInWindow(`document.getElementById('save-state')?.textContent`), selected: (await fetch(`${origin}/api/takes?projectId=${PROJECT_ID}`).then(r => r.json())).selections }).slice(0, 500),
  )
  const rehtml = await compileHtml(rehydrated)
  const reSection = sceneTag(rehtml, SCENE_ID)
  const reUrl = rehydrated.recordedBlocks[SCENE_ID].videoUrl
  check(
    'the rehydrated presenter take still compiles to graphics plus the presenter overlay',
    Boolean(reSection) && !reSection.includes('has-recorded-take') && rehtml.includes('class="camera camera-kind-') && rehtml.includes(`src="${reUrl}"`),
    String(reUrl).slice(0, 80),
  )

  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(600)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `PRESENTER TAKE CHECK FAIL (${failures})` : 'PRESENTER TAKE CHECK PASS')
process.exitCode = failures ? 1 : 0
