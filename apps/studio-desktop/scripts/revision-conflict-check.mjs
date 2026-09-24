// Issue #6 (P1): the finish's concurrent-edit guard used to compare only the
// scene's svg and script, so beat-motion, staging or layout edits made while
// a run was live were silently overwritten when the run applied. The build
// now captures the complete scene revision at dispatch (inputs.scenes[].revision,
// hashed with the shared scene-revision contract), and the finish refuses —
// nothing written — while the reviewed candidate stays in the run. Runs
// dispatched before the capture keep the legacy svg/script compare.
// Tool-bundle pattern per finish-atomic-check.mjs (stubbed renderer).
import { build } from 'esbuild'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = await mkdtemp(join(tmpdir(), 'revision-conflict-'))
const projectDir = join(dir, 'run-revision')
const previousFetch = globalThis.fetch

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

try {
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeFile(join(dir, 'entry.ts'), [
    `export { EXPLAINER_TOOLS } from ${JSON.stringify(fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url)))}`,
    `export { sceneRevisionPayload } from ${JSON.stringify(fileURLToPath(new URL('../../studio-v2/src/scene-revision.ts', import.meta.url)))}`,
  ].join('\n'))
  await build({
    entryPoints: [join(dir, 'entry.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async () => undefined; export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS, sceneRevisionPayload } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const finish = () => EXPLAINER_TOOLS.find(t => t.name === 'explainer_finish').call({ projectDir }, { origin: 'http://fixture' })

  // The product hashes a canonical key order (PG jsonb reorders keys).
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hashOf = (svg, program) => createHash('sha256').update(svg).update(stable(program)).digest('hex')
  // The run-start revision, exactly the way the dispatch and the finish
  // derive it: the scene svg hashed with the canonical direction payload.
  const revisionOf = attrs => createHash('sha256').update(String(attrs.svg || '')).update(stable(sceneRevisionPayload(attrs))).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))

  // The reviewed candidate in the run, and the page as the run started: a
  // wireframe carrying its own editable direction (program, motion, staging).
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g id="queue"/></svg>'
  const program = { version: 1, cast: [], beats: [{ say: 'First the queue holds the work.', events: [] }] }
  const plan = { version: 2, steps: [{ motionWindowMs: 100, holdMs: 1900, actions: [] }] }
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash: hashOf(svg, program), errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan, windows: [], durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash: hashOf(svg, program), audioUrl: 'http://fixture/scene.mp3' })
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Queue', question: 'Why?', answer: 'Backpressure.', review: 'States checked.', assets: [] }] })

  const runStartAttrs = () => ({
    id: 'scene', title: 'Queue', svg: 'wireframe', script: '',
    program: { version: 1, cast: [], beats: [{ say: 'Draft words.', events: [] }] },
    motion: { version: 2, steps: [{ motionWindowMs: 300, holdMs: 900, actions: [] }] },
    windows: [{ say: 'Draft words.', parts: ['queue'] }],
    stageTrack: [{ family: 'content-full', atMs: 0 }],
    stagePlacements: null, directorAuto: { storyboard: [] }, directorNotes: '', sourceText: '',
  })
  const baseProject = () => ({
    version: 1, id: 'video', title: 'Revision fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: runStartAttrs() }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {},
  })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '', revision: revisionOf(runStartAttrs()) }] })

  let project = baseProject()
  let putCalls = 0
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') { putCalls += 1; project = JSON.parse(options.body).project || JSON.parse(options.body) }
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  // Baseline: the untouched page takes the reviewed candidate.
  const applied = await finish()
  check('an untouched page applies cleanly', applied?.projectId === 'video' && putCalls === 1, JSON.stringify(applied).slice(0, 100))
  const receipt = JSON.parse(await readFile(join(projectDir, 'explainer', 'receipt.json'), 'utf8'))
  check('the receipt pins the complete applied revision', receipt.applied?.scene === revisionOf(project.notebook.content[0].attrs), String(receipt.applied?.scene || '').slice(0, 16))

  // The probe from the review: the page's program moved (svg/script did not).
  project = baseProject()
  project.notebook.content[0].attrs.program.beats[0].say = 'The user re-timed this beat while the run was live.'
  const refusal = await finish().then(() => '', error => String(error?.message || error))
  check('a mid-run program edit is a reviewable conflict', /notebook changed during generation/.test(refusal), refusal.slice(0, 120))
  check('the refused finish never wrote the project', putCalls === 1, `putCalls=${putCalls}`)
  check('the user’s edit is preserved', project.notebook.content[0].attrs.program.beats[0].say.includes('re-timed'))

  // Same for compiled motion and for camera/layout direction.
  project = baseProject()
  project.notebook.content[0].attrs.motion.steps[0].holdMs = 4500
  const motionRefusal = await finish().then(() => '', error => String(error?.message || error))
  check('a mid-run motion edit conflicts too', /notebook changed during generation/.test(motionRefusal) && putCalls === 1, motionRefusal.slice(0, 100))

  project = baseProject()
  project.notebook.content[0].attrs.stageTrack = [{ family: 'speaker-panel', atMs: 0 }]
  project.notebook.content[0].attrs.directorAuto = { storyboard: [{ family: 'speaker-panel', beats: [0] }] }
  const stagingRefusal = await finish().then(() => '', error => String(error?.message || error))
  check('a mid-run camera/layout edit conflicts too', /notebook changed during generation/.test(stagingRefusal) && putCalls === 1, stagingRefusal.slice(0, 100))

  // The conflict is reviewable, not destructive: the untouched page still applies.
  project = baseProject()
  const retried = await finish()
  check('the reviewed candidate still applies over the untouched page', retried?.projectId === 'video' && putCalls === 2)
  const reapplied = await finish()
  check('re-application is safe on the new revision recipe', reapplied?.projectId === 'video' && putCalls === 3)

  // Runs dispatched before the capture keep the legacy svg/script compare.
  project = baseProject()
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })
  await rm(join(projectDir, 'explainer', 'receipt.json'), { force: true })
  project.notebook.content[0].attrs.program.beats[0].say = 'Edited under a legacy run.'
  const legacy = await finish()
  check('a legacy run without a captured revision still applies (svg/script compare)', legacy?.projectId === 'video' && putCalls === 4, JSON.stringify(legacy).slice(0, 100))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `REVISION CONFLICT CHECK FAIL (${failures})` : 'REVISION CONFLICT CHECK PASS')
process.exitCode = failures ? 1 : 0
