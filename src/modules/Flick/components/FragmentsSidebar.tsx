import { css, cx } from '@emotion/css'
import { useRecoilValue } from 'recoil'
import React, { ChangeEvent, useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import Select from 'react-select'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd'
import { FiCheckCircle, FiPlus, FiPlusCircle } from 'react-icons/fi'
import { MdDelete } from 'react-icons/md'
import { BiCheckCircle, BiCircle, BiRightArrowAlt } from 'react-icons/bi'
import {
  Avatar,
  Button,
  emitToast,
  Heading,
  Text,
  TextField,
  Tooltip,
  updateToast,
} from '../../../components'
import {
  FlickFragmentFragment,
  useProduceVideoMutation,
  useFragmentRoleQuery,
  FlickParticipantsFragment,
  Participant_Role_Enum_Enum,
  useInsertParticipantToFragmentMutation,
  useReorderFragmentMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { StudioProviderProps, studioStore } from '../../Studio/stores'
import ConfirmDeleteModal from './ConfirmDeleteModal'

const style = css`
  .react-select__control {
    box-shadow: none;
    border-width: 2px;
    border-color: rgb(156, 163, 175);
  }

  .react-select__control:hover,
  .react-select__control:focus {
    box-shadow: none;
    border-color: #5156ea;
  }
`

const reorder = (
  list: FlickFragmentFragment[],
  startIndex: number,
  endIndex: number
) => {
  const results = Array.from(list)
  const [removed] = results.splice(startIndex, 1)
  results.splice(endIndex, 0, removed)

  return results.map((result, index) => ({ ...result, order: index }))
}

const ParticipantsTooltip = ({
  activeFragmentId,
  flickParticipants,
  fragment,
  setParticipantsTooltip,
  handleRefetch,
}: {
  fragment: FlickFragmentFragment
  activeFragmentId: string
  flickParticipants: FlickParticipantsFragment[]
  setParticipantsTooltip: (val: boolean) => void
  handleRefetch: (refresh?: boolean) => void
}) => {
  const [participants, setParticipants] = useState<
    { id: string; role: Participant_Role_Enum_Enum }[]
  >([])
  const [query, setQuery] = useState<string>('')

  const [insertParticipantToFragment, { loading }] =
    useInsertParticipantToFragmentMutation()

  useEffect(() => {
    if (!fragment) return
    setParticipants(
      fragment.participants.map(({ participant }) => {
        return { id: participant.id, role: participant.role }
      })
    )
  }, [fragment])

  const addParticipantsToFragment = async () => {
    try {
      if (flickParticipants.length === 0) throw new Error('No participants')
      participants
        .filter(
          ({ id }) =>
            !fragment.participants.find(
              ({ participant }) => participant.id === id
            )
        )
        .forEach(async (participant) => {
          await insertParticipantToFragment({
            variables: {
              fragmentId: activeFragmentId,
              participantId: participant.id,
            },
          })
        })
      setParticipantsTooltip(false)
      handleRefetch(true)
    } catch (error: any) {
      emitToast({
        type: 'error',
        title: 'Things went south.',
        description: (error as Error).message,
      })
    }
  }

  return (
    <div className="bg-background p-4 rounded-md">
      <TextField
        label="Search"
        placeholder="Search..."
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setQuery(e.target.value)
        }
      />
      <div className="mt-4 flex flex-col max-h-80 min-h-48 overflow-y-auto">
        {flickParticipants
          .filter((p) =>
            query.trim().length > 0
              ? p.user.displayName?.toLowerCase().includes(query.toLowerCase())
              : true
          )
          .map((participant) => {
            const options = [
              {
                value: Participant_Role_Enum_Enum.Assistant,
                label: Participant_Role_Enum_Enum.Assistant,
              },
              {
                value: Participant_Role_Enum_Enum.Host,
                label: Participant_Role_Enum_Enum.Host,
              },
              {
                value: Participant_Role_Enum_Enum.Viewer,
                label: Participant_Role_Enum_Enum.Viewer,
              },
            ]

            const selected = participants.find(
              ({ id }) => id === participant.id
            )

            const [showUsername, setShowUsername] = useState(false)

            return (
              <div
                className={cx('flex items-center justify-between my-3', style)}
                key={participant.id}
              >
                <div className="flex items-center">
                  {selected ? (
                    <BiCheckCircle
                      size={24}
                      className="text-green-600"
                      onClick={() =>
                        setParticipants((participants) =>
                          participants.filter(({ id }) => id !== selected.id)
                        )
                      }
                    />
                  ) : (
                    <BiCircle
                      size={24}
                      className="text-gray-400"
                      onClick={() =>
                        setParticipants(() => [
                          ...participants,
                          {
                            ...participant,
                            role: Participant_Role_Enum_Enum.Assistant,
                          },
                        ])
                      }
                    />
                  )}
                  <Avatar
                    src={participant.user.picture as string}
                    className="w-10 h-10 rounded-full ml-2"
                    alt={participant.user.displayName as string}
                  />
                  <div className="flex flex-col ml-3">
                    <Heading fontSize="base">
                      {participant.user.displayName}
                    </Heading>
                    <Heading
                      onClick={() =>
                        setShowUsername((showUsername) => !showUsername)
                      }
                      className="-mt-1 unselectable text-gray-400 cursor-pointer"
                      fontSize="small"
                    >
                      {showUsername && participant.user.username
                        ? `@${participant.user.username}`
                        : participant.user.email}
                    </Heading>
                  </div>
                </div>

                {selected && (
                  <Select
                    isSearchable={false}
                    className="react-select-container flex-shrink-0 w-40"
                    options={options}
                    classNamePrefix="react-select"
                    value={{ label: selected.role, value: selected.role }}
                    defaultValue={{
                      label: Participant_Role_Enum_Enum.Assistant,
                      value: Participant_Role_Enum_Enum.Assistant,
                    }}
                    onChange={(event) => {
                      setParticipants(
                        participants.map((p) =>
                          p.id === participant.id
                            ? {
                                ...p,
                                role:
                                  event?.value ||
                                  Participant_Role_Enum_Enum.Assistant,
                              }
                            : p
                        )
                      )
                    }}
                  />
                )}
              </div>
            )
          })}
      </div>

      <Button
        appearance="primary"
        type="button"
        icon={BiRightArrowAlt}
        iconPosition="right"
        disabled={participants.length === 0}
        onClick={() => {
          addParticipantsToFragment()
        }}
        loading={loading}
      >
        Add
      </Button>
    </div>
  )
}

const FragmentItem = ({
  flickId,
  fragment,
  provided,
  snapshot,
  isHost,
  flickParticipants,
  activeFragmentId,
  setActiveFragmentId,
  handleRefetch,
}: {
  flickId: string
  fragment: FlickFragmentFragment
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  isHost: boolean
  activeFragmentId: string
  flickParticipants: FlickParticipantsFragment[]
  setActiveFragmentId: (id: string) => void
  handleRefetch: (refresh?: boolean) => void
}) => {
  const userData = (useRecoilValue(userState) as User) || {}

  const [isParticipantsTooltip, setParticipantsTooltip] = useState(false)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const history = useHistory()
  const { data } = useFragmentRoleQuery({
    variables: {
      fragmentId: activeFragmentId,
      sub: userData.sub as string,
    },
  })
  const isParticipant = !(data && data.Participant.length === 0) as boolean

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyUp={() => {}}
      className={cx(
        'my-1 p-2 border-2 bg-white border-dotted rounded-md text-gray relative',
        {
          'border-gray-500 text-gray-600':
            (fragment.id === activeFragmentId && !isParticipant) ||
            (fragment.id === !activeFragmentId && !isParticipant),
          'border-brand text-brand':
            fragment.id === activeFragmentId && isParticipant,
          'border-grey-lighter text-black':
            fragment.id === !activeFragmentId && isParticipant,
          'bg-brand text-background-alt border-brand':
            snapshot.isDragging && isParticipant,
        }
      )}
      onClick={() => setActiveFragmentId(fragment.id)}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      {fragment.producedLink && (
        <FiCheckCircle className="text-success absolute top-1 right-1" />
      )}
      <div className="rounded relative">
        <Heading fontSize="base">{fragment.name}</Heading>
        <Text fontSize="normal">{fragment.description}</Text>
        <Text fontSize="small">{fragment.type}</Text>
        <div className="flex mt-2">
          {fragment.participants.map(({ participant }) => (
            <Avatar
              className="w-6 h-6 rounded-full mr-1"
              src={participant.user.picture as string}
              alt={participant.user.displayName as string}
            />
          ))}
          {isHost && activeFragmentId === fragment.id && (
            <Tooltip
              isOpen={isParticipantsTooltip}
              setIsOpen={setParticipantsTooltip}
              content={
                <ParticipantsTooltip
                  fragment={fragment}
                  flickParticipants={flickParticipants}
                  activeFragmentId={activeFragmentId}
                  handleRefetch={handleRefetch}
                  setParticipantsTooltip={setParticipantsTooltip}
                />
              }
              placement="bottom-start"
              triggerOffset={6}
            >
              <FiPlusCircle
                className="w-6 h-6 text-gray-400 cursor-pointer"
                onClick={() => setParticipantsTooltip(!isParticipantsTooltip)}
              />
            </Tooltip>
          )}
        </div>
        <div className="m-2">
          <MdDelete
            className="cursor-pointer absolute bottom-1 right-1"
            onClick={(e) => {
              e?.preventDefault()
              setConfirmDeleteModal(true)
            }}
          />
        </div>
        <ConfirmDeleteModal
          open={confirmDeleteModal}
          handleClose={(refresh) => {
            if (refresh) {
              handleRefetch(true)
              history.push(`/flick/${flickId}`)
            }
            setConfirmDeleteModal(false)
          }}
          fragmentId={fragment.id}
          fragmentName={fragment.name || ''}
          flickId={flickId}
        />
      </div>
    </div>
  )
}

