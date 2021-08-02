// eslint-disable-next-line
import React, { useEffect } from 'react'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { authState } from '../stores/auth.store'
import { databaseUserState, firebaseUserState } from '../stores/user.store'
import firebaseState from '../stores/firebase.store'
import { useGetUserLazyQuery } from '../generated/graphql'

const AuthProvider = ({ children }: { children: JSX.Element }): JSX.Element => {
  const { database, auth: firebaseAuth } = useRecoilValue(firebaseState)
  const [auth, setAuth] = useRecoilState(authState)
  const setFirebaseUser = useSetRecoilState(firebaseUserState)
  const setDatabaseUser = useSetRecoilState(databaseUserState)

  const [getUserQuery, { data: me }] = useGetUserLazyQuery()

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error: any) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(firebaseAuth, provider)
    } catch (error: any) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  const signInWithGithub = async () => {
    try {
      const provider = new GithubAuthProvider()
      await signInWithPopup(firebaseAuth, provider)
    } catch (error: any) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  const createUserWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error: any) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  const signOut = async () => {
    try {
      setAuth((auth) => ({ ...auth, loading: true }))
      await firebaseSignOut(firebaseAuth)
    } catch (error: any) {
      setAuth((auth) => ({ ...auth, error }))
    }
  }

  useEffect(() => {
    setAuth((auth) => ({
      ...auth,
      signInWithEmail,
      signInWithGoogle,
      signInWithGithub,
      createUserWithEmail,
      signOut,
    }))
  }, [])

  useEffect(() => {
    if (auth?.loading) {
      setAuth((auth) => ({ ...auth, error: undefined }))
    }
  }, [auth?.loading])

  useEffect(() => {
    if (auth?.token === undefined) return
    getUserQuery()
  }, [auth?.token])

  useEffect(() => {
    if (!me?.Me) return
    setDatabaseUser(me.Me)
  }, [me])

  useEffect(() => {
    onAuthStateChanged(firebaseAuth, async (user) => {
      setAuth((auth) => ({ ...auth, loading: true }))
      if (user) {
        const token = await user.getIdToken(true)
        const idTokenResult = await user.getIdTokenResult(true)
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
