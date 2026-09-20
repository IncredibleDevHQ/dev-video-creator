// Continue-from-accepted-work check (issue #8): the real RunManager drives a
// stubbed adapter through the human-path journey —
//  1. run A ends cleanly while scene B still needs a human take: the run is
//     recorded as `waiting` (a normal durable state), never as an error, and
//     the requested pickup survives in run A's stage history;
//  2. Continue dispatches run B naming run A in its inputs (run id + directory
//     + accepted scenes + waiting checkpoints); the prior run's reviewed
//     artifacts are carried into run B's own fresh directory — story, proofs,
//     candidates, receipts and the spent review budget — while a stale export
//     is not; the accepted scene's bytes are exactly the prior run's;
//  3. run B then completes through the REAL export verification over the
//     carried, unregenerated scenes.
// The hidden renderer is stubbed (pattern per finish-pickup-check.mjs); the
// durable store is a stubbed fetch keyed exactly like the product schema —
// (run, stage, subject), the same identity the stage-identity check proves
// against both real backends.
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const root = await mkdtemp(join(tmpdir(), 'explainer-resume-'))
const projectsRoot = join(root, 'projects')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

// The tools' canonical hashing recipe (explainer-tools.ts): sha256 over the
// svg + the key-sorted JSON of the program. The run-dir files this check
// fabricates must satisfy the real verifier's digests.
const stableStringify = value =>
  JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v))
const digest = (svg, program) => createHash('sha256').update(svg).update(stableStringify(program)).digest('hex')

const svgFor = id => `<svg xmlns="http://www.w3.org/2000/svg"><g id="${id}"/></svg>`
const programFor = say => ({ version: 1, cast: [], beats: [{ id: 'b1', say, events: [] }] })

// The fake durable store: run rows and subject-keyed stage rows.
const runRows = new Map()
const stageRows = new Map()
const stageKey = (runId, stage, subject) => `${runId}${stage}${subject || ''}`
const previousFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  const u = String(url)
  const stagesMatch = /\/api\/runs\/([^/]+)\/stages$/.exec(u)
  if (stagesMatch && options?.method === 'POST') {
    const body = JSON.parse(options.body || '{}')
    const key = stageKey(decodeURIComponent(stagesMatch[1]), body.stage, body.subject)
    stageRows.set(key, { ...(stageRows.get(key) || {}), ...body, runId: decodeURIComponent(stagesMatch[1]) })
    return Response.json({ saved: true })
  }
  if (stagesMatch) {
    const runId = decodeURIComponent(stagesMatch[1])
    return Response.json({ stages: [...stageRows.values()].filter(row => row.runId === runId) })
  }
  if (u.endsWith('/api/runs') && options?.method === 'POST') {
    const body = JSON.parse(options.body || '{}')
    runRows.set(body.id, { ...(runRows.get(body.id) || {}), ...body })
    return Response.json({ saved: true })
  }
  if (u.endsWith('/api/runs')) return Response.json({ runs: [...runRows.values()] })
  if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
  throw new Error(`Unexpected fixture URL: ${u}`)
}

const SCENES = [
  { id: 'blk-a', file: 'scene-a', say: 'The bucket holds the retries.', durationMs: 400 },
  { id: 'blk-b', file: 'scene-b', say: 'The pool drains as workers pick up.', durationMs: 600 },
]
const story = {
  version: 1,
  scenes: SCENES.map(scene => ({ id: scene.id, file: scene.file, title: scene.file, question: `Why ${scene.file}?`, answer: 'Because.', review: 'States checked.', assets: [] })),
}
// Set from inside the run B adapter (it runs in this process).
const observed = { carriedStory: false, sawStaleExport: false, carriedSceneA: '' }

