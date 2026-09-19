// Release suite (D7): every journey/storage/lineage check in one run, with a
// summary. Unit gates run first, then each scripted check against fresh smoke
// apps. The live-provider and real-presenter proofs are separate by design —
// this suite is the deterministic half of the release evidence.
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

const UNIT_GATES = [
  ['yarn', ['studio:test'], 'unit: node-identifier + markdown-composition + studio-v2 typecheck'],
  ['yarn', ['workspace', 'studio-v2', 'test'], 'unit: studio-v2 suite'],
]
const CHECKS = [
  'create-explainer-check.mjs',   // D0: delivery paths, no default, draft labels, badges, rename
  'migration-check.mjs',          // D0a: legacy file store → PostgreSQL/MinIO import
  'theme-library-check.mjs',      // D1: durable revisioned themes, restart, browser import
  'source-capture-check.mjs',     // D1: immutable source revisions, brand URL, light wireframes
  'story-records-check.mjs',      // D2: narrative revisions, explanation model, wording policy
  'explainer-lineage-check.mjs',  // D3: splits/merges, coverage, forged markers refused
  'explainer-persistence-check.mjs', // D3: finish/export guards
  'run-history-check.mjs',        // D3: durable runs + stage checkpoints
  'take-workflow-check.mjs',      // D3: take archive, selections, reopen hydration
  'skill-references-check.mjs',   // D4: shipped instruction dependency graph
  'align-take-check.mjs',         // D5: take-aligned timing on canned transcripts
  'take-alignment-e2e-check.mjs', // D5: synthesized speech through the real aligner (SKIP without uv)
  'diagnostics-check.mjs',        // D7: secrets-free diagnostic bundle
]

const runOne = (command, args, cwd) =>
  new Promise(resolve => {
    const child = spawn(command, args, { cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => { out += chunk })
    child.stderr.on('data', chunk => { out += chunk })
    child.on('exit', code => resolve({ code: code ?? 1, out }))
  })

const results = []
for (const [command, args, label] of UNIT_GATES) {
  process.stdout.write(`${label}… `)
  const { code, out } = await runOne(command, args, repoRoot)
  results.push([label, code === 0])
  console.log(code === 0 ? 'PASS' : `FAIL\n${out.split('\n').slice(-25).join('\n')}`)
}
for (const script of CHECKS) {
  process.stdout.write(`${script}… `)
  const { code, out } = await runOne('node', [join(desktopDir, 'scripts', script)], desktopDir)
  const lines = out.split('\n').filter(line => /CHECK (PASS|FAIL|SKIP)/.test(line))
  results.push([script, code === 0])
  console.log(code === 0 ? `PASS  (${lines[lines.length - 1] || 'ok'})` : `FAIL\n${out.split('\n').filter(line => /FAIL/.test(line)).slice(0, 12).join('\n')}`)
}

const failed = results.filter(([, ok]) => !ok)
console.log('\n——— Release suite ———')
results.forEach(([label, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`))
console.log(failed.length ? `RELEASE SUITE FAIL (${failed.length})` : `RELEASE SUITE PASS (${results.length}/${results.length})`)
process.exitCode = failed.length ? 1 : 0