const FragmentDND = ({
  flickId,
  fragments,
  setFragments,
  activeFragmentId,
  setActiveFragmentId,
  handleRefetch,
  isHost,
  flickParticipants,
}: {
  flickId: string
  fragments: FlickFragmentFragment[]
  setFragments: (fragments: FlickFragmentFragment[]) => void
  activeFragmentId: string
  flickParticipants: FlickParticipantsFragment[]
  isHost: boolean
  setActiveFragmentId: (id: string) => void
  handleRefetch: (refresh?: boolean) => void
}) => {
  const [reorderFragment, { data: reorderData, loading: reorderLoading }] =
    useReorderFragmentMutation()

  const reorderFragments = (
    fragments: FlickFragmentFragment[],
    flickId: string
  ) => {
    reorderFragment({
      variables: {
        fragmentIds: fragments.map((x) => x.id),
        flick_id: flickId,
      },
    })
  }

  useEffect(() => {
    if (!fragments) return
    reorderFragments(fragments, flickId)
  }, [fragments])

  const onDragEnd = (result: any) => {
    if (!result.destination || !isHost) {
      return
    }
    const items = reorder(
      fragments,
      result.source.index,
      result.destination.index
    )
    setFragments(items)
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable">
        {(provided) => (
          <div
            className="flex flex-col"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {fragments.map((fragment, index) => (
              <Draggable
                draggableId={fragment.id}
                key={fragment.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <FragmentItem
                    flickId={flickId}
                    provided={provided}
                    snapshot={snapshot}
                    fragment={fragment}
                    isHost={isHost}
                    flickParticipants={flickParticipants}
                    activeFragmentId={activeFragmentId}
                    setActiveFragmentId={setActiveFragmentId}
                    handleRefetch={handleRefetch}
                    key={fragment.id}
                  />
                )}
              </Draggable>
            ))}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

const FragmentsSidebar = ({
  flickId,
  fragments,
  activeFragmentId,
  setActiveFragmentId,
  handleRefetch,
  participants,
}: {
  flickId: string
  fragments: FlickFragmentFragment[]
  activeFragmentId?: string
  setActiveFragmentId: (id: string) => void
  handleRefetch: (refresh?: boolean) => void
  participants: FlickParticipantsFragment[]
}) => {
  const [fragmentItems, setFragmentItems] = useState<FlickFragmentFragment[]>(
    []
  )
  const [produceVideoMutation] = useProduceVideoMutation()
  const history = useHistory()
  const { isHost } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  useEffect(() => {
    setFragmentItems(fragments)
  }, [fragments])

  const produceVideo = async () => {
    const toastProps = {
      title: 'Pushing pixels...',
      type: 'info',
      autoClose: false,
      description: 'Our hamsters are gift-wrapping your Fragment. Do hold. :)',
    }

    // @ts-ignore
    const toast = emitToast(toastProps)

    try {
      const { errors } = await produceVideoMutation({
        variables: {
          flickId,
        },
      })
      if (errors) throw errors[0]

      updateToast({
        id: toast,
        ...toastProps,
        autoClose: false,
        type: 'info',
        description: 'Almost done! Click here to see all your Flicks!',
        onClick: () => history.push('/dashboard'),
      })
    } catch (e) {
      emitToast({
        title: 'Yikes. Something went wrong.',
        type: 'error',
        autoClose: false,
        description: 'Our servers are a bit cranky today. Try in a while?',
      })
    }
  }

  return (
    <div className="flex flex-col w-1/6 h-screen py-2 px-4 bg-background-alt">
      <div className="flex flex-row justify-between items-center mb-8">
        <Heading className="flex-1">Fragments</Heading>
        {isHost && (
          <FiPlus
            className="text-grey-lighter"
            size={20}
            onClick={() => {
              history.push(`/new-fragment/${flickId}`)
            }}
          />
        )}
      </div>
      {activeFragmentId ? (
        <FragmentDND
          flickId={flickId}
          activeFragmentId={activeFragmentId}
          setActiveFragmentId={setActiveFragmentId}
          flickParticipants={participants}
          setFragments={setFragmentItems}
          fragments={fragmentItems}
          handleRefetch={handleRefetch}
          isHost={isHost}
        />
      ) : (
        <Text>No Fragments</Text>
      )}

      {fragmentItems.length > 0 && isHost && (
        <Button
          className="mt-auto"
          type="button"
          appearance="primary"
          disabled={!fragmentItems.every((f) => f.producedLink !== null)}
          onClick={produceVideo}
        >
          Produce
        </Button>
      )}
    </div>
  )
}

FragmentsSidebar.defaultProps = {
  activeFragmentId: undefined,
}

export default FragmentsSidebar
