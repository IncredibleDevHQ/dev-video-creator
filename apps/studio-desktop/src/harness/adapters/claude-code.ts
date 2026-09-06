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
import { probeVersion, spawnJsonLines } from './util'

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
            env: { STUDIO_MCP_URL: `${context.origin}/mcp` },
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
      if (part.type === 'text' && part.text) onEvent({ type: 'text', ts, text: String(part.text) })
      if (part.type === 'tool_use') {
        onEvent({ type: 'tool', ts, tool: String(part.name || 'tool') })
        const input = (part.input || {}) as Record<string, unknown>
        const file = input.file_path || input.path
        if (file) onEvent({ type: 'file', ts, file: String(file) })
      }
    }
    return
  }
  if (message.type === 'result') {
    if (typeof message.result === 'string' && message.result) {
      onEvent({ type: 'text', ts, text: message.result })
    }
    return
  }
  if (message.type === 'system' && message.subtype === 'init') return
}

export const createClaudeCodeAdapter = (context: HarnessContext): HarnessAdapter => ({
  id: 'claude-code',
  available: () => probeVersion('claude'),
  async run(run, onEvent, signal) {
    const mcpConfig = await writeMcpConfig(run, context)
    const task = String(run.inputs.task || '')
    const args = [
      '-p',
      task,
      '--output-format',
      'stream-json',
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      'Read,Write,Edit,Bash(python3 *),mcp__studio__*',
      '--mcp-config',
      mcpConfig,
    ]
    if (run.resumeId) args.push('--resume', run.resumeId)
    const state: { resumeId?: string } = {}
    const { exitCode } = await spawnJsonLines({
      command: 'claude',
      args,
      cwd: run.projectDir,
      env: { SKILL_DIR: join(context.skillsDir, run.skill) },
      onLine: line => emitLine(line, onEvent, state),
      signal,
    })
    return { resumeId: state.resumeId, exitCode }
  },
})
