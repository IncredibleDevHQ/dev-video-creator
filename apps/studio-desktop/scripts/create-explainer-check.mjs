// D0 create-explainer journey check: the legacy diagram tool is renamed
// Basic diagram, Create explainer offers Present it myself / Generate
// automatically as equal peers with independent material selection, the
// choice is recorded on the notebook (remembered, never assumed), Build
// explainer on an unchosen notebook opens the chooser, Publish labels a
// non-reviewed render as a draft, the library shows the Base badge, and
// changing the delivery path keeps existing takes and artwork (§3.7/§10).
// Follows notebooks-hierarchy-check.mjs's pattern (smoke app + /__eval).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-d0-'))
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
const PROJECT_ID = `d0-check-${Date.now().toString(36)}`

try {
  // ——— The served shell carries the renamed tool and the new entry ———
  const html = await fetch(`${origin}/`).then(r => r.text())
  check('commandbar has Create explainer', html.includes('id="create-explainer"'))
  check('Create explainer dialog ships both delivery paths', html.includes('id="create-explainer-dialog"') && html.includes('Present it myself') && html.includes('Generate automatically'))
  check('empty state offers Create explainer', html.includes('data-start="explainer"'))
  check('legacy wizard is labeled Basic diagram', html.includes('<span class="eyebrow">Basic diagram</span>') && !html.includes('>Explainer block<'), 'wizard header')

  // A fresh base notebook with one block, so Publish is enabled. The scene
  // carries artwork so the delivery-switch test has something to keep.
  const SCENE_SVG = '<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="40" y="40" width="200" height="120" fill="#4f46e5"/></svg>'
  const project = {
    version: 1,
    id: PROJECT_ID,
    title: 'D0 check notebook',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Retry storms' }] },
      { type: 'scene', attrs: { id: 'blk-s1', title: 'Scene one', svg: SCENE_SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SCENE_SVG)}` } },
    ] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: {},
    presenterTracks: {},
    recordedBlocks: {},
    brand: {},
    theme: {},
  }
  const put = await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) }).then(r => r.json())
  check('fixture notebook created', put.saved === true, JSON.stringify(put))

  // Open it in the UI and wait for the editor.
  await evaluate(`async () => {
    window.localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}')
    window.location.assign('/studio')
    return true
  }`, 'open fixture notebook')
  let booted = false
  let bootState = null
  for (let i = 0; i < 60; i += 1) {
    bootState = await evaluate(`() => ({
      hidden: document.getElementById('app')?.hidden,
      title: document.getElementById('project-title')?.value || '',
      hasPm: Boolean(document.querySelector('#editor .ProseMirror')),
    })`, 'boot').catch(() => null)
    booted = Boolean(bootState && bootState.hidden === false && bootState.title === 'D0 check notebook')
    if (booted) break
    await sleep(500)
  }
  check('fixture notebook open in the editor', booted, JSON.stringify(bootState))

  // Build explainer with no delivery choice opens the chooser, not a build.
  await evaluate(`() => { document.getElementById('build-explainer').click(); return true }`, 'build without choice')
  await sleep(400)
  const gate = await evaluate(`() => ({
    chooserOpen: document.getElementById('create-explainer-dialog')?.open === true,
    progressHidden: document.getElementById('explainer-progress')?.hidden === true,
  })`, 'gate state')
  check('Build explainer on an unchosen notebook opens the chooser, no build starts', gate.chooserOpen && gate.progressHidden, JSON.stringify(gate))

  // No default: neither path is preselected; proceeding without one is refused.
  const noDefault = await evaluate(`() => ({
    selected: [...document.querySelectorAll('#create-explainer-paths [data-delivery]')].filter(c => c.classList.contains('is-primary')).length,
  })`, 'no default')
  check('no delivery path is preselected', noDefault.selected === 0, JSON.stringify(noDefault))
  await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'material without path')
  await sleep(300)
  const refused = await evaluate(`() => ({
    open: document.getElementById('create-explainer-dialog')?.open === true,
    status: document.getElementById('create-explainer-status')?.textContent || '',
    sourceOpen: document.getElementById('source-dialog')?.open === true,
  })`, 'refused')
  check('material without a path is refused with guidance', refused.open && /Choose Present it myself or Generate automatically/.test(refused.status) && !refused.sourceOpen, JSON.stringify(refused))

  // Choose Present it myself + own narrative → recorded, source flow opens.
  await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="human"]').click(); return true }`, 'choose human')
  await sleep(200)
  await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'start from narrative')
  await sleep(600)
  const routed = await evaluate(`() => ({
    chooserOpen: document.getElementById('create-explainer-dialog')?.open === true,
    sourceOpen: document.getElementById('source-dialog')?.open === true,
    heading: document.getElementById('source-heading')?.textContent || '',
  })`, 'routed')
  check('Present it myself + narrative routes into the source flow', !routed.chooserOpen && routed.sourceOpen && routed.heading.includes('narrative'), JSON.stringify(routed))
  let recorded = null
  for (let i = 0; i < 20; i += 1) {
    const body = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).catch(() => null)
    if (body?.project?.explainerDelivery) { recorded = body.project.explainerDelivery; break }
    await sleep(400)
  }
  check('delivery choice recorded on the notebook', recorded === 'human', String(recorded))

  // The remembered choice is preselected when the dialog reopens.
  await evaluate(`() => { document.getElementById('source-dialog').close(); document.getElementById('create-explainer').click(); return true }`, 'reopen chooser')
  await sleep(300)
  const remembered = await evaluate(`() => {
    const card = document.querySelector('#create-explainer-paths [data-delivery="human"]')
    const status = document.getElementById('create-explainer-status')?.textContent || ''
    const result = { checked: card?.getAttribute('aria-checked') === 'true', status }
    document.getElementById('create-explainer-dialog').close()
    return result
  }`, 'remembered')
  check('the explicit previous choice is remembered', remembered.checked && /Present it myself/.test(remembered.status), JSON.stringify(remembered))

  // Changing delivery paths keeps the work (§3.7 / §10): the recorded take,
  // the scene's artwork, and its words all survive a human ↔ generated switch.
  await evaluate(`() => { window.__timing.standInTake('blk-s1', 8000); return true }`, 'stand-in take')
  let before = null
  for (let i = 0; i < 20; i += 1) {
    const body = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).catch(() => null)
    if (body?.project?.recordedBlocks?.['blk-s1']) { before = body.project; break }
    await sleep(400)
  }
  check('a recorded take exists before the switch', Boolean(before?.recordedBlocks?.['blk-s1']?.recordingId))
  const sceneShape = p => p.notebook.content.find(n => n.attrs?.id === 'blk-s1')
  const switchDelivery = async path => {
    await evaluate(`() => { document.getElementById('create-explainer').click(); return true }`, 'reopen chooser')
    await sleep(300)
    await evaluate(`() => { document.querySelector('#create-explainer-paths [data-delivery="${path}"]').click(); return true }`, `choose ${path}`)
    await sleep(200)
    await evaluate(`() => { document.querySelector('#create-explainer-materials [data-material="narrative"]').click(); return true }`, 'start from narrative')
    await sleep(600)
    await evaluate(`() => { document.getElementById('source-dialog').close(); return true }`, 'close source')
    await sleep(400)
  }
  await switchDelivery('generated')
  const afterGenerated = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).then(b => b.project)
  check(
    'switching to generated keeps the take archive, the active take, and the scene artwork',
    afterGenerated?.explainerDelivery === 'generated'
      && afterGenerated?.recordedBlocks?.['blk-s1']?.recordingId === before.recordedBlocks['blk-s1'].recordingId
      && (afterGenerated?.recordedBlockTakes?.['blk-s1'] || []).length === 1
      && JSON.stringify(sceneShape(afterGenerated)) === JSON.stringify(sceneShape(before)),
  )
  await switchDelivery('human')
  const afterHuman = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).then(b => b.project)
  check(
    'switching back to human keeps everything again',
    afterHuman?.explainerDelivery === 'human'
      && afterHuman?.recordedBlocks?.['blk-s1']?.recordingId === before.recordedBlocks['blk-s1'].recordingId
      && JSON.stringify(sceneShape(afterHuman)) === JSON.stringify(sceneShape(before)),
  )

  // Publish on an unreviewed notebook is visibly a draft export. With two
  // scenes the junction walkthrough comes first — walk it to the summary.
  const publishKind = async () => {
    await evaluate(`() => { document.getElementById('render-video').click(); return true }`, 'publish click')
    for (let i = 0; i < 20; i += 1) {
      const result = await evaluate(`() => {
        const dialog = document.getElementById('publish-dialog')
        if (dialog?.open) return { kind: document.getElementById('publish-export-kind')?.textContent || '' }
        const walkthrough = document.getElementById('finalize-bar')
        if (walkthrough && !walkthrough.hidden) { document.getElementById('finalize-next')?.click(); return null }
        return null
      }`, 'publish dialog').catch(() => null)
      if (result) return result
      await sleep(400)
    }
    return null
  }
  const closePublish = () => evaluate(`() => { document.getElementById('publish-dialog')?.close(); return true }`, 'close publish')
  const bootInto = async (id, title) => {
    await evaluate(`() => { window.localStorage.setItem('incredible-studio-v2-active-project', '${id}'); location.reload(); return true }`, `open ${id}`)
    for (let i = 0; i < 60; i += 1) {
      const state = await evaluate(`() => document.getElementById('project-title')?.value || ''`, 'boot').catch(() => '')
      if (state === title) return
      await sleep(500)
    }
    throw new Error(`notebook ${id} did not open`)
  }
  const publish = await publishKind()
  if (!publish) {
    const openModals = await evaluate(`() => [...document.querySelectorAll('dialog[open]')].map(d => d.id)`, 'open modals').catch(() => [])
    check('Publish labels the render a draft export, not a reviewed explainer', false, `dialog never opened; open dialogs: ${JSON.stringify(openModals)}`)
  } else {
    check('Publish labels the render a draft export, not a reviewed explainer', /Draft export/.test(publish.kind), JSON.stringify(publish))
  }
  await closePublish()

  // The library shows the Base badge on a root notebook.
  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    document.querySelector('.notebook-menu-library')?.click()
    await new Promise(r => setTimeout(r, 400))
    return true
  }`, 'open library')
  let library = null
  for (let i = 0; i < 20; i += 1) {
    library = await evaluate(`() => {
      const page = document.getElementById('notebooks-page')
      if (!page || page.hidden) return null
      const card = [...document.querySelectorAll('#notebooks-tree .notebook-card')].find(c => c.querySelector('strong')?.textContent.includes('D0 check notebook'))
      if (!card) return null
      return { badges: [...card.querySelectorAll('.notebook-kind-badge')].map(b => b.textContent) }
    }`, 'library').catch(() => null)
    if (library) break
    await sleep(400)
  }
  check('library marks the root notebook as Base', Boolean(library && library.badges.includes('Base')), JSON.stringify(library))

  // The reviewed label tracks the stamped revision (§3.9): since issue #17
  // the stamp pins the whole rendered performance — the scene revision plus
  // camera, duration, narration and take identity — the same contract the
  // finish tool writes and the export verifies. The stamp is computed over
  // the page-normalized project (the editor materializes defaults and block
  // config) with the shared revision contract, so this also proves the page
  // and the tool hash the same revision.
  const VIDEO_ID = `${PROJECT_ID}-video`
  const VSCENE_SVG = '<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="40" y="40" width="200" height="120" fill="#4f46e5"/></svg>'
  const VPROGRAM = { version: 1, beats: [{ id: 'b1', say: 'Reviewed line.' }] }
  const { createHash } = await import('node:crypto')
  const revisionModule = join(root, 'scene-revision.mjs')
  await build({ entryPoints: [fileURLToPath(new URL('../../studio-v2/src/scene-revision.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: revisionModule, logLevel: 'silent' })
  const { sceneRevisionPayload, sceneRenderedExtras } = await import(pathToFileURL(revisionModule).href)
  // Canonical key order — PG jsonb reorders object keys, so the stamp hashes
  // the canonical form (same recipe as the finish tool and the page).
  const stableStringify = value => JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v))
  const stampFor = doc => {
    const node = doc.notebook.content.find(n => n.attrs?.id === 'blk-v1')
    const attrs = node?.attrs || {}
    return createHash('sha256').update(String(attrs.svg || '')).update(stableStringify(sceneRevisionPayload(attrs, sceneRenderedExtras(doc.blocks?.['blk-v1'], doc.presenterTracks?.['blk-v1'], doc.recordedBlocks?.['blk-v1'])))).digest('hex')
  }
  const videoProject = (svg, hash) => ({
    version: 1, id: VIDEO_ID, title: 'D0 video notebook',
    derivedFrom: { notebook: PROJECT_ID, kind: 'video' },
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-vh', level: 1 }, content: [{ type: 'text', text: 'Video' }] },
      { type: 'scene', attrs: { id: 'blk-v1', title: 'Reviewed scene', svg, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, program: VPROGRAM, ...(hash ? { explainer: { reviewed: true, hash } } : {}) } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  })
  await fetch(`${origin}/api/projects/${VIDEO_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(videoProject(VSCENE_SVG)) })
  await bootInto(VIDEO_ID, 'D0 video notebook')
  const unstamped = await publishKind()
  check('an unstamped derived scene reads as a draft export', /Draft export/.test(unstamped?.kind || ''), JSON.stringify(unstamped))
  await closePublish()
  // The publish pass normalized and persisted the page's copy; stamp exactly
  // what the page now holds.
  let normalized = null
  for (let i = 0; i < 20; i += 1) {
    const body = await fetch(`${origin}/api/projects/${VIDEO_ID}`).then(r => r.json()).catch(() => null)
    if (body?.project?.blocks?.['blk-v1']?.camera) { normalized = body.project; break }
    await sleep(300)
  }
  check('the page normalized and persisted the scene', Boolean(normalized))
  const stamped = JSON.parse(JSON.stringify(normalized))
  stamped.notebook.content.find(n => n.attrs?.id === 'blk-v1').attrs.explainer = { reviewed: true, hash: stampFor(stamped) }
  await fetch(`${origin}/api/projects/${VIDEO_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(stamped) })
  await bootInto(VIDEO_ID, 'D0 video notebook')
  const reviewedLabel = await publishKind()
  check('a fully reviewed notebook reads as a reviewed export', /Reviewed explainer export/.test(reviewedLabel?.kind || ''), JSON.stringify(reviewedLabel))
  await closePublish()

  // Every rendered input the stamp covers flips the label back to draft.
  const driftCases = [
    ['the artwork', doc => { const node = doc.notebook.content.find(n => n.attrs?.id === 'blk-v1'); node.attrs.svg = node.attrs.svg.replace('#4f46e5', '#dc2626'); node.attrs.svgSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(node.attrs.svg)}` }],
    ['the compiled motion', doc => { doc.notebook.content.find(n => n.attrs?.id === 'blk-v1').attrs.motion = { version: 2, steps: [{ motionWindowMs: 100, holdMs: 900, actions: [] }] } }],
    ['the narration track', doc => { doc.presenterTracks = { 'blk-v1': [{ kind: 'narration', audioUrl: '/objects/swapped.mp3', audioKind: 'generated' }] } }],
  ]
  for (const [label, mutate] of driftCases) {
    const drifted = JSON.parse(JSON.stringify(stamped))
    mutate(drifted)
    await fetch(`${origin}/api/projects/${VIDEO_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(drifted) })
    await bootInto(VIDEO_ID, 'D0 video notebook')
    const driftLabel = await publishKind()
    check(`changing ${label} after the review reads as a draft again`, /1 of 1 scenes changed since the rich build's review/.test(driftLabel?.kind || ''), JSON.stringify(driftLabel))
    await closePublish()
  }
  await fetch(`${origin}/api/projects/${VIDEO_ID}`, { method: 'DELETE' })

  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebooks deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `CREATE EXPLAINER CHECK FAIL (${failures})` : 'CREATE EXPLAINER CHECK PASS')
process.exitCode = failures ? 1 : 0
