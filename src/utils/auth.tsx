import React, { useEffect } from 'react'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { getDatabase, ref, onValue } from 'firebase/database'
import { initializeApp } from 'firebase/app'
import { authState } from '../stores/auth.store'
import { useSetRecoilState } from 'recoil'
import { firebaseUserState } from '../stores/user.store'
import config from '../config'

const {
  firebase: { default: firebaseConfig },
} = config
const app = initializeApp(firebaseConfig)

const auth = getAuth(app)
const database = getDatabase(app)

const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const setAuth = useSetRecoilState(authState)
  const setFirebaseUser = useSetRecoilState(firebaseUserState)

  useEffect(() => {
    setAuth((auth) => ({ ...auth, signInWithGoogle, signOut }))
  }, [])

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      console.log({ user })
      if (user) {
        const token = await user.getIdToken()
        const idTokenResult = await user.getIdTokenResult()
        const hasuraClaim = idTokenResult.claims['https://hasura.io/jwt/claims']

        if (hasuraClaim) {
          setAuth((auth) => ({ ...auth, isAuthenticated: true, token }))
          setFirebaseUser((firebaseUser) => ({ ...firebaseUser, user }))
        } else {
          const metadataRef = ref(
            database,
            'metadata/' + user.uid + '/refreshTime'
          )

          onValue(metadataRef, async (data) => {
            if (!data.exists) return
            const token = await user.getIdToken(true)
            setAuth((auth) => ({ ...auth, isAuthenticated: true, token }))
            setFirebaseUser((firebaseUser) => ({ ...firebaseUser, user }))
          })
        }
      } else {
        setAuth((auth) => ({
          ...auth,
          isAuthenticated: false,
          loading: false,
          token: undefined,
        }))
        setFirebaseUser(null)
      }
    })
  }, [])

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.log({ error })
    }
  }

  const signOut = async () => {
    try {
      setAuth((auth) => ({ ...auth, loading: true }))
      await firebaseSignOut(auth)
    } catch (error) {
      console.log(error)
    }
  }

  return children
}

export default AuthProvider
