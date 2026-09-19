// §3.7/§5.5 human-path guard: on a human-delivery run, explainer_narrate
// refuses — generated speech never substitutes for an unrecorded presenter
// segment — and the run is left durably `needs-input` (waiting for a person),
// not failed. The generated path and delivery-less legacy runs are untouched.
// Tool-bundle pattern per take-alignment-e2e-check.mjs (no model needed: the
// guard fires before any voice or alignment work).
import { build } from 'esbuild'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const dir = await mkdtemp(join(tmpdir(), 'narrate-guard-'))
const stageCalls = []

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

try {
  // The real tool bundle, with the hidden renderer stubbed to a benign pass.
  // Layout mirrors production: dist-electron/tools.mjs with ../skills beside
  // it, the way dist-electron/worker.mjs resolves the vendored aligner.
  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async () => ({ errors: [], warnings: [], frames: [], durationMs: 1 }); export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const narrate = EXPLAINER_TOOLS.find(t => t.name === 'explainer_narrate')
  check('explainer_narrate is in the tool set', Boolean(narrate))

  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/runs/') && u.endsWith('/stages')) {
      stageCalls.push(JSON.parse(options?.body || '{}'))
      return Response.json({ saved: true })
    }
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  const runDir = async (name, inputs) => {
    const projectDir = join(dir, name)
    await mkdir(join(projectDir, 'motion'), { recursive: true })
    await writeFile(join(projectDir, 'motion', 'inputs.json'), JSON.stringify(inputs))
    return projectDir
  }
  const errorOf = fn => fn().then(() => '', error => String(error?.message || error))

  try {
    // Human delivery: refuse, and leave the run waiting for a person.
    const humanDir = await runDir('run-human-guard', { projectId: 'nb', delivery: { mode: 'human' }, scenes: [{ id: 'scene' }] })
    const refusal = await errorOf(() => narrate.call({ projectDir: humanDir, scene: 'scene' }, { origin: 'http://fixture' }))
    check('narrate refuses the human delivery path', /human delivery path/.test(refusal) && /explainer_align_take/.test(refusal), refusal.slice(0, 120))
    const checkpoint = stageCalls.find(c => c.stage === 'narrate' && c.status === 'needs-input')
    check('the refusal leaves a durable needs-input checkpoint', Boolean(checkpoint && checkpoint.detail?.scene === 'scene'), JSON.stringify(checkpoint || null))

    // Generated delivery: the guard stays out of the way — the call proceeds
    // into the real work (and fails here only because the fixture has no
    // program file, an error about the program, not about delivery).
    const generatedDir = await runDir('run-generated-control', { projectId: 'nb', delivery: { mode: 'generated' }, scenes: [{ id: 'scene' }] })
    const generated = await errorOf(() => narrate.call({ projectDir: generatedDir, scene: 'scene' }, { origin: 'http://fixture' }))
    check('the generated path is not refused', Boolean(generated) && !/human delivery path/.test(generated), generated.slice(0, 90))

    // Legacy run inputs carry no delivery mode: same non-refusal.
    const legacyDir = await runDir('run-legacy-control', { projectId: 'nb', scenes: [{ id: 'scene' }] })
    const legacy = await errorOf(() => narrate.call({ projectDir: legacyDir, scene: 'scene' }, { origin: 'http://fixture' }))
    check('a delivery-less run is not refused', Boolean(legacy) && !/human delivery path/.test(legacy), legacy.slice(0, 90))
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `NARRATE GUARD CHECK FAIL (${failures})` : 'NARRATE GUARD CHECK PASS')
process.exitCode = failures ? 1 : 0
