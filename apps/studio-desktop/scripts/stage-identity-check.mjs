// Stage-identity check (earlier-review #7): stage checkpoints carry
// scene/object identity, so one scene's needs-input checkpoint (with its
// pickup details) survives another scene's progress in the same run.
//  - Tool phase: the real explainer tools post per-scene/per-object subjects
//    (bundled tools, stubbed renderer + store — pattern per narrate-guard-check).
//  - Store phase: the real API on BOTH backends (PostgreSQL, then the file
//    store) keeps two scenes' same-stage checkpoints side by side, updates
//    each in place, and keeps run-level (subject-less) checkpoints distinct.
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'stage-identity-'))

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

// ——— Phase 1: the real tools post their scene/object identity ———
const stageCalls = []
try {
  const dir = join(root, 'tools')
  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async (name, svg, program) => { if (name === "objectClipSeek") return { found: true }; if (name === "explainerFrame") return { ms: 0, beat: 0 }; const beats = (program && program.beats) || []; return { errors: [], warnings: [], frames: [0], durationMs: Math.max(1, beats.length) * 200, program, plan: { version: 2, steps: beats.map(() => ({ motionWindowMs: 100, holdMs: 100, actions: [] })) }, windows: [], captures: [], clips: [], fidelity: null } }; export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/runs/') && u.endsWith('/stages')) { stageCalls.push(JSON.parse(options?.body || '{}')); return Response.json({ saved: true }) }
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    throw new Error(`Unexpected fixture URL: ${url}`)
  }
  try {
    // Two scenes on the human path: both refuse narration, each under its own
    // subject — before the fix both collapsed onto one (run, stage) row.
    const runDir = join(dir, 'run-identity')
    await mkdir(join(runDir, 'explainer'), { recursive: true })
    await mkdir(join(runDir, 'motion'), { recursive: true })
    await writeFile(join(runDir, 'motion', 'inputs.json'), JSON.stringify({ projectId: 'nb', delivery: { mode: 'human' }, scenes: [{ id: 'alpha' }, { id: 'beta' }] }))
    for (const scene of ['alpha', 'beta']) {
      await writeFile(join(runDir, 'explainer', `${scene}.svg`), '<svg xmlns="http://www.w3.org/2000/svg"/>')
      await writeFile(join(runDir, 'explainer', `${scene}.program.json`), JSON.stringify({ version: 1, cast: [], beats: [{ id: 'b1', say: 'One line.', events: [] }] }))
    }
    await tool('explainer_narrate').call({ projectDir: runDir, scene: 'alpha' }, context).catch(() => {})
    await tool('explainer_narrate').call({ projectDir: runDir, scene: 'beta' }, context).catch(() => {})
    const narrateCheckpoints = stageCalls.filter(c => c.stage === 'narrate' && c.status === 'needs-input')
    check(
      'each scene\'s waiting checkpoint carries its own subject',
      narrateCheckpoints.length === 2 && narrateCheckpoints[0]?.subject === 'alpha' && narrateCheckpoints[1]?.subject === 'beta',
      JSON.stringify(narrateCheckpoints.map(c => c.subject ?? null)),
    )

    // A preview posts the scene as its subject too.
    await tool('explainer_preview').call({ projectDir: runDir, scene: 'alpha' }, context)
    const preview = stageCalls.find(c => c.stage === 'preview')
    check('the preview checkpoint is keyed on its scene', preview?.subject === 'alpha' && preview?.status === 'succeeded', JSON.stringify(preview && { subject: preview.subject, status: preview.status }))

    // And an object's isolated review is keyed on the asset key.
    await mkdir(join(runDir, 'explainer', 'assets'), { recursive: true })
    await writeFile(join(runDir, 'explainer', 'assets', 'ab12cd.json'), JSON.stringify({ key: 'ab12cd', entity: 'bucket', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
    await tool('explainer_review_object').call({ projectDir: runDir, key: 'ab12cd' }, context)
    const objectReview = stageCalls.find(c => c.stage === 'object-review')
    check('the object review checkpoint is keyed on the asset', objectReview?.subject === 'ab12cd', JSON.stringify(objectReview && { subject: objectReview.subject }))
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  check(`tool phase: ${error.message}`, false)
}

// ——— Phase 2: the durable store keys checkpoints by (run, stage, subject) ———
const startApp = async persistence => {
  const child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: {
      ...process.env,
      STUDIO_ALLOW_MULTI_INSTANCE: '1',
      STUDIO_DATA_DIR: join(root, `data-${persistence}`),
      STUDIO_OUTPUTS_DIR: join(root, `outputs-${persistence}`),
      ...(persistence === 'local' ? { STUDIO_PERSISTENCE: 'local' } : {}),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const origin = await new Promise((resolve, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
    child.stdout.on('data', chunk => {
      buffer += chunk
      const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
      if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
    })
    child.once('exit', code => reject(new Error(`app exited (${code})`)))
  })
  return { child, origin }
}

const storePhase = async (persistence, runId) => {
  const { child, origin } = await startApp(persistence)
  try {
    await fetch(`${origin}/api/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: runId, projectId: 'nb-identity', skill: 'explainer-master', route: 'Build Explainer', adapter: 'kimi', projectDir: '/tmp/x', status: 'running' }),
    })
    const postStage = body =>
      fetch(`${origin}/api/runs/${runId}/stages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    const listStages = () => fetch(`${origin}/api/runs/${runId}/stages`).then(r => r.json()).then(body => body.stages || [])

    // Scene A waits for a pickup; scene B aligns. Same run, same stage name.
    await postStage({ stage: 'align-take', subject: 'scene-a', status: 'needs-input', detail: { scene: 'scene-a', review: [{ beat: 2, note: 'The take skips the second sentence.' }] } })
    await postStage({ stage: 'align-take', subject: 'scene-b', status: 'succeeded', detail: { scene: 'scene-b' } })
    let stages = await listStages()
    const sceneA = stages.find(s => s.stage === 'align-take' && s.subject === 'scene-a')
    const sceneB = stages.find(s => s.stage === 'align-take' && s.subject === 'scene-b')
    check(
      `[${persistence}] scene A's waiting checkpoint survives scene B's alignment`,
      stages.filter(s => s.stage === 'align-take').length === 2 && sceneA?.status === 'needs-input' && sceneB?.status === 'succeeded',
      JSON.stringify(stages.map(s => `${s.stage}:${s.subject ?? ''}:${s.status}`)),
    )
    check(
      `[${persistence}] scene A's pickup details survive intact`,
      sceneA?.detail?.review?.[0]?.beat === 2 && /skips the second sentence/.test(sceneA?.detail?.review?.[0]?.note || ''),
      JSON.stringify(sceneA?.detail || null),
    )

    // A retry of scene B updates its own row in place — scene A is untouched.
    await postStage({ stage: 'align-take', subject: 'scene-b', status: 'needs-input', detail: { scene: 'scene-b', review: [{ beat: 1, note: 'Pickup for the opening line.' }] } })
    stages = await listStages()
    const updatedB = stages.find(s => s.stage === 'align-take' && s.subject === 'scene-b')
    check(
      `[${persistence}] a retried scene updates its own checkpoint in place`,
      stages.filter(s => s.stage === 'align-take').length === 2 && updatedB?.status === 'needs-input' && updatedB?.detail?.review?.[0]?.beat === 1,
      JSON.stringify(stages.map(s => `${s.subject ?? ''}:${s.status}`)),
    )

    // A run-level checkpoint (no subject) stays distinct from both scenes and
    // keeps its pre-identity in-place update behavior.
    await postStage({ stage: 'finish', status: 'succeeded', detail: { scenes: 2 } })
    await postStage({ stage: 'finish', status: 'succeeded', detail: { scenes: 3 } })
    stages = await listStages()
    const finishes = stages.filter(s => s.stage === 'finish')
    check(
      `[${persistence}] run-level checkpoints still update in place`,
      stages.length === 3 && finishes.length === 1 && finishes[0]?.detail?.scenes === 3,
      JSON.stringify(stages.map(s => `${s.stage}:${s.subject ?? ''}`)),
    )
  } finally {
    child.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 600))
  }
}

try {
  await storePhase('postgres', `stage-identity-pg-${Date.now().toString(36)}`)
  await storePhase('local', `stage-identity-local-${Date.now().toString(36)}`)
} catch (error) {
  check(`store phase: ${error.message}`, false)
} finally {
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `STAGE IDENTITY CHECK FAIL (${failures})` : 'STAGE IDENTITY CHECK PASS')
process.exitCode = failures ? 1 : 0
