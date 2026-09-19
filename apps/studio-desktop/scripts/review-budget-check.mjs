// §5.5 review-budget check: a scene's preview loop is bounded; over the
// budget the tool returns the retained best proof and tells the agent to
// report the remaining issue instead of revising forever. Benign stubbed
// renderer (the loop logic is the subject). No app needed.
import { build } from 'esbuild'
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

process.env.STUDIO_REVIEW_BUDGET = '3'
const dir = await mkdtemp(join(tmpdir(), 'review-budget-'))
const projectDir = join(dir, 'run-budget')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
try {
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  await writeFile(join(projectDir, 'explainer', 'scene.program.json'), JSON.stringify({ version: 1, cast: [], beats: [{ say: 'A line.', events: [] }] }))
  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async (name, svg, program) => ({ errors: [], warnings: [], frames: [0], durationMs: 200, program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 100, actions: [] }] }, windows: [] }); export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const preview = EXPLAINER_TOOLS.find(t => t.name === 'explainer_preview')
  const context = { origin: 'http://fixture' }
  globalThis.fetch = async () => Response.json({ saved: true })

  for (let i = 0; i < 3; i += 1) {
    const ok = await preview.call({ projectDir, scene: 'scene' }, context)
    assert.deepEqual(ok.errors, [], `preview ${i + 1} should run`)
  }
  const fourth = await preview.call({ projectDir, scene: 'scene' }, context)
  check('the fourth preview is refused with the budget spent', fourth.errors.some(e => /review budget/i.test(e)), fourth.errors[0] || '')
  check('the retained best proof answers with its frames', Array.isArray(fourth.frames) && fourth.frames.length === 1)
  check('the refusal says what to do instead', /report the exact remaining issue|finish with the retained proof/.test(fourth.errors[0] || ''))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `REVIEW BUDGET CHECK FAIL (${failures})` : 'REVIEW BUDGET CHECK PASS')
process.exitCode = failures ? 1 : 0

