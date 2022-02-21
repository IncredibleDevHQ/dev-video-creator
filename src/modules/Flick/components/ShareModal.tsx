/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { Dialog, Menu } from '@headlessui/react'
import React, { useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import {
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseOutline,
} from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useDebouncedCallback } from 'use-debounce'
import dpFallback from '../../../assets/dp_fallback.png'
import {
  Button,
  dismissToast,
  emitToast,
  Text,
  Tooltip,
  updateToast,
} from '../../../components'
import {
  CollaborationTypes,
  ContentContainerTypes,
  FilteredUserFragment,
  Participant_Role_Enum_Enum,
  useCollaborateWithUserMutation,
  useEmailInviteGuestUserMutation,
  useGetFilteredUsersLazyQuery,
  useGetFlickParticipantsLazyQuery,
  useGetPendingInvitesQuery,
  useRemoveFlickParticipantMutation,
  useTransferFlickOwnershipMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { logEvent, logPage } from '../../../utils/analytics'
import {
  PageCategory,
  PageEvent,
  PageTitle,
} from '../../../utils/analytics-types'
import { newFlickStore } from '../store/flickNew.store'

interface Invitee {
  name: string
  role: Participant_Role_Enum_Enum
  email: string
  sub: string
  image?: string
}

const noScrollBar = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const customScroll = css`
  ::-webkit-scrollbar {
    width: 18px;
  }
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-color: #d6dee1;
    border-radius: 20px;
    border: 6px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: #a8bbbf;
  }
`

const ShareModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [{ flick }, setFlick] = useRecoilState(newFlickStore)
  const { uid } = (useRecoilValue(userState) as User) || {}
  const [inviteLoading, setInviteLoading] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [invitee, setInvitee] = useState<Invitee>({
    name: '',
    role: Participant_Role_Enum_Enum.Viewer,
    email: '',
    sub: '',
  })

  const [search, setSearch] = useState<string>('')
  const [GetFilteredUsers, { data: filteredUsersData }] =
    useGetFilteredUsersLazyQuery()

  const { data: pendingInvites, refetch } = useGetPendingInvitesQuery({
    variables: {
      flickId: flick?.id,
    },
  })

  const debouncedSearch = useDebouncedCallback((value) => {
    GetFilteredUsers({
      variables: {
        _ilike: `%${value}%`,
      },
    })
  }, 300)

  useEffect(() => {
    if (search.trim() === '') return
    debouncedSearch(search)
  }, [search])

  const [AddMemberToFlickMutation] = useCollaborateWithUserMutation()

  const [InviteGuestMember] = useEmailInviteGuestUserMutation()

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      )
  }

  const handleAddMember = async () => {
    try {
      setInviteLoading(true)
      // Segment Tracking
      logEvent(PageEvent.InviteCollaborator)
      // regex to check if input email
      if (validateEmail(search)) {
        await InviteGuestMember({
          variables: {
            email: search,
            flickId: flick?.id,
          },
        })
      } else {
        await AddMemberToFlickMutation({
          variables: {
            flickId: flick?.id,
            collaborationType: CollaborationTypes.Invite,
            isNew: false,
            senderId: flick?.owner?.userSub as string,
            receiverId: invitee.sub,
            contentType: ContentContainerTypes.Flick,
            message: '',
          },
        })
      }
      setSearch('')
      setInvitee((prev) => ({ ...prev, email: '', name: '', sub: '' }))
      refetch()
      emitToast({
        title: 'User Invited',
        type: 'success',
      })
    } catch (error) {
      emitToast({
        title: 'Error inviting user',
        type: 'error',
      })
    } finally {
      setInviteLoading(false)
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
    setIsOwner(flick.owner?.userSub === uid)
    setFlick((store) => ({
      ...store,
      flick: {
        ...flick,
        participants: participantsData.Participant,
      },
    }))
  }, [participantsData])

  useEffect(() => {
    // Segment Tracking
    logPage(PageCategory.Studio, PageTitle.Invite)
    GetFlickParticipants()
  }, [])

  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog
      className={cx(
        'fixed z-10 inset-0 w-2/5 m-auto overflow-y-scroll',
        customScroll
      )}
      open={open}
      style={{
        padding: '0',
        minHeight: '250px',
        maxHeight: '60vh',
        maxWidth: '600px',
      }}
      onClose={() => handleClose()}
    >
      <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
      <div className="flex flex-col min-h-32 w-full relative bg-white rounded-sm">
        <Text className="px-5 py-3 text-sm font-bold text-gray-800 font">
          Invite
        </Text>
        <hr className="border-t border-gray-300" />
        <div className="flex items-center my-4 px-5 w-full">
          <Tooltip
            className="w-full"
            content={
              <div
                className={cx(
                  'w-full bg-grey-500 font-body rounded-sm mt-2 overflow-y-scroll',
                  noScrollBar
                )}
              >
                {search
                  ? filteredUsersData?.User?.filter(
                      (u) =>
                        u.displayName &&
                        !flick?.participants
                          .map((user) => user.userSub)
                          .includes(u.sub)
                    ).map((user: FilteredUserFragment, index) => {
                      return (
                        <div
                          onClick={() => {
                            setIsOpen(false)
                            setInvitee({
                              ...invitee,
                              name: user.displayName || '',
                              email: user.email || '',
                              sub: user.sub,
                              image: user.picture || '',
                            })
                          }}
                          className={cx(
                            'px-2 py-1 flex items-center text-xs text-gray-100 gap-x-2 hover:bg-dark-100 cursor-pointer',
                            {
                              'pt-2 rounded-t-sm': index === 0,
                              'pb-2 rounded-b-sm':
                                index ===
                                filteredUsersData?.User?.filter(
                                  (u) =>
                                    u.displayName &&
                                    !flick?.participants
                                      .map((user) => user.userSub)
                                      .includes(u.sub)
                                ).length -
                                  1,
                            }
                          )}
                        >
                          <img
                            className="rounded-full h-6 w-6"
                            src={user.picture || dpFallback}
                            alt=""
                          />
                          {user.displayName}
                        </div>
                      )
                    })
                  : validateEmail(search)
                  ? 'Search something da'
                  : ''}
              </div>
            }
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            placement="bottom-start"
          >
            {invitee.sub ? (
              <div className="flex items-center w-full text-xs font-body gap-x-2 bg-gray-100 py-1.5 rounded-sm px-4 border justify-between">
                <div className="flex items-center gap-x-2">
                  <img
                    className="rounded-full h-6 w-6"
                    src={invitee.image || dpFallback}
                    alt=""
                  />
                  {invitee.name}
                </div>
                <IoCloseOutline
                  size={18}
                  className="cursor-pointer"
                  onClick={() => {
                    setInvitee((prev) => ({
                      ...prev,
                      sub: '',
                      name: '',
                      email: '',
                    }))
                  }}
                />
              </div>
            ) : (
              <input
                onFocus={() => {
                  setIsOpen(true)
                }}
                onChange={(e) => {
                  setSearch(e.target.value)
                }}
                placeholder="Invite"
                className="w-full border py-2 px-2 bg-gray-100 rounded-sm font-body focus:outline-none text-sm flex-1"
              />
            )}
          </Tooltip>
          <Button
            className="col-span-1 ml-2"
            type="button"
            appearance="primary"
            size="small"
            disabled={
              !validateEmail(search)
                ? invitee.name.length === 0 || !isOwner
                : false
            }
            loading={inviteLoading}
            onClick={() => {
              handleAddMember()
            }}
          >
            Invite
          </Button>
        </div>
        <div
          className={cx(
            'flex flex-col px-5 pb-8 overflow-y-scroll h-full',
            customScroll
          )}
        >
          {participantsData?.Participant.map((participant) => {
            return (
              <div
                className="grid items-center grid-cols-4"
                key={participant.id}
              >
                <div className="flex flex-row items-center col-span-3 my-1">
                  <img
                    className="w-7 h-7 rounded-full"
                    src={participant.user.picture || dpFallback}
                    alt=""
                  />
                  <Text className="ml-2 text-xs font-body">
                    {participant.user.displayName}
                  </Text>
                </div>
                <AccessControl
                  isOwner={isOwner}
                  participantSub={participant.userSub}
                  participantId={participant.id}
                  isInvitee={false}
                  refetch={() => GetFlickParticipants()}
                />
              </div>
            )
          })}

          {pendingInvites?.Invitations?.map((invitee) => {
            return (
              <div
                className="grid items-center grid-cols-4"
                key={invitee.receiver.sub}
              >
                <div className="flex items-center text-xs font-body my-1 gap-x-2 text-gray-400 col-span-3">
                  <div className="h-7 w-7 rounded-full bg-gray-100 border border-gray-300" />
                  {invitee.receiver.email === invitee.receiver.sub
                    ? invitee.receiver.email
                    : invitee.receiver.displayName}
                </div>
                <AccessControl
                  isOwner={isOwner}
                  participantSub={invitee.receiver.sub}
                  participantId={invitee.receiver.sub}
                  isInvitee
                  refetch={() => refetch()}
                />
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}

const AccessControl = ({
  isOwner,
  participantSub,
  participantId,
  isInvitee,
  refetch,
}: {
  participantSub: string
  participantId: string
  isOwner: boolean
  isInvitee: boolean
  refetch: () => void
}) => {
  const [{ flick }, setFlick] = useRecoilState(newFlickStore)

  const [removeParticipant, { data: removeData }] =
    useRemoveFlickParticipantMutation()

  const [transferOwnership, { data: transferData }] =
    useTransferFlickOwnershipMutation()

  useEffect(() => {
    if (removeData || transferOwnership) {
      refetch()
    }
  }, [removeData, transferData])

  const handleRemoval = async (userId: string) => {
    const toast = emitToast({
      type: 'info',
      title: 'Removing participant...',
      autoClose: false,
    })
    try {
      await removeParticipant({
        variables: {
          flickId: flick?.id,
          userId,
        },
      })
      updateToast({
        id: toast,
        type: 'success',
        autoClose: 3000,
        title: 'Participant removed',
      })
      setTimeout(() => {
        dismissToast(toast)
      }, 3000)
    } catch (e) {
      dismissToast(toast)
      emitToast({
        type: 'error',
        title: 'Could not delete participant',
      })
    }
  }

  const handleTransfer = async (participantId: string, userId: string) => {
    const toast = emitToast({
      type: 'info',
      title: 'Transferring ownership...',
      autoClose: false,
    })
    try {
      await transferOwnership({
        variables: {
          flickId: flick?.id,
          newOwnerId: participantId,
        },
      })
      if (flick)
        setFlick((store) => ({
          ...store,
          flick: {
            ...flick,
            owner: {
              userSub: userId,
            },
            ownerId: participantId,
          },
        }))
      updateToast({
        id: toast,
        type: 'success',
        title: 'Ownership transferred',
      })
      setTimeout(() => {
        dismissToast(toast)
      }, 3000)
    } catch (e) {
      dismissToast(toast)
      emitToast({
        type: 'error',
        title: 'Could not transfer ownership',
      })
    }
  }

  return (
    <Menu>
      {({ open }) => (
        <div className="relative mt-1">
          <Menu.Button
            disabled={participantSub === flick?.owner?.userSub || !isOwner}
            className={cx(
              'w-full flex items-center justify-end pr-0 relative ml-1 text-gray-600',
              {
                'pr-5': participantSub !== flick?.owner?.userSub && isOwner,
              }
            )}
          >
            <Text className="text-xs font-body">
              {participantSub === flick?.owner?.userSub
                ? 'Owner'
                : 'Contributor'}
            </Text>
            {participantSub !== flick?.owner?.userSub && isOwner && (
              <span className="absolute inset-y-0 right-0 flex items-center pointer-events-none text-gray-600 mt-px">
                {open ? (
                  <IoChevronUpOutline size={14} />
                ) : (
                  <IoChevronDownOutline size={14} />
                )}
              </span>
            )}
          </Menu.Button>
          <Menu.Items className="absolute flex flex-col text-left bg-dark-300 bg-opacity-100 z-50 rounded-sm w-full mt-2 p-1 ml-1">
            {!isInvitee && (
              <>
                <Menu.Item
                  onClick={() => {
                    handleTransfer(participantId, participantSub)
                  }}
                >
                  {({ active }) => (
                    <div
                      className={cx(
                        'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer mt-1 rounded-sm',
                        {
                          'bg-dark-100': active,
                        }
                      )}
                    >
                      <Text className="text-xs">Owner</Text>
                      {participantSub === flick?.owner?.userSub && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <BiCheck size={20} />
                        </span>
                      )}
                    </div>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <div
                      className={cx(
                        'flex items-center gap-x-4 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer py-2 rounded-sm',
                        {
                          'bg-dark-100': active,
                        }
                      )}
                    >
                      <Text className="text-xs">Contributor</Text>
                      {participantSub !== flick?.owner?.userSub && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <BiCheck size={20} />
                        </span>
                      )}
                    </div>
                  )}
                </Menu.Item>
                <hr className="mx-2 my-1 border-t border-gray-500" />
              </>
            )}
            <Menu.Item
              onClick={() => {
                handleRemoval(participantSub)
              }}
            >
              {({ active }) => (
                <div
                  className={cx(
                    'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-sm',
                    {
                      'bg-dark-100': active,
                      'mb-1': !isInvitee,
                    }
                  )}
                >
                  <Text className="text-xs">Remove</Text>
                </div>
              )}
            </Menu.Item>
          </Menu.Items>
        </div>
      )}
    </Menu>
  )
}

export default ShareModal
