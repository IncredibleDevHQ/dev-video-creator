import { atom, selector } from 'recoil'
import { User as FBUser } from 'firebase/auth'

export type FirebaseUser = FBUser

export const firebaseUserState = atom<Partial<FirebaseUser> | null>({
  key: 'firebaseUser',
  default: null,
  dangerouslyAllowMutability: true,
})

export type User = Partial<FirebaseUser> | null

export const userState = selector<User>({
  key: 'user',
  get: ({ get }) => {
    const firebaseUser = get(firebaseUserState)
    // TODO: Add databaseUser...

    return { ...firebaseUser }
  },
  dangerouslyAllowMutability: true,
})
