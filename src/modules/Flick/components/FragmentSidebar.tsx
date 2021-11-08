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
import { FiMoreHorizontal, FiPlus } from 'react-icons/fi'
import { IoCheckmarkCircle, IoTrashOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { DeleteFragmentModal } from '.'
import {
  Avatar,
  Button,
  dismissToast,
  emitToast,
  Text,
  Tooltip,
  updateToast,
} from '../../../components'
import {
  FlickFragmentFragment,
  useCreateFragmentMutation,
  useGetFlickFragmentsLazyQuery,
  useReorderFragmentMutation,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const FragmentSideBar = () => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)

  const [createFragment] = useCreateFragmentMutation()
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [GetFlickFragments, { data, error, refetch }] =
    useGetFlickFragmentsLazyQuery({
      variables: {
        flickId: flick?.id,
      },
    })

  const handleCreateFragment = async () => {
    if (flick?.owner?.userSub !== sub) return
    let toast
    try {
      toast = emitToast({
        type: 'info',
        title: 'Creating...',
        autoClose: false,
      })

      const res = await createFragment({
        variables: {
          flickId: flick?.id,
          name: 'Untitled',
          creatorPid: flick?.participants.find((p) => p.userSub === sub)?.id,
        },
      })

      if (res.errors) {
        throw Error(res.errors[0].message)
      }

      setFlickStore((prev) => ({
        ...prev,
        activeFragmentId: res.data?.CreateFragment?.id,
      }))

      GetFlickFragments?.()

      dismissToast(toast)
    } catch (e) {
      if (toast) {
        updateToast({
          id: toast,
          type: 'error',
          title: 'There was an error creating a fragment.',
          autoClose: 5000,
        })
      }
    }
  }

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
    <div>
      <div
        className={cx(
          'w-48 h-full border-r border-gray-300 overflow-y-auto pt-8 pb-20 relative',
          style
        )}
      >
        <ThumbnailDND />
        <div
          role="button"
          onKeyUp={() => {}}
          tabIndex={-1}
          className={cx(
            'bg-gray-50 absolute top-0 flex items-center justify-center w-48 left-0 cursor-pointer py-2 border-b border-l border-r border-gray-300',
            {
              'cursor-not-allowed': flick?.owner?.userSub !== sub,
            }
          )}
          onClick={handleCreateFragment}
        >
          <Button
            type="button"
            className={cx('text-green-600 -ml-4')}
            disabled={flick?.owner?.userSub !== sub}
            appearance="link"
            size="small"
            icon={FiPlus}
          >
            <Text className="text-sm">New Fragment</Text>
          </Button>
        </div>
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
  const [editFragmentName, setEditFragmentName] = useState(false)
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [updateFragmentMutation, { data: updateFragmentData }] =
    useUpdateFragmentMutation()
  const [overflowButtonVisible, setOverflowButtonVisible] = useState(false)
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false)

  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)

  useEffect(() => {
    if (!updateFragmentData) return
    setEditFragmentName(false)
  }, [updateFragmentData])

  const updateFragment = async (newName: string) => {
    if (editFragmentName) {
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
          'mt-10': position === 0,
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
      <Text
        className={cx(
          'text-xs font-bold text-gray-800 cursor-text rounded-md p-1 hover:bg-gray-200 overflow-scroll',
          {
            'truncate overflow-ellipsis': !editFragmentName,
          }
        )}
        contentEditable={editFragmentName}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => {
          setEditFragmentName(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            setEditFragmentName(false)
            updateFragment(e.currentTarget.innerText)
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            e.currentTarget.innerText = fragment.name || ''
            setEditFragmentName(false)
          }
        }}
      >
        {fragment.name}
      </Text>
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
