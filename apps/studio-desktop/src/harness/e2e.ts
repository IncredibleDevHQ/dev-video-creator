// Headless harness e2e driver. Activated only when STUDIO_HARNESS_E2E points
// at a JSON config file:
//   { "adapter": "claude-code", "skill": "motion-master", "route": "Quick",
//     "projectDir": "<abs>", "inputs": {…}, "expectResume": true }
// The main process runs the scenario directly (no renderer), prints every
// event as `HARNESS-EVENT <json>`, then `HARNESS E2E PASS` or
// `HARNESS E2E FAIL: <reason>` and exits 0/1. Gate answering is expected via
// STUDIO_GATE_AUTO_ANSWER (no dialog in headless runs).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { HarnessAdapter, HarnessContext, HarnessEvent } from './types'
import { RunManager } from './run-manager'
import { createClaudeCodeAdapter } from './adapters/claude-code'
import { createKimiAdapter } from './adapters/kimi'
import { createCodexAdapter } from './adapters/codex'

type E2EConfig = {
  adapter: 'claude-code' | 'codex' | 'kimi'
  skill: string
  route: string
  projectDir: string
  inputs?: Record<string, unknown>
  expectResume?: boolean
  timeoutMs?: number
  // Real-agent runs may legitimately still be working through later gates
  // when the timeout hits; accept a proven gate round trip as the pass.
  allowIncomplete?: boolean
}

const adapters = (context: HarnessContext): Record<string, HarnessAdapter> => ({
  'claude-code': createClaudeCodeAdapter(context),
  codex: createCodexAdapter(context),
  kimi: createKimiAdapter(context),
})

export const runHarnessE2E = async (
  context: HarnessContext,
  projectsRoot: string,
): Promise<number> => {
  const configPath = process.env.STUDIO_HARNESS_E2E
  if (!configPath) return 1
  const config = JSON.parse(await readFile(configPath, 'utf8')) as E2EConfig
  const events: Array<HarnessEvent & { runId: string }> = []
  let sawGate = false
  const manager = new RunManager(context, projectsRoot, async () => {
    // No dialog in headless mode: STUDIO_GATE_AUTO_ANSWER must be set.
    if (!process.env.STUDIO_GATE_AUTO_ANSWER) {
      console.log('HARNESS E2E FAIL: gate fired without STUDIO_GATE_AUTO_ANSWER')
    }
    return null
  })
  manager.onEvent((runId, event) => {
    events.push({ runId, ...event })
    console.log(`HARNESS-EVENT ${JSON.stringify(event)}`)
    if (event.type === 'gate') sawGate = true
  })
  const summary = await manager.start({
    adapter: adapters(context)[config.adapter],
    skill: config.skill,
    route: config.route,
    projectDir: config.projectDir,
    inputs: config.inputs,
  })
  const deadline = Date.now() + (config.timeoutMs || 120_000)
  while (Date.now() < deadline) {
    const current = manager.list().find(run => run.id === summary.id)
    if (current?.finishedAt) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const final = manager.list().find(run => run.id === summary.id)
  const runFile = JSON.parse(
    await readFile(join(config.projectDir, 'motion', 'run.json'), 'utf8'),
  ) as { status?: string; resumeId?: string }
  const problems: string[] = []
  const resumed = events.some(
    (event, index) => event.type !== 'gate' && events.slice(0, index).some(e => e.type === 'gate'),
  )
  if (config.allowIncomplete) {
    if (!sawGate) problems.push('no gate event fired')
    if (!resumed) problems.push('the adapter was never re-invoked after the gate answer')
    if (!runFile.resumeId) problems.push('run.json has no resumeId')
    console.log(`HARNESS E2E INFO: final status ${final?.status ?? 'unknown'} (${events.length} events)`)
  } else {
    if (!final?.finishedAt) problems.push('run never finished')
    if (final?.status !== 'done') problems.push(`status is ${final?.status}, expected done`)
    if (config.expectResume !== false) {
      if (!sawGate) problems.push('no gate event fired')
      if (!runFile.resumeId) problems.push('run.json has no resumeId')
    }
    if (runFile.status !== 'done') problems.push(`run.json status is ${runFile.status}`)
  }
  return problems.length ? (console.log(`HARNESS E2E FAIL: ${problems.join('; ')}`), 1)
       : (console.log('HARNESS E2E PASS'), 0)
}
