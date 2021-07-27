import React from 'react'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../stores/auth.store'
import { User, userState } from '../stores/user.store'

const Login = () => {
  const { signInWithGoogle, signOut, token } =
    (useRecoilValue(authState) as Auth) || {}
  const user = (useRecoilValue(userState) as User) || {}

  return (
    <div>
      <button type="button" onClick={signInWithGoogle}>
        sign in
      </button>
      <button type="button" onClick={signOut}>
        sign out
      </button>
      <div>{JSON.stringify(user)}</div>
      <h1 className="text-2xl font-bold">{token}</h1>
    </div>
  )
}

export default Login
