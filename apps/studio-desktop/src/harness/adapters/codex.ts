// Codex CLI adapter (spec §3.3): `codex exec --json "<task>"` with sandbox
// workspace-write. The MCP server goes into a per-run CODEX_HOME so the
// user's own ~/.codex is never touched. The thread id from the JSONL stream
// is captured for resume (`codex exec resume <threadId>`).
// NOTE: codex is not installed on this machine; the event parsing below
// follows the documented `codex exec --json` shapes and is covered by the
// stub-CLI protocol test only.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  HarnessAdapter,
  HarnessContext,
  HarnessEvent,
  HarnessRun,
} from '../types'
import { probeVersion, spawnJsonLines } from './util'

const writeCodexHome = async (run: HarnessRun, context: HarnessContext) => {
  const home = join(run.projectDir, '.codex')
  await mkdir(home, { recursive: true })
  await writeFile(
    join(home, 'config.toml'),
    [
      '# Per-run Codex home written by the studio harness.',
      '[mcp_servers.studio]',
      'command = "node"',
      `args = [${JSON.stringify(context.mcpShimPath)}]`,
      `env = { STUDIO_MCP_URL = ${JSON.stringify(`${context.origin}/mcp`)} }`,
      '',
    ].join('\n'),
  )
  return home
}

const emitLine = (line: string, onEvent: (e: HarnessEvent) => void, state: { resumeId?: string }) => {
  let message: Record<string, unknown>
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  const ts = Date.now()
  // Documented codex exec --json items:
  //   {"type":"thread.started","thread_id":"…"}
  //   {"type":"item.completed","item":{"item_type":"agent_message","text":"…"}}
  //   {"type":"item.completed","item":{"item_type":"command_execution",…}}
  if (message.type === 'thread.started' && typeof message.thread_id === 'string') {
    state.resumeId = message.thread_id
    return
  }
  const item = (message.item || {}) as Record<string, unknown>
  const kind = String(item.item_type || item.type || '')
  if (kind === 'agent_message' && item.text) {
    onEvent({ type: 'text', ts, text: String(item.text) })
    return
  }
  if (kind === 'command_execution' || kind === 'local_shell_call' || kind === 'mcp_tool_call') {
    onEvent({ type: 'tool', ts, tool: String(item.name || item.command || kind).slice(0, 120) })
    return
  }
  if (kind === 'file_change' && item.path) {
    onEvent({ type: 'file', ts, file: String(item.path) })
    return
  }
}

export const createCodexAdapter = (context: HarnessContext): HarnessAdapter => ({
  id: 'codex',
  available: () => probeVersion('codex'),
  async run(run, onEvent, signal) {
    const codexHome = await writeCodexHome(run, context)
    const args = run.resumeId
      ? ['exec', 'resume', run.resumeId, '--json', '--sandbox', 'workspace-write', String(run.inputs.task || '')]
      : ['exec', '--json', '--sandbox', 'workspace-write', String(run.inputs.task || '')]
    const state: { resumeId?: string } = {}
    const { exitCode } = await spawnJsonLines({
      command: 'codex',
      args,
      cwd: run.projectDir,
      env: {
        SKILL_DIR: join(context.skillsDir, run.skill),
        CODEX_HOME: codexHome,
      },
      onLine: line => emitLine(line, onEvent, state),
      signal,
    })
    return { resumeId: state.resumeId, exitCode }
  },
})
