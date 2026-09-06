// Run manager (spec §3.1/§3.2): allocates run ids, writes motion/run.json
// and motion/inputs.json, spawns the adapter, normalises events, implements
// the gate protocol (skill writes motion/gate.json and exits 0 → the app
// shows the dialog / auto-answers → writes motion/gate.<id>.answer.json →
// re-runs with resumeId + inputs.gateAnswer), and cancels via AbortSignal.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { installSkills, resolveSkillDir } from './skills-install'
import type {
  GateRequest,
  HarnessAdapter,
  HarnessContext,
  HarnessEvent,
  RunStatus,
  RunSummary,
} from './types'

export type StartRunOptions = {
  adapter: HarnessAdapter
  skill: string
  route: string
  projectId?: string
  projectDir?: string
  inputs?: Record<string, unknown>
}

type RunRecord = {
  summary: RunSummary
  controller: AbortController
  pendingGate?: GateRequest
  resumeId?: string
  inputs: Record<string, unknown>
  options: StartRunOptions
}

type RunFile = {
  id: string
  skill: string
  harness: string
  harnessVersion: string
  model?: string
  skillVersion?: string
  startedAt: string
  resumeId?: string
  status: RunStatus
}

const log = (...args: unknown[]) => console.log('[harness]', ...args)

// Documented test hook: when set, the gate dialog is bypassed and this JSON
// is written as the gate answer (headless runs, e2e tests).
const AUTO_ANSWER = process.env.STUDIO_GATE_AUTO_ANSWER

// The one-line task text (spec §3.3): everything else travels in files.
const taskText = (skillDir: string, route: string, projectDir: string) =>
  `Read ${skillDir}/SKILL.md and run route ${route} for project ${projectDir} with inputs in motion/inputs.json.`

export class RunManager {
  private runs = new Map<string, RunRecord>()
  private listeners = new Set<(runId: string, event: HarnessEvent) => void>()

  constructor(
    private context: HarnessContext,
    private projectsRoot: string,
    // The desktop main shows the gate dialog; tests can auto-answer instead.
    private showGate: (runId: string, gate: GateRequest) => Promise<Record<string, unknown> | null>,
  ) {}

