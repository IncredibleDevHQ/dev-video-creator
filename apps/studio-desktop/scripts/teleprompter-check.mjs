// Issue #11 regression: the teleprompter mirrors the scene's saved script —
// it is read-only in the camera dialog, with an explicit path to edit the
// script in the notebook. After editing at the source and reopening, the
// teleprompter, the saved script and the guide-voice input all agree (the
// saved scene script is also the alignment target).
// Pattern per take-workflow-check.mjs / rehearsal-check.mjs (smoke app + __eval).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-teleprompter-'))
const PROJECT_ID = `teleprompter-${Date.now().toString(36)}`
const SCENE_ID = 'blk-tele'
const ORIGINAL = 'The original narration words.'
const IMPROVED = 'The improved narration words, edited in the notebook.'

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
const putProject = async script => {
  const project = {
    version: 1, derivedFrom: { notebook: 'fixture-base', kind: 'video' }, id: PROJECT_ID, title: 'Teleprompter fixture',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Teleprompter' }] },
      { type: 'scene', attrs: { id: SCENE_ID, title: 'Tele scene', script } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project, expectedProject: (await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json())).project }) })
}
const openCameraFor = async title => {
  await evalInWindow(`(() => {
    const chip = [...document.querySelectorAll('#scene-rail .scene-card')].find(b => b.textContent.includes(${JSON.stringify(title)}))
    if (!chip) throw new Error('no scene chip')
    chip.click()
    document.getElementById('record-this-block').click()
  })()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === true`)
}
const teleprompterState = () => evalInWindow(`(() => ({
  value: document.getElementById('presenter-script')?.value,
  readOnly: document.getElementById('presenter-script')?.readOnly === true,
  editPath: !!document.getElementById('teleprompter-edit'),
}))()`)

try {
  await putProject(ORIGINAL)
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); location.assign('/studio')`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)

  await openCameraFor('Tele scene')
  const initial = await teleprompterState()
  check(
    'the teleprompter shows the saved scene script and is read-only, with an edit path',
    initial.value === ORIGINAL && initial.readOnly && initial.editPath,
    JSON.stringify(initial),
  )

  // A would-be edit in the dialog cannot silently drift from the script.
  await evalInWindow(`(() => {
    const box = document.getElementById('presenter-script')
    box.value = 'Typed-in drift'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    document.getElementById('close-camera').click()
  })()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === false`)
  await openCameraFor('Tele scene')
  const reopened = await teleprompterState()
  check('reopening still mirrors the saved script — no silent drift', reopened.value === ORIGINAL, JSON.stringify(reopened.value))

  // The edit path leaves the dialog and lands on the scene in the notebook.
  await evalInWindow(`document.getElementById('teleprompter-edit').click()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === false`)
  const landed = await evalInWindow(`(() => ({
    selected: document.querySelector('.tiptap .selected-block')?.id || '',
    dialogOpen: document.getElementById('camera-dialog')?.open === true,
  }))()`)
  check('the edit path selects the scene in the notebook', landed.selected === SCENE_ID && !landed.dialogOpen, JSON.stringify(landed))

  // A pending take survives the editing handoff and returns in review.
  await openCameraFor('Tele scene')
  await evalInWindow(`window.__timing.stageReview()`)
  const pendingUrl = await evalInWindow(`document.getElementById('camera-preview').getAttribute('src')`)
  await evalInWindow(`document.getElementById('teleprompter-edit').click()`)
  await openCameraFor('Tele scene')
  const retained = await evalInWindow(`({url: document.getElementById('camera-preview').getAttribute('src'), review: !document.getElementById('take-review').hidden})`)
  check('editing preserves the exact unkept take for review', retained.review && retained.url === pendingUrl)
  await evalInWindow(`document.getElementById('discard-take').click(); document.getElementById('close-camera').click()`)

  // The script changes at the source; the teleprompter and the guide voice
  // both follow the saved words.
  await waitFor(`document.getElementById('save-state')?.textContent === 'Saved'`)
  await putProject(IMPROVED)
  await evalInWindow(`location.reload()`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)
  await openCameraFor('Tele scene')
  const updated = await teleprompterState()
  check('the teleprompter agrees with the edited script after reopening', updated.value === IMPROVED, JSON.stringify(updated.value))

  await evalInWindow(`(() => {
    window.__voiceBodies = []
    const real = window.fetch
    window.fetch = (url, ...rest) => String(url).includes('/api/voice')
      ? (window.__voiceBodies.push(JSON.parse(rest[0]?.body || '{}')),
        Promise.resolve(new Response(JSON.stringify({ url: 'data:audio/wav;base64,', provider: 'stub' }), { status: 200, headers: { 'content-type': 'application/json' } })))
      : real(url, ...rest)
    return true
  })()`)
  await evalInWindow(`document.getElementById('generate-guide').click()`)
  await waitFor(`(window.__voiceBodies || []).length === 1`)
  const guideText = await evalInWindow(`window.__voiceBodies[0].text`)
  check('the guide voice speaks the same saved words', guideText === IMPROVED, JSON.stringify(guideText).slice(0, 120))

  await evalInWindow(`document.getElementById('close-camera').click()`)
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(600)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `TELEPROMPTER CHECK FAIL (${failures})` : 'TELEPROMPTER CHECK PASS')
process.exitCode = failures ? 1 : 0
