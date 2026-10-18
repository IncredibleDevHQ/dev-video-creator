import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import {
  request as httpRequest,
  type IncomingMessage,
  type Server
} from 'node:http'
import { WorkspaceAuth } from './workspace-auth'
import { createStudioServer } from './server'
const servers: Server[] = []
const credentials = {
  email: 'owner@example.test',
  password: 'test-only-password-123'
}
const passwordAuth = () =>
  new WorkspaceAuth({
    MINIMAL_STUDIO_AUTH_MODE: 'password',
    MINIMAL_STUDIO_LOGIN_EMAIL: credentials.email,
    MINIMAL_STUDIO_LOGIN_PASSWORD: credentials.password
  })
const start = async (auth = passwordAuth(), readOnly = false) => {
  const server = createStudioServer({ auth, readOnly }).listen(0, '127.0.0.1')
  servers.push(server)
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return {
    base,
    get: (path: string, cookie = '') =>
      fetch(base + path, { headers: { cookie } }),
    post: (path: string, body: unknown = {}, cookie = '', origin?: string) =>
      fetch(base + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
          ...(origin ? { origin } : {})
        },
        body: JSON.stringify(body)
      })
  }
}
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0]
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve())
          s.closeAllConnections()
        })
    )
  )
})
it('requires complete owner configuration and rejects unknown modes', () => {
  expect(
    () => new WorkspaceAuth({ MINIMAL_STUDIO_AUTH_MODE: 'password' })
  ).toThrow('at least 12')
  expect(() => new WorkspaceAuth({ MINIMAL_STUDIO_AUTH_MODE: 'none' })).toThrow(
    'local or password'
  )
})
it('offers local entry without credentials, persists browser identity, and signs out', async () => {
  const api = await start(new WorkspaceAuth({}))
  expect(await (await api.get('/api/auth/session')).json()).toEqual({
    mode: 'local',
    user: null
  })
  const login = await api.post('/api/auth/login')
  expect(login.status).toBe(200)
  expect(login.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Lax')
  const cookie = cookieOf(login)
  expect(
    (await (await api.get('/api/auth/session', cookie)).json()).user.name
  ).toBe('Local creator')
  expect((await api.get('/not-a-route')).status).toBe(404)
  expect(
    (await api.post('/api/auth/logout', {}, cookie)).headers.get('set-cookie')
  ).toContain('Max-Age=0')
  expect(
    (await (await api.get('/api/auth/session', cookie)).json()).user
  ).toBeNull()
  const remote = {
    socket: { remoteAddress: '192.168.1.2' },
    headers: {}
  } as IncomingMessage
  expect(new WorkspaceAuth({}).allowed(remote)).toBe(false)
})
it('protects data and assets, rejects forged sessions, rotates and revokes tokens', async () => {
  const api = await start()
  for (const path of [
    '/api/research-projects',
    '/objects/private.png',
    '/api/settings'
  ])
    expect((await api.get(path)).status).toBe(401)
  expect(
    (await api.get('/not-a-route', 'incredible_session_4320=forged')).status
  ).toBe(401)
  expect(
    (await api.post('/api/auth/login', { ...credentials, password: 'wrong' }))
      .status
  ).toBe(401)
  const first = cookieOf(await api.post('/api/auth/login', credentials))
  expect((await api.get('/not-a-route', first)).status).toBe(404)
  const second = cookieOf(await api.post('/api/auth/login', credentials, first))
  expect(second).not.toBe(first)
  expect((await api.get('/not-a-route', first)).status).toBe(401)
  expect(
    (await (await api.get('/api/auth/session', second)).json()).user.email
  ).toBe(credentials.email)
  await api.post('/api/auth/logout', {}, second)
  expect((await api.get('/not-a-route', second)).status).toBe(401)
})
it('expires sessions and limits failed logins', async () => {
  const api = await start()
  const cookie = cookieOf(await api.post('/api/auth/login', credentials))
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000)
  expect((await api.get('/not-a-route', cookie)).status).toBe(401)
  for (let i = 0; i < 5; i++)
    expect((await api.post('/api/auth/login', {})).status).toBe(401)
  const blocked = await api.post('/api/auth/login', credentials)
  expect(blocked.status).toBe(429)
  expect(blocked.headers.get('retry-after')).toBe('900')
})
it('allows sign-in in saved reviews while preserving read-only and origin guards', async () => {
  const api = await start(passwordAuth(), true)
  expect(
    (
      await api.post(
        '/api/auth/login',
        credentials,
        '',
        'https://foreign.example'
      )
    ).status
  ).toBe(403)
  const login = await api.post('/api/auth/login', credentials)
  expect(login.status).toBe(200)
  expect(
    (await api.post('/api/research-projects', {}, cookieOf(login))).status
  ).toBe(403)
})

it('rejects unauthenticated voice upgrades before accepting a socket', async () => {
  const api = await start()
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(
      api.base + '/api/voice',
      {
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          Origin: api.base
        }
      },
      (response) => {
        response.resume()
        resolve(response.statusCode)
      }
    )
    request.on('error', reject)
    request.end()
  })
  expect(status).toBe(401)
})

it('revokes already-open streaming channels when the owner signs out', async () => {
  const auth = passwordAuth(),
    api = await start(auth)
  const cookie = cookieOf(await api.post('/api/auth/login', credentials))
  const channel = new PassThrough()
  auth.track({ headers: { cookie } } as IncomingMessage, channel)
  expect(channel.destroyed).toBe(false)
  await api.post('/api/auth/logout', {}, cookie)
  expect(channel.destroyed).toBe(true)
})
