/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { HTMLProps, useEffect, useState } from 'react'
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from 'react-beautiful-dnd'
import { FiMoreHorizontal } from 'react-icons/fi'
import { IoCheckmarkCircle, IoTrashOutline } from 'react-icons/io5'
import { useRecoilState } from 'recoil'
import { DeleteFragmentModal } from '.'
import { Avatar, Text, Tooltip } from '../../../components'
import {
  FlickFragmentFragment,
  useReorderFragmentMutation,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const FragmentSideBar = () => {
  return (
    <div>
      <div
        className={cx(
          'w-48 border-r border-gray-300 h-full overflow-y-scroll relative',
          style
        )}
      >
        <ThumbnailDND />
      </div>
    </div>
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
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [fragmentName, setFragmentName] = useState(fragment.name)
  const [updateFragmentMutation, { data: updateFragmentData }] =
    useUpdateFragmentMutation()
  const [overflowButtonVisible, setOverflowButtonVisible] = useState(false)
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false)

  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)

  useEffect(() => {
    if (!fragment) return
    setFragmentName(fragment.name)
  }, [fragment])

  const updateFragment = async (newName: string) => {
    if (flick) {
      setFlickStore((store) => ({
        ...store,
        flick: {
          ...flick,
          fragments: flick.fragments.map((f) => {
            if (f.id === fragment?.id) {
              return { ...f, name: newName }
            }
            return f
          }),
        },
      }))
    }
    await updateFragmentMutation({
      variables: {
        fragmentId: fragment?.id, // value for 'fragmentId'
        name: newName,
      },
    })
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      onKeyUp={() => {}}
      className={cx(
        'flex flex-col my-2 mx-4 rounded-md h-24 bg-gray-100 justify-end p-2 relative border border-gray-300',
        {
          'border-green-600': active,
          'mt-5': position === 0,
        },
        className
      )}
      onMouseEnter={() => setOverflowButtonVisible(true)}
      onMouseLeave={() => setOverflowButtonVisible(false)}
      {...rest}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      {fragment.producedLink && (
        <IoCheckmarkCircle className="absolute top-0 right-0 m-2 text-green-600" />
      )}
      {overflowButtonVisible && (
        <div
          role="button"
          onKeyUp={() => {}}
          tabIndex={-1}
          className="absolute top-0 right-0 m-2 bg-gray-50 w-min p-1 shadow-md rounded-md cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            setOverflowMenuVisible(true)
          }}
        >
          <FiMoreHorizontal />
        </div>
      )}
      <Tooltip
        isOpen={overflowMenuVisible}
        setIsOpen={setOverflowMenuVisible}
        content={
          <div className="flex flex-col bg-gray-50 rounded-md border border-gray-300 w-44 z-10 shadow-md">
            <div
              role="button"
              onKeyUp={() => {}}
              tabIndex={-1}
              className="flex items-center py-3 px-4 cursor-pointer hover:bg-gray-100"
              onClick={() => setConfirmDeleteModal(true)}
            >
              <IoTrashOutline size={21} className="text-gray-600 mr-4" />
              <Text className="font-medium">Delete</Text>
            </div>
          </div>
        }
        placement="bottom-start"
        hideOnOutsideClick
      />
      <input
        type="text"
        value={fragmentName || ''}
        className="text-xs font-bold text-gray-800 cursor-text rounded-md p-1 hover:bg-gray-200 bg-transparent focus:outline-none"
        onChange={(e) => setFragmentName(e.target.value)}
        onBlur={() => fragmentName && updateFragment(fragmentName)}
        onKeyDown={(e) => {
          if (!fragment?.name) return
          if (e.key === 'Enter') {
            updateFragment(fragmentName || fragment.name)
          }
        }}
      />
      <div className="flex pl-1 pt-1">
        {fragment.participants.map(({ participant }) => (
          <Avatar
            className="w-5 h-5 rounded-full mr-1"
            src={participant.user.picture as string}
            alt={participant.user.displayName as string}
          />
        ))}
      </div>
      <DeleteFragmentModal
        open={confirmDeleteModal}
        handleClose={() => {
          setConfirmDeleteModal(false)
        }}
      />
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
