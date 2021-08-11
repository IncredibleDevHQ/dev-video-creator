import React from 'react'
import Gravatar from 'react-gravatar'
import { User } from '../../../stores/user.store'
import { UserFragment } from '../../../generated/graphql'
import { Text } from '../../../components'

interface Props {
  userData: Partial<User> & Partial<UserFragment>
}

const ProfileDetails = ({ userData }: Props) => {
  return (
    <div className="flex flex-row px-4 mb-4 w-full ">
      {userData.picture ? (
        <img
          src={userData.picture}
          alt={userData.displayName || 'user'}
          className="w-40 h-40 mx-3 my-2 rounded-full border-blue-200 border-4"
        />
      ) : (
        <Gravatar
          className="w-40 h-40 mx-3 my-2 rounded-full"
          email={userData.email as string}
        />
      )}
      <div className="relative px-4 h-40 my-2 w-auto">
        <div className="  flex flex-col content-center my-12 ">
          <Text className="text-3xl font-bold">{userData.displayName}</Text>
          <Text className=" text-black  text-opacity-50 ">
            {userData.username}
          </Text>
          <Text className=" text-black text-opacity-50 ">{userData.email}</Text>
        </div>
      </div>
    </div>
  )
}

export default ProfileDetails
