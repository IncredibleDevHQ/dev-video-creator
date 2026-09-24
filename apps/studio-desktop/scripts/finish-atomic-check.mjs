// Issue #5 (P1) finish atomicity: narration validation and take clearing used
// to interleave inside the apply loop, so a scene with a stale narration hash
// failed the finish AFTER an earlier scene's take selection had been durably
// cleared. Now every scene validates before any side effect, and the durable
// /api/takes/clear calls fire only after the project PUT lands: an invalid
// final scene leaves all project content and take selections unchanged.
// Tool-bundle pattern per explainer-persistence-check.mjs (stubbed renderer).
import { build } from 'esbuild'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = await mkdtemp(join(tmpdir(), 'finish-atomic-'))
const projectDir = join(dir, 'run-finish-atomic')
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
  const finish = () => EXPLAINER_TOOLS.find(t => t.name === 'explainer_finish').call({ projectDir }, { origin: 'http://fixture' })

  // Two reviewed scenes; each scene's files hash consistently. Scene two's
  // narration receipt starts out stale — the failure the probe exercises.
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hashOf = (svg, program) => createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))
  const plan = { version: 2, steps: [{ motionWindowMs: 100, holdMs: 1900, actions: [] }] }
  const writeScene = async (name, svg, program, narrationHash) => {
    await writeFile(join(projectDir, 'explainer', `${name}.svg`), svg)
    await save(`explainer/${name}.program.json`, program)
    await save(`explainer/${name}.proof.json`, { hash: hashOf(svg, program), errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan, windows: [], durationMs: 2000 })
    await save(`explainer/${name}.narration.json`, { hash: narrationHash, audioUrl: `http://fixture/${name}.mp3` })
  }
  const programOne = { version: 1, cast: [], beats: [{ say: 'First the queue holds the work.', events: [] }] }
  const programTwo = { version: 1, cast: [], beats: [{ say: 'Then the worker drains it.', events: [] }] }
  const svgOne = '<svg xmlns="http://www.w3.org/2000/svg"><g id="queue"/></svg>'
  const svgTwo = '<svg xmlns="http://www.w3.org/2000/svg"><g id="worker"/></svg>'
  await writeScene('one', svgOne, programOne, hashOf(svgOne, programOne))
  await writeScene('two', svgTwo, programTwo, 'stale-hash-from-an-older-revision')
  await save('explainer/story.json', { scenes: [
    { id: 'one', file: 'one', title: 'Queue', question: 'Why?', answer: 'Backpressure.', review: 'States checked.', assets: [] },
    { id: 'two', file: 'two', title: 'Worker', question: 'How?', answer: 'It drains.', review: 'States checked.', assets: [] },
  ] })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'one', svg: 'wireframe-1', script: '' }, { id: 'two', svg: 'wireframe-2', script: '' }] })

  let project = {
    version: 1, id: 'video', title: 'Atomic finish fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [
      { type: 'scene', attrs: { id: 'one', svg: 'wireframe-1', script: '' } },
      { type: 'scene', attrs: { id: 'two', svg: 'wireframe-2', script: '' } },
    ] },
    fps: 30, width: 1920, height: 1080,
    blocks: { one: { nodeId: 'one', durationMs: 6000 }, two: { nodeId: 'two', durationMs: 6000 } },
    presenterTracks: {},
    recordedBlocks: { one: { blockId: 'one', recordingId: 'take-1', videoUrl: 'http://fixture/take-one.webm', durationMs: 4000, recordedAt: '2026-09-20T00:00:00.000Z', storage: 'local' } },
  }
  const pristine = JSON.stringify(project)
  let putCalls = 0
  const cleared = []
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.endsWith('/api/takes/clear')) { cleared.push(JSON.parse(options?.body || '{}')); return Response.json({ cleared: true }) }
    if (u.endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') { putCalls += 1; cleared.push(...(JSON.parse(options.body).clearTakeBlocks || []).map(blockId => ({ blockId }))); project = JSON.parse(options.body).project || JSON.parse(options.body) }
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  const refusal = await finish().then(() => '', error => String(error?.message || error))
  check('the stale final scene fails the finish', /two: narration or picture changed/.test(refusal), refusal.slice(0, 120))
  check('the failed finish never wrote the project', putCalls === 0, `putCalls=${putCalls}`)
  check('the failed finish cleared no take selection', cleared.length === 0, JSON.stringify(cleared))
  check('the project content and its selected take are untouched', JSON.stringify(project) === pristine && project.recordedBlocks?.one?.recordingId === 'take-1')

  // Repair the narration and the same finish applies both scenes, and only
  // then do the retired takes leave their durable selections.
  await save('explainer/two.narration.json', { hash: hashOf(svgTwo, programTwo), audioUrl: 'http://fixture/two.mp3' })
  const applied = await finish()
  check('the repaired finish applies', applied?.projectId === 'video' && putCalls === 1, JSON.stringify(applied).slice(0, 120))
  check('the unaligned takes retire once the apply landed', cleared.some(entry => entry.blockId === 'one') && cleared.some(entry => entry.blockId === 'two'), JSON.stringify(cleared))
  check('the applied document dropped the unaligned take', !project.recordedBlocks?.one)
  check('both scenes carry their narration', project.presenterTracks?.one?.[0]?.audioUrl === 'http://fixture/one.mp3' && project.presenterTracks?.two?.[0]?.audioUrl === 'http://fixture/two.mp3')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `FINISH ATOMIC CHECK FAIL (${failures})` : 'FINISH ATOMIC CHECK PASS')
process.exitCode = failures ? 1 : 0
