import React from 'react'
import { RecoilRoot, useRecoilValue } from 'recoil'
import { Auth, authState } from './stores/auth.store'
import { User, userState } from './stores/user.store'
import AuthProvider from './utils/auth'

const App = () => {
  const { signInWithGoogle, signOut, token } =
    (useRecoilValue(authState) as Auth) || {}
  const user = (useRecoilValue(userState) as User) || {}

  return (
    <RecoilRoot>
      <AuthProvider>
        <div className="App">
          <>
            <button onClick={signInWithGoogle}>sign in</button>
            <button onClick={signOut}>sign out</button>
            <div>{JSON.stringify(user)}</div>
            <h1 className="text-2xl font-bold">{token}</h1>
          </>
        </div>
      </AuthProvider>
    </RecoilRoot>
  )
}

export default App
