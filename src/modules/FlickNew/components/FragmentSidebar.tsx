import { css, cx } from '@emotion/css'
import React, { HTMLProps, useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import { useRecoilState } from 'recoil'
import { emitToast, Button, Text, Avatar } from '../../../components'
import { newFlickStore } from '../store/flickNew.store'
import {
  FlickFragmentFragment,
  useGetFlickFragmentsLazyQuery,
  useReorderFragmentMutation,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import NewFragmentModal from './NewFragmentModal'
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from 'react-beautiful-dnd'

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const FragmentSideBar = () => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isCreateNewFragmentModalOpen, setIsCreateNewModalOpen] =
    useState(false)

  const [GetFlickFragments, { data, error, refetch }] =
    useGetFlickFragmentsLazyQuery({
      variables: {
        flickId: flick?.id,
      },
    })

  useEffect(() => {
    if (!data || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...data.Fragment],
      },
    }))
  }, [data])

  useEffect(() => {
    if (!error || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [error])

  return (
    <>
      <div
        className={cx(
          'w-56 h-screen border-r-2 border-gray-300 overflow-y-scroll',
          style
        )}
      >
        <ThumbnailDND />
        <div
          className="bg-gray-100 py-2 fixed bottom-0 flex items-center justify-center left-0 w-56 cursor-pointer  border-r-2 border-gray-300"
          onClick={() => setIsCreateNewModalOpen(true)}
        >
          <Button
            type="button"
            className="text-green-600"
            appearance="link"
            size="small"
            icon={FiPlus}
          >
            New Fragment
          </Button>
        </div>
      </div>
      {isCreateNewFragmentModalOpen && (
        <NewFragmentModal
          handleClose={(refresh) => {
            setIsCreateNewModalOpen(false)
            if (refresh) {
              GetFlickFragments()
            }
          }}
        />
      )}
    </>
  )
}

const ThumbnailDND = () => {
  const [{ flick, activeFragmentId }, setFlick] = useRecoilState(newFlickStore)

  const [reorderFragments] = useReorderFragmentMutation()

  const clientReorder = (
    list: FlickFragmentFragment[],
    startIndex: number,
    endIndex: number
  ) => {
    const results = Array.from(list)
    const [removed] = results.splice(startIndex, 1)
    results.splice(endIndex, 0, removed)

    return results.map((result, index) => ({ ...result, order: index }))
  }

  const onDragEnd = (result: any) => {
    if (!result.destination || !flick) {
      return
    }
    const items = clientReorder(
      flick.fragments,
      result.source.index,
      result.destination.index
    )

    reorderFragments({
      variables: {
        fragmentIds: items.map((frag) => frag.id),
        flick_id: flick.id,
      },
    })

    setFlick((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...items],
      },
    }))
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
            {flick?.fragments.map((fragment, index) => (
              <Draggable
                draggableId={fragment.id}
                key={fragment.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <Thumbnail
                    id={fragment.id}
                    className="cursor-pointer"
                    active={activeFragmentId === fragment.id}
                    onClick={() =>
                      setFlick((store) => ({
                        ...store,
                        activeFragmentId: fragment.id,
                      }))
                    }
                    fragment={fragment}
                    position={index}
                    provided={provided}
                    snapshot={snapshot}
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

const Thumbnail = ({
  className,
  active,
  fragment,
  position,
  provided,
  snapshot,
  ...rest
}: ThumbnailProps) => {
  const [editFragmentName, setEditFragmentName] = useState(false)

  const [updateFragmentMutation, { data: updateFargmentData }] =
    useUpdateFragmentMutation()

  useEffect(() => {
    if (!updateFargmentData) return
    setEditFragmentName(false)
  }, [updateFargmentData])

  const updateFragment = async (newName: string) => {
    if (editFragmentName) {
      await updateFragmentMutation({
        variables: {
          fragmentId: fragment.id, // value for 'fragmentId'
          name: newName,
        },
      })
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyUp={() => {}}
      className={cx(
        'flex flex-col border-0 my-2 mx-4 rounded-md h-28 bg-gray-100 justify-end p-4',
        {
          'border-2 border-green-600': active,
          'mt-6': position === 0,
        },
        className
      )}
      {...rest}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <Text
        className="text-base mb-1 font-bold text-gray-800 truncate overflow-ellipsis cursor-text rounded-md p-1 hover:bg-gray-300"
        contentEditable={editFragmentName}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          setEditFragmentName(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            setEditFragmentName(false)
            updateFragment(e.currentTarget.innerText)
          }
        }}
      >
        {fragment.name}
      </Text>
      <div className="flex items-center justify-between pl-1">
        <Text className="text-sm text-gray-600">{fragment.type}</Text>
        <div className="flex">
          {fragment.participants.map(({ participant }) => (
            <Avatar
              className="w-5 h-5 rounded-full mr-1"
              src={participant.user.picture as string}
              alt={participant.user.displayName as string}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ThumbnailProps extends HTMLProps<HTMLDivElement> {
  fragment: FlickFragmentFragment
  active?: boolean
  position: number
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
}

export default FragmentSideBar
