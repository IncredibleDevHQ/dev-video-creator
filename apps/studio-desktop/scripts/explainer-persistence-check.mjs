// Exercise the actual finish/export tools against an in-memory product API.
import { build } from 'esbuild'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = await mkdtemp(join(tmpdir(), 'explainer-persistence-'))
const previousFetch = globalThis.fetch
try {
  await build({ entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'), plugins: [{ name: 'unused-render-window', setup(b) {
    b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = () => {}; export const captureHiddenPage = () => {};' }))
  } }] })
  const { EXPLAINER_TOOLS, verifyExplainerExport } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const invoke = name => EXPLAINER_TOOLS.find(t => t.name === name).call({ projectDir: dir }, { origin: 'http://fixture' })
  await mkdir(join(dir, 'explainer')); await mkdir(join(dir, 'motion'))
  const save = (name, value) => writeFile(join(dir, name), JSON.stringify(value))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const program = { version: 1, cast: [], beats: [{ say: 'A complete explanation.', events: [] }] }
  // The notebook store (PG jsonb) reorders object keys; the product hashes a
  // canonical key order, so this fixture does the same.
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hash = createHash('sha256').update(svg).update(stable(program)).digest('hex')
  await writeFile(join(dir, 'explainer/scene.svg'), svg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 0, holdMs: 2000, actions: [] }] }, windows: [], durationMs: 2000 })
  await save('explainer/scene.narration.json', { hash, audioUrl: 'http://fixture/audio.mp3' })
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Mechanism', question: 'Why?', answer: 'Because.', review: 'States checked.', assets: [] }] })
  await save('motion/inputs.json', { projectId: 'video', scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })
  let project = { id: 'video', derivedFrom: { notebook: 'base' }, blocks: { scene: { nodeId: 'scene', durationMs: 6000 } }, notebook: { content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] } }
  const video = join(dir, 'fixture.mp4')
  const renderVideo = seconds => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30', '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/api/projects/video')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body)
      return Response.json({ project })
    }
    if (String(url).endsWith('/api/preview')) return Response.json({})
    if (String(url).endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (String(url).endsWith('/api/render')) return Response.json({ url: 'http://fixture/video.mp4', durationSeconds: 2 })
    if (String(url).endsWith('/video.mp4')) return new Response(await readFile(video))
    throw new Error(`Unexpected fixture URL: ${url}`)
  }
  await invoke('explainer_finish')
  assert.equal(project.blocks.scene.durationMs, 2000, 'Reviewed duration replaces the wireframe default')
  await invoke('explainer_finish')
  project.notebook.content[0].attrs.script = 'A concurrent user edit'
  await assert.rejects(invoke('explainer_finish'), /notebook changed/)
  project.notebook.content[0].attrs.script = program.beats[0].say
  console.log('PASS finish: reviewed duration, safe re-application, concurrent edit protection')
  // A store round-trip (PG jsonb reorders keys) is not an edit: re-finishing
  // must still recognize the applied scene.
  const reorder = value => JSON.parse(stable(value))
  project = reorder(project)
  await invoke('explainer_finish')
  console.log('PASS finish: a store round-trip with reordered keys is not a false edit')
  await save('explainer/export.json', { stale: true })
  renderVideo(1)
  await assert.rejects(invoke('explainer_export'), /Export duration/)
  await assert.rejects(access(join(dir, 'explainer/export.json')))
  console.log('PASS export: actual truncated MP4 rejected and stale success removed')
  renderVideo(2)
  await invoke('explainer_export')
  await verifyExplainerExport(dir)
  project = reorder(project)
  await invoke('explainer_export')
  console.log('PASS export: a store round-trip with reordered keys is not a false mismatch')
  const exported = JSON.parse(await readFile(join(dir, 'explainer/export.json')))
  exported.sceneHashes = ['stale']
  await save('explainer/export.json', exported)
  await assert.rejects(verifyExplainerExport(dir), /stale/)
  console.log('PASS completion: complete MP4 accepted, stale scene revision rejected')
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
