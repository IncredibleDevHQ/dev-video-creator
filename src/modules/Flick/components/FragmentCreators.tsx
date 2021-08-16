import React, { useEffect, useState } from 'react'
import Select from 'react-select'
import { RiCheckboxCircleFill } from 'react-icons/ri'
import { useRecoilValue } from 'recoil'
import { Button, Heading, ScreenState, Text } from '../../../components'
import {
  FlickParticipantsFragment,
  useInsertParticipantToFragmentMutation,
  useFragmentParticipantsQuery,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'

const CreatorsTab = ({
  participants,
  fragmentId,
}: {
  participants: FlickParticipantsFragment[]
  fragmentId: string
}) => {
  type IsStatus = 'Host' | 'Assistant' | 'Participant' | undefined

  interface Participants {
    name: string
    id: string
    picture: string
    isChecked: boolean
  }

  const [insertParticipants, { data, loading, error }] =
    useInsertParticipantToFragmentMutation()
  const { data: fragmentParticipants } = useFragmentParticipantsQuery({
    variables: {
      fragmentId,
    },
  })
  const [creators, setCreators] = useState<Participants[]>([])
  const userData = (useRecoilValue(userState) as User) || {}
  const [role, setRole] = useState<IsStatus>(undefined)
  useEffect(() => {
    if (participants.length) {
      let list: Participants[] = []

      participants.forEach((participant) => {
        if (participant.userSub === userData.sub) {
          setRole(participant.role as IsStatus)
        }

        const member: Participants = {
          id: participant.id,
          name: participant.user.displayName as string,
          picture: participant.user.picture as string,
          isChecked: false,
        }
        fragmentParticipants?.Fragment_Participant.forEach((id) => {
          if (id.participantId === member.id) {
            member.isChecked = true
          }
        })
        list = [...list, member]
      })

      setCreators(list)
    }
  }, [fragmentParticipants])

  const onSave = () => {
    creators.map(async (member) => {
      if (member.isChecked === true) {
        await insertParticipants({
          variables: {
            fragmentId,
            participantId: member.id,
          },
        })
      }
    })
  }
  const reverseChecked = (id: Participants['id']) => {
    const updatedList: Participants[] =
      creators &&
      creators.map((member) => {
        if (member.id === id) {
          return { ...member, isChecked: true }
        }
        return member
      })
    setCreators(updatedList)
  }

  if (loading) return <ScreenState title="Updating...." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <div className="w-full flex flex-col ">
      {role === 'Host' && (
        <>
          <Select
            className="flex-1 mt-2"
            noOptionsMessage={() => 'Search a Name..'}
            onChange={(value) => reverseChecked(value?.value as string)}
            options={creators
              .filter((t) => !t.isChecked)
              .map((user) => {
                const option = {
                  value: user.id,
                  label: user.name as string,
                }
                return option
              })}
            placeholder="Search a Participant"
          />

          <Button
            type="button"
            className="ml-auto w-1/16 m-2"
            size="small"
            appearance="primary"
            onClick={() => {
              onSave()
            }}
          >
            Save
          </Button>
        </>
      )}
      <div className="w-full m-2 grid grid-flow-row grid-cols-4 gap-4">
        {creators.map((details) =>
          role === 'Host' ? (
            <div
              key={details.id}
              role="button"
              aria-hidden="true"
              tabIndex={0}
              className="flex  relative flex-row h-3/4 rounded-lg p-4 ml-7 w-3/4 m-2 border-blue-400 border-2 bg-white shadow-md"
              onClick={() => {
                reverseChecked(details.id)
              }}
            >
              {details.isChecked && (
                <span className="p-0.5 rounded-full scale-150 bg-blue-100 text-white absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <RiCheckboxCircleFill color="green" />
                </span>
              )}

              <img
                src={details.picture as string}
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
              />

              <Text className="h-20 m-2 flex align-middle justify-center text-center text-base overflow-hidden overflow-ellipsis ">
                {details.name}
              </Text>
            </div>
          ) : (
            details.isChecked && (
              <div
                key={details.id}
                className="flex  relative flex-row h-3/4 rounded-lg p-4 ml-7 w-3/4 m-2 border-blue-400 border-2 bg-white shadow-md"
              >
                <span className="p-0.5 rounded-full scale-150 bg-blue-100 text-white absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <RiCheckboxCircleFill color="green" />
                </span>

                <div className="flex items-center">
                  <img
                    src={details.picture as string}
                    className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                    alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
                  />
                </div>

                <Text className="h-20 m-2 flex align-middle justify-center text-center text-base overflow-hidden overflow-ellipsis ">
                  {details.name}
                </Text>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}

export default CreatorsTab
