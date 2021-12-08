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
  Fragment_Type_Enum_Enum,
  useCreateFragmentMutation,
  useGetFlickFragmentsLazyQuery,
  User,
  useReorderFragmentMutation,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { newFlickStore } from '../store/flickNew.store'

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const FragmentSideBar = ({ plateValue }: { plateValue: any }) => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const [createFragment] = useCreateFragmentMutation()
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [
    GetFlickFragments,
    { data: fragmentData, error: fragmentError, refetch },
  ] = useGetFlickFragmentsLazyQuery({
    variables: {
      flickId: flick?.id,
    },
  })

  const [blockLength, setBlockLength] = useState(0)

  useEffect(() => {
    if (!plateValue?.blocks) return
    setBlockLength(plateValue.blocks.length)
  }, [plateValue])

  useEffect(() => {
    if (!fragmentData || !flick) return
    setFlickStore((store) => ({
      ...store,
      flick: {
        ...flick,
        fragments: [...fragmentData.Fragment],
      },
    }))
  }, [fragmentData])

  useEffect(() => {
    if (!fragmentError || !refetch) return
    emitToast({
      title: "We couldn't fetch your new fragment",
      type: 'error',
      description: 'Click this toast to give it another try',
      onClick: () => refetch(),
    })
  }, [fragmentError])

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

  return (
    <div className="h-full">
      <div className="flex flex-col w-48 border-r border-gray-300 h-full relative bg-gray-50">
        <button
          onClick={() =>
            setFlickStore((prev) => ({
              ...prev,
              activeFragmentId: flick?.fragments.find(
                (f) => f.type === Fragment_Type_Enum_Enum.Intro
              )?.id,
            }))
          }
          type="button"
          className={cx(
            'flex bg-gray-100 items-center justify-start m-4 p-4 rounded-md border border-gray-300 relative',
            {
              'border-green-600':
                activeFragmentId ===
                flick?.fragments.find(
                  (f) => f.type === Fragment_Type_Enum_Enum.Intro
                )?.id,
            }
          )}
        >
          {flick?.fragments.find(
            (f) => f.type === Fragment_Type_Enum_Enum.Intro
          )?.producedLink && (
            <IoCheckmarkCircle className="absolute top-0 right-0 m-2 text-green-600" />
          )}
          <Text className="text-sm font-bold">Intro</Text>
        </button>
        <div className="border-b-2" />
        <div
          role="button"
          onKeyUp={() => {}}
          tabIndex={-1}
          className={cx(
            'w-48 bg-gray-50 flex items-center justify-center cursor-pointer border-r border-gray-300 mr-4 py-2',
            {
              'cursor-not-allowed': flick?.owner?.userSub !== sub,
            }
          )}
          onClick={handleCreateFragment}
        >
          <Button
            type="button"
            className={cx('text-green-600 transition-all duration-200', {
              'border py-3 border-green-500 ring ring-green-500 ring-opacity-10':
                blockLength > 3,
            })}
            disabled={flick?.owner?.userSub !== sub}
            appearance="link"
            size="small"
            icon={FiPlus}
          >
            <Text className="text-sm">New Fragment</Text>
          </Button>
        </div>
        <ThumbnailDND />
        <div className="border-t-2 mt-auto" />
        <button
          onClick={() =>
            setFlickStore((prev) => ({
              ...prev,
              activeFragmentId: flick?.fragments.find(
                (f) => f.type === Fragment_Type_Enum_Enum.Outro
              )?.id,
            }))
          }
          type="button"
          className={cx(
            'flex bg-gray-100 items-center justify-start m-4 p-4 rounded-md border border-gray-300 relative',
            {
              'border-green-600':
                activeFragmentId ===
                flick?.fragments.find(
                  (f) => f.type === Fragment_Type_Enum_Enum.Outro
                )?.id,
            }
          )}
        >
          {flick?.fragments.find(
            (f) => f.type === Fragment_Type_Enum_Enum.Outro
          )?.producedLink && (
            <IoCheckmarkCircle className="absolute top-0 right-0 m-2 text-green-600" />
          )}
          <Text className="text-sm font-bold">Outro</Text>
        </button>
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

    return results
  }

  const onDragEnd = (result: any) => {
    if (!result.destination || !flick) {
      return
    }
    const items = clientReorder(
      flick.fragments.filter(
        (l) =>
          l.type !== Fragment_Type_Enum_Enum.Intro &&
          l.type !== Fragment_Type_Enum_Enum.Outro
      ),
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
        fragments: [
          flick.fragments.filter(
            (f) => f.type === Fragment_Type_Enum_Enum.Intro
          )[0],
          ...items,
          flick.fragments.filter(
            (f) => f.type === Fragment_Type_Enum_Enum.Outro
          )[0],
        ],
      },
    }))
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="droppable">
        {(provided) => (
          <div
            className={cx('flex flex-col h-full overflow-y-scroll', style)}
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {flick?.fragments
              .filter(
                (f) =>
                  f.type !== Fragment_Type_Enum_Enum.Intro &&
                  f.type !== Fragment_Type_Enum_Enum.Outro
              )
              .map((fragment, index) => (
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
  const [updateFragmentMutation] = useUpdateFragmentMutation()
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
        'flex flex-col my-2 mx-4 rounded-md h-24 flex-shrink-0 bg-gray-100 justify-end p-2 relative border border-gray-300',
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
        onClick={(e) => {
          e.stopPropagation()
        }}
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
