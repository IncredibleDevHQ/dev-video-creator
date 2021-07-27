const firebaseConfig = JSON.parse(
  (import.meta.env.VITE_FIREBASE_CONFIG as string) || '{}'
)

const config = {
  /**
   * Hasura configs
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
}

export default config
