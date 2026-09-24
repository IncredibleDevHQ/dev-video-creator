// Issue #17 (P2): the reviewed export used to verify only svg/program/block
// duration, then rendered the saved project's separate motion, stage track
// and presenter/audio tracks — a post-finish edit to any of them exported
// unreviewed content under the reviewed label. The finish now pins the whole
// rendered performance per scene (scene revision + camera + duration +
// narration/take identity) into the receipt and the scene stamp, and the
// export refuses when the saved project no longer matches; re-applying an
// unchanged review re-pins and exports normally. Tool-bundle pattern per
// explainer-persistence-check.mjs (stubbed renderer, real ffmpeg fixture).
import { build } from 'esbuild'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const dir = await mkdtemp(join(tmpdir(), 'export-pin-'))
const projectDir = join(dir, 'run-export-pin')
const previousFetch = globalThis.fetch

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

try {
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async () => undefined; export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hashOf = (svg, program) => createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))

  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g id="queue"/></svg>'
  const program = { version: 1, cast: [], beats: [{ say: 'First the queue holds the work.', events: [] }] }
  const hash = hashOf(svg, program)
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 1900, actions: [] }] }, windows: [], durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash, audioUrl: 'http://fixture/reviewed-voice.mp3' })
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Queue', question: 'Why?', answer: 'Backpressure.', review: 'States checked.', assets: [] }] })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })

  const baseProject = () => ({
    version: 1, id: 'video', title: 'Export pin fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000, camera: { mode: 'information-circle', position: 'bottom-right', shape: 'circle', scale: 1 } } },
    presenterTracks: {}, recordedBlocks: {},
  })
  let project = baseProject()
  let renderCalls = 0
  const video = join(dir, 'fixture.mp4')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body).project || JSON.parse(options.body)
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    if (u.endsWith('/api/render')) { renderCalls += 1; return Response.json({ url: 'http://fixture/video.mp4', durationSeconds: 2 }) }
    if (u.endsWith('/video.mp4')) return new Response(await readFile(video))
    throw new Error(`Unexpected fixture URL: ${url}`)
  }
  const finish = () => tool('explainer_finish').call({ projectDir }, context)
  const exportScene = () => tool('explainer_export').call({ projectDir }, context)
  const refusalOf = promise => promise.then(() => '', error => String(error?.message || error))

  await finish()
  const receipt = JSON.parse(await readFile(join(projectDir, 'explainer', 'receipt.json'), 'utf8'))
  check('the finish pins the whole rendered performance', /^[0-9a-f]{64}$/.test(receipt.rendered?.scene || ''), String(receipt.rendered?.scene || '').slice(0, 16))
  const appliedNode = project.notebook.content.find(n => n.attrs?.id === 'scene')
  check('the scene stamp is that same pin (the UI badge reads the export contract)', appliedNode?.attrs?.explainer?.hash === receipt.rendered.scene)

  const exported = await exportScene()
  check('the pinned project exports', Number.isFinite(exported?.durationSeconds) && renderCalls === 1)

  // The probe: change the rendered motion, staging and audio after the finish.
  const mutations = [
    ['compiled motion', p => { p.notebook.content[0].attrs.motion.steps[0].holdMs = 4500 }],
    ['the stage track', p => { p.notebook.content[0].attrs.stageTrack = [{ family: 'speaker-full', atMs: 0 }] }],
    ['the narration track', p => { p.presenterTracks.scene = [{ kind: 'narration', audioUrl: 'http://fixture/swapped-voice.mp3', audioKind: 'generated' }] }],
    ['the camera framing', p => { p.blocks.scene.camera = { ...p.blocks.scene.camera, position: 'full' } }],
    ['the selected take', p => { p.recordedBlocks = { scene: { blockId: 'scene', recordingId: 'take-x', videoUrl: 'http://fixture/take.webm', durationMs: 3000, recordedAt: '2026-09-20T00:00:00.000Z', storage: 'local' } } }],
    ['the block duration', p => { p.blocks.scene.durationMs = 9999 }],
  ]
  for (const [label, mutate] of mutations) {
    const mutated = JSON.parse(JSON.stringify(project))
    mutate(mutated)
    const saved = project
    project = mutated
    const refusal = await refusalOf(exportScene())
    check(`changing ${label} after the finish invalidates the export`, /differs from its reviewed performance/.test(refusal), refusal.slice(0, 110))
    project = saved
  }
  check('no refused export rendered anything', renderCalls === 1, `renderCalls=${renderCalls}`)

  // A legitimate update: re-applying the unchanged review re-pins the
  // presentation (the take the run never aligned retires by design), and the
  // export proceeds.
  const mutated = JSON.parse(JSON.stringify(project))
  mutated.presenterTracks.scene = [{ kind: 'narration', audioUrl: 'http://fixture/swapped-voice.mp3', audioKind: 'generated' }]
  project = mutated
  await finish()
  const reExported = await exportScene()
  check('re-applying the unchanged review re-pins and exports', Number.isFinite(reExported?.durationSeconds) && renderCalls === 2)
  check('the re-applied scene carries the reviewed narration again', project.presenterTracks.scene[0].audioUrl === 'http://fixture/reviewed-voice.mp3')

  // A store round-trip (PG jsonb reorders keys) is not a rendered change.
  const reorder = value => JSON.parse(stable(value))
  project = reorder(project)
  const afterRoundTrip = await exportScene()
  check('a store round-trip is not a false pin mismatch', Number.isFinite(afterRoundTrip?.durationSeconds) && renderCalls === 3)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `EXPORT PIN CHECK FAIL (${failures})` : 'EXPORT PIN CHECK PASS')
process.exitCode = failures ? 1 : 0
