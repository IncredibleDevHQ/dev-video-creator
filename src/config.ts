const firebaseConfig = JSON.parse(
  (import.meta.env.VITE_FIREBASE_CONFIG as string) || '{}'
)

const config = {
  /**
   * Hasura configs...
   */
  hasura: {
    server: import.meta.env.VITE_HASURA_SERVER,
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
  storage config
  */
  storage: {
    baseUrl: import.meta.env.VITE_STORAGE_BASE_URL,
  },
}

export default config
