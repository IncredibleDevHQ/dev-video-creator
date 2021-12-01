// eslint-disable-next-line
import * as Sentry from '@sentry/react'
import axios from 'axios'
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'
import { useEffect } from 'react'
import { useRecoilState, useSetRecoilState } from 'recoil'
import config from '../config'
import { useGetUserLazyQuery } from '../generated/graphql'
import firebaseState from '../stores/firebase.store'
import {
  databaseUserState,
  firebaseUserState,
  userVerificationStatus,
} from '../stores/user.store'

const AuthProvider = ({ children }: { children: JSX.Element }): JSX.Element => {
  const [auth, setAuth] = useRecoilState(firebaseState)
  const setFbUser = useSetRecoilState(firebaseUserState)
  const [dbUser, setDbUser] = useRecoilState(databaseUserState)
  const setVerificationStatus = useSetRecoilState(userVerificationStatus)

  const [getUserQuery, { data: me }] = useGetUserLazyQuery()

  const login = async () => {
    try {
      setAuth({ ...auth, loading: true })
      const statusResponse = await axios.get(
        `${config.auth.endpoint}/api/status`,
        {
          withCredentials: true,
        }
      )
      const signedInUser = await signInWithCustomToken(
        auth.auth,
        statusResponse.data as string
      )
      setFbUser(signedInUser.user)
      getUserQuery()
    } catch (e) {
      setAuth({ ...auth, loading: false })
    }
  }

  useEffect(() => {
    if (!me?.Me || dbUser) return
    setDbUser(me.Me)
    setVerificationStatus(me.Me.verificationStatus || null)
    setAuth({ ...auth, loading: false })
  }, [me])

  useEffect(() => {
    onAuthStateChanged(auth.auth, async (user) => {
      if (user) {
        const token = await user.getIdToken(true)
        const idTokenResult = await user.getIdTokenResult(true)
        const hasuraClaim = idTokenResult.claims['https://hasura.io/jwt/claims']

        if (hasuraClaim) {
          setAuth((auth) => ({
            ...auth,
            token,
            loading: false,
          }))
          setFbUser((firebaseUser) => ({ ...firebaseUser, ...user }))
        }
      } else {
        setAuth((auth) => ({
          ...auth,
          loading: false,
          token: null,
        }))
      }
    })
  }, [])

  useEffect(() => {
    login()
  }, [])

  return children
}

export default AuthProvider
