import React, { useEffect, useState } from 'react'
import Gravatar from 'react-gravatar'
import { FiUsers, FiX } from 'react-icons/fi'
import Select from 'react-select'
import { useRecoilValue } from 'recoil'
import { Heading, Text, Button, emitToast } from '../../../components'
import {
  FilteredUserFragment,
  FlickParticipantsFragment,
  GetFlickByIdQuery,
  InviteParticipantRoleEnum,
  useGetFilteredUsersQuery,
  useInviteParticipantToFlickMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'

let isOwner = false
const Participant = ({
  participant,
}: {
  participant: FlickParticipantsFragment
}) => {
  const userData = (useRecoilValue(userState) as User) || {}
  if (participant.role === 'Host' && userData.sub === participant.userSub) {
    isOwner = true
  }

  return (
    <div className="flex flex-row mt-2 items-center">
      {participant.user.picture ? (
        <img
          src={participant.user.picture}
          alt={participant.user.displayName || 'user'}
          className="w-8 h-8 rounded-md"
        />
      ) : (
        <Gravatar
          className="w-8 h-8 rounded-md"
          email={participant.user.displayName as string}
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
  flickId,
  handleRefetch,
}: {
  isParticipants: boolean
  setParticipants: (val: boolean) => void
  participants: FlickParticipantsFragment[]
  flickId: string
  handleRefetch: (refresh?: boolean) => void
}) => {
  const [search, setSearch] = useState<string>('')
  const [isEmail, setIsEmail] = useState(false)
  const [selectedMember, setSelectedMember] = useState<
    FilteredUserFragment | { email: string }
  >()
  const isNewMember = true

  useEffect(() => {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

    setIsEmail(re.test(search.toLowerCase()))
  }, [search])

  const {
    data,
    error: errorSelect,
    loading: loadingSelect,
  } = useGetFilteredUsersQuery({
    variables: {
      _ilike: `%${search}%`,
    },
  })

  const [AddMemberToFlickMutation, { loading }] =
    useInviteParticipantToFlickMutation()

  const handleAddMember = async () => {
    try {
      await AddMemberToFlickMutation({
        variables: {
          email: selectedMember?.email as string,
          flickId: flickId as string,
          role: InviteParticipantRoleEnum.Assistant,
        },
      })
      handleRefetch(isNewMember)
    } catch (error) {
      emitToast({
        title: 'User Already added',
        type: 'error',
        description: `Click this toast to refresh and give it another try.`,
        onClick: () => window.location.reload(),
      })
    }
  }

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
    <div className="flex flex-col h-screen py-2 px-4 bg-background-alt overflow-y-auto">
      <div className="flex flex-row justify-between items-center mb-4">
        <Heading fontSize="medium">Participants</Heading>
        <FiX
          className="cursor-pointer"
          onClick={() => {
            setParticipants(false)
          }}
        />
      </div>
      {isOwner && (
        <div className="w-auto   flex m-1 mt-0 gap-2">
          <Select
            className="flex-1"
            noOptionsMessage={() =>
              errorSelect ? 'Error Occured' : 'Search a Name..'
            }
            onChange={(value) => setSelectedMember(value?.value)}
            // @ts-ignore
            options={
              // eslint-disable-next-line no-nested-ternary
              isEmail
                ? [
                    {
                      value: { email: search },
                      label: search,
                    },
                  ]
                : search
                ? data?.User?.map((user: FilteredUserFragment) => {
                    const option = {
                      value: user,
                      label: user.displayName,
                    }
                    return option
                  })
                : []
            }
            isLoading={loadingSelect}
            onInputChange={(value: string) => setSearch(value.trim())}
            placeholder="Add a user"
          />

          {selectedMember && (
            <button
              onClick={handleAddMember}
              type="button"
              className="bg-blue-500 pl-5 pr-5 rounded-md text-white"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      )}
      {participants.map((participant) => (
        <Participant participant={participant} key={participant.id} />
      ))}
    </div>
  )
}

export default Participants
