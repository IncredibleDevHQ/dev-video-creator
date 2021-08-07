import React from 'react'
import Gravatar from 'react-gravatar'
import { User } from '../../../stores/user.store'
import { UserFragment } from '../../../generated/graphql'

interface Props {
  userdata: Partial<User> & Partial<UserFragment>
}

const ProfileDetails = ({ userdata }: Props) => {
  return (
    <div className="flex flex-row px-4 max-w-full ">
      {userdata.picture ? (
        <img
          src={userdata.picture}
          alt={userdata.displayName || 'user'}
          className="w-40 h-40 mx-3 my-2 rounded-full"
        />
      ) : (
        <Gravatar
          className="w-40 h-40 mx-3 my-2 rounded-full"
          email={userdata.email as string}
        />
      )}
      <div className="relative px-4 h-40 my-2 w-auto">
        <div className="  flex flex-col content-center my-12 ">
          <p className="text-3xl font-bold">{userdata.displayName}</p>
          <p className=" text-black  text-opacity-50 ">{userdata.username}</p>
          <p className=" text-black text-opacity-50 ">{userdata.email}</p>
        </div>
      </div>
    </div>
  )
}

export default ProfileDetails
