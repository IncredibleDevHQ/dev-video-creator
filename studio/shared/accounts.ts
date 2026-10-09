// The creator's own accounts: YouTube (through Google), X and LinkedIn,
// each signed in with the creator's own developer app. What the page sees:
// whether an app is set up and who is connected, never a secret or token.

export type Provider = 'google' | 'x' | 'linkedin'

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn'
}

/** Where each provider's developer app is made. */
export const PROVIDER_CONSOLES: Record<Provider, string> = {
  google: 'https://console.cloud.google.com/apis/credentials',
  x: 'https://developer.x.com/en/portal/dashboard',
  linkedin: 'https://www.linkedin.com/developers/apps'
}

export type AccountView = {
  provider: Provider
  /** The app's client id, when one is set (it is not a secret). */
  clientId: string | null
  hasSecret: boolean
  /** From the engine's environment: changed in .env, not here. */
  fromEnvironment: boolean
  /** The address to register as the app's redirect. */
  redirectUri: string
  /** How the last sign-in ended, while the engine runs. */
  lastSignIn?: { ok: boolean; error?: string; at: string }
  connected: {
    name: string
    at: string
    expiresAt?: string
    /** Connected before a permission the studio now needs: why to sign in
     * again (review 6: playlists). */
    signInAgain?: string
  } | null
}

/** X charges the app's owner per post; prices change, so they are set. */
export type XPrices = { post: number; postWithLink: number }
export const X_PRICES: XPrices = { post: 0.015, postWithLink: 0.2 }

export type AccountsView = {
  accounts: AccountView[]
  xPrices: XPrices
}

/** LinkedIn tokens last 60 days; the creator signs in again before then. */
export const expiresSoon = (account: AccountView, now = Date.now()) =>
  Boolean(
    account.connected?.expiresAt &&
    Date.parse(account.connected.expiresAt) - now < 7 * 86_400_000
  )