  onEvent(listener: (runId: string, event: HarnessEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  installInto(projectDir: string) {
    return installSkills(this.context.skillsDir, projectDir)
  }

  private emit(runId: string, event: HarnessEvent) {
    for (const listener of this.listeners) listener(runId, event)
  }

  list(): RunSummary[] {
    return [...this.runs.values()].map(record => ({ ...record.summary }))
  }

  private motionDir(record: RunRecord) {
    return join(record.summary.projectDir, 'motion')
  }

  private async writeRunFile(record: RunRecord) {
    const file: RunFile = {
      id: record.summary.id,
      skill: record.summary.skill,
      harness: record.summary.adapter,
      harnessVersion: '1',
      startedAt: record.summary.startedAt,
      resumeId: record.resumeId,
      status: record.summary.status,
    }
    await writeFile(
      join(this.motionDir(record), 'run.json'),
      JSON.stringify(file, null, 2),
    )
  }

  private async writeInputs(record: RunRecord) {
    await writeFile(
      join(this.motionDir(record), 'inputs.json'),
      JSON.stringify(record.inputs, null, 2),
    )
  }

  async start(options: StartRunOptions): Promise<RunSummary> {
    const id = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
    const projectDir =
      options.projectDir || join(this.projectsRoot, options.projectId || 'default')
    // Install the vendored skills into the project first (spec §5): the
    // adapter then reads SKILL.md from the project's .claude/skills copy.
    try {
      const install = await installSkills(this.context.skillsDir, projectDir)
      if (install.installed.length) log(`skills installed: ${install.installed.join(', ')}`)
      if (install.modifiedLocally.length) {
        log(`skills modified locally (kept): ${install.modifiedLocally.join(', ')}`)
      }
    } catch (error) {
      log('skill install failed:', error instanceof Error ? error.message : error)
    }
    const skillDir = resolveSkillDir(this.context.skillsDir, projectDir, options.skill)
    const inputs: Record<string, unknown> = {
      ...(options.inputs || {}),
      task: taskText(skillDir, options.route, projectDir),
    }
    await mkdir(join(projectDir, 'motion'), { recursive: true })
    const record: RunRecord = {
      summary: {
        id,
        skill: options.skill,
        route: options.route,
        adapter: options.adapter.id,
        projectDir,
        status: 'running',
        startedAt: new Date().toISOString(),
      },
      controller: new AbortController(),
      inputs,
      options,
    }
    this.runs.set(id, record)
    await this.writeInputs(record)
    await this.writeRunFile(record)
    void this.attempt(record)
    return { ...record.summary }
  }

  private async attempt(record: RunRecord) {
    const { adapter } = record.options
    const runId = record.summary.id
    const gatePath = join(this.motionDir(record), 'gate.json')
    // A stale gate from an earlier attempt must not refire.
    await rm(gatePath, { force: true })
    let result: { resumeId?: string; exitCode: number }
    try {
      result = await adapter.run(
        {
          id: runId,
          skill: record.options.skill,
          projectDir: record.summary.projectDir,
          inputs: record.inputs,
          resumeId: record.resumeId,
        },
        event => this.emit(runId, event),
        record.controller.signal,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emit(runId, { type: 'error', ts: Date.now(), error: message })
      result = { exitCode: 1 }
    }
    if (result.resumeId) record.resumeId = result.resumeId
    if (record.controller.signal.aborted || record.summary.status === 'cancelled') {
      await this.finish(record, 'cancelled', result.exitCode)
      return
    }
    // Gate protocol: the skill stops by writing motion/gate.json and exiting 0.
    if (result.exitCode === 0 && existsSync(gatePath)) {
      let gate: GateRequest
      try {
        gate = JSON.parse(await readFile(gatePath, 'utf8')) as GateRequest
      } catch (error) {
        await this.fail(record, `gate.json is unreadable: ${error}`)
        return
      }
      record.pendingGate = gate
      record.summary.status = 'gate'
      await this.writeRunFile(record)
      this.emit(runId, { type: 'gate', ts: Date.now(), gate })
      const answers = AUTO_ANSWER
        ? (JSON.parse(AUTO_ANSWER) as Record<string, unknown>)
        : await this.showGate(runId, gate)
      if (!answers) {
        await this.finish(record, 'cancelled', 0)
        return
      }
      await this.answer(record.summary.id, answers)
      return
    }
    if (result.exitCode === 0) {
      await this.finish(record, 'done', 0)
    } else {
      await this.finish(record, 'error', result.exitCode)
    }
  }

  // Writes motion/gate.<id>.answer.json and re-runs with resumeId +
  // inputs.gateAnswer (spec §3.2). Callable from IPC while a gate is pending.
  async answer(runId: string, answers: Record<string, unknown>): Promise<boolean> {
    const record = this.runs.get(runId)
    if (!record?.pendingGate) return false
    const gate = record.pendingGate
    record.pendingGate = undefined
    const answer = {
      gate: gate.id,
      stage: gate.stage,
      answers,
      answeredAt: new Date().toISOString(),
    }
    await writeFile(
      join(this.motionDir(record), `gate.${gate.id}.answer.json`),
      JSON.stringify(answer, null, 2),
    )
    record.inputs = { ...record.inputs, gateAnswer: answer }
    await this.writeInputs(record)
    record.summary.status = 'running'
    await this.writeRunFile(record)
    void this.attempt(record)
    return true
  }

  async cancel(runId: string): Promise<boolean> {
    const record = this.runs.get(runId)
    if (!record || record.summary.finishedAt) return false
    const parkedOnGate = record.summary.status === 'gate'
    record.summary.status = 'cancelled'
    record.pendingGate = undefined
    record.controller.abort()
    // Parked on a gate there is no child to abort; finish immediately.
    // Otherwise the in-flight attempt finishes the run when the child exits.
    if (parkedOnGate) await this.finish(record, 'cancelled', 130)
    return true
  }

  private async finish(record: RunRecord, status: RunStatus, exitCode: number) {
    if (record.summary.finishedAt) return
    record.summary.status = status
    record.summary.finishedAt = new Date().toISOString()
    record.summary.resumeId = record.resumeId
    await this.writeRunFile(record).catch(() => {})
    this.emit(record.summary.id, { type: 'done', ts: Date.now(), exitCode })
    log(`run ${record.summary.id} ${status} (adapter ${record.summary.adapter})`)
  }

  private async fail(record: RunRecord, message: string) {
    this.emit(record.summary.id, { type: 'error', ts: Date.now(), error: message })
    await this.finish(record, 'error', 1)
  }
}
