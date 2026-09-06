// Transport-agnostic MCP message handler (JSON-RPC 2.0, MCP protocol):
// initialize, notifications/*, ping, tools/list, tools/call. Hosted over HTTP
// by the desktop main (POST /mcp) and reached by harness CLIs through the
// stdio shim.
import { TOOLS, type ToolContext } from './tools'

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
        'Studio motion helpers for the motion-master skill: atomize, measure, plan_beats, resolve, validate, receipt, frames. Paths are absolute; outputs are files under motion/ plus a compact JSON summary.',
    })
  }
  if (method === 'ping') return reply(message.id, {})
  if (method === 'tools/list') {
    return reply(message.id, {
      tools: TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    })
  }
  if (method === 'tools/call') {
    const params = (message.params || {}) as { name?: string; arguments?: Record<string, unknown> }
    const tool = TOOLS.find(candidate => candidate.name === params.name)
    if (!tool) return replyError(message.id, -32602, `unknown tool "${params.name}"`)
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
