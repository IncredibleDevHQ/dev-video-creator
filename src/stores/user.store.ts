import { atom, selector } from 'recoil'
import { User as FBUser } from 'firebase/auth'
import { UserFragment, VerificationStatusEnum } from '../generated/graphql'

export type FirebaseUser = FBUser

export const firebaseUserState = atom<Partial<FirebaseUser> | null>({
  key: 'firebaseUser',
  default: null,
  dangerouslyAllowMutability: true,
})

export const databaseUserState = atom<Partial<UserFragment> | null>({
  key: 'databaseUser',
  default: null,
})

interface VerificationStatus {
  status: VerificationStatusEnum | null
  loading: boolean
}
export const userVerificationStatus = atom<VerificationStatus | null>({
  default: null,
  key: 'userVerificationStatus',
})

export type User = (Partial<FirebaseUser> & Partial<UserFragment>) | null

export const userState = selector<User>({
  key: 'user',
  get: ({ get }) => {
    const firebaseUser = get(firebaseUserState)
    const User = get(databaseUserState)

    return { ...firebaseUser, ...User }
  },
  dangerouslyAllowMutability: true,
})
