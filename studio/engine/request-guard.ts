// Only the studio itself may drive the studio. A page the creator happens to
// visit must not change settings, start paid runs or post (a form or a fetch
// from another site), and neither may a site whose name was pointed at this
// computer (DNS rebinding).
import type { IncomingMessage } from 'node:http'

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]']

/** A web address's name and port, or null when it is not one. */
const placeOf = (url: string) => {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname)
      return null
    return {
      name: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80))
    }
  } catch {
    return null
  }
}

/**
 * Where the studio answers: this computer's names, and the harness origin's
 * when one is set for the agent to call back on; on the engine's port, the
 * page's (whose server passes the page's requests on), the harness
 * origin's, and the port a request actually came in on.
 */
const ownPlaces = (env: NodeJS.ProcessEnv, arrivedOn?: number) => {
  const names = new Set(LOOPBACK)
  const ports = new Set([
    Number(env.MINIMAL_STUDIO_PORT || 4320),
    Number(env.MINIMAL_STUDIO_WEB_PORT || 4180)
  ])
  const harness = placeOf(env.MINIMAL_STUDIO_HARNESS_ORIGIN || '')
  if (harness) {
    names.add(harness.name)
    ports.add(harness.port)
  }
  if (arrivedOn) ports.add(arrivedOn)
  return {
    has: (place: { name: string; port: number } | null) =>
      Boolean(place && names.has(place.name) && ports.has(place.port))
  }
}

/** Why a request is refused, or null when it is the studio's own. */
export const foreignRequest = (
  request: Pick<IncomingMessage, 'method' | 'headers'> & {
    socket?: { localPort?: number }
  },
  env: NodeJS.ProcessEnv = process.env
): string | null => {
  const own = ownPlaces(env, request.socket?.localPort)
  // Reads too: after a rebinding, another site's page could read notebooks.
  if (!own.has(placeOf(`http://${request.headers.host || ''}`)))
    return 'The studio answers only on this computer'
  const method = (request.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return null
  const origin = request.headers.origin
  if (origin !== undefined && !own.has(placeOf(String(origin))))
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
