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

  const [getUserQuery] = useGetUserLazyQuery()

  const login = async () => {
    try {
      setAuth({ ...auth, loading: true })
      // console.log('logging in....')
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
        window.location.href = `${config.auth.endpoint}/login`
      }
      const { user } = await signInWithCustomToken(auth.auth, data as string)
      // console.log('FB user', user)
      setFbUser(user)

      if (!dbUser) {
        // console.log('no db user')
        const { data, error } = await getUserQuery()
        if (error) throw error
        if (!data?.Me) throw new Error('Response returned null')
        setDbUser(data.Me)
        setVerificationStatus(data.Me.verificationStatus || null)
      }

      // repeat call to /login endpoint to update auth token in session cookie
      const idToken = await user.getIdToken()
      // console.log('idToken', idToken)
      await axios.post(
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
      // console.log(JSON.stringify(e))
      setAuth({ ...auth, loading: false })
    } finally {
      setAuth((auth) => ({ ...auth, loading: false }))
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

  return children
}

export default AuthProvider
