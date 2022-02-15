/**
 * This file defines typings for environment variables. :)
 * Since any variables exposed to your Vite source code will end up in your client bundle,
 * VITE_* variables should not contain any sensitive information.
 *
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_HASURA_SERVER: string
  VITE_HASURA_REST_SERVER: string
  VITE_HASURA_WEBSOCKET_SERVER: string
  VITE_FIREBASE_CONFIG: string
  VITE_SENTRY_DSN: string
  VITE_SENTRY_ENABLED: string
  VITE_STORAGE_BASE_URL: string
  VITE_AGORA_APP_ID: string
  VITE_PUBLIC_URL: string
  VITE_VECTORLY_TOKEN: string
  VITE_GITHUB_INTEGRATION_CONFIG: string
  VITE_AUTH_ENDPOINT: string
  VITE_COHERE_API_KEY: string
  VITE_LIVE_STREAM_ENDPOINT: string
  VITE_GOOGLE_FONTS_API_KEY: string
  VITE_HOCUSPOCUS_SERVER: string
  VITE_EMBED_PLAYER_URL: string
}
