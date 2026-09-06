// Kimi CLI adapter (spec §3.3: agent mode, MCP enabled, JSON lines, session
// id for resume). Runs
//   kimi -p "<task>" --output-format stream-json
// with cwd = projectDir and SKILL_DIR in env. Kimi loads MCP servers from a
// Claude-compatible .mcp.json in the working directory, so each run writes
// one pointing at the studio stdio bridge. Resume uses `kimi -r <sessionId>`
// (the resume hint the CLI itself prints).
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  HarnessAdapter,
  HarnessContext,
  HarnessEvent,
  HarnessRun,
} from '../types'
import { probeVersion, spawnJsonLines } from './util'
import { resolveSkillDir } from '../skills-install'

const writeMcpConfig = async (run: HarnessRun, context: HarnessContext) => {
  const path = join(run.projectDir, '.mcp.json')
  await mkdir(run.projectDir, { recursive: true })
  await writeFile(
    path,
    JSON.stringify(
      {
        mcpServers: {
          studio: {
            command: 'node',
            args: [context.mcpShimPath],
            env: { STUDIO_MCP_URL: `${context.origin}/mcp` },
          },
        },
      },
      null,
      2,
    ),
  )
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
      onEvent({ type: 'tool', ts, tool: String(fn.name || 'tool') })
      try {
        const args = JSON.parse(fn.arguments || '{}') as Record<string, unknown>
        const file = args.path || args.file_path
        if (file) onEvent({ type: 'file', ts, file: String(file) })
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
  async run(run, onEvent, signal) {
    await writeMcpConfig(run, context)
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
    if (run.resumeId) args.push('-r', run.resumeId)
    const state: { resumeId?: string } = {}
    const { exitCode } = await spawnJsonLines({
      command: 'kimi',
      args,
      cwd: run.projectDir,
      env: { SKILL_DIR: resolveSkillDir(context.skillsDir, run.projectDir, run.skill) },
      onLine: line => emitLine(line, onEvent, state),
      signal,
    })
    return { resumeId: state.resumeId, exitCode }
  },
})
