import React, { useEffect, useState } from 'react'
import Select from 'react-select'
import { RiCheckboxCircleFill, RiRefreshLine } from 'react-icons/ri'
import { useRecoilValue } from 'recoil'
import { Button, Heading, ScreenState, Text } from '../../../components'
import {
  FlickParticipantsFragment,
  useInsertParticipantToFragmentMutation,
  useFragmentParticipantsQuery,
  FragmentParticipantsQuery,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'

const ParticipantsTab = ({
  participants,
  fragmentId,
}: {
  participants: FlickParticipantsFragment[]
  fragmentId: string
}) => {
  type IsStatus = 'Host' | 'Assistant' | 'Viewer' | undefined

  interface Participant {
    name: string
    id: string
    picture: string
    isChecked: boolean
  }

  const [insertParticipants, { data, loading, error }] =
    useInsertParticipantToFragmentMutation()
  const { data: fragmentParticipants, refetch } = useFragmentParticipantsQuery({
    variables: {
      fragmentId,
    },
  })
  const [participantsList, setParticipantsList] = useState<Participant[]>([])
  const [newParticipants, setNewParticipants] = useState<string[]>([])

  const userData = (useRecoilValue(userState) as User) || {}
  const [role, setRole] = useState<IsStatus>(undefined)

  const getParticipants = (
    fragmentParticipants: FragmentParticipantsQuery | undefined
  ) => {
    if (participants.length) {
      let list: Participant[] = []

      participants.forEach((participant) => {
        if (participant.userSub === userData.sub) {
          setRole(participant.role as IsStatus)
        }

        const member: Participant = {
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

      setParticipantsList(list)
    }
  }

  useEffect(() => {
    getParticipants(fragmentParticipants)
  }, [fragmentParticipants])

  const onSave = () => {
    newParticipants.map(async (member) => {
      await insertParticipants({
        variables: {
          fragmentId,
          participantId: member,
        },
      })
    })
    setNewParticipants([])
  }
  const toggleCardSelection = (id: Participant['id']) => {
    const updatedList: Participant[] =
      participantsList &&
      participantsList.map((member) => {
        if (member.id === id) {
          setNewParticipants([...newParticipants, member.id])
          return { ...member, isChecked: true }
        }
        return member
      })
    setParticipantsList(updatedList)
  }
  if (loading) return <ScreenState title="Updating..." loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!" subtitle={error.message} />
    )

  return (
    <div className="w-full flex flex-col ">
      {role === 'Host' && (
        <>
          <Select
            className="flex-1 mt-2"
            noOptionsMessage={() => 'Search a Name'}
            onChange={(value) => toggleCardSelection(value?.value as string)}
            options={participantsList
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
          <RiRefreshLine
            className="ml-auto w-1/16 m-2"
            onClick={() => {
              refetch()
              getParticipants(fragmentParticipants)
            }}
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
        {participantsList.map((participant) =>
          role === 'Host' ? (
            <div
              key={participant.id}
              role="button"
              onKeyUp={() => {}}
              tabIndex={0}
              className="flex relative flex-row h-3/4 rounded-lg p-4 ml-7 w-3/4 m-2 border-blue-400 border-2 bg-white shadow-md"
              onClick={() => {
                toggleCardSelection(participant.id)
              }}
            >
              {participant.isChecked && (
                <span className="p-0.5 rounded-full scale-150 bg-blue-100 text-white absolute top-0 right-0 transform translate-x-1/2 translate-y-1/2">
                  <RiCheckboxCircleFill color="green" />
                </span>
              )}

              <img
                src={participant.picture as string}
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
              />

              <Text className="h-20 m-2 flex align-middle justify-center text-center text-base overflow-hidden overflow-ellipsis">
                {participant.name}
              </Text>
            </div>
          ) : (
            participant.isChecked && (
              <div
                key={participant.id}
                className="flex relative flex-row h-3/4 rounded-lg p-4 ml-7 w-3/4 m-2 border-blue-400 border-2 bg-white shadow-md"
              >
                <span className="p-0.5 rounded-full scale-150 bg-blue-100 text-white absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                  <RiCheckboxCircleFill color="green" />
                </span>

                <div className="flex items-center">
                  <img
                    src={participant.picture as string}
                    className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                    alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
                  />
                </div>

                <Text className="h-20 m-2 flex align-middle justify-center text-center text-base overflow-hidden overflow-ellipsis ">
                  {participant.name}
                </Text>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}

export default ParticipantsTab