try {
  await mkdir(join(root, 'dist-electron'), { recursive: true })
  await build({
    entryPoints: [fileURLToPath(new URL('../src/harness/run-manager.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(root, 'dist-electron', 'run-manager.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async () => ({}); export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { RunManager } = await import(pathToFileURL(join(root, 'dist-electron', 'run-manager.mjs')))
  const context = { origin: 'http://fixture', mcpShimPath: '', skillsDir: fileURLToPath(new URL('../skills', import.meta.url)) }

  const postStage = (runId, body) =>
    globalThis.fetch(`http://fixture/api/runs/${encodeURIComponent(runId)}/stages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  // ——— Run A: scene A is reviewed and accepted; scene B waits for a take ———
  const adapterA = {
    id: 'kimi',
    available: async () => ({ ok: true }),
    run: async run => {
      const dir = join(run.projectDir, 'explainer')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'story.json'), JSON.stringify(story, null, 2))
      for (const scene of SCENES) {
        const svg = svgFor(scene.id)
        const program = programFor(scene.say)
        const hash = digest(svg, program)
        const proof = { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: join(dir, 'review', scene.file, hash.slice(0, 12), '0000000.png') }], program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 100, actions: [] }] }, windows: [], durationMs: scene.durationMs }
        await writeFile(join(dir, `${scene.file}.svg`), svg)
        await writeFile(join(dir, `${scene.file}.program.json`), JSON.stringify(program))
        await writeFile(join(dir, `${scene.file}.proof.json`), JSON.stringify(proof))
        await writeFile(join(dir, `${scene.file}.best-proof.json`), JSON.stringify(proof))
        await mkdir(join(dir, 'candidates', scene.file, hash.slice(0, 12)), { recursive: true })
        await writeFile(join(dir, 'candidates', scene.file, hash.slice(0, 12), 'proof.json'), JSON.stringify(proof))
        await postStage(run.id, { stage: 'preview', subject: scene.file, status: 'succeeded', detail: { scene: scene.file } })
      }
      // The review budget spent so far is review work a resume must not reset.
      await writeFile(join(dir, 'review-counts.json'), JSON.stringify({ 'scene-a': 3 }))
      // Scene A was accepted and applied; scene B aligned scene A's take fine
      // but needs a pickup itself — the run parks here.
      await writeFile(join(dir, 'receipt.json'), JSON.stringify({ projectId: 'nb-resume', scenes: 1, applied: { 'blk-a': digest(svgFor('blk-a'), programFor(SCENES[0].say)) }, at: new Date().toISOString() }))
      await postStage(run.id, { stage: 'align-take', subject: 'scene-a', status: 'succeeded', detail: { scene: 'scene-a' } })
      await postStage(run.id, { stage: 'align-take', subject: 'scene-b', status: 'needs-input', detail: { scene: 'scene-b', review: [{ beat: 2, note: 'The take skips the second sentence.' }] } })
      // A stale export fragment from an earlier attempt: never carried forward.
      await writeFile(join(dir, 'export.json'), JSON.stringify({ durationSeconds: 99, sceneHashes: ['stale'] }))
      await writeFile(join(dir, 'export.mp4'), 'stale video bytes')
      await mkdir(join(dir, 'export-review'), { recursive: true })
      await writeFile(join(dir, 'export-review', 'old.png'), 'stale frame')
      return { exitCode: 0 }
    },
  }

  const manager = new RunManager(context, projectsRoot, async () => null)
  const events = []
  manager.onEvent((runId, event) => events.push({ runId, ...event }))
  const waitForFinish = async id => {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const current = manager.list().find(run => run.id === id)
      if (current?.finishedAt) return current
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`run ${id} never finished`)
  }

  const runA = await manager.start({
    adapter: adapterA, skill: 'explainer-master', route: 'Build Explainer', projectId: 'nb-resume',
    inputs: { projectId: 'nb-resume', delivery: { mode: 'human' }, scenes: SCENES.map(({ id }) => ({ id })) },
  })
  const finalA = await waitForFinish(runA.id)
  check('a run parked on a human take ends waiting, not as an error', finalA.status === 'waiting', `status=${finalA.status}`)
  check('the waiting run is durable with exit code 0', runRows.get(runA.id)?.status === 'waiting' && runRows.get(runA.id)?.exitCode === 0, JSON.stringify({ status: runRows.get(runA.id)?.status, exitCode: runRows.get(runA.id)?.exitCode }))
  const doneA = events.find(event => event.runId === runA.id && event.type === 'done')
  check('the done event reports the waiting state', doneA?.status === 'waiting' && doneA?.exitCode === 0, JSON.stringify(doneA && { status: doneA.status, exitCode: doneA.exitCode }))
  const stagesA = [...stageRows.values()].filter(row => row.runId === runA.id)
  const pickup = stagesA.find(row => row.stage === 'align-take' && row.subject === 'scene-b')
  check(
    'the requested pickup is recorded per scene, beside the other scene\'s success',
    pickup?.status === 'needs-input' && pickup?.detail?.review?.[0]?.beat === 2 && stagesA.some(row => row.stage === 'align-take' && row.subject === 'scene-a' && row.status === 'succeeded'),
    JSON.stringify(stagesA.map(row => `${row.stage}:${row.subject ?? ''}:${row.status}`)),
  )

  // ——— Continue: run B names run A and carries its accepted work ———
  const adapterB = {
    id: 'kimi',
    available: async () => ({ ok: true }),
    run: async run => {
      const dir = join(run.projectDir, 'explainer')
      observed.carriedStory = existsSync(join(dir, 'story.json'))
      observed.carriedSceneA = await readFile(join(dir, 'scene-a.svg'), 'utf8').catch(() => '')
      observed.sawStaleExport = await readFile(join(dir, 'export.json'), 'utf8').then(text => JSON.parse(text).durationSeconds === 99).catch(() => false)
      // The pickup landed: scene B's take now aligns; the run finishes and
      // re-exports. Accepted scene files are used exactly as carried.
      await postStage(run.id, { stage: 'align-take', subject: 'scene-b', status: 'succeeded', detail: { scene: 'scene-b' } })
      await postStage(run.id, { stage: 'finish', status: 'succeeded', detail: { scenes: 2 } })
      await writeFile(join(dir, 'receipt.json'), JSON.stringify({
        projectId: 'nb-resume', scenes: 2,
        applied: Object.fromEntries(SCENES.map(scene => [scene.id, digest(svgFor(scene.id), programFor(scene.say))])),
        at: new Date().toISOString(),
      }))
      await writeFile(join(dir, 'export.json'), JSON.stringify({
        durationSeconds: SCENES.reduce((sum, scene) => sum + scene.durationMs, 0) / 1000,
        sceneHashes: SCENES.map(scene => digest(svgFor(scene.id), programFor(scene.say))),
        url: '/objects/export.mp4',
      }))
      await postStage(run.id, { stage: 'export', status: 'succeeded', detail: { durationSeconds: 1 } })
      return { exitCode: 0 }
    },
  }
  const runB = await manager.start({
    adapter: adapterB, skill: 'explainer-master', route: 'Build Explainer', projectId: 'nb-resume',
    inputs: {
      projectId: 'nb-resume', delivery: { mode: 'human' }, scenes: SCENES.map(({ id }) => ({ id })),
      resume: {
        runId: runA.id,
        projectDir: runA.projectDir,
        accepted: ['blk-a'],
        waiting: [{ stage: 'align-take', subject: 'scene-b', scene: 'scene-b', review: [{ beat: 2, note: 'The take skips the second sentence.' }] }],
      },
    },
  })
  const finalB = await waitForFinish(runB.id)

  check('the continued run gets its own directory', runB.projectDir !== runA.projectDir && runB.projectDir.includes(runB.id), runB.projectDir)
  const inputsB = JSON.parse(await readFile(join(runB.projectDir, 'motion', 'inputs.json'), 'utf8'))
  check(
    'the new run\'s inputs name the prior run, the accepted scenes and the waiting pickup',
    inputsB.resume?.runId === runA.id && inputsB.resume?.projectDir === runA.projectDir && JSON.stringify(inputsB.resume?.accepted) === '["blk-a"]' && inputsB.resume?.waiting?.[0]?.review?.[0]?.beat === 2,
    JSON.stringify(inputsB.resume || null),
  )
  check('the story and the accepted scene were carried, not regenerated', observed.carriedStory && observed.carriedSceneA === svgFor('blk-a'), `carriedStory=${observed.carriedStory} sceneBytes=${observed.carriedSceneA.length}`)
  check('a stale export is never carried into the new run', observed.sawStaleExport === false && !existsSync(join(runB.projectDir, 'explainer', 'export.mp4')) && !existsSync(join(runB.projectDir, 'explainer', 'export-review')))
  const counts = await readFile(join(runB.projectDir, 'explainer', 'review-counts.json'), 'utf8').catch(() => '')
  check('the accepted scenes\' review work is carried, not reset', JSON.parse(counts || '{}')['scene-a'] === 3, counts)
  check('the retained candidates and proofs survived into the new run', existsSync(join(runB.projectDir, 'explainer', 'candidates', 'scene-a')) && existsSync(join(runB.projectDir, 'explainer', 'scene-a.best-proof.json')))
  check('the continued run completes through the real export verification', finalB.status === 'done', `status=${finalB.status}`)
  const stagesAFinal = [...stageRows.values()].filter(row => row.runId === runA.id)
  check(
    'run A\'s waiting checkpoint is still intact after the continuation',
    stagesAFinal.some(row => row.stage === 'align-take' && row.subject === 'scene-b' && row.status === 'needs-input' && row.detail?.review?.[0]?.beat === 2),
    JSON.stringify(stagesAFinal.map(row => `${row.subject ?? ''}:${row.status}`)),
  )
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `EXPLAINER RESUME CHECK FAIL (${failures})` : 'EXPLAINER RESUME CHECK PASS')
process.exitCode = failures ? 1 : 0
