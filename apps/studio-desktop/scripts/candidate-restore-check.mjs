// Issue #16 (P2): the retained "best candidate" used to be unrecoverable —
// every review wrote frames over the same scene/time filenames and only the
// best proof JSON survived, so after a failed revision the passing result's
// frames (and its SVG/program) were gone. Previews now write frames under the
// revision's content address, every passing revision is snapshotted
// (artwork, program, proof), and explainer_restore puts a retained candidate
// back exactly. Acceptance: pass A → fail B → budget exhausted can restore
// and finish A with A's original frames. Stubbed renderer; no app needed.
import { build } from 'esbuild'
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

process.env.STUDIO_REVIEW_BUDGET = '2'
const dir = await mkdtemp(join(tmpdir(), 'candidate-restore-'))
const projectDir = join(dir, 'run-restore')
const previousFetch = globalThis.fetch

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><!--rev-A--><g id="queue"/></svg>'
const SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><!--rev-B BROKEN--><g id="queue"/></svg>'
const programA = { version: 1, cast: [], beats: [{ say: 'First the queue holds the work.', events: [] }] }
const programB = { version: 1, cast: [], beats: [{ say: 'A worse rewrite.', events: [] }] }

try {
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  // The stubbed hidden window mirrors production: reviewExplainer loads the
  // svg, explainerFrame seeks it, captureHiddenPage returns whatever is shown
  // — so a frame's bytes identify the revision they were captured from.
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: [
        'let shown = ""',
        'export const runAtomizer = async (name, svg, program) => {',
        '  if (name === "reviewExplainer") { shown = /rev-([AB])/.exec(svg)?.[1] || "?"; return { errors: svg.includes("BROKEN") ? ["the mechanism renders wrong"] : [], warnings: [], frames: [0], durationMs: 200, program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 100, actions: [] }] }, windows: [] } }',
        '  if (name === "explainerFrame") return { ms: 0 }',
        '  return undefined',
        '}',
        'export const captureHiddenPage = async () => Buffer.from(`frame-bytes-${shown}`)',
      ].join('\n') }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hashOf = (svg, program) => createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))
  const hashA = hashOf(SVG_A, programA)
  const hashB = hashOf(SVG_B, programB)
  const framePathOf = hash => join(projectDir, 'explainer', 'review', 'scene', hash.slice(0, 12), '0000000.png')

  await writeFile(join(projectDir, 'explainer', 'scene.svg'), SVG_A)
  await save('explainer/scene.program.json', programA)
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Queue', question: 'Why?', answer: 'Backpressure.', review: 'States checked.', assets: [] }] })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })
  // Revision A was narrated before the failed revision happened.
  await save('explainer/scene.narration.json', { hash: hashA, audioUrl: 'http://fixture/scene.mp3' })

  let project = {
    version: 1, id: 'video', title: 'Restore fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {},
  }
  let putCalls = 0
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') { putCalls += 1; project = JSON.parse(options.body) }
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  // Pass A.
  const previewA = await tool('explainer_preview').call({ projectDir, scene: 'scene' }, context)
  check('revision A passes review', previewA.errors.length === 0 && previewA.frames.length === 1, JSON.stringify(previewA.errors))
  check('A\'s frames live under A\'s content address', previewA.frames[0].path === framePathOf(hashA), previewA.frames[0].path)
  check('A\'s frames are A\'s capture', (await readFile(framePathOf(hashA), 'utf8')) === 'frame-bytes-A')
  const candidateA = join(projectDir, 'explainer', 'candidates', 'scene', hashA.slice(0, 12))
  check('A is snapshotted as an immutable candidate', Boolean(await access(join(candidateA, 'scene.svg')).then(() => true, () => false)))

  // Fail B: the working copy and the current proof move on to B.
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), SVG_B)
  await save('explainer/scene.program.json', programB)
  const previewB = await tool('explainer_preview').call({ projectDir, scene: 'scene' }, context)
  check('revision B fails review', previewB.errors.length === 1, JSON.stringify(previewB.errors))
  check('B\'s frames went to B\'s own address', previewB.frames[0].path === framePathOf(hashB))
  check('A\'s frames survived B\'s failed review', (await readFile(framePathOf(hashA), 'utf8')) === 'frame-bytes-A')
  const best = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.best-proof.json'), 'utf8'))
  check('the retained best is still A', best.hash === hashA, best.hash.slice(0, 12))
  const noCandidateB = await access(join(projectDir, 'explainer', 'candidates', 'scene', hashB.slice(0, 12))).then(() => false, () => true)
  check('a failed revision is never snapshotted', noCandidateB)

  // Budget exhausted: the refusal names the restore path and answers with A.
  const refused = await tool('explainer_preview').call({ projectDir, scene: 'scene' }, context)
  check('the spent budget refuses another revision', refused.errors.some(e => /review budget/i.test(e)), refused.errors[0] || '')
  check('the refusal names the restore path', /explainer_restore/.test(refused.errors[0] || ''), refused.errors[0] || '')
  check('the refusal answers with A\'s proof and frames', refused.frames?.[0]?.path === framePathOf(hashA))

  // Restore A and finish with it — its original frames, not B's.
  const restored = await tool('explainer_restore').call({ projectDir, scene: 'scene' }, context)
  check('restore returns the retained candidate', restored.hash === hashA, String(restored.hash).slice(0, 12))
  check('the working copy is A again', (await readFile(join(projectDir, 'explainer', 'scene.svg'), 'utf8')) === SVG_A)
  const proof = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.proof.json'), 'utf8'))
  check('the working proof is A\'s with A\'s original frames', proof.hash === hashA && proof.frames[0].path === framePathOf(hashA))
  check('A\'s frames are still A\'s capture after the whole loop', (await readFile(proof.frames[0].path, 'utf8')) === 'frame-bytes-A')

  const finished = await tool('explainer_finish').call({ projectDir }, context)
  check('the restored candidate finishes', finished?.projectId === 'video' && putCalls === 1, JSON.stringify(finished).slice(0, 100))
  check('the applied scene is A', project.notebook.content[0].attrs.svg === SVG_A)

  const badHash = await tool('explainer_restore').call({ projectDir, scene: 'scene', hash: hashB }, context).then(() => '', error => String(error?.message || error))
  check('a failed revision cannot be restored', /No retained candidate/.test(badHash), badHash.slice(0, 100))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `CANDIDATE RESTORE CHECK FAIL (${failures})` : 'CANDIDATE RESTORE CHECK PASS')
process.exitCode = failures ? 1 : 0
