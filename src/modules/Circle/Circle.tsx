import React, { useEffect } from 'react'
import Gravatar from 'react-gravatar'
import { useRecoilValue } from 'recoil'
import { Navbar, ScreenState, Text, Button } from '../../components'
import {
  useDeleteCircleMemberMutation,
  useGetCircleMembersQuery,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'

const Circle = () => {
  const userData = (useRecoilValue(userState) as User) || {}

  const { data, loading, error, refetch } = useGetCircleMembersQuery({
    variables: {
      user_sub: userData.sub as string,
    },
  })

  const [deleteCircleMember, { data: deleteCircleMemberData }] =
    useDeleteCircleMemberMutation()

  const deleteMember = (centreId: string, memberId: string) => {
    deleteCircleMember({
      variables: {
        centre: centreId,
        member: memberId,
      },
    })
  }

  useEffect(() => {
    if (deleteCircleMemberData === null) return
    refetch()
  }, [deleteCircleMemberData])

  useEffect(() => {
    refetch()
  }, [])

  return (
    <div>
      <Navbar />
      {error && (
        <ScreenState
          title="Could not load circle! Please try again"
          button="Reload this page"
          handleClick={() => refetch()}
        />
      )}
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
                    alt={
                      member.circle_member.displayName ||
                      member.circle_member.sub
                    }
                    className="w-40 h-40 mx-3 my-2 rounded-full border-blue-200 border-4"
                  />
                ) : (
                  <Gravatar
                    className="w-40 h-40 mx-3 my-2 rounded-full"
                    email={member.circle_member.email as string}
                  />
                )}
                <div className=" flex flex-col content-center my-12 relative px-4 h-40 w-full">
                  <Text className="text-black font-bold">
                    {member.circle_member.displayName}
                  </Text>
                  <Text className=" text-black  text-opacity-50 ">
                    {member.circle_member.username}
                  </Text>
                </div>

                <Button
                  appearance="primary"
                  type="submit"
                  className="my-5 p-2 mx-2 flex justify-end text-white bg-blue-300 rounded-md"
                  onClick={(e) => {
                    e?.preventDefault()
                    deleteMember(
                      userData.sub as string,
                      member.circle_member.sub
                    )
                  }}
                >
                  Remove
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Circle
