// Node-only bridge, copied from the desktop protocol and scoped to one run.
import { createInterface } from 'node:readline'
const endpoint = process.env.STUDIO_MCP_URL || ''
const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)
let queue = Promise.resolve()
createInterface({ input: process.stdin }).on('line', (line) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      let message
      try {
        message = JSON.parse(line)
      } catch {
        return
      }
      const hasId = Object.hasOwn(message, 'id')
      try {
        if (!endpoint)
          throw new Error('The studio did not provide a run endpoint')
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(900000)
        })
        if (!response.ok)
          throw new Error(
            `The studio submission endpoint answered ${response.status}`
          )
        const body = await response.json()
        if (hasId && body && Object.keys(body).length) write(body)
      } catch (error) {
        if (hasId)
          write({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32000,
              message:
                error instanceof Error
                  ? error.message
                  : 'Studio submission failed'
            }
          })
      }
    })
})
