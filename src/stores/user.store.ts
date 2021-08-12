import { atom, selector } from 'recoil'
import { User as FBUser } from 'firebase/auth'
import { UserFragment } from '../generated/graphql'

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
