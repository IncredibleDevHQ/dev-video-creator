// Only the studio itself may drive the studio. A page the creator happens to
// visit must not change settings, start paid runs or post (a form or a fetch
// from another site), and neither may a site whose name was pointed at this
// computer (DNS rebinding).
import type { IncomingMessage } from 'node:http'

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]']

const hostnameOf = (url: string) => {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.hostname : ''
  } catch {
    return ''
  }
}

/** The names the studio answers to: this computer's, and the harness
 * origin's when one is set for the agent to call back on. */
const ownNames = (env: NodeJS.ProcessEnv) => {
  const names = new Set(LOOPBACK)
  const harness = env.MINIMAL_STUDIO_HARNESS_ORIGIN
  if (harness && hostnameOf(harness)) names.add(hostnameOf(harness))
  return names
}

/** Why a request is refused, or null when it is the studio's own. */
export const foreignRequest = (
  request: Pick<IncomingMessage, 'method' | 'headers'>,
  env: NodeJS.ProcessEnv = process.env
): string | null => {
  const names = ownNames(env)
  // Reads too: after a rebinding, another site's page could read notebooks.
  if (!names.has(hostnameOf(`http://${request.headers.host || ''}`)))
    return 'The studio answers only on this computer'
  const method = (request.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return null
  const origin = request.headers.origin
  if (origin !== undefined && !names.has(hostnameOf(String(origin))))
    return 'The studio refuses requests from other sites'
  // A page elsewhere can send a form or plain text without asking first;
  // JSON makes the browser ask, and the studio never says yes.
  if (
    (method === 'POST' || method === 'PATCH') &&
    !/^application\/json\s*(;|$)/i.test(
      String(request.headers['content-type'] || '')
    )
  )
    return 'Send the request as JSON'
  return null
}
