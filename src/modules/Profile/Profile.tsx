import React from 'react'
import { useRecoilValue } from 'recoil'
import { Auth, authState } from '../../stores/auth.store'
import { User, userState } from '../../stores/user.store'
import { ProfileDetails, UserSeries, UserFlicks } from './components/index'

const Profile = () => {
  const { signOut } = (useRecoilValue(authState) as Auth) || {}
  const userdata = (useRecoilValue(userState) as User) || {}

  return (
    <div className="  flex flex-col max-w-full">
      <button
        className="w-full mr-5 mt-5 px-4 flex justify-end"
        type="button"
        onClick={async () => {
          await signOut?.()
        }}
      >
        Sign Out
      </button>
      {/* overflow-ellipsis overflow-hidden max-w-xs px-6 py-4 mx-auto bg-emerald-200 text-emerald-500 font-medium rounded-lg */}
      <text className="m-2 p-3 bg-pink-400 bg-opacity-25 text-3xl rounded-lg w-auto">
        Profile
      </text>
      <div className="grid-cols-1 divide-y divide-pink-400 divide-opacity-25 p-4">
        <ProfileDetails userdata={userdata} />
        {/* <div className="divide-y divide-fuchsia-300"></div> */}
        <UserSeries userdata={userdata} />
        <UserFlicks />
      </div>
    </div>
  )
}

export default Profile
