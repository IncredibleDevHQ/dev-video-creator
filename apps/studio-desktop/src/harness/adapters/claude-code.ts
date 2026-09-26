// Claude Code adapter (spec §3.3). Runs
//   claude -p "<task>" --output-format stream-json --permission-mode acceptEdits
//          --allowedTools "Read,Write,Edit,Bash(python3 *),mcp__studio__*" --mcp-config <path>
// with cwd = projectDir and SKILL_DIR in env; parses stream-json; captures
// session_id for resume (--resume <sessionId>).
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  HarnessAdapter,
  HarnessContext,
  HarnessEvent,
  HarnessRun,
} from '../types'
import { probeVersion, spawnJsonLines, studioMcpUrl } from './util'
import { resolveSkillDir } from '../skills-install'
import { claudeModels, compareVersions } from '../models'
import { operationOf } from '../operations'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'

// Where Claude Code lives on a developer machine. The Claude desktop app
// ships its own copy under Application Support (versioned folders) and never
// puts `claude` on PATH; the npm/curl installs land in ~/.local/bin or
// ~/.claude/local; Homebrew in /opt/homebrew/bin. An explicit
// STUDIO_CLAUDE_BIN wins; otherwise the newest working copy is used, since a
// newer model can need a newer CLI than the one first on the list.
const desktopBundles = () => {
  const roots = [
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code'),
    join(homedir(), 'AppData', 'Local', 'Claude', 'claude-code'),
    join(homedir(), '.config', 'Claude', 'claude-code'),
  ]
  const found: string[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    let versions: string[] = []
    try {
      versions = readdirSync(root).filter(name => /^\d+\.\d+\.\d+/.test(name))
    } catch {
      versions = []
    }
    versions
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .forEach(version => {
        for (const candidate of [
          join(root, version, 'claude.app', 'Contents', 'MacOS', 'claude'),
          join(root, version, 'claude'),
          join(root, version, 'claude.exe'),
        ]) {
          if (existsSync(candidate)) found.push(candidate)
        }
      })
  }
  return found
}

