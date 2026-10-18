import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'

const lifetime = 7 * 24 * 60 * 60 * 1000
const loopback = (address = '') =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex')
type User = { name: string; email?: string }
/** A local owner session. Existing origin/DNS-rebinding guards still apply.
 * Local mode intentionally trusts loopback tools; password mode gates all data. */
export class WorkspaceAuth {
  readonly mode: 'local' | 'password'
  private email: string
  private salt = randomBytes(16)
  private password: Buffer | null
  private sessions = new Map<string, { user: User; expires: number }>()
  private attempts = new Map<string, { count: number; until: number }>()
  private channels = new Map<string, Set<ServerResponse | Duplex>>()
  private cookie: string
  constructor(env: NodeJS.ProcessEnv = process.env) {
    const mode = env.MINIMAL_STUDIO_AUTH_MODE || 'local'
    if (!['local', 'password'].includes(mode))
      throw new Error('MINIMAL_STUDIO_AUTH_MODE must be local or password')
    this.mode = mode as typeof this.mode
    this.email = (env.MINIMAL_STUDIO_LOGIN_EMAIL || '').trim().toLowerCase()
    const password = env.MINIMAL_STUDIO_LOGIN_PASSWORD || ''
    if (
      mode === 'password' &&
      (!this.email.includes('@') || password.length < 12)
    )
      throw new Error(
        'Password mode needs MINIMAL_STUDIO_LOGIN_EMAIL and a MINIMAL_STUDIO_LOGIN_PASSWORD of at least 12 characters'
      )
    this.password =
      mode === 'password' ? scryptSync(password, this.salt, 32) : null
    this.cookie = `incredible_session_${Number(env.MINIMAL_STUDIO_PORT || 4320)}`
  }
  private token(request: IncomingMessage) {
    return (
      (request.headers.cookie || '')
        .split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${this.cookie}=`))
        ?.slice(this.cookie.length + 1) || ''
    )
  }
  user(request: IncomingMessage): User | null {
    const key = digest(this.token(request)),
      session = this.sessions.get(key)
    if (!session) return null
    if (session.expires <= Date.now()) {
      this.revoke(key)
      return null
    }
    return session.user
  }
  private revoke(key: string) {
    this.sessions.delete(key)
    for (const channel of this.channels.get(key) || []) channel.destroy()
    this.channels.delete(key)
  }
  /** Logout and expiry also close already-open event streams and voice sockets. */
  track(request: IncomingMessage, channel: ServerResponse | Duplex) {
    if (this.mode !== 'password') return
    const key = digest(this.token(request)),
      session = this.sessions.get(key)
    if (!session) return
    const channels =
      this.channels.get(key) || new Set<ServerResponse | Duplex>()
    channels.add(channel)
    this.channels.set(key, channels)
    const timer = setTimeout(
      () => this.revoke(key),
      Math.max(1, session.expires - Date.now())
    )
    timer.unref()
    channel.once('close', () => {
      clearTimeout(timer)
      channels.delete(channel)
      if (!channels.size) this.channels.delete(key)
    })
  }
  allowed(request: IncomingMessage) {
    return this.mode === 'local'
      ? loopback(request.socket.remoteAddress)
      : Boolean(this.user(request))
  }
  private setCookie(
    request: IncomingMessage,
    response: ServerResponse,
    token: string,
    maxAge: number
  ) {
    const secure =
      (request.socket as { encrypted?: boolean }).encrypted ||
      request.headers.origin?.startsWith('https://')
    response.setHeader(
      'Set-Cookie',
      `${this.cookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
    )
  }
  async route(
    url: URL,
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<boolean> {
    if (!url.pathname.startsWith('/api/auth/')) return false
    const send = (status: number, body: unknown) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      })
      response.end(JSON.stringify(body))
      return true
    }
    if (url.pathname === '/api/auth/session' && request.method === 'GET')
      return send(200, { mode: this.mode, user: this.user(request) })
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      this.revoke(digest(this.token(request)))
      this.setCookie(request, response, '', 0)
      return send(200, { ok: true })
    }
    if (url.pathname !== '/api/auth/login' || request.method !== 'POST')
      return send(404, { error: 'Not found' })
    if (this.mode === 'local' && !loopback(request.socket.remoteAddress))
      return send(403, {
        error: 'Local development sign-in is available only on this computer.'
      })
    const address = request.socket.remoteAddress || 'unknown'
    let attempt = this.attempts.get(address)
    if (attempt && attempt.until <= Date.now()) {
      this.attempts.delete(address)
      attempt = undefined
    }
    if (attempt && attempt.count >= 5) {
      response.setHeader(
        'Retry-After',
        String(Math.ceil((attempt.until - Date.now()) / 1000))
      )
      return send(429, { error: 'Too many attempts. Try again in 15 minutes.' })
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 8192) {
        response.setHeader('Connection', 'close')
        return send(413, { error: 'Sign-in request is too large.' })
      }
      chunks.push(chunk)
    }
    let body: Record<string, unknown>
    try {
      body = JSON.parse(Buffer.concat(chunks).toString())
      if (!body || typeof body !== 'object') throw new Error()
    } catch {
      return send(400, { error: 'Send a valid sign-in request.' })
    }
    if (this.mode === 'password') {
      const password = typeof body.password === 'string' ? body.password : ''
      const candidate = scryptSync(password, this.salt, 32)
      const valid =
        timingSafeEqual(candidate, this.password!) &&
        typeof body.email === 'string' &&
        body.email.trim().toLowerCase() === this.email
      if (!valid) {
        this.attempts.set(address, {
          count: (attempt?.count || 0) + 1,
          until: attempt?.until || Date.now() + 15 * 60 * 1000
        })
        return send(401, { error: 'Email or password is incorrect.' })
      }
    }
    this.attempts.delete(address)
    for (const [key, session] of this.sessions)
      if (session.expires <= Date.now()) this.revoke(key)
    this.revoke(digest(this.token(request)))
    if (this.sessions.size >= 500)
      return send(503, { error: 'Too many active sessions. Try again later.' })
    const user: User =
      this.mode === 'local'
        ? { name: 'Local creator' }
        : { name: this.email.split('@')[0], email: this.email }
    const token = randomBytes(32).toString('base64url')
    this.sessions.set(digest(token), { user, expires: Date.now() + lifetime })
    this.setCookie(request, response, token, lifetime / 1000)
    return send(200, { mode: this.mode, user })
  }
}
