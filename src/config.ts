const firebaseConfig = JSON.parse(
  (import.meta.env.VITE_FIREBASE_CONFIG as string) || '{}'
)

const githubIntegrationConfig = JSON.parse(
  (import.meta.env.VITE_GITHUB_INTEGRATION_CONFIG as string) || '{}'
)

const config = {
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
}

export default config