export const claudeBinaryCandidates = () => {
  const home = homedir()
  return [
    ...(process.env.STUDIO_CLAUDE_BIN ? [process.env.STUDIO_CLAUDE_BIN] : []),
    join(home, '.claude', 'local', 'claude'),
    join(home, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    ...desktopBundles(),
    'claude',
  ]
}

let resolvedBinary: { path: string; version: string } | null = null

/**
 * The binary to run: an explicit STUDIO_CLAUDE_BIN is trusted as long as it
 * exists (it may be a wrapper or a test stub that does not answer
 * --version); auto-discovered candidates must answer --version, and the
 * newest of them is used. Cached.
 */
export const resolveClaudeBinary = async () => {
  if (resolvedBinary) return resolvedBinary
  const explicit = process.env.STUDIO_CLAUDE_BIN
  if (explicit && existsSync(explicit)) {
    const probe = await probeVersion(explicit)
    resolvedBinary = { path: explicit, version: probe.ok ? probe.version || '' : 'STUDIO_CLAUDE_BIN' }
    return resolvedBinary
  }
  const tried: string[] = explicit ? [`${explicit} (STUDIO_CLAUDE_BIN, missing)`] : []
  let newest: { path: string; version: string } | null = null
  for (const candidate of [...new Set(claudeBinaryCandidates().filter(path => path !== explicit))]) {
    if (candidate !== 'claude' && !existsSync(candidate)) {
      tried.push(candidate)
      continue
    }
    const probe = await probeVersion(candidate)
    if (!probe.ok) {
      tried.push(`${candidate} (${probe.reason || 'no answer'})`)
      continue
    }
    const version = probe.version || ''
    if (!newest || compareVersions(version, newest.version) > 0) newest = { path: candidate, version }
  }
  if (newest) {
    resolvedBinary = newest
    return resolvedBinary
  }
  return { path: null as string | null, tried }
}

// Each run gets its own MCP config pointing at the app's stdio bridge.
const writeMcpConfig = async (run: HarnessRun, context: HarnessContext) => {
  const path = join(run.projectDir, 'motion', 'mcp-config.json')
  await mkdir(join(run.projectDir, 'motion'), { recursive: true })
  await writeFile(
    path,
    JSON.stringify(
      {
        mcpServers: {
          studio: {
            command: 'node',
            args: [context.mcpShimPath],
            env: { STUDIO_MCP_URL: studioMcpUrl(context.origin, run.inputs) },
          },
        },
      },
      null,
      2,
    ),
  )
  return path
}

const emitLine = (line: string, onEvent: (e: HarnessEvent) => void, state: { resumeId?: string }) => {
  let message: Record<string, unknown>
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  const ts = Date.now()
  if (typeof message.session_id === 'string') state.resumeId = message.session_id
  if (message.type === 'assistant') {
    const content = (message.message as { content?: Array<Record<string, unknown>> })?.content || []
    for (const part of content) {
      if (part.type === 'text' && /not logged in/i.test(String(part.text || ''))) {
        // The CLI answers with a synthetic message instead of failing; make
        // the fix obvious.
        onEvent({
          type: 'error',
          ts,
          error: 'Claude Code is not logged in for the command line. Open a terminal, run `claude`, then `/login` once — the studio reuses that login.',
        })
      }
      if (part.type === 'text' && part.text) onEvent({ type: 'text', ts, text: String(part.text) })
      if (part.type === 'tool_use') {
        const tool = String(part.name || 'tool')
        const operation = operationOf(tool)
        onEvent({ type: 'tool', ts, tool, operation })
        const input = (part.input || {}) as Record<string, unknown>
        const file = input.file_path || input.path || input.notebook_path
        if (file) onEvent({ type: 'file', ts, file: String(file), operation })
      }
    }
    return
  }
  if (message.type === 'result') {
    if (typeof message.result === 'string' && message.result) {
      // The CLI reports provider refusals (an unsupported model, an API
      // error) as a result flagged is_error; that text is the useful status.
      if (message.is_error === true) onEvent({ type: 'error', ts, error: message.result.slice(0, 400) })
      else onEvent({ type: 'text', ts, text: message.result })
    }
    return
  }
  // The session's own account of the model it runs.
  if (message.type === 'system' && message.subtype === 'init') {
    if (typeof message.model === 'string' && message.model) onEvent({ type: 'session', ts, model: message.model })
    return
  }
}

export const createClaudeCodeAdapter = (context: HarnessContext): HarnessAdapter => ({
  id: 'claude-code',
  // Its Read tool renders images for the model.
  images: 'native',
  available: async () => {
    const found = await resolveClaudeBinary()
    if (found.path && 'version' in found) return { ok: true, version: `${found.version} · ${found.path}` }
    return {
      ok: false,
      reason: `claude not found — set STUDIO_CLAUDE_BIN or install it (npm i -g @anthropic-ai/claude-code). Looked in: ${('tried' in found ? found.tried : []).slice(0, 6).join(', ')}`,
    }
  },
  models: async () => {
    const found = await resolveClaudeBinary()
    return claudeModels(found.path && 'version' in found ? found.version : '')
  },
  async run(run, onEvent, signal) {
    const found = await resolveClaudeBinary()
    if (!found.path) throw new Error('claude binary not found (set STUDIO_CLAUDE_BIN)')
    const mcpConfig = await writeMcpConfig(run, context)
    const task = String(run.inputs.task || '')
    // --verbose is mandatory: `claude -p --output-format stream-json` refuses
    // to run without it ("requires --verbose").
    const args = [
      '-p',
      task,
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      // A planning or production run gets no shell at all: it reads, writes
      // its plan or its scene and calls its own tools, nothing else.
      run.inputs.capabilityScope === 'planning'
        ? 'Read,Write,Edit,Glob,Grep,mcp__studio__plan_*'
        : run.inputs.capabilityScope === 'production'
          ? 'Read,Write,Edit,Glob,Grep,mcp__studio__produce_*'
          : 'Read,Write,Edit,Bash(python3 *),mcp__studio__*',
      '--mcp-config',
      mcpConfig,
    ]
    if (typeof run.inputs.model === 'string' && run.inputs.model) args.push('--model', run.inputs.model)
    if (typeof run.inputs.effort === 'string' && ['low', 'medium', 'high', 'xhigh', 'max'].includes(run.inputs.effort)) args.push('--effort', run.inputs.effort)
    if (run.resumeId) args.push('--resume', run.resumeId)
    const state: { resumeId?: string; reportedError?: boolean } = {}
    let stderrTail = ''
    const { exitCode } = await spawnJsonLines({
      command: found.path,
      args,
      cwd: run.projectDir,
      env: { SKILL_DIR: resolveSkillDir(context.skillsDir, run.projectDir, run.skill) },
      onLine: line => emitLine(line, event => {
        if (event.type === 'error') state.reportedError = true
        onEvent(event)
      }, state),
      onStderr: text => {
        stderrTail = (stderrTail + text).slice(-1_200)
      },
      signal,
    })
    if (exitCode !== 0 && stderrTail.trim() && !state.reportedError) onEvent({ type: 'error', ts: Date.now(), error: stderrTail.trim().split('\n').slice(-3).join(' · ').slice(0, 400) })
    return { resumeId: state.resumeId, exitCode }
  },
})
