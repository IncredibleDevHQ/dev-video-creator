import React, { useEffect } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Button, ScreenState, Text } from '../../components'
import config from '../../config'
import { ASSETS } from '../../constants'
import firebaseState from '../../stores/firebase.store'
import { userState } from '../../stores/user.store'

const Landing = () => {
  const { auth, loading } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)
  const history = useHistory()

  useEffect(() => {
    if (!user || loading) return
    history.replace('/dashboard')
  }, [])

  return loading ? (
    <ScreenState />
  ) : (
    <div className="h-screen flex flex-col items-center justify-center bg-dark-500">
      <img
        className="absolute top-0 left-0 m-4 h-10"
        src={ASSETS.ICONS.IncredibleLogoDark}
        alt="Incredible.dev"
      />
      {user ? <ScreenState /> : <Login />}
    </div>
  )
}

const Login = () => {
  return (
    <div className="w-full col-start-5 col-end-9 flex flex-col items-center justify-center -mt-12">
      <div className="flex">
        <div className="h-24 w-24 bg-white border-8 border-gray-300 rounded-full z-0" />
        <div className="h-32 w-32 rounded-full backdrop-filter backdrop-blur-xl -ml-10 z-20" />
        <div className="h-32 w-32 bg-gray-200 rounded-full -ml-32 z-10" />
      </div>
      <Text className="text-gray-100 font-bold text-2xl mt-12">
        Please login to continue
      </Text>
      <Button
        appearance="primary"
        type="button"
        className="w-1/5 py-2 mt-4"
        onClick={() => {
          window.location.href = `${config.auth.endpoint}/login?redirect=${window.location.href}`
        }}
      >
        Login
      </Button>
    </div>
  )
}

export default Landing
