// §3.8 rehearsal-loop check: in the camera dialog, a scene with a compiled
// plan offers Rehearse — the proposed graphics play beside the cue lines at
// the plan's estimated pace, with manual beat controls; a scene without a
// plan keeps the pane hidden; closing and reopening resets the rehearsal.
// Pattern per take-workflow-check.mjs / scene-animate-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-rehearsal-'))
const PROJECT_ID = `rehearsal-${Date.now().toString(36)}`
const SCENE_ID = 'blk-rehearse'
const PLAIN_ID = 'blk-plain'

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

const SVG = `<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><g id="part-a"><rect x="60" y="60" width="240" height="140" rx="10" fill="#4f46e5"/><text x="90" y="140" fill="#ffffff" font-size="28">queue</text></g><g id="part-b"><circle cx="620" cy="130" r="70" fill="#0891b2"/><text x="575" y="140" fill="#ffffff" font-size="28">worker</text></g></svg>`
const WINDOWS = [
  { say: 'First the queue holds the work.', parts: ['part-a'], hero: 'part-a', layout: 'page' },
  { say: 'Then the worker drains it.', parts: ['part-b'], hero: 'part-b', layout: 'beside' },
]
// Short beats so scripted playback crosses a boundary quickly.
const MOTION = {
  version: 2,
  steps: [
    { id: 'b1', title: 'Queue', explanation: WINDOWS[0].say, actions: [{ op: 'reveal', targets: ['part-a'], startMs: 0, durationMs: 300, ease: 'enter', persistence: 'state' }], motionWindowMs: 500, holdMs: 300 },
    { id: 'b2', title: 'Worker', explanation: WINDOWS[1].say, actions: [{ op: 'reveal', targets: ['part-b'], startMs: 0, durationMs: 300, ease: 'enter', persistence: 'state' }], motionWindowMs: 500, holdMs: 300 },
  ],
}
const sceneNode = (id, title, attrs) => ({
  type: 'scene',
  attrs: {
    id, title, svg: SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`,
    structureApproved: true, ...attrs,
  },
})

const openCameraFor = async title => {
  await evalInWindow(`(() => {
    const chip = [...document.querySelectorAll('#scene-rail .scene-card')].find(b => b.textContent.includes(${JSON.stringify(title)}))
    if (!chip) throw new Error('no scene chip')
    chip.click()
    document.getElementById('record-this-block').click()
  })()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === true`)
}
const rehearsalState = () => evalInWindow(`(() => ({
  open: document.getElementById('camera-dialog')?.open === true,
  hidden: document.getElementById('rehearsal')?.hidden,
  hasSvg: !!document.querySelector('#rehearsal-stage svg'),
  beat: document.getElementById('rehearsal-beat')?.textContent,
  shot: document.getElementById('rehearsal-shot')?.textContent,
  line: document.getElementById('rehearsal-line')?.textContent,
  toggle: document.getElementById('rehearse-toggle')?.textContent,
}))()`)

try {
  const project = {
    version: 1, id: PROJECT_ID, title: 'Rehearsal fixture',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Rehearsal' }] },
      sceneNode(SCENE_ID, 'Rehearse scene', { windows: WINDOWS, motion: MOTION }),
      sceneNode(PLAIN_ID, 'Plain scene', {}),
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); location.assign('/studio')`)
  await waitFor(`!!document.getElementById('${SCENE_ID}')`)

  await openCameraFor('Rehearse scene')
  const initial = await rehearsalState()
  check('camera dialog opens with the rehearsal pane and the scene graphics', initial.hidden === false && initial.hasSvg, JSON.stringify({ hidden: initial.hidden, hasSvg: initial.hasSvg }))
  check('the first cue line shows at beat 1 of 2 with its shot', initial.beat === '1 / 2' && initial.line === WINDOWS[0].say && initial.shot === 'Page owns the frame', `${initial.beat} · ${initial.shot} · ${initial.line}`)

  await evalInWindow(`document.getElementById('rehearse-next').click()`)
  const next = await rehearsalState()
  check('next beat jumps to beat 2 with its line and shot', next.beat === '2 / 2' && next.line === WINDOWS[1].say && next.shot === 'Beside me', `${next.beat} · ${next.shot}`)

  await evalInWindow(`document.getElementById('rehearse-prev').click()`)
  const prev = await rehearsalState()
  check('previous beat returns to beat 1', prev.beat === '1 / 2' && prev.line === WINDOWS[0].say)

  await evalInWindow(`document.getElementById('rehearse-toggle').click()`)
  const playing = await rehearsalState()
  check('rehearse starts playback', playing.toggle === '■ Stop', playing.toggle)
  const advanced = await waitFor(`document.getElementById('rehearsal-line')?.textContent === ${JSON.stringify(WINDOWS[1].say)}`, 6_000).catch(() => null)
  check('playback advances the cue line with the plan', Boolean(advanced))
  await evalInWindow(`document.getElementById('rehearse-toggle').click()`)
  const stopped = await rehearsalState()
  check('stopping holds the rehearsal', stopped.toggle === '▶ Rehearse', stopped.toggle)

  await evalInWindow(`document.getElementById('close-camera').click()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === false`)
  await openCameraFor('Rehearse scene')
  const reopened = await rehearsalState()
  check('reopening resets the rehearsal to beat 1', reopened.beat === '1 / 2' && reopened.line === WINDOWS[0].say && reopened.toggle === '▶ Rehearse')
  await evalInWindow(`document.getElementById('close-camera').click()`)
  await waitFor(`document.getElementById('camera-dialog')?.open === false`)

  await openCameraFor('Plain scene')
  const plain = await rehearsalState()
  check('a scene without a compiled plan keeps the rehearsal pane hidden', plain.open && plain.hidden === true, `hidden=${plain.hidden}`)
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
console.log(failures ? `REHEARSAL CHECK FAIL (${failures})` : 'REHEARSAL CHECK PASS')
process.exitCode = failures ? 1 : 0
