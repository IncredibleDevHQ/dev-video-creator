import { css, cx } from '@emotion/css'
import React, { HTMLProps, useEffect, useState } from 'react'
import { FiMoreHorizontal, FiPlus } from 'react-icons/fi'
import { RiStickyNoteLine } from 'react-icons/ri'
import { useRecoilState } from 'recoil'
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from 'react-beautiful-dnd'
import {
  IoCheckmarkCircle,
  IoCopyOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import { emitToast, Button, Text, Avatar, Tooltip } from '../../../components'
import { newFlickStore } from '../store/flickNew.store'
import {
  FlickFragmentFragment,
  useGetFlickFragmentsLazyQuery,
  useReorderFragmentMutation,
  useUpdateFragmentMutation,
} from '../../../generated/graphql'
import NewFragmentModal from './NewFragmentModal'
import { DeleteFragmentModal, DuplicateFragmentModal, NotesModal } from '.'

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const FragmentSideBar = () => {
  const [{ flick }, setFlickStore] = useRecoilState(newFlickStore)
  const [isCreateNewFragmentModalOpen, setIsCreateNewModalOpen] = useState(
    flick?.fragments.length === 0
  )

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
    <div>
      <div
        className={cx(
          'w-56 h-full border-r border-gray-300 overflow-y-auto pt-10 pb-20 relative',
          {
            'h-full': flick?.fragments.length === 0,
          },
          style
        )}
      >
        <ThumbnailDND />
        <div
          role="button"
          onKeyUp={() => {}}
          tabIndex={-1}
          className="bg-gray-50 absolute top-0 flex items-center justify-center w-56 left-0 cursor-pointer py-3 border border-gray-300"
          onClick={() => setIsCreateNewModalOpen(true)}
        >
          <Button
            type="button"
            className="text-green-600 -ml-4"
            appearance="link"
            size="small"
            icon={FiPlus}
          >
            <Text className="text-sm">New Fragment</Text>
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
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [notesModal, setNotesModal] = useState(false)
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
        'flex flex-col my-2 mx-6 rounded-md h-28 bg-gray-100 justify-end p-4 relative border border-gray-300',
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
              className="flex items-center pt-3 pb-1.5 px-4 cursor-pointer hover:bg-gray-100"
              onClick={() => setConfirmDeleteModal(true)}
            >
              <IoTrashOutline size={21} className="text-gray-600 mr-4" />
              <Text className="font-medium">Delete</Text>
            </div>
            <div
              role="button"
              onKeyUp={() => {}}
              tabIndex={-1}
              className="flex items-center cursor-pointer py-1.5 px-4 hover:bg-gray-100"
              onClick={() => setDuplicateModal(true)}
            >
              <IoCopyOutline size={21} className="text-gray-600 mr-4" />
              <Text>Make a copy</Text>
            </div>
            <div className="h-px bg-gray-200" />
            <div
              role="button"
              onKeyUp={() => {}}
              tabIndex={-1}
              className="flex items-center py-2 px-4 cursor-pointer hover:bg-gray-100"
              onClick={() => setNotesModal(true)}
            >
              <RiStickyNoteLine size={21} className="text-gray-600 mt-1 mr-4" />
              <Text>Note</Text>
            </div>
          </div>
        }
        placement="bottom-start"
        hideOnOutsideClick
      />
      <Text
        className={cx(
          'text-sm font-bold text-gray-800 cursor-text rounded-md p-1 hover:bg-gray-200 overflow-scroll',
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
      <DuplicateFragmentModal
        open={duplicateModal}
        handleClose={(refresh) => {
          if (refresh) {
            GetFlickFragments()
          }
          setDuplicateModal(false)
        }}
      />
      <NotesModal
        open={notesModal}
        handleClose={() => {
          setNotesModal(false)
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
