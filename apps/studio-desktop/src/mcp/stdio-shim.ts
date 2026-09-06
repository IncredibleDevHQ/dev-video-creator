// MCP stdio↔HTTP bridge (dist-electron/mcp-stdio.mjs). Harness CLIs spawn
// this with plain `node`; each newline-delimited JSON-RPC message on stdin is
// POSTed to the studio desktop app's MCP endpoint (STUDIO_MCP_URL, written
// into the per-run MCP config by the adapter) and the response is printed to
// stdout. Node builtins only — it must run outside Electron. When the app is
// not running, requests get a clear JSON-RPC tool error instead of a hang.
import { createInterface } from 'node:readline'

const endpoint = process.env.STUDIO_MCP_URL || ''

const write = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n')

const errorReply = (id: unknown, message: string) =>
  write({ jsonrpc: '2.0', id: id ?? null, error: { code: -32000, message } })

if (!endpoint) {
  // Still answer initialize so the handshake fails with a useful message.
  createInterface({ input: process.stdin }).on('line', line => {
    let id: unknown = null
    try { id = (JSON.parse(line) as { id?: unknown }).id } catch { /* keep null */ }
    errorReply(id, 'STUDIO_MCP_URL is not set — the studio desktop app writes it into the MCP config when it starts a run')
  })
} else {
  const pending: Array<{ line: string }> = []
  const flush = async () => {
    let next: { line: string } | undefined
    while ((next = pending.shift())) {
      const { line } = next
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue // Not JSON — ignore comments/banners the CLI may print.
      }
      const hasId = Object.prototype.hasOwnProperty.call(message, 'id')
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(message),
        })
        if (!response.ok) {
          if (hasId) errorReply(message.id, `studio MCP endpoint answered ${response.status}`)
          continue
        }
        const body = await response.json()
        // Notifications (no id) get no stdout line, per JSON-RPC.
        if (hasId && body && Object.keys(body).length) write(body)
      } catch (error) {
        if (hasId) {
          errorReply(
            message.id,
            `studio desktop app is not reachable at ${endpoint} (${error instanceof Error ? error.message : error}) — start the app first`,
          )
        }
      }
    }
  }
  createInterface({ input: process.stdin }).on('line', line => {
    if (!line.trim()) return
    pending.push({ line })
    if (pending.length === 1) void flush()
  })
}
