// Signing in to the creator's own accounts. Each uses the creator's own
// developer app: its client id and secret come from the environment (.env)
// or are kept with the engine's settings. Sign-in happens in the browser and
// comes back to the engine on this computer (OAuth with PKCE); the tokens
// stay with the engine, are refreshed here, and never reach the page.
import { createHash, randomBytes } from 'node:crypto'
import {
  X_PRICES,
  type AccountView,
  type AccountsView,
  type Provider,
  type XPrices
} from '../shared/accounts'
import { loadSetting, saveSetting } from './persistence'
import { Refusal } from './refusal'

type ProviderConfig = {
  authorize: string
  token: string
  scopes: string[]
  extra?: Record<string, string>
  /** Some token endpoints take the app's credentials as Basic auth. */
  basic?: boolean
  env: [string, string]
}
export const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      // Adding a video to the series' playlist needs this one (review 6).
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ],
    extra: { access_type: 'offline', prompt: 'consent' },
    env: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']
  },
  x: {
    authorize: 'https://x.com/i/oauth2/authorize',
    token: 'https://api.x.com/2/oauth2/token',
    scopes: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'media.write',
      'offline.access'
    ],
    basic: true,
    env: ['X_CLIENT_ID', 'X_CLIENT_SECRET']
  },
  linkedin: {
    authorize: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
    env: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']
  }
}

type App = { clientId: string; clientSecret: string }
type Tokens = {
  access: string
  refresh?: string
  expiresAt?: string
  name: string
  /** The account's own id: LinkedIn's member id authors its posts. */
  id?: string
  at: string
  /** The scopes the provider granted, space-separated. */
  scopes?: string
}

export const validProvider = (raw: unknown): Provider => {
  if (raw === 'google' || raw === 'x' || raw === 'linkedin') return raw
  throw new Refusal('Choose YouTube, X or LinkedIn')
}

const appOf = async (provider: Provider) => {
  const [idKey, secretKey] = PROVIDERS[provider].env
  const fromEnvironment = Boolean(process.env[idKey]?.trim())
  if (fromEnvironment)
    return {
      app: {
        clientId: process.env[idKey]!.trim(),
        clientSecret: process.env[secretKey]?.trim() || ''
      },
      fromEnvironment
    }
  const saved = (await loadSetting(`account-app-${provider}`)) as App | null
  return { app: saved?.clientId ? saved : null, fromEnvironment }
}

/** Keeps the creator's own app for a provider, with the engine only. */
export const saveAccountApp = async (provider: Provider, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const clientId = String(value.clientId || '').trim()
  const given = String(value.clientSecret || '').trim()
  if (!clientId || clientId.length > 300)
    throw new Refusal('Add the app’s client id')
  const previous = (await loadSetting(`account-app-${provider}`)) as App | null
  // An empty secret keeps the one already kept: the page never shows it.
  const clientSecret = given || previous?.clientSecret || ''
  if (clientSecret.length > 500) throw new Refusal('That secret is too long')
  await saveSetting(`account-app-${provider}`, { clientId, clientSecret })
  return accountsView()
}

export const redirectUri = (provider: Provider) =>
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}/api/accounts/${provider}/callback`

const tokensOf = async (provider: Provider) =>
  (await loadSetting(`account-${provider}`)) as Tokens | null

/** What the page may know: apps set up, who is connected; never secrets. */
// Each provider's last sign-in, for the dialog to say how it ended
// (review 6: a failed one was never reported).
const lastSignIns = new Map<
  Provider,
  { ok: boolean; error?: string; at: string }
>()
export const recordSignIn = (
  provider: Provider,
  result: { ok: boolean; error?: string }
) => lastSignIns.set(provider, { ...result, at: new Date().toISOString() })

export const accountsView = async (): Promise<AccountsView> => {
  const accounts: AccountView[] = []
  for (const provider of Object.keys(PROVIDERS) as Provider[]) {
    const { app, fromEnvironment } = await appOf(provider)
    const tokens = await tokensOf(provider)
    accounts.push({
      provider,
      clientId: app?.clientId || null,
      hasSecret: Boolean(app?.clientSecret),
      fromEnvironment,
      redirectUri: redirectUri(provider),
      ...(lastSignIns.has(provider)
        ? { lastSignIn: lastSignIns.get(provider) }
        : {}),
      connected: tokens
        ? {
            name: tokens.name,
            at: tokens.at,
            ...(provider === 'linkedin' && tokens.expiresAt
              ? { expiresAt: tokens.expiresAt }
              : {}),
            // Connected before playlists were asked for: sign in again.
            ...(provider === 'google' &&
            !/youtube\.force-ssl/.test(tokens.scopes || '')
              ? { signInAgain: 'Sign in again to add videos to playlists' }
              : {})
          }
        : null
    })
  }
  const prices = ((await loadSetting('x-prices')) as XPrices | null) || X_PRICES
  return { accounts, xPrices: prices }
}

export const saveXPrices = async (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const post = Number(value.post)
  const postWithLink = Number(value.postWithLink)
  if (
    ![post, postWithLink].every((n) => Number.isFinite(n) && n >= 0 && n < 100)
  )
    throw new Refusal('Give each price in dollars')
  await saveSetting('x-prices', { post, postWithLink })
  return accountsView()
}

const pending = new Map<
  string,
  { provider: Provider; verifier: string; at: number }
>()
const base64url = (bytes: Buffer) => bytes.toString('base64url')

/** The provider's sign-in page, for the creator's browser. */
export const connectAccount = async (provider: Provider) => {
  const { app } = await appOf(provider)
  if (!app) throw new Refusal('Add your app’s client id first')
  const state = base64url(randomBytes(24))
  const verifier = base64url(randomBytes(48))
  for (const [key, item] of pending)
    if (Date.now() - item.at > 15 * 60_000) pending.delete(key)
  pending.set(state, { provider, verifier, at: Date.now() })
  const config = PROVIDERS[provider]
  const url = new URL(config.authorize)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: app.clientId,
    redirect_uri: redirectUri(provider),
    scope: config.scopes.join(' '),
    state,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    ...config.extra
  }).toString()
  return { url: url.href }
}

const tokenRequest = async (
  provider: Provider,
  body: Record<string, string>
) => {
  const { app } = await appOf(provider)
  if (!app) throw new Refusal('Add your app’s client id first')
  const config = PROVIDERS[provider]
  const response = await fetch(config.token, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(config.basic && app.clientSecret
        ? {
            authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString('base64')}`
          }
        : {})
    },
    body: new URLSearchParams({
      ...body,
      client_id: app.clientId,
      ...(!config.basic && app.clientSecret
        ? { client_secret: app.clientSecret }
        : {})
    }),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok)
    throw new Refusal(
      `${provider === 'google' ? 'Google' : provider === 'x' ? 'X' : 'LinkedIn'} refused the sign-in (${response.status})`
    )
  return (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
}

