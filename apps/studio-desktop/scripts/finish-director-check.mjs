// D6 director-at-finish, production wiring: explainer_finish runs through the
// smoke app's real MCP endpoint and real hidden window — the applied scene
// must carry a stage track from the shot plan and the director brief (not the
// old nulls), and the finish stage checkpoint lands on the durable run.
// Pattern per take-workflow-check.mjs (smoke app) + /mcp JSON-RPC over HTTP.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-finish-director-'))
const stamp = Date.now().toString(36)
const PROJECT_ID = `director-finish-${stamp}`
const RUN_ID = `run-finish-${stamp}`
const SCENE_ID = 'scene-fix'

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

const callTool = async (name, args) => {
  const response = await fetch(`${origin}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }).then(r => r.json())
  const text = response?.result?.content?.[0]?.text || ''
  if (response?.result?.isError) throw new Error(`${name}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return { raw: text } }
}

try {
  // The reviewed candidate on disk: scene files + proofs + narration, all
  // hashed with the canonical recipe the product uses.
  const runDir = join(root, RUN_ID)
  await mkdir(join(runDir, 'explainer'), { recursive: true })
  await mkdir(join(runDir, 'motion'), { recursive: true })
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><g id="part-a"><rect x="60" y="60" width="240" height="140" rx="10" fill="#4f46e5"/><text x="90" y="140" fill="#ffffff" font-size="28">queue</text></g><g id="part-b"><circle cx="620" cy="130" r="70" fill="#0891b2"/><text x="575" y="140" fill="#ffffff" font-size="28">worker</text></g></svg>'
  const program = { version: 1, cast: [], beats: [{ id: 'b1', say: 'First the queue holds the work.', events: [] }, { id: 'b2', say: 'Then the worker drains it.', events: [] }] }
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hash = createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const windows = [
    { say: program.beats[0].say, parts: ['part-a'] },
    { say: program.beats[1].say, parts: ['part-b'] },
  ]
  const plan = { version: 2, steps: windows.map(() => ({ motionWindowMs: 400, holdMs: 600, actions: [] })) }
  const save = (name, value) => writeFile(join(runDir, name), JSON.stringify(value))
  await writeFile(join(runDir, 'explainer', 'scene.svg'), svg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan, windows, durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash, audioUrl: '/objects/fixture.mp3', alignment: 'local-whisper-word-timestamps', durationMs: 2000 })
  await save('explainer/story.json', { scenes: [{ id: SCENE_ID, file: 'scene', title: 'Queue and worker', question: 'Why does the storm pass?', answer: 'The queue spreads the work.', review: 'States checked.', assets: [] }] })
  await save('motion/inputs.json', { projectId: PROJECT_ID, delivery: { mode: 'generated' }, scenes: [{ id: SCENE_ID, svg: 'wireframe', script: '' }] })

  // The durable run row, so the finish checkpoint has somewhere to land.
  await fetch(`${origin}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: RUN_ID, projectId: PROJECT_ID, skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: runDir, status: 'running' }) })

  const project = {
    version: 1, id: PROJECT_ID, title: 'Director finish fixture',
    derivedFrom: { notebook: 'base-fixture', kind: 'video' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: SCENE_ID, title: 'Wireframe', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { [SCENE_ID]: { nodeId: SCENE_ID, durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })

  const finished = await callTool('explainer_finish', { projectDir: runDir })
  check('finish applies the reviewed scene', Number.isFinite(finished.scenes) || finished.raw, JSON.stringify(finished).slice(0, 120))

  const applied = await fetch(`${origin}/api/projects/${PROJECT_ID}`).then(r => r.json()).then(body => body.project.notebook.content.find(n => n.attrs?.id === SCENE_ID).attrs)
  check('the applied scene carries the reviewed stamp and hash', applied.explainer?.reviewed === true && typeof applied.explainer?.hash === 'string' && applied.explainer.hash.length === 64)
  check(
    'a real director pass staged the scene (D6): saved stage track from the shots',
    Array.isArray(applied.stageTrack) && applied.stageTrack.length > 0 && applied.stageTrack.every(segment => typeof segment.family === 'string' && Number.isFinite(segment.atMs)),
    JSON.stringify(applied.stageTrack).slice(0, 140),
  )
  check(
    'the coach brief and shots persist on the applied scene',
    Boolean(applied.directorAuto?.recordingBrief) && Array.isArray(applied.directorAuto?.shots) && applied.directorAuto.shots.length > 0,
    JSON.stringify({ brief: applied.directorAuto?.recordingBrief?.objective || '', shots: applied.directorAuto?.shots?.length }),
  )
  const stages = await fetch(`${origin}/api/runs/${RUN_ID}/stages`).then(r => r.json())
  check('the finish checkpoint landed durably', stages.stages?.some(s => s.stage === 'finish' && s.status === 'succeeded'), JSON.stringify(stages.stages || []))

  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(resolve => setTimeout(resolve, 600))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `FINISH DIRECTOR CHECK FAIL (${failures})` : 'FINISH DIRECTOR CHECK PASS')
process.exitCode = failures ? 1 : 0
