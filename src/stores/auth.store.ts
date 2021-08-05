import { UserCredential } from 'firebase/auth'
import { atom } from 'recoil'

export interface Auth {
  signInWithGoogle?: () => Promise<UserCredential>
  signInWithGithub?: () => Promise<UserCredential>
  signInWithEmail?: (email: string, password: string) => Promise<UserCredential>
  createUserWithEmail?: (
    email: string,
    password: string
  ) => Promise<UserCredential>
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
