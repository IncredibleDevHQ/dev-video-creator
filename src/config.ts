const firebaseConfig = JSON.parse(
  (import.meta.env.VITE_FIREBASE_CONFIG as string) || '{}'
)

const config = {
  /**
   * Firebase configs...
   */
  firebase: {
    default: firebaseConfig,
  },
}

export default config
