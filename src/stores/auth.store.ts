import { atom } from 'recoil'

export interface Auth {
  signInWithGoogle?: () => Promise<void>
  signOut?: () => Promise<void>
  loading?: boolean
  isAuthenticated?: boolean
  error?: any
  token?: string
}

export const authState = atom<Auth | null>({
  key: 'auth',
  default: null,
  dangerouslyAllowMutability: true,
})
