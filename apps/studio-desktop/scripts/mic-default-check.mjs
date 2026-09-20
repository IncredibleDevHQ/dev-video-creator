// Issue #4 regression: the camera dialog's audio approach follows the
// journey's delivery choice — Present it myself defaults to the microphone
// (the take must carry the presenter's real voice), Generate automatically
// defaults to the guide voice — and device access is requested only by the
// Enable camera action, never by opening the dialog.
// Pattern per rehearsal-check.mjs / take-workflow-check.mjs (smoke app + __eval).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-mic-default-'))
const PROJECT_ID = `mic-default-${Date.now().toString(36)}`
const SCENE_ID = 'blk-mic'

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
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 90)}`)
}

const putProject = async delivery => {
  const project = {
    version: 1, id: PROJECT_ID, title: 'Mic default fixture',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Mic default' }] },
      { type: 'scene', attrs: { id: SCENE_ID, title: 'Mic scene', script: 'Words the presenter reads.' } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
    ...(delivery ? { explainerDelivery: delivery } : {}),
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
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
const audioState = () => evalInWindow(`(() => ({
  mode: document.getElementById('audio-mode')?.value,
  engineHidden: document.getElementById('engine-recording')?.hidden,
  voiceRefHidden: document.getElementById('voice-reference-label')?.hidden,
  gumCalls: (window.__gumCalls || []).map(c => ({ audio: c.audio === true })),
  status: document.getElementById('camera-status')?.textContent,
}))()`)
const installGumStub = () => evalInWindow(`(() => {
  window.__gumCalls = []
  const stub = { getUserMedia: constraints => { window.__gumCalls.push(constraints || {}); return Promise.resolve(new MediaStream()) } }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: stub })
  return true
})()`)

try {
  await putProject('human')
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); location.assign('/studio')`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)
  await installGumStub()

  await openCameraFor('Mic scene')
  const human = await audioState()
  check(
    'Present it myself defaults the audio approach to the microphone',
    human.mode === 'microphone' && human.engineHidden === true && human.voiceRefHidden === true,
    JSON.stringify({ mode: human.mode, engineHidden: human.engineHidden, voiceRefHidden: human.voiceRefHidden }),
  )
  check('opening the dialog requests no device access', human.gumCalls.length === 0, `${human.gumCalls.length} calls`)

  await evalInWindow(`document.getElementById('enable-camera').click()`)
  await waitFor(`(window.__gumCalls || []).length === 1`)
  const humanLive = await audioState()
  check(
    'Enable camera requests the microphone for the human path',
    humanLive.gumCalls.length === 1 && humanLive.gumCalls[0].audio === true && /microphone ready/.test(humanLive.status || ''),
    JSON.stringify({ calls: humanLive.gumCalls, status: humanLive.status }),
  )
  await evalInWindow(`document.getElementById('close-camera').click()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === false`)

  // The generated path keeps its guide-voice default: no microphone request.
  await putProject('generated')
  await evalInWindow(`location.reload()`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)
  await installGumStub()
  await openCameraFor('Mic scene')
  const generated = await audioState()
  check(
    'Generate automatically keeps the guide-voice default',
    generated.mode === 'generated' && generated.engineHidden === false && generated.voiceRefHidden === false,
    JSON.stringify({ mode: generated.mode, engineHidden: generated.engineHidden, voiceRefHidden: generated.voiceRefHidden }),
  )
  await evalInWindow(`document.getElementById('enable-camera').click()`)
  await waitFor(`(window.__gumCalls || []).length === 1`)
  const generatedLive = await audioState()
  check(
    'Enable camera on the generated path requests no microphone',
    generatedLive.gumCalls.length === 1 && generatedLive.gumCalls[0].audio === false && /Camera-only ready/.test(generatedLive.status || ''),
    JSON.stringify({ calls: generatedLive.gumCalls, status: generatedLive.status }),
  )
  await evalInWindow(`document.getElementById('close-camera').click()`)

  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(resolve => setTimeout(resolve, 600))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `MIC DEFAULT CHECK FAIL (${failures})` : 'MIC DEFAULT CHECK PASS')
process.exitCode = failures ? 1 : 0
