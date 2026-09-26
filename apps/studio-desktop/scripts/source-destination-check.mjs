// Source-destination check (review finding #3): the new-or-append decision
// turns on the author's own content, not only on scenes, and the untouched
// starter sample is not content. A fresh launch finishing a two-scene source
// flow gets a new notebook holding exactly that story (compiled duration is
// the two scenes, no starter blocks ride along); a notebook with real content
// is asked, and a deliberate "add to this notebook" appends. Pattern per
// take-workflow-check.mjs (smoke app + /__eval) and build-fork-check.mjs
// (stub kimi on PATH); the local file store keeps the shared database out of
// the fixture, per local-store-check.mjs.
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-destination-'))
const dataDir = join(root, 'data')

// Two-sentence narratives: the stub story planner makes one scene per
// sentence, so every flow below knows exactly which scenes to expect.
const FLOW_A_ONE = 'Every request waits in one queue, and a single slow job blocks all the others behind it.'
const FLOW_A_TWO = 'A worker pool pulls from the queue in parallel, so one slow job never holds the rest hostage.'
const FLOW_B_ONE = 'Retries multiply the load exactly when the service can least afford it.'
const FLOW_B_TWO = 'A backoff schedule spaces the retries out, so the load arrives at a survivable rate.'
const FLOW_C_ONE = 'The cache stamps every entry with the time it was written, so a stale read is always visible.'
const FLOW_D_ONE = 'A page split moves half the keys into a new page and points the parent at both.'
const SAMPLE_MARK = 'Make technical ideas feel human'
const narrativeOf = (...sentences) => `# Flow\n\n${sentences.join('\n\n')}`

