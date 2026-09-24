// First-build fork check: one Build explainer click on a base notebook makes
// exactly one video derivative and dispatches exactly one build run — against
// the derivative's own id and its remapped scenes, never against the base.
// Before the fix the click raced the fork's reload: the run went out with the
// base's id and scenes (or was interrupted by the navigation), and finish
// would refuse the underived base. Pattern per approval-check.mjs (stub kimi
// on PATH so no agent is spawned) and take-workflow-check.mjs (smoke app +
// /__eval).
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-build-fork-'))
const dataDir = join(root, 'data')
const BASE_ID = `fork-base-${Date.now().toString(36)}`
const BASE_TITLE = 'Fork build check'
const BASE_SCENE = 'blk-fork-1'
const SCENE_SVG = '<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="40" y="40" width="200" height="120" fill="#4f46e5"/></svg>'

// A stub kimi on PATH: answers --version and any run with one JSON line and
// exit 0, so the real dispatch path runs without a real agent.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node\nconsole.log(JSON.stringify({role:'assistant',content:'stub run'}))\nconsole.log(JSON.stringify({role:'meta',type:'session.resume_hint',session_id:'stub-session-fork'}))\n`,
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
const runsFor = async id =>
  fetch(`${origin}/api/runs?projectId=${encodeURIComponent(id)}`).then(r => r.json()).then(body => body.runs || [])

try {
  const base = {
    version: 1, id: BASE_ID, title: BASE_TITLE, explainerDelivery: 'generated',
    notebook: { type: 'doc', content: [
      { type: 'scene', attrs: { id: BASE_SCENE, title: 'Fork scene', svg: SCENE_SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SCENE_SVG)}`, script: 'A line to narrate.' } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  const put = await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) }).then(r => r.json())
  check('fixture base notebook created', put.saved === true, JSON.stringify(put))

  await evalInWindow(`(() => { window.localStorage.setItem('incredible-studio-v2-active-project', '${BASE_ID}'); window.localStorage.setItem('studio.codingAgent', 'kimi'); window.location.assign('/studio'); })()`)
  let opened = false
  for (let i = 0; i < 60; i += 1) {
    const title = await evalInWindow(`document.getElementById('project-title')?.value || ''`).catch(() => '')
    if (title === BASE_TITLE) { opened = true; break }
    await sleep(500)
  }
  check('base notebook open in the editor', opened)

  // The one click this check is about.
  await evalInWindow(`(() => { document.getElementById('build-explainer').click(); return true })()`)

  // The fork lands, the page navigates into the derivative, and the build
  // resumes there — all after the click's page is gone. Poll across the reload.
  let child = null
  let derivativeCount = 0
  for (let i = 0; i < 60; i += 1) {
    const { projects } = await fetch(`${origin}/api/projects`).then(r => r.json()).catch(() => ({ projects: [] }))
    const derivatives = (projects || []).filter(row => row.derivedFrom?.notebook === BASE_ID)
    if (derivatives.length) { child = derivatives[0]; derivativeCount = derivatives.length; break }
    await sleep(500)
  }
  check('one click creates exactly one video derivative', Boolean(child) && derivativeCount === 1, child ? `${child.id} (${derivativeCount})` : 'none')

  let childOpen = false
  if (child) {
    for (let i = 0; i < 60; i += 1) {
      const title = await evalInWindow(`document.getElementById('project-title')?.value || ''`).catch(() => '')
      if (title === `${BASE_TITLE} · video`) { childOpen = true; break }
      await sleep(500)
    }
  }
  check('the click lands in the derivative notebook', childOpen)

  let childRuns = []
  if (child) {
    for (let i = 0; i < 60; i += 1) {
      childRuns = await runsFor(child.id).catch(() => [])
      if (childRuns.length) break
      await sleep(500)
    }
  }
  check('exactly one build run is dispatched for the derivative', childRuns.length === 1, `${childRuns.length}`)
  // Let any misdirected base run settle, then look.
  await sleep(2_000)
  const baseRuns = await runsFor(BASE_ID).catch(() => [])
  check('no build run is dispatched for the base', baseRuns.length === 0, `${baseRuns.length}`)

  if (child && childRuns.length) {
    const run = childRuns[0]
    const inputs = JSON.parse(await readFile(join(run.projectDir, 'motion', 'inputs.json'), 'utf8'))
    check('the run inputs name the derivative, not the base', inputs.projectId === child.id, String(inputs.projectId))
    const childProject = await fetch(`${origin}/api/projects/${encodeURIComponent(child.id)}`).then(r => r.json()).then(body => body.project)
    const childSceneIds = childProject.notebook.content
      .filter(node => (node.type === 'scene' || node.type === 'slide') && node.attrs?.svg)
      .map(node => String(node.attrs.id))
    const runSceneIds = (inputs.scenes || []).map(scene => String(scene.id))
    check(
      'the run carries the remapped scenes only',
      runSceneIds.length === childSceneIds.length && runSceneIds.every(id => childSceneIds.includes(id)) && !runSceneIds.includes(BASE_SCENE),
      JSON.stringify(runSceneIds),
    )
  } else {
    check('the run carries the remapped scenes only', false, 'no run to inspect')
  }

  if (child) await fetch(`${origin}/api/projects/${encodeURIComponent(child.id)}`, { method: 'DELETE' })
  await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebooks deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(600)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `BUILD FORK CHECK FAIL (${failures})` : 'BUILD FORK CHECK PASS')
process.exitCode = failures ? 1 : 0
