import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import Select from 'react-select'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Button, emitToast, Text } from '../../../components'
import {
  FilteredUserFragment,
  InviteParticipantRoleEnum,
  Participant_Role_Enum_Enum,
  UpdateParticipantRoleEnum,
  useGetFilteredUsersLazyQuery,
  useGetFlickParticipantsLazyQuery,
  useInviteParticipantToFlickMutation,
  useUpdateParticipantRoleMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'

interface Invitee {
  name: string
  role: Participant_Role_Enum_Enum
  email: string
}

const roleOptions: {
  value:
    | Participant_Role_Enum_Enum.Assistant
    | Participant_Role_Enum_Enum.Viewer
  label:
    | Participant_Role_Enum_Enum.Assistant
    | Participant_Role_Enum_Enum.Viewer
}[] = [
  {
    label: Participant_Role_Enum_Enum.Viewer,
    value: Participant_Role_Enum_Enum.Viewer,
  },
  {
    label: Participant_Role_Enum_Enum.Assistant,
    value: Participant_Role_Enum_Enum.Assistant,
  },
]

const getUpdateRole = (role: Participant_Role_Enum_Enum) => {
  switch (role) {
    case Participant_Role_Enum_Enum.Assistant:
      return UpdateParticipantRoleEnum.Assistant
    case Participant_Role_Enum_Enum.Viewer:
      return UpdateParticipantRoleEnum.Viewer
    default:
      return UpdateParticipantRoleEnum.Viewer
  }
}

const ShareModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [{ flick }, setFlick] = useRecoilState(newFlickStore)
  const { uid } = (useRecoilValue(userState) as User) || {}
  const [invitee, setInvitee] = useState<Invitee>({
    name: '',
    role: Participant_Role_Enum_Enum.Viewer,
    email: '',
  })

  const [search, setSearch] = useState<string>('')
  const [
    GetFilteredUsers,
    {
      data: filteredUsersData,
      error: filteredUsersError,
      loading: filteredUsersLoading,
    },
  ] = useGetFilteredUsersLazyQuery()
  useEffect(() => {
    if (search === '') return
    GetFilteredUsers({
      variables: {
        _ilike: `%${search}%`,
      },
    })
  }, [search])

  const [
    AddMemberToFlickMutation,
    { data: addMemberData, loading: addMemberLoading },
  ] = useInviteParticipantToFlickMutation()

  const handleAddMember = async () => {
    try {
      await AddMemberToFlickMutation({
        variables: {
          email: invitee?.email as string,
          flickId: flick?.id as string,
          role: InviteParticipantRoleEnum[invitee.role],
        },
      })
    } catch (error) {
      emitToast({
        title: 'User Already added',
        type: 'error',
        description: `Click this toast to refresh and give it another try.`,
        onClick: () => window.location.reload(),
      })
    }
  }

  const [GetFlickParticipants, { data: participantsData }] =
    useGetFlickParticipantsLazyQuery({
      fetchPolicy: 'cache-and-network',
      variables: {
        flickId: flick?.id as string,
      },
    })

  useEffect(() => {
    if (!participantsData || !flick) return
    setFlick((store) => ({
      ...store,
      flick: {
        ...flick,
        participants: participantsData.Participant,
      },
    }))
  }, [participantsData])

  useEffect(() => {
    if (!addMemberData) return
    setSearch('')
    setInvitee((prev) => ({ ...prev, email: '', name: '' }))
    GetFlickParticipants()
  }, [addMemberData])

  const [UpdateParticipantRole] = useUpdateParticipantRoleMutation()
  const updateRole = async (
    participantId: string,
    role: Participant_Role_Enum_Enum
  ) => {
    if (flick)
      setFlick((store) => ({
        ...store,
        flick: {
          ...flick,
          participants: flick.participants.map((p) =>
            p.id === participantId
              ? {
                  ...p,
                  role,
                }
              : p
          ),
        },
      }))
    UpdateParticipantRole({
      variables: {
        participantId,
        role: getUpdateRole(role),
        flickId: flick?.id,
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx('rounded-md w-full md:w-1/3'),
      }}
      center
      showCloseIcon={false}
    >
      <Text className="bg-gray-100 text-gray-800 mb-8 px-4 py-2 rounded-md font-semibold w-max text-sm">
        Invite to {flick?.name}
      </Text>
      <div className="grid grid-cols-6 items-center mt-4 mb-12">
        <div className="grid grid-cols-6 col-span-5 items-center">
          <Select
            className="col-span-4 text-xs"
            noOptionsMessage={() =>
              filteredUsersError ? 'Error Occured' : 'Search a Name..'
            }
            onChange={(value) =>
              setInvitee((prev) => ({
                ...prev,
                email: value?.value.email || '',
                name: value?.value.displayName || '',
              }))
            }
            options={
              search
                ? filteredUsersData?.User?.map((user: FilteredUserFragment) => {
                    const option = {
                      value: user,
                      label: user.displayName,
                    }
                    return option
                  })
                : []
            }
            isLoading={filteredUsersLoading}
            onInputChange={(value: string) => setSearch(value)}
            placeholder="Search a user"
          />
          <Select
            className="pl-2 col-span-2 text-xs"
            onChange={(value) =>
              setInvitee((prev) => ({
                ...prev,
                role: value?.value || Participant_Role_Enum_Enum.Viewer,
              }))
            }
            options={roleOptions}
            value={{
              value: invitee.role,
              label: invitee.role,
            }}
            placeholder="Select role"
          />
        </div>
        <Button
          className="ml-2 col-span-1"
          type="button"
          appearance="primary"
          size="small"
          disabled={
            invitee.name.length === 0 ||
            flick?.participants.find((p) => p.userSub === uid)?.role !==
              Participant_Role_Enum_Enum.Host
          }
          loading={addMemberLoading}
          onClick={() => {
            handleAddMember()
          }}
        >
          Invite
        </Button>
      </div>
      {flick?.participants.map((participant) => {
        return (
          <div className="grid grid-cols-4 items-center" id={participant.id}>
            <div className="flex flex-row my-1 col-span-3 items-center">
              <img
                className="w-8 h-8 rounded-full border-2"
                src={participant.user.picture || ''}
                alt={participant.user.displayName || ''}
              />
              <Text className="ml-4 text-xs">
                {participant.user.displayName}
              </Text>
            </div>
            {participant.role === Participant_Role_Enum_Enum.Host ? (
              <Text className="text-right text-xs">{participant.role}</Text>
            ) : (
              <Select
                isDisabled={
                  flick?.participants.find((p) => p.userSub === uid)?.role !==
                  Participant_Role_Enum_Enum.Host
                }
                className="pt-2 text-xs"
                onChange={(value) => {
                  const role = value?.value || Participant_Role_Enum_Enum.Viewer
                  updateRole(participant.id, role)
                }}
                options={roleOptions}
                value={{
                  value: participant.role,
                  label: participant.role,
                }}
                placeholder="Select role"
              />
            )}
          </div>
        )
      })}
    </Modal>
  )
}

export default ShareModal