// A stub kimi on PATH: --version answers, a story-master run plans one scene
// per authored sentence (narration verbatim) from the run's own inputs, and
// any other run simply ends. No real agent is ever spawned.
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
  const lines = inputs.source.text.split('\\n').map(line => line.trim()).filter(Boolean)
  const title = (lines.find(line => line.startsWith('#')) || '# Untitled').replace(/^#+\\s*/, '')
  const body = lines.filter(line => !line.startsWith('#')).join(' ')
  const sentences = (body.match(/[^.!?]+[.!?]+/g) || [body]).map(s => s.trim()).filter(Boolean)
  const scenes = sentences.slice(0, 3).map((sentence, index) => ({
    title: title + ' ' + (index + 1),
    idea: sentence,
    kind: 'diagram',
    seconds: 12,
    parts: [{ label: 'Queue', kind: 'box', detail: 'holds work' }, { label: 'Worker', kind: 'box', detail: 'does work' }],
    relations: [{ from: 'Queue', to: 'Worker', verb: 'feeds' }],
    narration: sentence,
    source: [sentence],
  }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title, targetSeconds: scenes.length * 12, scenes, glossary: [] }))
  fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: scenes.length }))
  emit({ role: 'assistant', content: 'Planned ' + scenes.length + ' scenes.' })
} else {
  emit({ role: 'assistant', content: 'stub run' })
}
emit({ role: 'meta', type: 'session.resume_hint', session_id: 'stub-session-destination' })
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
  console.log(`${ok ? 'PASS' : `FAIL`}  ${label}${detail ? `  ${detail}` : ''}`)
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
const nodeText = node => `${(node.content || []).map(nodeText).join(' ')} ${node.text || ''}`.trim()
const meaningful = project => (project?.notebook?.content || []).filter(node => node.type !== 'paragraph' || nodeText(node).length > 0)
const sceneNodes = project => (project?.notebook?.content || []).filter(node => node.type === 'scene')
const compiledSeconds = async project => {
  const response = await fetch(`${origin}/api/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project }),
  }).then(r => r.json())
  return response.durationSeconds
}
const expectedSeconds = project =>
  sceneNodes(project).reduce((sum, node) => sum + Math.max(1000, Number(project.blocks?.[node.attrs?.id]?.durationMs) || 0) / 1000, 0)

// One wizard run: paste the narrative, read, outline (stub kimi), pages. When
// the destination row shows, pick the requested destination; the caller learns
// whether the row was offered at all.
const runWizard = async (narrative, destination) => {
  await evaluate(`() => { window.__source.open('narrative'); return true }`, 'open source')
  await waitFor(`() => document.getElementById('source-dialog')?.open === true`, 'source dialog')
  await evaluate(`() => { const box = document.getElementById('source-narrative'); box.value = ${JSON.stringify(narrative)}; document.getElementById('source-read').click(); return true }`, 'read')
  const brand = await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')
  if (!brand) return { ok: false, offered: null }
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline')
  const outlined = await waitFor(`() => !document.getElementById('source-step-outline')?.hidden`, 'outline step', 150)
  if (!outlined) return { ok: false, offered: null }
  await evaluate(`() => { document.getElementById('source-make-pages').click(); return true }`, 'pages')
  const paged = await waitFor(`() => !document.getElementById('source-step-pages')?.hidden`, 'pages step')
  if (!paged) return { ok: false, offered: null }
  const offered = await evaluate(`() => !document.getElementById('source-destination-row')?.hidden`, 'destination row')
  if (destination) {
    await evaluate(`() => { const radio = document.querySelector('input[name="source-destination"][value="${destination}"]'); if (radio) radio.click(); return true }`, 'destination')
  }
  await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish')
  const done = await waitFor(`async () => {
    if (document.getElementById('source-dialog')?.open) return null
    return window.localStorage.getItem('incredible-studio-v2-active-project')
  }`, 'finish', 120)
  return { ok: Boolean(done), offered }
}

try {
  // ——— Flow A: a fresh launch, the notebook still holding only the starter
  // sample. Switching surfaces without a reload keeps the pristine session,
  // the way a creator who goes straight into Create explainer sees it. ———
  await evaluate(`() => { document.getElementById('theme-app').hidden = true; document.getElementById('app').hidden = false; window.history.replaceState({}, '', '/studio'); return true }`, 'show studio')
  const boot = await waitFor(`() => {
    const editor = document.querySelector('#editor .ProseMirror')
    return editor ? { id: window.localStorage.getItem('incredible-studio-v2-active-project'), text: editor.textContent || '' } : null
  }`, 'boot')
  check('fresh launch boots on the starter sample', Boolean(boot && boot.text.includes(SAMPLE_MARK)), (boot?.text || '').slice(0, 60))
  const bootNotebookId = boot?.id || ''

  // Present it myself is irrelevant to the destination; the generated path is
  // exercised here so the delivery chooser runs the real entry.
  await evaluate(`() => { window.localStorage.setItem('studio.codingAgent', 'kimi'); document.getElementById('create-explainer').click(); return true }`, 'open chooser')
  await sleep(300)
  await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="generated"]').click(); return true }`, 'choose generated')
  await sleep(200)
  await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'own narrative')
  const dialogOpen = await waitFor(`() => document.getElementById('source-dialog')?.open === true`, 'source dialog')
  check('the source flow opens for the narrative', Boolean(dialogOpen))
  await evaluate(`() => { const box = document.getElementById('source-narrative'); box.value = ${JSON.stringify(narrativeOf(FLOW_A_ONE, FLOW_A_TWO))}; document.getElementById('source-read').click(); return true }`, 'read')
  check('the narrative is read', Boolean(await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')))
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline')
  check('the story run plans the outline', Boolean(await waitFor(`() => !document.getElementById('source-step-outline')?.hidden`, 'outline step', 150)))
  await evaluate(`() => { document.getElementById('source-make-pages').click(); return true }`, 'pages')
  check('the pages are made', Boolean(await waitFor(`() => !document.getElementById('source-step-pages')?.hidden`, 'pages step')))
  const offeredA = await evaluate(`() => !document.getElementById('source-destination-row')?.hidden`, 'destination row')
  check('the untouched starter sample is not treated as content (no destination prompt)', offeredA === false, `offered=${offeredA}`)
  await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish')
  const finishedA = await waitFor(`async () => {
    if (document.getElementById('source-dialog')?.open) return null
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    return scenes.length >= 2 ? id : null
  }`, 'finish', 120)
  check('finishing a fresh launch starts a new notebook', Boolean(finishedA) && finishedA !== bootNotebookId, `${finishedA} vs ${bootNotebookId}`)

  const freshNotebook = finishedA ? await projectBody(finishedA) : null
  const freshScenes = sceneNodes(freshNotebook)
  const freshBlocks = meaningful(freshNotebook)
  check(
    'the new notebook holds exactly the two scenes — no starter blocks ride along',
    freshScenes.length === 2 && freshBlocks.length === 2 && !freshBlocks.some(node => nodeText(node).includes(SAMPLE_MARK)),
    JSON.stringify((freshNotebook?.notebook?.content || []).map(node => node.type)),
  )
  const previewSeconds = freshNotebook ? await compiledSeconds(freshNotebook) : 0
  const sceneSeconds = freshNotebook ? expectedSeconds(freshNotebook) : -1
  check(
    'the compiled duration is exactly the two scenes',
    Math.abs(previewSeconds - sceneSeconds) < 0.05 && sceneSeconds > 0,
    `compiled=${previewSeconds}s scenes=${sceneSeconds}s`,
  )
  const bootNotebook = bootNotebookId ? await projectBody(bootNotebookId) : null
  check(
    'the starter notebook is kept, untouched',
    Boolean(bootNotebook) && sceneNodes(bootNotebook).length === 0 && meaningful(bootNotebook).some(node => nodeText(node).includes(SAMPLE_MARK)),
  )

  // ——— Flow B: the notebook now has the author's scenes, so the destination
  // is asked — and a deliberate append adds to this notebook. ———
  const flowB = await runWizard(narrativeOf(FLOW_B_ONE, FLOW_B_TWO), 'append')
  check('a notebook with content is offered the destination choice', flowB.ok && flowB.offered === true, `offered=${flowB.offered}`)
  // The debounced save lands shortly after the dialog closes; poll for it.
  let afterB = null
  for (let i = 0; i < 30; i += 1) {
    afterB = finishedA ? await projectBody(finishedA) : null
    if (sceneNodes(afterB).length === 4) break
    await sleep(400)
  }
  const afterBScripts = sceneNodes(afterB).map(node => String(node.attrs?.script || ''))
  check(
    'a deliberate append adds the scenes to the same notebook',
    Boolean(afterB) && (await activeId()) === finishedA && sceneNodes(afterB).length === 4,
    `${sceneNodes(afterB).length} scenes`,
  )
  check(
    'the append keeps the first story and the starter sample stays out',
    afterBScripts.includes(FLOW_A_ONE) && afterBScripts.includes(FLOW_B_ONE) && !meaningful(afterB).some(node => nodeText(node).includes(SAMPLE_MARK)),
    JSON.stringify(afterBScripts).slice(0, 160),
  )

  // ——— Flow C: a markdown-only notebook (no scenes) is content too: the
  // choice is offered, and the default starts a new notebook. ———
  const MD_ID = `markdown-${Date.now().toString(36)}`
  const mdProject = {
    version: 1, id: MD_ID, title: 'Markdown notes',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-md-h', level: 1 }, content: [{ type: 'text', text: 'Notes that are mine' }] },
      { type: 'paragraph', attrs: { id: 'blk-md-p' }, content: [{ type: 'text', text: 'A paragraph the author wrote, not a scene.' }] },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${MD_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mdProject) })
  await evaluate(`() => { window.localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(MD_ID)}); window.localStorage.setItem('studio.codingAgent', 'kimi'); window.location.assign('/studio'); return true }`, 'open markdown notebook')
  const mdBoot = await waitFor(`() => document.getElementById('project-title')?.value === 'Markdown notes'`, 'markdown notebook boot')
  check('the markdown notebook opens', Boolean(mdBoot))
  const flowC = await runWizard(narrativeOf(FLOW_C_ONE), 'new')
  check('written markdown triggers the destination choice even without scenes', flowC.ok && flowC.offered === true, `offered=${flowC.offered}`)
  // The debounced save of the new notebook lands shortly after the close.
  let afterC = null
  let cNotebook = null
  for (let i = 0; i < 30; i += 1) {
    afterC = await activeId().catch(() => null)
    cNotebook = afterC ? await projectBody(afterC) : null
    if (afterC && afterC !== MD_ID && sceneNodes(cNotebook).length === 1) break
    await sleep(400)
  }
  check(
    'starting a new notebook from written content leaves the markdown notebook alone',
    flowC.ok && afterC !== MD_ID && sceneNodes(cNotebook).length === 1 && meaningful(cNotebook).length === 1,
    `active=${afterC}`,
  )
  const mdAfter = await projectBody(MD_ID)
  check(
    'the markdown notebook keeps its own content, no scenes appended',
    Boolean(mdAfter) && sceneNodes(mdAfter).length === 0 && meaningful(mdAfter).some(node => nodeText(node).includes('Notes that are mine')),
  )

  // ——— Flow D (BoltDB review B01): a source finished while a video
  // notebook's Scenes view is open. The new notebook used to be swapped in
  // under the studio, which kept the video's views — its scenes, its
  // stage, its lineage. The studio now opens on the new notebook, as it
  // opens any: nothing of the video is left in view. ———
  const BASE_ID = `fabric-base-${Date.now().toString(36)}`
  const VIDEO_ID = `video-${BASE_ID}`
  const page = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="80" y="80" width="400" height="200"/><text x="100" y="200">Fabric</text></svg>'
  const fabricScene = (id, title) => ({ type: 'scene', attrs: { id, title, svg: page, script: 'The fabric keeps its threads apart.' } })
  const fabricNotebook = (id, title, sceneTitle, extra = {}) => ({ version: 1, id, title, notebook: { type: 'doc', content: [fabricScene(`${id}-s01`, sceneTitle)] }, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {}, ...extra })
  await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fabricNotebook(BASE_ID, 'Fabric base', 'Fabric threads')) })
  await fetch(`${origin}/api/projects/${VIDEO_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fabricNotebook(VIDEO_ID, 'Fabric video', 'Fabric threads on stage', { derivedFrom: { notebook: BASE_ID, baseTitle: 'Fabric base', forkedAt: new Date().toISOString() } })) })
  await evaluate(`() => { window.localStorage.setItem('incredible-studio-v2-video-view', 'scenes'); localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(VIDEO_ID)}); window.localStorage.setItem('studio.codingAgent', 'kimi'); window.location.assign('/studio'); return true }`, 'open the video notebook')
  const videoOpen = await waitFor(`() => document.getElementById('project-title')?.value === 'Fabric video' && document.body.classList.contains('is-scene-workspace') ? { video: document.body.classList.contains('is-video-notebook'), text: document.body.innerText.includes('Fabric threads on stage') } : null`, 'video notebook boot')
  check('the video notebook opens on its Scenes view', Boolean(videoOpen?.video && videoOpen.text), JSON.stringify(videoOpen))
  // A mark on this page: the notebook the studio opens next is a page of its own.
  await evaluate(`() => { window.__videoPage = true; return true }`, 'mark the page')
  const flowD = await runWizard(narrativeOf(FLOW_D_ONE), 'new')
  check('from the video notebook, the source finishes into a new notebook', flowD.ok && flowD.offered === true, `offered=${flowD.offered}`)
  const opened = await waitFor(`() => {
    // Until the studio has opened afresh, the video's page is still this one.
    if (window.__videoPage) return null
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const editor = document.querySelector('#editor .ProseMirror')
    if (!editor || !id || id === ${JSON.stringify(VIDEO_ID)} || document.getElementById('project-title')?.value !== 'Flow') return null
    return {
      id,
      video: document.body.classList.contains('is-video-notebook'),
      scenesView: document.body.classList.contains('is-scene-workspace'),
      workspace: !document.getElementById('scene-workspace').hidden,
      scenesTab: !document.getElementById('workspace-tab-scenes').hidden,
      fabric: /Fabric/.test(document.body.innerText),
      scenes: editor.querySelectorAll(':scope > [data-block-type="scene"]').length,
      said: editor.textContent.includes('page split'),
    }
  }`, 'new notebook open', 120)
  check('the studio opens on the new notebook, as it opens any: no video view, no Scenes, no lineage', Boolean(opened) && !opened.video && !opened.scenesView && !opened.workspace && !opened.scenesTab, JSON.stringify(opened))
  check('nothing of the video notebook is left in view; the new scene is', Boolean(opened) && !opened.fabric && opened.scenes === 1 && opened.said, JSON.stringify(opened && { fabric: opened.fabric, scenes: opened.scenes, said: opened.said }))
  const newNotebook = opened ? await projectBody(opened.id) : null
  const videoAfter = await projectBody(VIDEO_ID)
  check('the new notebook is a base of its own, and the video notebook is untouched', Boolean(newNotebook) && !newNotebook.derivedFrom && sceneNodes(newNotebook).length === 1 && sceneNodes(videoAfter).length === 1 && videoAfter.derivedFrom?.notebook === BASE_ID, JSON.stringify({ derived: newNotebook?.derivedFrom || null, video: sceneNodes(videoAfter).map(node => node.attrs?.title) }))
  const notice = await waitFor(`() => { const toast = document.querySelector('#toast, .toast'); return toast && /in a new notebook/.test(toast.textContent) ? toast.textContent : null }`, 'notice', 20)
  check('once it is open, the new notebook says what it holds', Boolean(notice), notice || '')

  // Cleanup: every notebook this run touched goes; the temp store removes the
  // rest.
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
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE DESTINATION CHECK FAIL (${failures})` : 'SOURCE DESTINATION CHECK PASS')
process.exitCode = failures ? 1 : 0
