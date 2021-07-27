// eslint-disable-next-line
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
import { useRecoilState, useSetRecoilState } from 'recoil'
import { authState } from '../stores/auth.store'
import { firebaseUserState } from '../stores/user.store'
import config from '../config'

const {
  firebase: { default: firebaseConfig },
} = config
const app = initializeApp(firebaseConfig)

const firebaseAuth = getAuth(app)
const database = getDatabase(app)

const AuthProvider = ({ children }: { children: JSX.Element }): JSX.Element => {
  const [auth, setAuth] = useRecoilState(authState)
  const setFirebaseUser = useSetRecoilState(firebaseUserState)

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(firebaseAuth, provider)
    } catch (error) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  const signOut = async () => {
    try {
      setAuth((auth) => ({ ...auth, loading: true }))
      await firebaseSignOut(firebaseAuth)
    } catch (error) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  useEffect(() => {
    setAuth((auth) => ({ ...auth, signInWithGoogle, signOut }))
  }, [])

  useEffect(() => {
    if (auth?.loading) {
      setAuth((auth) => ({ ...auth, error: undefined }))
    }
  }, [auth?.loading])

  useEffect(() => {
    onAuthStateChanged(firebaseAuth, async (user) => {
      setAuth((auth) => ({ ...auth, loading: true }))
      if (user) {
        const token = await user.getIdToken()
        const idTokenResult = await user.getIdTokenResult()
        const hasuraClaim = idTokenResult.claims['https://hasura.io/jwt/claims']

        if (hasuraClaim) {
          setAuth((auth) => ({
            ...auth,
            isAuthenticated: true,
            token,
            loading: false,
          }))
          setFirebaseUser((firebaseUser) => ({ ...firebaseUser, ...user }))
        } else {
          const metadataRef = ref(database, `metadata/${user.uid}/refreshTime`)

          onValue(metadataRef, async (data) => {
            if (!data.exists) return
            const token = await user.getIdToken(true)
            setAuth((auth) => ({
              ...auth,
              isAuthenticated: true,
              token,
              loading: false,
            }))
            setFirebaseUser((firebaseUser) => ({ ...firebaseUser, ...user }))
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

  return children
}

export default AuthProvider
