import { atom } from 'recoil'

export interface Auth {
  signInWithGoogle?: () => Promise<void>
  signInWithGithub?: () => Promise<void>
  signInWithEmail?: (email: string, password: string) => Promise<void>
  createUserWithEmail?: (email: string, password: string) => Promise<void>
  signOut?: () => Promise<void>
  loading?: boolean
  isAuthenticated?: boolean
  error?: Error
  token?: string
}

export const authState = atom<Auth | null>({
  key: 'auth',
  default: null,
  dangerouslyAllowMutability: true,
})
