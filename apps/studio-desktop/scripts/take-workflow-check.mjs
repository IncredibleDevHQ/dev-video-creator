// D3 take-workflow check: committing a recording preserves an immutable take
// and selects it; a retake keeps both; selecting an earlier take is a durable
// record; a restart loses neither the archive nor the selection; and the UI
// hydrates the archive back into a reopened notebook. Pattern per
// migration-check.mjs (smoke app + __eval).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-takes-'))
const PROJECT_ID = `d3-takes-${Date.now().toString(36)}`

const startApp = async () => {
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
  return { app, origin }
}

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
// Take ids cross from the recording phase into the restarted-app phase.
let take1Id = ''
let take2Id = ''
const evalInWindow = async (origin, js) => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
  }).then(r => r.json())
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

let first
try {
  first = await startApp()
  const { origin } = first
  const project = {
    version: 1, id: PROJECT_ID, title: 'Takes fixture',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Takes' }] },
      { type: 'scene', attrs: { id: 'blk-p1', title: 'Take scene' } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })

  const uploadTake = async name => {
    const response = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-project-id': PROJECT_ID, 'x-block-id': 'blk-p1' }, body: Buffer.from(`take ${name} bytes`) })
    return response.json()
  }
  const commitTake = async (asset, durationMs) => {
    const response = await fetch(`${origin}/api/recordings/commit`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: PROJECT_ID, blockId: 'blk-p1', assetId: asset.assetId, mediaUrl: asset.url, durationMs }),
    })
    return response.json()
  }
  const listTakes = () => fetch(`${origin}/api/takes?projectId=${PROJECT_ID}`).then(r => r.json())

  const asset1 = await uploadTake('one')
  const take1 = await commitTake(asset1, 4000)
  const asset2 = await uploadTake('two')
  const take2 = await commitTake(asset2, 5200)
  take1Id = take1.recording.recordingId
  take2Id = take2.recording.recordingId
  const afterTwo = await listTakes()
  check('two commits are two preserved takes', afterTwo.takes?.length === 2, `${afterTwo.takes?.length}`)
  check('committing selects the new take', afterTwo.selections?.[0]?.takeId === take2.recording?.recordingId, JSON.stringify(afterTwo.selections))

  const bad = await fetch(`${origin}/api/takes/select`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: PROJECT_ID, blockId: 'blk-p1', takeId: crypto.randomUUID() }) })
  check('selecting an unknown take is refused', bad.status === 500 || bad.status === 400, `status ${bad.status}`)

  await fetch(`${origin}/api/takes/select`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: PROJECT_ID, blockId: 'blk-p1', takeId: take1.recording.recordingId }) })
  const reselected = await listTakes()
  check('selecting the earlier take is durable', reselected.selections?.[0]?.takeId === take1.recording.recordingId)
} catch (error) {
  check(`first app: ${error.message}`, false)
} finally {
  first?.app.kill('SIGTERM')
  await sleep(600)
}

// Restart: archive and selection survive; the reopened notebook hydrates.
let second
try {
  second = await startApp()
  const { origin } = second
  const relisted = await fetch(`${origin}/api/takes?projectId=${PROJECT_ID}`).then(r => r.json())
  check('takes and selection survive a restart', relisted.takes?.length === 2 && relisted.selections?.length === 1, `${relisted.takes?.length} takes`)

  await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(() => { window.localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); window.location.assign('/studio'); })()` }),
  })
  let doc = null
  for (let i = 0; i < 40; i += 1) {
    await sleep(500)
    const body = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).catch(() => null)
    if (body?.project?.recordedBlocks?.['blk-p1']) { doc = body.project; break }
  }
  const active = doc?.recordedBlocks?.['blk-p1']
  const archived = doc?.recordedBlockTakes?.['blk-p1'] || []
  check(
    'the reopened notebook hydrates the selected take as active',
    Boolean(active && active.recordingId === relisted.selections[0].takeId && archived.length === 2),
    `active=${active?.recordingId?.slice(0, 8)}… takes=${archived.length}`,
  )

  // The take picker shows the archive's provenance (§5.8a): which take the
  // edit uses, and when each take was recorded.
  await evalInWindow(origin, `(() => {
    const chip = [...document.querySelectorAll('#scene-rail .scene-card')].find(b => b.textContent.includes('Take scene'))
    if (!chip) throw new Error('no chip for the take scene')
    chip.click()
  })()`)
  const created1 = relisted.takes.find(t => t.id === take1Id)?.createdAt
  const created2 = relisted.takes.find(t => t.id === take2Id)?.createdAt
  const picker = await evalInWindow(origin, `(() => {
    const box = document.getElementById('canvas-take-versions')
    const fmt = d => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    return {
      hidden: box.hidden,
      buttons: [...box.querySelectorAll('button')].map(b => ({ label: b.textContent, title: b.title })),
      when: [fmt(${JSON.stringify(created1)}), fmt(${JSON.stringify(created2)})],
    }
  })()`)
  check('the picker shows both preserved takes', picker.hidden === false && picker.buttons.length === 2, `${picker.buttons.length} buttons`)
  check('the selected take reads as used, with when it was recorded', picker.buttons[0]?.title === `Take v1 · used for the final video · ${picker.when[0]}`, picker.buttons[0]?.title)
  check('the other take offers its duration and provenance', picker.buttons[1]?.title === `Use take v2 (00:05) · ${picker.when[1]} for the final video`, picker.buttons[1]?.title)

  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted')
} catch (error) {
  check(`second app: ${error.message}`, false)
} finally {
  second?.app.kill('SIGTERM')
  await sleep(600)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `TAKE WORKFLOW CHECK FAIL (${failures})` : 'TAKE WORKFLOW CHECK PASS')
process.exitCode = failures ? 1 : 0
