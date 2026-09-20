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
  'build-fork-check.mjs',         // P1: first Build on a base forks once, then builds the derivative
  'notebook-draft-check.mjs',     // P1: failed-save drafts survive notebook switches until a save lands
  'migration-check.mjs',          // D0a: legacy file store → PostgreSQL/MinIO import
  'local-store-check.mjs',        // D0a: the explicit file-backend opt-out stays green (takes included)
  'theme-library-check.mjs',      // D1: durable revisioned themes, restart, browser import, site kept over revisions
  'theme-site-check.mjs',         // D1: save a read direction as the site's theme; re-reading names it
  'source-capture-check.mjs',     // D1: immutable source revisions, brand URL, light wireframes
  'story-records-check.mjs',      // D2: narrative revisions, explanation model, wording policy
  'wording-preserve-check.mjs',   // P1: Keep my wording survives finish, reopen and the build inputs
  'source-destination-check.mjs', // P1: a fresh source starts its own notebook; append stays a choice
  'source-delivery-check.mjs',    // P2: a new source notebook keeps the journey's delivery choice
  'explainer-lineage-check.mjs',  // D3: splits/merges, coverage, forged markers refused
  'explainer-persistence-check.mjs', // D3: finish/export guards
  'finish-director-check.mjs',    // D6: finish stages scenes via the real hidden-window director
  'run-history-check.mjs',        // D3: durable runs + stage checkpoints
  'take-workflow-check.mjs',      // D3: take archive, selections, reopen hydration
  'rehearsal-check.mjs',          // §3.8: rehearsal loop — graphics + cue lines, beat controls, reset
  'mic-default-check.mjs',        // #4: the human path records the microphone by default, devices on demand
  'presenter-take-check.mjs',     // P2: a camera take compiles to graphics + presenter overlay, never a scene swap
  'take-duration-check.mjs',      // P5: a take's duration is fixed at stop, not after review/upload
  'stage-panel-check.mjs',        // §5.5: build panel stage checklist, needs-input as waiting
  'skill-references-check.mjs',   // D4: shipped instruction dependency graph
  'align-take-check.mjs',         // D5: take-aligned timing on canned transcripts
  'narrate-guard-check.mjs',      // §3.7/§5.5: narrate refuses the human path, needs-input checkpoint
  'take-alignment-e2e-check.mjs', // D5: synthesized speech through the real aligner (SKIP without uv)
  'review-budget-check.mjs',      // D5/§5.5: bounded preview loops, retained best proof
  'object-review-check.mjs',      // §5.4a: review receipts carry source hash + skill version
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
