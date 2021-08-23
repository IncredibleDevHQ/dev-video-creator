import React from 'react'
import { useEffect } from 'react'
import Gravatar from 'react-gravatar'
import { useRecoilValue } from 'recoil'
import { Navbar, ScreenState, Text, Button, Avatar } from '../../components'
import {
  useDeleteCircleMemberMutation,
  useGetCircleMembersLazyQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'

export default function Circle() {
  const userData = (useRecoilValue(userState) as User) || {}

  const [getCircleMembers, { data, loading, error }] =
    useGetCircleMembersLazyQuery({
      variables: {
        user_sub: userData.sub as string,
      },
    })

  const [
    deleteCircleMember,
    {
      data: deleteCircleMemberData,
      loading: deleteCircleMemberLoading,
      error: deleteCircleMemberError,
    },
  ] = useDeleteCircleMemberMutation()

  useEffect(() => {
    if (deleteCircleMemberData === null) return
    getCircleMembers()
  }, [deleteCircleMemberData])

  useEffect(() => {
    getCircleMembers()
  }, [])

  return (
    <div className="">
      <Navbar />
      {loading ? (
        <ScreenState title="Loading your Circle! ..." loading />
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {data?.Circle.map((member) => {
            return (
              <div className="flex flex-col w-full mx-4 text-center items-center border-2">
                {member.circle_member.picture ? (
                  <img
                    src={member.circle_member.picture}
                    alt={member.circle_member.displayName || 'sub'}
                    className="w-40 h-40 mx-3 my-2 rounded-full border-blue-200 border-4"
                  />
                ) : (
                  <Gravatar
                    className="w-40 h-40 mx-3 my-2 rounded-full"
                    email={member.circle_member.email as string}
                  />
                )}
                <div className=" flex-1 relative px-4 h-40 my-1 w-full">
                  <div className="  flex flex-col content-center my-12 ">
                    <Text className="text-black font-bold">
                      {member.circle_member.displayName}
                    </Text>
                    <Text className=" text-black  text-opacity-50 ">
                      {member.circle_member.username}
                    </Text>
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-blue-500 mx-5 h-10 hover:bg-blue-400 text-white font-bold px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded"
                  onClick={(e) => {
                    e?.preventDefault()
                    deleteCircleMember({
                      variables: {
                        centre: userData.sub as string,
                        member: member.circle_member.sub,
                      },
                    })
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
