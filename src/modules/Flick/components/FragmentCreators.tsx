import React, { useEffect, useState } from 'react'
import Select from 'react-select'
import { Heading, Text } from '../../../components'
import { FlickParticipantsFragment } from '../../../generated/graphql'
import { options } from './AddFragmentModal'

const CreatorsTab = ({
  participants,
}: {
  participants: FlickParticipantsFragment[]
}) => {
  interface Participants {
    name: string
    id: string
    picture: string
    isChecked: boolean
  }
  const [selectedMember, setSelectedMember] = useState<string>()
  const [creators, setCreators] = useState<Participants[]>([])
  useEffect(() => {
    if (participants.length) {
      let list: Participants[] = []

      participants.forEach((participant) => {
        const member: Participants = {
          id: participant.id,
          name: participant.user.displayName as string,
          picture: participant.user.picture as string,
          isChecked: false,
        }
        list = [...list, member]
      })

      setCreators(list)
    }
  }, [])

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

  return (
    <div className="w-full flex flex-col ">
      <Select
        className="flex-1 mt-2"
        noOptionsMessage={() => 'Search a Name..'}
        onChange={(value) => setSelectedMember(value?.value)}
        options={participants.map((user: FlickParticipantsFragment) => {
          const option = {
            value: user.id,
            label: user.user.displayName as string,
          }
          return option
        })}
        placeholder="Search a Creator"
      />
      <div className="w-full m-2 grid grid-flow-row grid-cols-4 gap-4">
        {creators.map((details) => (
          <div
            key={details.id}
            className="flex  relative flex-row h-3/4 rounded-lg p-4 ml-7 w-3/4 m-2 border-blue-400 border-2 bg-white shadow-md"
            onClick={() => {
              reverseChecked(details.id)
            }}
          >
            {details.isChecked && (
              <span className="p-1 rounded-full bg-brand text-white absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                <p color="#ffffff"> chceked </p>
              </span>
            )}

            <div className="flex items-center">
              <img
                src={details.picture as string}
                className="w-10 md:w-10 lg:w-10 h-10 md:h-10 lg:h-10 border-blue-300 border-2 rounded-lg"
                alt="https://png.pngitem.com/pimgs/s/31-316453_firebase-logo-png-transparent-firebase-logo-png-png.png"
              />
            </div>

            <Text className="h-20 m-2 text-sm overflow-hidden overflow-ellipsis">
              {details.name}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CreatorsTab
