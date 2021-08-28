import { cx } from '@emotion/css'
import { useRecoilValue } from 'recoil'
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd'
import { FiCheckCircle, FiPlus } from 'react-icons/fi'
import { MdDelete } from 'react-icons/md'
import {
  Button,
  emitToast,
  Heading,
  Text,
  updateToast,
} from '../../../components'
import {
  FlickFragmentFragment,
  useProduceVideoMutation,
  useFragmentRoleQuery,
  useDeleteFragmentMutation,
  FlickParticipantsFragment,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { StudioProviderProps, studioStore } from '../../Studio/stores'

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

const FragmentItem = ({
  fragment,
  provided,
  snapshot,
  activeFragmentId,
  setActiveFragmentId,
  handleRefetch,
}: {
  fragment: FlickFragmentFragment
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  activeFragmentId: string
  setActiveFragmentId: (id: string) => void
  handleRefetch: (refresh?: boolean) => void
}) => {
  const userData = (useRecoilValue(userState) as User) || {}
  const [deleteFragment, { data: deleteFragmentData }] =
    useDeleteFragmentMutation()

  const deleteFragmentbyId = (fragmentId: string) => {
    deleteFragment({
      variables: {
        id: fragmentId,
      },
    })
  }

  useEffect(() => {
    if (!deleteFragmentData) return
    handleRefetch(true)
  }, [deleteFragmentData])

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
        'my-1 p-2 border-2 border-dotted rounded-md text-gray relative',
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
      <div className="grid grid-cols-3">
        <div className="col-span-2 bg-white rounded">
          <Heading fontSize="base">{fragment.name}</Heading>
          <Text fontSize="normal">{fragment.description}</Text>
          <Text fontSize="small">{fragment.type}</Text>
        </div>
        <div className="p-5">
          <MdDelete
            className="cursor-pointer"
            onClick={(e) => {
              e?.preventDefault()
              deleteFragmentbyId(fragment.id)
            }}
          />
        </div>
      </div>
    </div>
  )
}

const FragmentDND = ({
  fragments,
  setFragments,
  activeFragmentId,
  setActiveFragmentId,
  handleRefetch,
}: {
  fragments: FlickFragmentFragment[]
  setFragments: (fragments: FlickFragmentFragment[]) => void
  activeFragmentId: string
  setActiveFragmentId: (id: string) => void
  handleRefetch: (refresh?: boolean) => void
}) => {
  const onDragEnd = (result: any) => {
    if (!result.destination) {
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
                    provided={provided}
                    snapshot={snapshot}
                    fragment={fragment}
                    activeFragmentId={activeFragmentId}
                    setActiveFragmentId={setActiveFragmentId}
                    handleRefetch={handleRefetch}
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
  const userData = (useRecoilValue(userState) as User) || {}
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
          objectNames: fragmentItems.map((fragment) => {
            return fragment.producedLink as string
          }),
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
        <FiPlus
          className="text-grey-lighter"
          size={20}
          onClick={() => {
            history.push(`/flick/${flickId}/new`)
          }}
        />
      </div>
      {activeFragmentId ? (
        <FragmentDND
          activeFragmentId={activeFragmentId}
          setActiveFragmentId={setActiveFragmentId}
          setFragments={setFragmentItems}
          fragments={fragmentItems}
          handleRefetch={handleRefetch}
        />
      ) : (
        <Text>No Fragments</Text>
      )}

      {fragmentItems.length > 0 && (
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
