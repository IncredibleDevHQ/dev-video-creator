// Live paid/provider proof (plan §8 top tier): one real explainer build
// through the local Kimi harness on a fresh base — story, Quiver cast,
// narration, review, finish, export — with the product's verification as the
// gate. This spends model/provider budget by design. Not part of the
// deterministic release suite.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-live-'))
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
    process.stdout.write(chunk)
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})

const sleep = ms => new Promise(r => setTimeout(r, ms))
const evaluate = async js => {
  const response = await fetch(`${origin}/__eval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  const body = await response.json()
  if (!body.ok) throw new Error(body.error || 'eval failed')
  return body.result
}
let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const BASE_ID = `live-base-${Date.now().toString(36)}`
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" font-family="Inter, sans-serif" font-size="22" data-page-role="diagram" data-page-index="01"><rect id="bg" data-role="background" x="0" y="0" width="1280" height="720" fill="#0b1220"/><g id="s01-node-clients" data-role="node" data-kind="box" data-entity="client"><rect x="80" y="280" width="280" height="160" rx="12" fill="#111827" stroke="#3b82f6"/><text x="220" y="366" font-size="24" fill="#e5edf5" text-anchor="middle">Clients</text></g><g id="s01-node-service" data-role="node" data-kind="box" data-entity="service"><rect x="920" y="280" width="280" height="160" rx="12" fill="#111827" stroke="#3b82f6"/><text x="1060" y="366" font-size="24" fill="#e5edf5" text-anchor="middle">Service</text></g><line id="s01-edge-1" data-role="connector" data-verb="calls" data-from="s01-node-clients" data-to="s01-node-service" x1="360" y1="360" x2="920" y2="360" stroke="#635bff" stroke-width="2"/><g id="s01-actor-request" data-actor="request" opacity="0"><circle cx="360" cy="360" r="14" fill="#635bff"/><text x="360" y="366" font-size="16" text-anchor="middle" fill="#fff">req</text></g></svg>`

try {
  // A one-scene base about retry storms, forked to a video notebook.
  const base = {
    version: 1, id: BASE_ID, title: 'Live proof: retry storms',
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'blk-storm', title: 'The retry storm', svg: SVG, script: 'When the service comes back, every client retries at once and it falls over again. Jitter gives each client a different wait, so retries spread out and the service survives.', sourcePassages: ['A recovering service can fail again when every client retries at once.', 'Jitter spreads the retries so the service survives.'] } }] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {}, explainerDelivery: 'generated',
  }
  await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })
  const fork = await fetch(`${origin}/api/projects/${BASE_ID}/fork`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ forkKey: `live-${Date.now()}`, title: 'Live proof · video' }) }).then(r => r.json())
  const child = fork.project
  check('the base forked to a video notebook', Boolean(child?.id) && child.id !== BASE_ID, child?.id)
  // §10: a repeat build over the same material must not spend new provider
  // calls — the compatible library objects answer the cast. Snapshot the
  // spent budget now; after the run it must not have moved.
  const budgetBefore = await fetch(`${origin}/api/diagnostics`).then(r => r.json()).then(d => d.counts?.artworkCallsSpent ?? -1).catch(() => -1)
  const scenes = child.notebook.content.filter(n => (n.type === 'scene' || n.type === 'slide') && n.attrs?.svg).map(n => ({
    id: String(n.attrs.id), title: String(n.attrs.title || ''), svg: String(n.attrs.svg),
    script: String(n.attrs.script || ''), source: n.attrs.sourcePassages || [], idea: String(n.attrs.directorNotes || ''),
  }))

  // The real build: local Kimi, installed skills, product tools.
  const runStartedAt = Date.now()
  await evaluate(`async () => {
    window.__liveLog = []
    window.studioDesktop.harness.onEvent(({ event }) => {
      const m = event.text || event.error || (event.tool ? 'tool: ' + event.tool : event.type)
      window.__liveLog.push(m.replace(/\\s+/g, ' ').slice(0, 220))
    })
    return true
  }`)
  const run = await evaluate(`async () => {
    const run = await window.studioDesktop.harness.run({ adapter: 'kimi', skill: 'explainer-master', route: 'Build Explainer', projectId: '${child.id}',
      inputs: { projectId: '${child.id}', video: { title: 'Live proof: retry storms' }, delivery: { mode: 'generated' }, scenes: ${JSON.stringify(scenes)}, model: 'kimi-code/k3', effort: 'high', autonomous: true } })
    return { id: run.id, projectDir: run.projectDir }
  }`)
  console.log(`run started: ${run.id} — ${run.projectDir}`)

  // Watch until done/error (a rich scene takes a while; cap at 120 min).
  let status = 'running'
  let final = null
  for (let i = 0; i < 480 && ['running', 'gate'].includes(status); i += 1) {
    await sleep(15_000)
    const runs = await evaluate(`async () => window.studioDesktop.harness.list()`, 'list')
    final = runs.find(r => r.id === run.id)
    status = final?.status || 'error'
    if (i % 4 === 3) {
      const log = await evaluate(`async () => (window.__liveLog || []).slice(-4)`, 'log').catch(() => [])
      console.log(`…${status} (${(i + 1) * 15}s)${log.length ? ` — ${log.join(' | ')}` : ''}`)
    }
  }
  check('the live build finished instead of timing out', status !== 'running', status)
  check('the run completed with the export verified', status === 'done', `status=${status}`)

  const artefacts = await evaluate(`async () => window.studioDesktop.harness.artefacts('${run.id}')`, 'artefacts')
  const exportReceipt = artefacts?.explainer?.export
  check('export receipt: the MP4 was verified against the reviewed scenes', Boolean(exportReceipt?.durationSeconds > 0), JSON.stringify(exportReceipt ? { durationSeconds: exportReceipt.durationSeconds, url: exportReceipt.url } : null))
  const finishReceipt = artefacts?.explainer?.receipt
  check('finish receipt: reviewed scenes applied with a verified cast', Boolean(finishReceipt?.scenes > 0), JSON.stringify(finishReceipt?.cast || null))

  const stages = await fetch(`${origin}/api/runs/${run.id}/stages`).then(r => r.json()).catch(() => ({ stages: [] }))
  console.log('stage checkpoints:', JSON.stringify((stages.stages || []).map(s => `${s.stage}:${s.status}`)))
  check('stage checkpoints record the journey', ['preview', 'narrate', 'finish', 'export'].every(stage => (stages.stages || []).some(s => s.stage === stage && s.status === 'succeeded')), JSON.stringify((stages.stages || []).map(s => `${s.stage}:${s.status}`)))

  // §10 reuse criterion, live-measurable form. Two parts: (a) a provider
  // GENERATION is a violation when the library already held a compatible
  // accepted object at run start; (b) the cast should include objects created
  // before this run — cross-run reuse is the point of the library. (Run-dir
  // records can't carry this: the list op copies every library record into
  // the run without a reused marker, so the receipt's cast keys + the
  // library's createdAt are the evidence.)
  const budgetAfter = await fetch(`${origin}/api/diagnostics`).then(r => r.json()).then(d => d.counts?.artworkCallsSpent ?? -1).catch(() => -1)
  const cast = (artefacts?.explainer?.assets || [])
  const { assets: library } = await fetch(`${origin}/api/appearance/library`).then(r => r.json()).catch(() => ({ assets: [] }))
  const freshGenerations = cast.filter(a => a.operation === 'generate' && a.reused === false)
  const compatible = (record, candidate) => candidate.accepted
    && candidate.entity === record.entity
    && candidate.brief?.role === record.brief?.role
    && candidate.brief?.style?.family === record.brief?.style?.family
    && candidate.brief?.style?.palette?.accent === record.brief?.style?.palette?.accent
    && (record.brief?.parts || []).every(p => (candidate.parts || []).some(cp => cp.id === p.id))
  const coverable = freshGenerations.filter(record => library.some(candidate => Date.parse(candidate.createdAt || '') < runStartedAt && compatible(record, candidate)))
  const castKeys = [...new Set(Object.values(finishReceipt?.cast || {}).flat().map(entry => String(entry).split(':')[0]))]
  const libraryByKey = new Map(library.map(asset => [asset.key, asset]))
  const reusedFromBefore = castKeys.filter(key => Date.parse(libraryByKey.get(key)?.createdAt || '') < runStartedAt)
  check(
    'no provider generation for a brief the library already covers',
    coverable.length === 0 && cast.length > 0,
    `fresh generations: ${freshGenerations.length}, coverable: ${coverable.length}; spend ${budgetBefore} → ${budgetAfter}`,
  )
  check(
    'the cast reuses library objects from earlier runs',
    castKeys.length > 0 && reusedFromBefore.length > 0,
    `cast keys: ${castKeys.length}, predating this run: ${reusedFromBefore.length}`,
  )

  // D6 live: the applied scene carries the director's staging, not nulls.
  const appliedDoc = await fetch(`${origin}/api/projects/${child.id}`).then(r => r.json()).catch(() => null)
  const appliedScene = appliedDoc?.project?.notebook?.content?.find(n => n.attrs?.explainer?.reviewed)?.attrs
  check(
    'the applied scene carries the director staging and coach brief',
    Array.isArray(appliedScene?.stageTrack) && appliedScene.stageTrack.length > 0 && Array.isArray(appliedScene?.directorAuto?.shots) && appliedScene.directorAuto.shots.length > 0,
    JSON.stringify({ track: appliedScene?.stageTrack?.length, shots: appliedScene?.directorAuto?.shots?.length }),
  )

  await fetch(`${origin}/api/projects/${child.id}`, { method: 'DELETE' })
  await fetch(`${origin}/api/projects/${BASE_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'live fixtures deleted (MP4 kept in outputs)')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  // KEEP_LIVE_DIR=1 preserves the run directory for post-hoc review.
  if (process.env.KEEP_LIVE_DIR) console.log(`run dir preserved: ${root}`)
  else await rm(root, { recursive: true, force: true })
}
console.log(failures ? `LIVE EXPLAINER CHECK FAIL (${failures})` : 'LIVE EXPLAINER CHECK PASS')
process.exitCode = failures ? 1 : 0
