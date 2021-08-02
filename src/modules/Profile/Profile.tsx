import React from 'react'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../../stores/auth.store'
import { User, userState } from '../../stores/user.store'

const Profile = () => {
  const { signOut } = (useRecoilValue(authState) as Auth) || {}
  const { displayName } = (useRecoilValue(userState) as User) || {}

  return (
    <div>
      <p>{displayName}</p>
      <button
        type="button"
        onClick={async () => {
          await signOut?.()
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

export default Profile
