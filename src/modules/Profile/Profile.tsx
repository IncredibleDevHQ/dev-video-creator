import React from 'react'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../../stores/auth.store'
import { User, userState } from '../../stores/user.store'
import { ProfileDetails, UserSeries, UserFlicks } from './components/index'

const Profile = () => {
  const { signOut } = (useRecoilValue(authState) as Auth) || {}
  const userdata = (useRecoilValue(userState) as User) || {}

  return (
    <div className="  flex flex-col  relative min-h-screen">
      <button
        className="w-full mr-5 mt-5 px-4 flex justify-end text-blue-400"
        type="button"
        onClick={async () => {
          await signOut?.()
        }}
      >
        Sign Out
      </button>
      <div className="m-1 p-1 rounded-lg border-blue-400 border-2 w-auto">
        <p className="m-1 p-1  text-3xl text-black rounded-lg w-auto">
          Profile
        </p>
      </div>
      <div className="grid-cols-1 divide-y divide-blue-400 divide-opacity-25 ">
        <ProfileDetails userdata={userdata} />
        <UserSeries userdata={userdata} />
        <UserFlicks />
      </div>
    </div>
  )
}

export default Profile
