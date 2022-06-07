// eslint-disable-next-line
import * as Sentry from '@sentry/react'
import axios from 'axios'
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'
import LogRocket from 'logrocket'
import React, { useEffect } from 'react'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { ScreenState } from '../components'
import config from '../config'
import firebaseState from '../stores/firebase.store'
import { databaseUserState, firebaseUserState } from '../stores/user.store'

const AuthProvider = ({ children }: { children: JSX.Element }): JSX.Element => {
  const [auth, setAuth] = useRecoilState(firebaseState)
  const setFbUser = useSetRecoilState(firebaseUserState)
  const [dbUser, setDbUser] = useRecoilState(databaseUserState)

  const login = async () => {
    try {
      setAuth({ ...auth, loading: true })
      const { data, status } = await axios.post(
        `${config.auth.endpoint}/api/status`,
        {},
        {
          withCredentials: true,
        }
      )
      // console.log('auth data', data)
      if (status !== 200) {
        throw new Error('Failed to get user status')
      }
      const { user } = await signInWithCustomToken(auth.auth, data as string)
      // console.log('FB user', user)
      setFbUser(user)

      Sentry.setUser({
        email: user.email || undefined,
        id: user.uid,
      })

      window.analytics.identify(user.email, {
        email: user.email,
        userId: user.uid,
      })

      LogRocket.identify(user.uid, {
        email: user.email || 'none',
        userId: user.uid,
      })

      const idToken = await user.getIdToken()
      if (!dbUser) {
        // console.log('no db user')
        const meResponse = await axios.post(
          `${config.hasura.restServer}/me`,
          {
            sub: user.uid,
          },
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        )
        if (!meResponse.data?.User_by_pk)
          throw new Error('Response returned null')

        Sentry.setUser({
          email: user.email || undefined,
          id: user.uid,
          username: meResponse.data.User_by_pk.displayName || undefined,
        })

        if (meResponse.data.User_by_pk.displayName) {
          LogRocket.identify(user.uid, {
            name: meResponse.data.User_by_pk.displayName,
          })
          window.analytics.identify(user.email, {
            name: meResponse.data.User_by_pk.displayName,
          })
        }

        setDbUser(meResponse.data.User_by_pk)
      }

      // repeat call to /login endpoint to update auth token in session cookie
      // console.log('idToken', idToken)
      axios.post(
        `${config.auth.endpoint}/api/login`,
        {
          idToken,
        },
        {
          headers: {
            'Content-Type': 'application/json', // 'text/plain',
            'Access-Control-Allow-Origin': `${config.client.studioUrl}`,
          },
          withCredentials: true,
        }
      )
    } catch (e) {
      setAuth({ ...auth, loading: false })
      if (!window.location.pathname.startsWith('/present')) {
        window.location.href = `${config.auth.endpoint}/login?redirect=${window.location.href}`
      }
    }
  }

  useEffect(() => {
    onAuthStateChanged(auth.auth, async (user) => {
      if (user) {
        const token = await user.getIdToken(true)
        setAuth({
          ...auth,
          loading: false,
          token,
        })
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

  if (!dbUser?.sub && !window.location.pathname.startsWith('/present'))
    return <ScreenState title="Just a jiffy" loading />

  return children
}

export default AuthProvider
