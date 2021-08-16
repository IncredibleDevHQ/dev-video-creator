/**
 * This file defines typings for environment variables. :)
 * Since any variables exposed to your Vite source code will end up in your client bundle,
 * VITE_* variables should not contain any sensitive information.
 *
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_HASURA_SERVER: string
  VITE_FIREBASE_CONFIG: string
  VITE_SENTRY_DSN: string
  VITE_SENTRY_ENABLED: string
  VITE_STORAGE_BASE_URL: string
  VITE_AGORA_APP_ID: string
}