const expiry = (seconds?: number) =>
  seconds ? new Date(Date.now() + seconds * 1000).toISOString() : undefined

/** Who signed in: the channel, the X handle, the LinkedIn member. */
const whoAmI = async (provider: Provider, access: string) => {
  const get = async (url: string) => {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${access}` },
      signal: AbortSignal.timeout(30_000)
    })
    return response.ok
      ? ((await response.json()) as Record<string, unknown>)
      : {}
  }
  if (provider === 'google') {
    const body = await get(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'
    )
    const channel = (
      body.items as
        | Array<{ id: string; snippet: { title: string } }>
        | undefined
    )?.[0]
    return { name: channel?.snippet.title || 'No channel yet', id: channel?.id }
  }
  if (provider === 'x') {
    const body = await get('https://api.x.com/2/users/me')
    const user = body.data as { id: string; username: string } | undefined
    return { name: user ? `@${user.username}` : 'X account', id: user?.id }
  }
  const body = await get('https://api.linkedin.com/v2/userinfo')
  return {
    name: String(body.name || 'LinkedIn member'),
    id: body.sub ? String(body.sub) : undefined
  }
}

/** The provider sends the creator back here with a code; keep the tokens. */
export const finishConnect = async (
  provider: Provider,
  params: URLSearchParams
) => {
  const state = params.get('state') || ''
  const waiting = pending.get(state)
  pending.delete(state)
  if (!waiting || waiting.provider !== provider)
    throw new Refusal('This sign-in has expired; start again from the studio')
  if (params.get('error')) throw new Refusal('The sign-in was cancelled')
  const tokens = await tokenRequest(provider, {
    grant_type: 'authorization_code',
    code: params.get('code') || '',
    redirect_uri: redirectUri(provider),
    code_verifier: waiting.verifier
  })
  const who = await whoAmI(provider, tokens.access_token)
  const kept: Tokens = {
    access: tokens.access_token,
    ...(tokens.refresh_token ? { refresh: tokens.refresh_token } : {}),
    ...(tokens.expires_in ? { expiresAt: expiry(tokens.expires_in) } : {}),
    ...(tokens.scope ? { scopes: tokens.scope } : {}),
    ...who,
    at: new Date().toISOString()
  }
  await saveSetting(`account-${provider}`, kept)
  return kept.name
}

export const disconnectAccount = async (provider: Provider) => {
  await saveSetting(`account-${provider}`, null)
  return accountsView()
}

/** Whether YouTube lets the studio add videos to playlists: a sign-in
 * from before the playlist scope needs to be made again. */
export const canEditPlaylists = async () => {
  const tokens = await tokensOf('google')
  return Boolean(
    tokens?.scopes &&
    /youtube\.force-ssl|auth\/youtube(\s|$)/.test(tokens.scopes)
  )
}

/** A current access token, refreshed when it is about to expire. */
export const accessToken = async (provider: Provider) => {
  const tokens = await tokensOf(provider)
  if (!tokens)
    throw new Refusal(
      `Connect ${provider === 'google' ? 'YouTube' : provider === 'x' ? 'X' : 'LinkedIn'} first`
    )
  if (!tokens.expiresAt || Date.parse(tokens.expiresAt) - Date.now() > 60_000)
    return { access: tokens.access, id: tokens.id }
  if (!tokens.refresh)
    throw new Refusal('Sign in again: the connection has expired')
  const fresh = await tokenRequest(provider, {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh
  })
  await saveSetting(`account-${provider}`, {
    ...tokens,
    access: fresh.access_token,
    refresh: fresh.refresh_token || tokens.refresh,
    expiresAt: expiry(fresh.expires_in)
  })
  return { access: fresh.access_token, id: tokens.id }
}

/** A request as the connected account. */
export const accountFetch = async (
  provider: Provider,
  url: string,
  init: RequestInit = {}
) => {
  const { access } = await accessToken(provider)
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${access}`
    },
    signal: init.signal || AbortSignal.timeout(120_000)
  })
}
