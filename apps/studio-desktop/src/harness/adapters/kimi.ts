// Kimi CLI adapter (spec §3.3: agent mode, MCP enabled, JSON lines, session
// id for resume). Runs
//   kimi -p "<task>" --output-format stream-json
// with cwd = projectDir and SKILL_DIR in env. Current Kimi Code loads project
// servers from .kimi-code/mcp.json. Keep the Claude-compatible file too for
// shared tooling. Resume uses `kimi -S <sessionId>`
// (the resume hint the CLI itself prints).
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  HarnessAdapter,
  HarnessContext,
  HarnessEvent,
  HarnessRun,
} from '../types'
import { homedir } from 'node:os'
import { probeVersion, spawnJsonLines, studioMcpUrl } from './util'
import { resolveSkillDir } from '../skills-install'
import { kimiModels } from '../models'
import { operationOf } from '../operations'

// Kimi reads its settings from KIMI_CODE_HOME. A drawing run wants the
// model thinking hard, but the effort lives in the user's own config and
// their interactive sessions are theirs — so a run gets a home of its own:
// everything symlinked through to the real one, with a copy of the config
// whose thinking effort is raised. Their global setting is untouched.
const homeWithEffort = async (projectDir: string, effort: string) => {
  const real = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')
  const config = await readFile(join(real, 'config.toml'), 'utf8')
  if (!['low', 'medium', 'high', 'max'].includes(effort)) throw new Error('Unsupported thinking effort')
  const thinking = `[thinking]\nenabled = true\neffort = "${effort}"\n`
  const raised = /^\[thinking\][^[]*/m.test(config)
    ? config.replace(/^\[thinking\][^[]*/m, section => {
      const other = section.split('\n').slice(1).filter(line => !/^\s*(?:effort|enabled)\s*=/.test(line)).join('\n')
      return `${thinking}${other}\n`
    })
    : `${config}\n${thinking}`
  const home = join(projectDir, 'motion', 'kimi-home')
  // Keep this run's CLI sessions so a retry can resume its actual context.
  await mkdir(home, { recursive: true })
  for (const entry of await readdir(real)) {
    if (entry === 'config.toml' || entry === 'mcp.json') continue
    await symlink(join(real, entry), join(home, entry)).catch(() => {})
  }
  await writeFile(join(home, 'config.toml'), raised, { mode: 0o600 })
  return home
}

const writeMcpConfig = async (run: HarnessRun, context: HarnessContext) => {
  await mkdir(run.projectDir, { recursive: true })
  const config = JSON.stringify(
      {
        mcpServers: {
          studio: {
            command: 'node',
            args: [context.mcpShimPath],
            env: { STUDIO_MCP_URL: studioMcpUrl(context.origin, run.inputs) },
            toolTimeoutMs: 900_000,
          },
        },
      },
      null,
      2,
    )
  await writeFile(join(run.projectDir, '.mcp.json'), config)
  await mkdir(join(run.projectDir, '.kimi-code'), { recursive: true })
  await writeFile(join(run.projectDir, '.kimi-code', 'mcp.json'), config)
  return config
}

const emitLine = (line: string, onEvent: (e: HarnessEvent) => void, state: { resumeId?: string }) => {
  let message: Record<string, unknown>
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  const ts = Date.now()
  // Observed shapes (kimi 0.41.0):
  //   {"role":"meta","type":"system.version","version":"0.41.0"}
  //   {"role":"assistant","content":"…"}
  //   {"role":"meta","type":"session.resume_hint","session_id":"…"}
  if (message.role === 'meta' && message.type === 'session.resume_hint') {
    if (typeof message.session_id === 'string') state.resumeId = message.session_id
    return
  }
  // Observed shapes (kimi 0.41.0):
  //   {"role":"assistant","content":"…"}
  //   {"role":"assistant","tool_calls":[{"type":"function","function":{"name":"Write","arguments":"{…}"}}]}
  //   {"role":"tool","tool_call_id":"…","content":"…"}
  if (message.role === 'assistant') {
    if (message.content) onEvent({ type: 'text', ts, text: String(message.content) })
    const toolCalls = (message.tool_calls || []) as Array<Record<string, unknown>>
    for (const call of toolCalls) {
      const fn = (call.function || {}) as { name?: string; arguments?: string }
      const tool = String(fn.name || 'tool')
      const operation = operationOf(tool)
      onEvent({ type: 'tool', ts, tool, operation })
      try {
        const args = JSON.parse(fn.arguments || '{}') as Record<string, unknown>
        const file = args.path || args.file_path
        if (file) onEvent({ type: 'file', ts, file: String(file), operation })
      } catch {
        // Arguments stream in chunks in some modes; the tool event is enough.
      }
    }
    return
  }
  if (message.role === 'tool') return
}

export const createKimiAdapter = (context: HarnessContext): HarnessAdapter => ({
  id: 'kimi',
  available: () => probeVersion('kimi'),
  models: kimiModels,
  async run(run, onEvent, signal) {
    const mcpConfig = await writeMcpConfig(run, context)
    // Skills discovery reads the project's installed copy when present
    // (--skills-dir names the directory that CONTAINS the skill folders).
    const installedRoot = join(run.projectDir, '.claude', 'skills')
    const skillsRoot = existsSync(join(installedRoot, run.skill))
      ? installedRoot
      : context.skillsDir
    const args = [
      '-p',
      String(run.inputs.task || ''),
      '--output-format',
      'stream-json',
      '--skills-dir',
      skillsRoot,
    ]
    // A model alias for this run (kimi-code/k3 thinks by default at max
    // effort). Prompt mode is already non-interactive; --auto cannot be
    // combined with it.
    if (typeof run.inputs.model === 'string' && run.inputs.model) args.push('-m', run.inputs.model)
    if (run.resumeId) args.push('-S', run.resumeId)
    const effort = typeof run.inputs.effort === 'string' ? run.inputs.effort : ''
    const home = effort ? await homeWithEffort(run.projectDir, effort).catch(error => {
      if (run.skill === 'explainer-master') throw error
      onEvent({ type: 'text', ts: Date.now(), text: `thinking effort left as configured (${error instanceof Error ? error.message : error})` })
      return ''
    }) : ''
    // This is an app-created isolated home, not the user's configuration.
    // Register the app's tools here as well so prompt mode does not discard
    // project MCP servers while waiting for interactive workspace trust.
    if (home) await writeFile(join(home, 'mcp.json'), mcpConfig, { mode: 0o600 })
    const state: { resumeId?: string } = {}
    let stderrTail = ''
    const { exitCode } = await spawnJsonLines({
      command: 'kimi',
      args,
      cwd: run.projectDir,
      env: { SKILL_DIR: resolveSkillDir(context.skillsDir, run.projectDir, run.skill), ...(home ? { KIMI_CODE_HOME: home } : {}) },
      onLine: line => emitLine(line, onEvent, state),
      onStderr: text => {
        stderrTail = (stderrTail + text).slice(-1_200)
      },
      signal,
    })
    // A CLI that refuses to start says why on stderr; the run shows it.
    if (exitCode !== 0 && stderrTail.trim()) onEvent({ type: 'error', ts: Date.now(), error: stderrTail.split('\n').map(line => line.trim()).filter(Boolean).slice(-3).join(' · ').slice(0, 400) })
    return { resumeId: state.resumeId, exitCode }
  },
})
