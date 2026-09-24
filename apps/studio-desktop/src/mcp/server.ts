// Transport-agnostic MCP message handler (JSON-RPC 2.0, MCP protocol):
// initialize, notifications/*, ping, tools/list, tools/call. Hosted over HTTP
// by the desktop main (POST /mcp) and reached by harness CLIs through the
// stdio shim.
import { TOOLS, type ToolContext } from './tools'
import { PLANNING_TOOL_NAMES } from './planning-tools'

// What a run may see and call. A planning run is offered only the planning
// tools; every other studio tool — artwork, narration, preview, finish,
// export — is refused by the product whatever the harness asks for.
const toolsFor = (context: ToolContext) =>
  context.scope === 'planning' ? TOOLS.filter(tool => PLANNING_TOOL_NAMES.has(tool.name)) : TOOLS

const PROTOCOL_VERSION = '2024-11-05'

type JsonRpcMessage = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const reply = (id: string | number | null | undefined, result: unknown) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  result,
})

const replyError = (
  id: string | number | null | undefined,
  code: number,
  message: string,
) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export const handleMcpMessage = async (
  message: JsonRpcMessage,
  context: ToolContext,
): Promise<Record<string, unknown> | null> => {
  const method = String(message.method || '')
  if (method.startsWith('notifications/')) return null
  if (method === 'initialize') {
    const params = (message.params || {}) as { protocolVersion?: string }
    return reply(message.id, {
      protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'incredible-studio', version: '0.1.0' },
      instructions:
        context.scope === 'planning'
          ? 'Studio planning tools for a planning-only run: plan_context, plan_assets, plan_submit_brief, plan_submit_treatment. Nothing here generates artwork, audio, recordings, compositions or exports.'
          : 'Studio motion helpers for the motion-master skill: atomize, direct (the director: measured staging options per beat), measure, plan_beats, resolve, validate, receipt, frames. Paths are absolute; outputs are files under motion/ plus a compact JSON summary.',
    })
  }
  if (method === 'ping') return reply(message.id, {})
  if (method === 'tools/list') {
    return reply(message.id, {
      tools: toolsFor(context).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    })
  }
  if (method === 'tools/call') {
    const params = (message.params || {}) as { name?: string; arguments?: Record<string, unknown> }
    const tool = toolsFor(context).find(candidate => candidate.name === params.name)
    if (!tool) {
      return TOOLS.some(candidate => candidate.name === params.name)
        ? replyError(message.id, -32602, `"${params.name}" is not available to a planning run: planning never generates artwork, audio, recordings, compositions or exports`)
        : replyError(message.id, -32602, `unknown tool "${params.name}"`)
    }
    try {
      const summary = await tool.call(params.arguments || {}, context)
      return reply(message.id, {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        isError: false,
      })
    } catch (error) {
      return reply(message.id, {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      })
    }
  }
  return replyError(message.id, -32601, `method not found: ${method}`)
}
