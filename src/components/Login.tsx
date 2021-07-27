import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../stores/auth.store'
import { User, userState } from '../stores/user.store'

const Login = () => {
  const { signInWithGoogle, signOut, token, isAuthenticated } =
    (useRecoilValue(authState) as Auth) || {}
  const user = (useRecoilValue(userState) as User) || {}
  const history = useHistory()

  useEffect(() => {
    history.push('/home')
  }, [isAuthenticated])

  return (
    <div>
      <button onClick={signInWithGoogle}>sign in</button>
      <button onClick={signOut}>sign out</button>
      <div>{JSON.stringify(user)}</div>
      <h1 className="text-2xl font-bold">{token}</h1>
      <p>{'ssj' + isAuthenticated}</p>
    </div>
  )
}

export default Login
