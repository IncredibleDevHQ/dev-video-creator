// Run manager (spec §3.1/§3.2): allocates run ids, writes motion/run.json
// and motion/inputs.json, spawns the adapter, normalises events, implements
// the gate protocol (skill writes motion/gate.json and exits 0 → the app
// shows the dialog / auto-answers → writes motion/gate.<id>.answer.json →
// re-runs with resumeId + inputs.gateAnswer), and cancels via AbortSignal.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { installSkills, resolveSkillDir } from './skills-install'
import { describeFailure } from './provider-errors'
import { verifyExplainerExport } from '../mcp/explainer-tools'
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
  resumeId?: string
}

type RunRecord = {
  summary: RunSummary
  controller: AbortController
  pendingGate?: GateRequest
  resumeId?: string
  inputs: Record<string, unknown>
  options: StartRunOptions
  // A planning run's record, reported to when the run ends.
  planningRecord?: string
  // The harness's last reported error: the provider status a failed
  // planning record keeps.
  lastError?: string
}

// A planning run names the record it works for (M0).
const PLANNING_SKILL = 'video-planner'

const planningOf = (inputs?: Record<string, unknown>) => {
  const planning = inputs?.planning as { recordId?: unknown } | undefined
  return typeof planning?.recordId === 'string' && planning.recordId ? planning.recordId : ''
}

