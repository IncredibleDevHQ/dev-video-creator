// D3 lineage check: the rich explainer finish no longer demands one
// derivative per input scene. A merge folds two pages into one surviving
// node whose origin lists both base scenes; a split clones new nodes from
// the page they came from and retires the original; uncovered inputs and
// unknown covers are rejected. Runs the real finish tool against an
// in-memory product API, per explainer-persistence-check.mjs.
import { build } from 'esbuild'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const dir = await mkdtemp(join(tmpdir(), 'explainer-lineage-'))
let failures = 0
const check = (label, fn) => {
  try {
    fn()
    console.log(`PASS  ${label}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${label}  ${String(error.message || error).slice(0, 200)}`)
  }
}
try {
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'),
    plugins: [{ name: 'unused-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const runAtomizer = async name => name === 'reviewObjectClip' ? { errors: [], warnings: [], captures: [{ clipId: 'clip-1', atMs: 0, label: 'rest' }], clips: [{ id: 'clip-1', durationMs: 1000 }], fidelity: null } : undefined; export const captureHiddenPage = async () => Buffer.from([]);` }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const invoke = (name, args = {}) => EXPLAINER_TOOLS.find(t => t.name === name).call({ projectDir: dir, ...args }, { origin: 'http://fixture' })

  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const program = { version: 1, cast: [], beats: [{ say: 'A complete explanation.', events: [] }] }
  // The product hashes a canonical key order (PG jsonb reorders keys).
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hash = createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(dir, name), JSON.stringify(value))
  const writeSceneFiles = async () => {
    await mkdir(join(dir, 'explainer'), { recursive: true })
    await mkdir(join(dir, 'motion'), { recursive: true })
    await writeFile(join(dir, 'explainer/scene.svg'), svg)
    await save('explainer/scene.program.json', program)
    await save('explainer/scene.proof.json', { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 0, holdMs: 2000, actions: [] }] }, windows: [], durationMs: 2000 })
    await save('explainer/scene.narration.json', { hash, audioUrl: 'http://fixture/audio.mp3' })
  }

  const baseProject = () => ({
    id: 'video',
    derivedFrom: { notebook: 'base' },
    blocks: {
      'scene-a': { nodeId: 'scene-a', durationMs: 6000 },
      'scene-b': { nodeId: 'scene-b', durationMs: 6000 },
      'scene-c': { nodeId: 'scene-c', durationMs: 6000 },
    },
    presenterTracks: {},
    notebook: { type: 'doc', content: [
      { type: 'scene', attrs: { id: 'scene-a', title: 'A', svg: 'wire-a', script: '', origin: { notebook: 'base', scene: 'base-a', scenes: ['base-a'] } } },
      { type: 'scene', attrs: { id: 'scene-b', title: 'B', svg: 'wire-b', script: '', origin: { notebook: 'base', scene: 'base-b', scenes: ['base-b'] } } },
      { type: 'scene', attrs: { id: 'scene-c', title: 'C', svg: 'wire-c', script: '', origin: { notebook: 'base', scene: 'base-c', scenes: ['base-c'] } } },
    ] },
  })
  const INPUTS = { projectId: 'video', scenes: [
    { id: 'scene-a', svg: 'wire-a', script: '' },
    { id: 'scene-b', svg: 'wire-b', script: '' },
    { id: 'scene-c', svg: 'wire-c', script: '' },
  ] }

  let project
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body).project || JSON.parse(options.body)
      return Response.json({ project })
    }
    if (String(url).endsWith('/api/preview')) return Response.json({})
    if (String(url).endsWith('/api/appearance/verify-cast')) {
      const sceneSvg = String(JSON.parse(options?.body || '{}').svg || '')
      const forged = sceneSvg.includes('data-appearance-key') && !sceneSvg.includes('data-appearance-key="c0ffee00cafe1234"')
      return Response.json(forged
        ? { ok: false, cast: [{ key: 'forged-key', status: 'unknown', tokensFound: 0, tokensTotal: 0 }] }
        : { ok: true, cast: sceneSvg.includes('c0ffee00cafe1234') ? [{ key: 'c0ffee00cafe1234', status: 'verified', tokensFound: 3, tokensTotal: 3 }] : [] })
    }
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  const storyScene = (id, covers) => ({ id, file: 'scene', title: 'Mechanism', question: 'Why?', answer: 'Because.', review: 'States checked.', assets: [], ...(covers ? { covers } : {}) })
  const story = async scenes => save('explainer/story.json', { scenes })

  // ——— Merge: scene-a covers scene-b; scene-c stays 1:1 ———
  project = baseProject()
  await writeSceneFiles()
  await save('motion/inputs.json', INPUTS)
  await story([storyScene('scene-a', ['scene-a', 'scene-b']), storyScene('scene-c')])
  await invoke('explainer_finish')
  check('merge folds scene-b into scene-a and removes its node', () => {
    const ids = project.notebook.content.map(n => n.attrs.id)
    assert.deepEqual(ids, ['scene-a', 'scene-c'])
    assert.equal(project.blocks['scene-b'], undefined)
  })
  check('the survivor’s origin lists both base scenes', () => {
    const a = project.notebook.content[0].attrs
    assert.deepEqual(a.origin.scenes, ['base-a', 'base-b'])
    assert.equal(a.origin.notebook, 'base')
  })
  check('reviewed stamps and durations applied on merge', () => {
    assert.equal(project.notebook.content[0].attrs.explainer.reviewed, true)
    assert.equal(project.blocks['scene-a'].durationMs, 2000)
  })

  // ——— Split: scene-a becomes a1 + a2; the original retires ———
  project = baseProject()
  await writeSceneFiles()
  await save('motion/inputs.json', INPUTS)
  await rm(join(dir, 'explainer', 'receipt.json'), { force: true })
  await story([storyScene('scene-a1', ['scene-a']), storyScene('scene-a2', ['scene-a']), storyScene('scene-b'), storyScene('scene-c')])
  await invoke('explainer_finish')
  check('split clones two nodes from the original and retires it', () => {
    const ids = project.notebook.content.map(n => n.attrs.id)
    assert.deepEqual(ids, ['scene-a1', 'scene-a2', 'scene-b', 'scene-c'])
  })
  check('both halves keep the base origin', () => {
    const [a1, a2] = project.notebook.content
    assert.deepEqual(a1.attrs.origin.scenes, ['base-a'])
    assert.deepEqual(a2.attrs.origin.scenes, ['base-a'])
    assert.equal(a1.attrs.explainer.reviewed, true)
  })

  // ——— Rejections ———
  project = baseProject()
  await rm(join(dir, 'explainer', 'receipt.json'), { force: true })
  await story([storyScene('scene-a'), storyScene('scene-b')])
  await assert.rejects(invoke('explainer_finish'), /nothing covers: scene-c/)
  console.log('PASS  an uncovered input scene is rejected')
  await story([storyScene('scene-a', ['scene-a', 'nope']), storyScene('scene-b'), storyScene('scene-c')])
  await assert.rejects(invoke('explainer_finish'), /unknown input scene "nope"/)
  console.log('PASS  unknown covers are rejected')
  // §5.4a: an object that performs must carry an isolated review receipt.
  const clipSvg = '<svg xmlns="http://www.w3.org/2000/svg"><g data-appearance-key="c0ffee00cafe1234"><svg id="clip-1" data-object-clip="1" data-duration-ms="1000"><circle cx="5" cy="5" r="4"><animate attributeName="r" values="4;6;4" dur="1s" fill="freeze"/></circle></svg></g></svg>'
  const clipHash = createHash('sha256').update(clipSvg).update(stable(program)).digest('hex')
  await writeFile(join(dir, 'explainer/scene.svg'), clipSvg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash: clipHash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 0, holdMs: 2000, actions: [] }] }, windows: [], durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash: clipHash, audioUrl: 'http://fixture/audio.mp3' })
  await story([storyScene('scene-a'), storyScene('scene-b'), storyScene('scene-c')])
  await assert.rejects(invoke('explainer_finish'), /isolated review/)
  console.log('PASS  a performing object without an isolated review is refused')
  // The receipt must bind the exact embedded performance (issue #15): write
  // the accepted asset and run the real review tool so the receipt it writes
  // covers this scene's clip revision, then the finish lets it through.
  await mkdir(join(dir, 'explainer', 'assets'), { recursive: true })
  await save('explainer/assets/c0ffee00cafe1234.json', { key: 'c0ffee00cafe1234', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><svg id="clip" data-object-clip="1" data-duration-ms="1000"><circle cx="5" cy="5" r="4"><animate attributeName="r" values="4;6;4" dur="1s" fill="freeze"/></circle></svg></svg>' })
  await invoke('explainer_review_object', { key: 'c0ffee00cafe1234' })
  await invoke('explainer_finish')
  check('the isolated review receipt lets the performed object through', () => {
    assert.equal(project.blocks['scene-a'].durationMs, 2000)
  })

  // §3.9: staleness is data the harness reads before re-running anything.
  const statusFresh = await invoke('explainer_status')
  check('after a finish, every scene reports fresh', () => {
    assert.equal(statusFresh.fresh, true)
    assert.deepEqual(statusFresh.scenes.map(s => s.stale), [[], [], []])
  })
  const edited = JSON.parse(await readFile(join(dir, 'explainer', 'scene.program.json'), 'utf8'))
  edited.beats[0].say = 'A rewritten line.'
  await save('explainer/scene.program.json', edited)
  const statusStale = await invoke('explainer_status')
  check('editing the program marks preview and narration stale, without touching the notebook', () => {
    assert.equal(statusStale.fresh, false)
    const stale = statusStale.scenes[0].stale.join('; ')
    assert.match(stale, /changed since the preview proof/)
    assert.match(stale, /narration predates/)
    assert.doesNotMatch(stale, /notebook diverged/)
  })
  // A forged artwork marker is not proof: the cast receipt refuses it (D4).
  await writeFile(join(dir, 'explainer/scene.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><g data-appearance-key="forged-key"><rect width="10" height="10"/></g></svg>')
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash: createHash('sha256').update('<svg xmlns="http://www.w3.org/2000/svg"><g data-appearance-key="forged-key"><rect width="10" height="10"/></g></svg>').update(stable(program)).digest('hex'), errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 0, holdMs: 2000, actions: [] }] }, windows: [], durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash: createHash('sha256').update('<svg xmlns="http://www.w3.org/2000/svg"><g data-appearance-key="forged-key"><rect width="10" height="10"/></g></svg>').update(stable(program)).digest('hex'), audioUrl: 'http://fixture/audio.mp3' })
  await story([storyScene('scene-a'), storyScene('scene-b'), storyScene('scene-c')])
  await assert.rejects(invoke('explainer_finish'), /not verified against the library/)
  console.log('PASS  a forged artwork marker cannot pass rich completion')
} catch (error) {
  failures += 1
  console.log(`FAIL  run: ${error.message}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `EXPLAINER LINEAGE CHECK FAIL (${failures})` : 'EXPLAINER LINEAGE CHECK PASS')
process.exitCode = failures ? 1 : 0
