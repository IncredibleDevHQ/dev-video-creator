/**
 * This file defines typings for environment variables. :)
 * Since any variables exposed to your Vite source code will end up in your client bundle,
 * VITE_* variables should not contain any sensitive information.
 *
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  NODE_ENV: string
  VITE_HASURA_SERVER: string
  VITE_FIREBASE_CONFIG: string
  HASURA_ADMIN_SECRET: string
}
