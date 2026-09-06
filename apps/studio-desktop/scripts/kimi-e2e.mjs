// Real-Kimi harness e2e: runs Plan Motion — Default through the kimi adapter
// with the real `kimi` CLI (must be on PATH) and STUDIO_GATE_AUTO_ANSWER for
// the two blocking gates. Passes when the gate protocol round trip is proven
// (gate event → auto-answer → adapter resumed with the real session id);
// reaching `done` is reported but not required (the full pipeline involves
// model calls and can run long).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect id="bg" x="0" y="0" width="1280" height="720" fill="#0f1411"/>
  <rect id="u-input" x="170" y="430" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-input-label" x="310" y="472" fill="#f4f4f5" font-size="26" text-anchor="middle">Input embedding</text>
  <rect id="u-attn" x="170" y="260" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-attn-label" x="310" y="302" fill="#f4f4f5" font-size="26" text-anchor="middle">Multi-head attention</text>
  <rect id="u-norm" x="170" y="90" width="280" height="70" rx="8" fill="#1b211e" stroke="#4ade80"/>
  <text id="u-norm-label" x="310" y="132" fill="#f4f4f5" font-size="26" text-anchor="middle">Add &amp; norm</text>
  <line id="u-arrow-1" x1="310" y1="430" x2="310" y2="330" stroke="#4ade80" stroke-width="3"/>
  <line id="u-arrow-2" x1="310" y1="260" x2="310" y2="160" stroke="#4ade80" stroke-width="3"/>
</svg>`

const root = await mkdtemp(join(tmpdir(), 'studio-kimi-e2e-'))
const projectDir = join(root, 'project')
await mkdir(join(projectDir, 'motion'), { recursive: true })
await writeFile(join(projectDir, 'page.svg'), SVG)

const configPath = join(root, 'e2e.json')
await writeFile(
  configPath,
  JSON.stringify({
    adapter: 'kimi',
    skill: 'motion-master',
    route: 'Plan Motion — Default',
    projectDir,
    inputs: {
      page: 'page.svg',
      narration:
        'Tokens come in as input embeddings. Each position looks at every other through multi-head attention. The result is added back and normalised.',
    },
    expectResume: true,
    allowIncomplete: true,
    timeoutMs: Number(process.env.KIMI_E2E_TIMEOUT_MS || 480_000),
  }),
)

const child = spawn(electronBinary, ['.'], {
  cwd: appDir,
  env: {
    ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${process.env.HOME}/.kimi-code/bin:${process.env.PATH}`,
    STUDIO_HARNESS_E2E: configPath,
    STUDIO_GATE_AUTO_ANSWER: JSON.stringify({
      explain_move: 'name the encoder parts in data order',
      pace: 'presenter-led with Next',
      presence: 'no camera',
      stage_default: 'free',
      attention_style: 'technical-trace',
      narration_source: 'literal script',
      constraints: 'none',
    }),
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
let output = ''
child.stdout.on('data', chunk => {
  process.stdout.write(chunk)
  output += chunk.toString()
})
const exitCode = await new Promise(resolve => child.once('exit', resolve))

let verdict = exitCode === 0 && output.includes('HARNESS E2E PASS')
try {
  const runFile = JSON.parse(await readFile(join(projectDir, 'motion', 'run.json'), 'utf8'))
  console.log('run.json:', JSON.stringify(runFile))
  if (!runFile.resumeId || !String(runFile.resumeId).startsWith('session_')) verdict = false
} catch {
  verdict = false
}
console.log('artefacts:')
for (const file of ['gate.json', 'run.json', 'inputs.json', 'geometry.json', 'brief.md', 'lock.md', 'resolved.json', 'receipt.json']) {
  try {
    await readFile(join(projectDir, 'motion', file))
    console.log(`  motion/${file} ✓`)
  } catch {
    console.log(`  motion/${file} —`)
  }
}
if (process.env.KEEP_KIMI_E2E_DIR) console.log(`kept ${root}`)
else await rm(root, { recursive: true, force: true })
console.log(verdict ? 'KIMI E2E PASS' : 'KIMI E2E FAIL')
process.exit(verdict ? 0 : 1)
