import React, { useEffect } from 'react'
import Gravatar from 'react-gravatar'
import { FiUsers, FiX } from 'react-icons/fi'
import { Heading, Text, Button } from '../../../components'
import { FlickParticipantsFragment } from '../../../generated/graphql'

const Participant = ({
  participant,
}: {
  participant: FlickParticipantsFragment
}) => {
  return (
    <div className="flex flex-row items-center">
      {participant.user.picture ? (
        <img
          src={participant.user.picture}
          alt={participant.user.displayName || 'user'}
          className="w-8 h-8 rounded-md"
        />
      ) : (
        <Gravatar
          className="w-8 h-8 rounded-md"
          email={participant.user.picture as string}
        />
      )}
      <Text fontSize="normal" className="ml-2">
        {participant.user.displayName}
      </Text>
    </div>
  )
}

const Participants = ({
  isParticipants,
  setParticipants,
  participants,
}: {
  isParticipants: boolean
  setParticipants: (val: boolean) => void
  participants: FlickParticipantsFragment[]
}) => {
  useEffect(() => {
    console.log('participants', participants)
  }, [participants])
  if (!isParticipants)
    return (
      <Button
        type="button"
        appearance="secondary"
        className="bg-background-alt rounded-full cursor-pointer h-12 w-12 fixed top-4 right-4"
        onClick={() => {
          setParticipants(true)
        }}
      >
        <FiUsers />
      </Button>
    )

  return (
    <div className="flex flex-col w-1/6 h-screen py-2 px-4 bg-background-alt">
      <div className="flex flex-row justify-between items-center mb-4">
        <Heading fontSize="medium">Participants</Heading>
        <FiX
          className="cursor-pointer"
          onClick={() => {
            setParticipants(false)
          }}
        />
      </div>
      {participants.map((participant) => (
        <Participant participant={participant} key={participant.id} />
      ))}
    </div>
  )
}

export default Participants
