// eslint-disable-next-line
import axios from 'axios'
import { signInWithCustomToken } from 'firebase/auth'
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
      const statusResponse = await axios.get(`${config.auth.endpoint}/status`, {
        withCredentials: true,
      })
      const signedInUser = await signInWithCustomToken(
        auth.auth,
        statusResponse.data
      )
      setFbUser(signedInUser.user)
      getUserQuery()
    } catch (e) {
      window.location.href = config.auth.endpoint
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
    login()
  }, [])

  return children
}

export default AuthProvider
