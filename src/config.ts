const firebaseConfig = JSON.parse(
  (import.meta.env.VITE_FIREBASE_CONFIG as string) || '{}'
)

const githubIntegrationConfig = JSON.parse(
  (import.meta.env.VITE_GITHUB_INTEGRATION_CONFIG as string) || '{}'
)

const config = {
  env: process.env.DEPLOY_ENV || 'development',
  /**
   * Agora configs...
   */
  agora: {
    appId: import.meta.env.VITE_AGORA_APP_ID,
  },
  /**
   * Hasura configs...
   */
  hasura: {
    server: import.meta.env.VITE_HASURA_SERVER,
    restServer: import.meta.env.VITE_HASURA_REST_SERVER,
    wsServer: import.meta.env.VITE_HASURA_WEBSOCKET_SERVER,
  },
  /**
   * Firebase configs...
   */
  firebase: {
    default: firebaseConfig,
  },
  /**
   * Sentry configs...
   */
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: !!(import.meta.env.VITE_SENTRY_ENABLED === 'true'),
  },
  /**
   * Segmet configs...
   */
  segment: {
    apiKey: import.meta.env.VITE_SEGMENT_API_KEY,
  },
  /**
   * Cohere configs...
   */
  cohere: {
    apiKey: import.meta.env.VITE_COHERE_API_KEY,
  },
  /**
   * Storage configs...
   */
  storage: {
    baseUrl: import.meta.env.VITE_STORAGE_BASE_URL,
  },
  /**
   * Client configs...
   */
  client: {
    publicUrl: import.meta.env.VITE_PUBLIC_URL,
    studioUrl: import.meta.env.VITE_STUDIO_URL,
    embedPlayerUrl: import.meta.env.VITE_EMBED_PLAYER_URL,
  },
  /**
   * Integrations configs...
   */
  integrations: {
    github: {
      clientId: githubIntegrationConfig.clientId,
      scope: githubIntegrationConfig.scope,
    },
  },
  /**
   * Auth endpoint
   */
  auth: {
    endpoint: import.meta.env.VITE_AUTH_ENDPOINT,
  },

  liveStream: {
    endpoint: import.meta.env.VITE_LIVE_STREAM_ENDPOINT,
  },

  googleFonts: {
    apiKey: import.meta.env.VITE_GOOGLE_FONTS_API_KEY,
  },

  hocusPocus: {
    server: import.meta.env.VITE_HOCUSPOCUS_SERVER,
  },

  giphy: {
    apiKey: import.meta.env.VITE_GIPHY_API_KEY,
  },
}

export default config
