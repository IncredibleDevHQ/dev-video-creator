// Harness protocol e2e: builds a stub `claude` CLI in a temp dir (emits
// claude-shaped stream-json, writes motion/gate.json on the first pass,
// verifies the answer + inputs.gateAnswer on resume), puts it on PATH and
// runs the app's headless e2e (STUDIO_HARNESS_E2E) with
// STUDIO_GATE_AUTO_ANSWER. Asserts HARNESS E2E PASS and inspects run.json.
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
// node scripts/harness-e2e.mjs [claude-code|codex] — which adapter to test.
const ADAPTER = process.argv[2] === 'codex' ? 'codex' : 'claude-code'

const root = await mkdtemp(join(tmpdir(), 'studio-harness-e2e-'))
const binDir = join(root, 'bin')
const projectDir = join(root, 'project')
await mkdir(binDir, { recursive: true })
await mkdir(join(projectDir, 'motion'), { recursive: true })

const stubClaude = `#!/usr/bin/env node
// Stub claude CLI: claude-shaped stream-json + the §3.2 gate protocol.
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
const resumeIndex = args.indexOf('--resume')
const resumeId = resumeIndex >= 0 ? args[resumeIndex + 1] : ''
const sessionId = 'stub-session-1'
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
const motionDir = path.join(process.cwd(), 'motion')
emit({ type: 'system', subtype: 'init', session_id: sessionId })
emit({ type: 'assistant', message: { content: [{ type: 'text', text: resumeId ? 'Resuming with the gate answer.' : 'Planning the contract gate.' }] } })
emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: path.join(motionDir, 'brief.md') } }] } })
if (!resumeId) {
  fs.writeFileSync(path.join(motionDir, 'gate.json'), JSON.stringify({
    id: 'gate-contract',
    stage: 'contract',
    fields: ['explain_move', 'pace'],
    recommendation: { pace: 'presenter-led', attention_style: 'technical-trace' },
  }))
  emit({ type: 'result', subtype: 'success', session_id: sessionId, result: 'Stopped at the contract gate.' })
  process.exit(0)
}
// Resume path: the answer file and inputs.gateAnswer must both be present.
const answerPath = path.join(motionDir, 'gate.gate-contract.answer.json')
if (!fs.existsSync(answerPath)) {
  console.error('answer file missing')
  process.exit(3)
}
const inputs = JSON.parse(fs.readFileSync(path.join(motionDir, 'inputs.json'), 'utf8'))
if (!inputs.gateAnswer || !inputs.gateAnswer.answers) {
  console.error('inputs.gateAnswer missing')
  process.exit(4)
}
fs.writeFileSync(path.join(motionDir, 'resolved.json'), JSON.stringify({ version: 1, steps: [] }))
emit({ type: 'result', subtype: 'success', session_id: sessionId, result: 'Resolved with ' + JSON.stringify(inputs.gateAnswer.answers) })
process.exit(0)
`

// Same protocol, codex exec --json shapes: thread.started + item.completed;
// resume via `codex exec resume <threadId>`.
const stubCodex = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
const resumeIndex = args.indexOf('resume')
const resumeId = resumeIndex >= 0 ? args[resumeIndex + 1] : ''
const threadId = 'stub-thread-1'
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
const motionDir = path.join(process.cwd(), 'motion')
emit({ type: 'thread.started', thread_id: threadId })
emit({ type: 'item.completed', item: { item_type: 'agent_message', text: resumeId ? 'Resuming with the gate answer.' : 'Planning the contract gate.' } })
emit({ type: 'item.completed', item: { item_type: 'file_change', path: path.join(motionDir, 'brief.md') } })
if (!resumeId) {
  fs.writeFileSync(path.join(motionDir, 'gate.json'), JSON.stringify({
    id: 'gate-contract',
    stage: 'contract',
    fields: ['explain_move', 'pace'],
    recommendation: { pace: 'presenter-led' },
  }))
  emit({ type: 'turn.completed' })
  process.exit(0)
}
if (!fs.existsSync(path.join(motionDir, 'gate.gate-contract.answer.json'))) process.exit(3)
const inputs = JSON.parse(fs.readFileSync(path.join(motionDir, 'inputs.json'), 'utf8'))
if (!inputs.gateAnswer || !inputs.gateAnswer.answers) process.exit(4)
fs.writeFileSync(path.join(motionDir, 'resolved.json'), JSON.stringify({ version: 1, steps: [] }))
emit({ type: 'turn.completed' })
process.exit(0)
`
const stubPath = join(binDir, ADAPTER === 'codex' ? 'codex' : 'claude')
await writeFile(stubPath, ADAPTER === 'codex' ? stubCodex : stubClaude)
await chmod(stubPath, 0o755)

// Sanity: the stub parses and runs outside Electron first.
const sanity = spawnSync(
  stubPath,
  ADAPTER === 'codex' ? ['exec', '--json', 'task'] : ['-p', 'task', '--output-format', 'stream-json'],
  { cwd: projectDir, encoding: 'utf8' },
)
if (sanity.status !== 0 || !sanity.stdout.includes('stub-')) {
  console.error('stub sanity failed:', sanity.status, sanity.stderr)
  process.exit(1)
}
await rm(join(projectDir, 'motion', 'gate.json'), { force: true })

const configPath = join(root, 'e2e.json')
await writeFile(
  configPath,
  JSON.stringify({
    adapter: ADAPTER,
    skill: 'motion-master',
    route: 'Quick',
    projectDir,
    inputs: { example: true },
    expectResume: true,
  }),
)

const child = spawn(electronBinary, ['.'], {
  cwd: appDir,
  env: {
    ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    // The claude adapter prefers known install paths (and the desktop app's
    // bundled binary) over PATH — pin it to the stub for this test.
    ...(ADAPTER === 'codex' ? {} : { STUDIO_CLAUDE_BIN: stubPath }),
    STUDIO_HARNESS_E2E: configPath,
    STUDIO_GATE_AUTO_ANSWER: JSON.stringify({
      explain_move: 'name the parts in order',
      pace: 'presenter-led',
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
  const expectedResumeId = ADAPTER === 'codex' ? 'stub-thread-1' : 'stub-session-1'
  if (runFile.status !== 'done' || runFile.resumeId !== expectedResumeId) verdict = false
  const answer = JSON.parse(
    await readFile(join(projectDir, 'motion', 'gate.gate-contract.answer.json'), 'utf8'),
  )
  if (answer.answers?.pace !== 'presenter-led') verdict = false
} catch (error) {
  console.error('post-checks failed:', error)
  verdict = false
}
await rm(root, { recursive: true, force: true })
console.log(verdict ? 'HARNESS STUB E2E PASS' : 'HARNESS STUB E2E FAIL')
process.exit(verdict ? 0 : 1)