type RunFile = {
  id: string
  skill: string
  harness: string
  harnessVersion: string
  model?: string
  reportedModel?: string
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
const RUN_SCOPED_SKILLS = new Set(['explainer-master', 'page-master', 'story-master'])

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
      model: record.summary.model,
      reportedModel: record.summary.reportedModel,
      startedAt: record.summary.startedAt,
      resumeId: record.resumeId,
      status: record.summary.status,
    }
    await writeFile(
      join(this.motionDir(record), 'run.json'),
      JSON.stringify(file, null, 2),
    )
  }

  // Durable run record (D3): the run is written to the store before its
  // side effects begin, and every later state lands in the same row — a
  // restarted app can see what ran, what finished, and what was interrupted.
  private async persistRun(record: RunRecord, exitCode: number | null = null) {
    const summary = record.summary
    try {
      await fetch(`${this.context.origin}/api/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: summary.id,
          projectId: record.options.projectId || null,
          skill: summary.skill,
          route: summary.route,
          adapter: summary.adapter,
          projectDir: summary.projectDir,
          status: summary.status,
          inputsHash: createHash('sha256').update(JSON.stringify(record.inputs)).digest('hex'),
          resumeId: record.resumeId,
          model: summary.model || null,
          reportedModel: summary.reportedModel || null,
          failure: summary.failure || null,
          exitCode,
          startedAt: summary.startedAt,
          finishedAt: summary.finishedAt || null,
        }),
      })
    } catch {
      // The store may be unreachable while services start; the run dir
      // remains the working record and the row is retried on the next event.
    }
  }

  // In-memory runs merged over the durable history (D3): rows whose process
  // is gone mid-run report as interrupted errors, never as still running.
  async history(): Promise<RunSummary[]> {
    let durable: Array<Record<string, unknown>> = []
    try {
      const response = await fetch(`${this.context.origin}/api/runs`)
      durable = ((await response.json()) as { runs?: Array<Record<string, unknown>> }).runs || []
    } catch {
      // offline store: the in-memory list stands alone
    }
    const live = new Map([...this.runs.values()].map(record => [record.summary.id, record]))
    const merged: RunSummary[] = []
    for (const row of durable) {
      const id = String(row.id)
      const record = live.get(id)
      if (record) {
        merged.push({ ...record.summary })
        live.delete(id)
        continue
      }
      const interrupted = ['running', 'gate'].includes(String(row.status))
      merged.push({
        id,
        skill: String(row.skill),
        route: String(row.route),
        adapter: String(row.adapter),
        projectDir: String(row.projectDir),
        status: (interrupted ? 'error' : row.status) as RunSummary['status'],
        resumeId: row.resumeId ? String(row.resumeId) : undefined,
        ...(row.model ? { model: String(row.model) } : {}),
        ...(row.reportedModel ? { reportedModel: String(row.reportedModel) } : {}),
        ...(row.failure ? { failure: row.failure as RunSummary['failure'] } : interrupted ? { failure: describeFailure({ message: 'The app closed while this run was working', harness: String(row.adapter), category: 'interrupted' }) } : {}),
        startedAt: String(row.startedAt),
        finishedAt: row.finishedAt ? String(row.finishedAt) : undefined,
      })
    }
    for (const record of live.values()) merged.push({ ...record.summary })
    return merged
  }

  // Runs the store still shows running or at a gate were cut off when the
  // app last closed: no process serves them now. Each is recorded as an
  // interrupted error, and a planning record it owned fails with a way to
  // retry — nothing stays "running" forever after a restart.
  async reconcileInterrupted(): Promise<string[]> {
    let durable: Array<Record<string, unknown>> = []
    try {
      const response = await fetch(`${this.context.origin}/api/runs`)
      durable = ((await response.json()) as { runs?: Array<Record<string, unknown>> }).runs || []
    } catch {
      return []
    }
    const interrupted: string[] = []
    for (const row of durable) {
      const id = String(row.id)
      if (!['running', 'gate'].includes(String(row.status)) || this.runs.has(id)) continue
      try {
        const failure = describeFailure({ message: 'The app closed while this run was working', harness: String(row.adapter), category: 'interrupted', ...(row.model ? { requestedModel: String(row.model) } : {}) })
        await fetch(`${this.context.origin}/api/runs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...row, status: 'error', exitCode: null, failure, finishedAt: new Date().toISOString() }),
        })
        await this.worker(`/api/planning/runs/${encodeURIComponent(id)}/finished`, { status: 'interrupted', exitCode: null })
        interrupted.push(id)
      } catch (error) {
        log('could not reconcile interrupted run', id, error instanceof Error ? error.message : error)
      }
    }
    if (interrupted.length) log(`interrupted runs reconciled: ${interrupted.join(', ')}`)
    return interrupted
  }

  private async writeInputs(record: RunRecord) {
    await writeFile(
      join(this.motionDir(record), 'inputs.json'),
      JSON.stringify(record.inputs, null, 2),
    )
  }

  async start(options: StartRunOptions): Promise<RunSummary> {
    const id = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
    const planningRecord = planningOf(options.inputs)
    // A planning record is answered by the planning skill, and only by it.
    if (planningRecord && options.skill !== PLANNING_SKILL) throw new Error(`A planning run uses the ${PLANNING_SKILL} skill, not ${options.skill}`)
    // A creation run — the story, the pages, the explainer — works in a
    // directory of its own, so a run never reads an earlier run's pages or
    // outline as its own result. Motion assist keeps the project directory.
    const projectDir =
      options.projectDir || (planningRecord
        ? join(this.projectsRoot, options.projectId || 'default', 'plans', id)
        : RUN_SCOPED_SKILLS.has(options.skill)
          ? join(this.projectsRoot, options.projectId || 'default', 'runs', id)
          : join(this.projectsRoot, options.projectId || 'default'))
    // Install the vendored skills into the project first (spec §5): the
    // adapter then reads SKILL.md from the project's .claude/skills copy.
    try {
      const install = await installSkills(this.context.skillsDir, projectDir, planningRecord ? { only: [PLANNING_SKILL] } : {})
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
    // A planning run reads exactly the packet the product pinned when it was
    // queued, written into the run directory before the harness starts, and
    // is offered only the planning tools (M0).
    if (planningRecord) {
      try {
        const packet = await this.materialisePacket(planningRecord, projectDir)
        await this.describeRun(projectDir, options.adapter, typeof options.inputs?.model === 'string' ? options.inputs.model : null)
        inputs.capabilityScope = 'planning'
        inputs.planning = { ...(inputs.planning as Record<string, unknown>), recordId: planningRecord, route: packet.route }
        inputs.packet = { files: packet.files }
      } catch (error) {
        const message = `The planning packet could not be prepared: ${error instanceof Error ? error.message : error}`
        await this.worker(`/api/planning/records/${encodeURIComponent(planningRecord)}/fail`, { message }).catch(() => {})
        throw new Error(message)
      }
    }
    // Continue from accepted work (issue #8): an explicit resume block in the
    // inputs names the prior run; its reviewed artifacts are carried into this
    // run's fresh directory, so accepted scenes keep their review state instead
    // of being regenerated. The resume is data, not implicit directory reuse:
    // this run gets its own id, directory and durable row.
    const resume = (options.inputs?.resume || null) as { runId?: unknown; projectDir?: unknown } | null
    if (resume && typeof resume.projectDir === 'string' && typeof resume.runId === 'string') {
      await this.carryResumeArtifacts(resume.projectDir, projectDir)
    }
    const record: RunRecord = {
      summary: {
        id,
        skill: options.skill,
        route: options.route,
        adapter: options.adapter.id,
        projectDir,
        status: 'running',
        ...(typeof inputs.model === 'string' && inputs.model ? { model: inputs.model } : {}),
        startedAt: new Date().toISOString(),
      },
      controller: new AbortController(),
      resumeId: options.resumeId,
      inputs,
      options,
      ...(planningRecord ? { planningRecord } : {}),
    }
    this.runs.set(id, record)
    await this.writeInputs(record)
    await this.writeRunFile(record)
    await this.persistRun(record)
    // The record learns which run serves it before the run does anything. A
    // record that already finished (superseded, failed, cancelled) is not run.
    if (planningRecord) {
      try {
        await this.worker(`/api/planning/records/${encodeURIComponent(planningRecord)}/run`, {
          runId: id,
          adapter: options.adapter.id,
          ...(typeof inputs.model === 'string' ? { model: inputs.model } : {}),
        })
      } catch (error) {
        await this.finish(record, 'cancelled', 0)
        throw new Error(`This planning request can no longer run: ${error instanceof Error ? error.message : error}`)
      }
    }
    void this.attempt(record)
    return { ...record.summary }
  }

  // The harness said which model its session runs: the run and a planning
  // record keep that, not only the model that was asked for.
  private async sessionModel(record: RunRecord, model: string) {
    if (record.summary.reportedModel === model) return
    record.summary.reportedModel = model
    await this.writeRunFile(record).catch(() => {})
    await this.persistRun(record).catch(() => {})
    if (record.planningRecord) {
      await this.worker(`/api/planning/records/${encodeURIComponent(record.planningRecord)}/model`, {
        runId: record.summary.id,
        model,
      }).catch(error => log('planning record did not take the reported model:', error instanceof Error ? error.message : error))
    }
  }

  private async worker(path: string, body?: unknown) {
    const response = await fetch(`${this.context.origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) throw new Error(String(result.error || `the studio answered ${response.status}`))
    return result
  }

  // Writes the pinned packet into the run directory. Only packet/ paths are
  // accepted, and none may leave the directory.
  private async materialisePacket(recordId: string, projectDir: string) {
    // A file is text, or bytes (a preview image) carried as base64.
    const packet = (await this.worker(`/api/planning/records/${encodeURIComponent(recordId)}/packet`)) as { route?: string; files?: Record<string, string | { base64: string; contentType?: string }> }
    const root = resolve(projectDir)
    const written: string[] = []
    for (const [name, contents] of Object.entries(packet.files || {})) {
      const path = resolve(root, name)
      if (!name.startsWith('packet/') || !path.startsWith(root + sep)) throw new Error(`unexpected packet path ${name}`)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, typeof contents === 'string' ? contents : Buffer.from(contents.base64, 'base64'))
      written.push(name)
    }
    if (!written.length) throw new Error('the packet is empty')
    return { route: String(packet.route || ''), files: written.sort() }
  }

  // This run's own facts beside the packet: which harness reads it, and
  // whether it can look at the packet's images.
  private async describeRun(projectDir: string, adapter: HarnessAdapter, model: string | null) {
    const images = adapter.images || 'unverified'
    await writeFile(
      join(projectDir, 'packet', 'RUN.json'),
      JSON.stringify(
        {
          harness: adapter.id,
          model,
          imageInspection: images,
          note: images === 'native' ? 'Open the packet\'s PNG files with your file-reading tool to see them.' : 'Viewing images has not been verified for this harness: try to open the PNG files; if you cannot see them, say so in unresolved and work from VISUAL_CAST.json and the SVG sources.',
        },
        null,
        2,
      ),
    )
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
        event => {
          if (event.type === 'error' && event.error) record.lastError = event.error
          if (event.type === 'session' && event.model) void this.sessionModel(record, event.model)
          this.emit(runId, event)
        },
        record.controller.signal,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record.lastError = message
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
      await this.persistRun(record)
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
      if (record.options.skill === 'explainer-master') {
        // A run that parked on a per-scene needs-input checkpoint ended
        // normally: it durably waits for its person (a take to record), so
        // the export verification does not apply — waiting is not an error
        // and needs no gate protocol.
        if (await this.waitingOnInput(record)) {
          await this.finish(record, 'waiting', 0)
          return
        }
        try {
          await verifyExplainerExport(record.summary.projectDir, this.context.origin)
        } catch (error) {
          await this.fail(record, `Explainer incomplete: ${error instanceof Error ? error.message : error}`)
          return
        }
      }
      await this.finish(record, 'done', 0)
    } else {
      await this.finish(record, 'error', result.exitCode)
    }
  }

  // Waiting is read from the durable stage rows the tools recorded: any
  // checkpoint still at needs-input means the run waits for a person. Because
  // checkpoints key on their scene/object (issue #7), a scene's resolved
  // checkpoint clears only its own wait — another scene's stays.
  private async waitingOnInput(record: RunRecord): Promise<boolean> {
    try {
      const response = await fetch(`${this.context.origin}/api/runs/${encodeURIComponent(record.summary.id)}/stages`)
      const { stages } = (await response.json()) as { stages?: Array<{ status?: unknown }> }
      return Boolean(stages?.some(stage => stage.status === 'needs-input'))
    } catch {
      // The store is unreachable: fall back to the export verification, which
      // reports an incomplete run honestly.
      return false
    }
  }

  // The resume carry (issue #8): the prior run's reviewed explainer artifacts
  // (story, candidates, proofs, narrations, receipts, the review budget) move
  // into the new run's own directory, so accepted scenes keep their review
  // state instead of being regenerated. The source must be one of this
  // manager's run directories, and a stale export is never carried — a
  // continued run re-renders and re-verifies its own.
  private async carryResumeArtifacts(fromDir: string, toDir: string) {
    try {
      const source = resolve(fromDir)
      const target = resolve(toDir)
      const root = resolve(this.projectsRoot)
      if (source === target || (source !== root && !source.startsWith(root + sep))) {
        log('resume source is not a run directory — continuing without carried artifacts:', fromDir)
        return
      }
      const explainerDir = join(source, 'explainer')
      if (!existsSync(explainerDir)) return
      await cp(explainerDir, join(target, 'explainer'), {
        recursive: true,
        filter: name => {
          const base = name.split(sep).pop() || ''
          return base !== 'export.json' && base !== 'export.mp4' && base !== 'export-review'
        },
      })
      log(`carried the prior run's reviewed artifacts into ${target}`)
    } catch (error) {
      // The new run still names the prior run in its inputs; without the
      // carried files it simply rebuilds, as before resume existed.
      log('resume carry failed:', error instanceof Error ? error.message : error)
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
    // A failed run keeps why, in a form every stage can act on.
    if (status === 'error') {
      record.summary.failure = describeFailure({
        message: record.lastError || `The ${record.summary.adapter} run ended with exit code ${exitCode}`,
        harness: record.summary.adapter,
        ...(record.summary.model ? { requestedModel: record.summary.model } : {}),
        ...(record.summary.reportedModel ? { reportedModel: record.summary.reportedModel } : {}),
      })
    }
    record.summary.resumeId = record.resumeId
    await this.writeRunFile(record).catch(() => {})
    await this.persistRun(record, exitCode)
    // A planning run that ended without submitting leaves its record failed,
    // with the provider's last word; one that submitted is already settled.
    if (record.planningRecord) {
      await this.worker(`/api/planning/runs/${encodeURIComponent(record.summary.id)}/finished`, {
        status,
        exitCode,
        ...(record.lastError ? { error: record.lastError } : {}),
        ...(record.summary.failure ? { failure: record.summary.failure } : {}),
      }).catch(error => log('planning finish report failed:', error instanceof Error ? error.message : error))
    }
    this.emit(record.summary.id, { type: 'done', ts: Date.now(), exitCode, status })
    log(`run ${record.summary.id} ${status} (adapter ${record.summary.adapter})`)
  }

  private async fail(record: RunRecord, message: string) {
    record.lastError = message
    this.emit(record.summary.id, { type: 'error', ts: Date.now(), error: message })
    await this.finish(record, 'error', 1)
  }
}
