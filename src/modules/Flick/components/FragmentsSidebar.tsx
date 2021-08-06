import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd'
import { FiPlus } from 'react-icons/fi'
import { Heading, Text } from '../../../components'
import { FlickFragmentFragment } from '../../../generated/graphql'

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
}: {
  fragment: FlickFragmentFragment
  provided: DraggableProvided
  snapshot: DraggableStateSnapshot
  activeFragmentId: string
  setActiveFragmentId: (id: string) => void
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyUp={() => {}}
      className={cx('my-1 p-2 border-2 border-dotted rounded-md', {
        'border-brand text-brand': fragment.id === activeFragmentId,
        'border-grey-lighter text-black': fragment.id !== activeFragmentId,
        'bg-brand text-background-alt border-brand': snapshot.isDragging,
      })}
      onClick={() => setActiveFragmentId(fragment.id)}
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <Heading fontSize="base">{fragment.name}</Heading>
      <Text fontSize="normal">{fragment.description}</Text>
      <Text fontSize="small">{fragment.type}</Text>
    </div>
  )
}

const FragmentDND = ({
  fragments,
  activeFragmentId,
  setActiveFragmentId,
}: {
  fragments: FlickFragmentFragment[]
  activeFragmentId: string
  setActiveFragmentId: (id: string) => void
}) => {
  const [fragmentItems, setFragmentItems] = useState<FlickFragmentFragment[]>(
    []
  )

  useEffect(() => {
    setFragmentItems(fragments)
  }, [fragments])

  const onDragEnd = (result: any) => {
    if (!result.destination) {
      return
    }

    const items = reorder(
      fragmentItems,
      result.source.index,
      result.destination.index
    )
    setFragmentItems(items)
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
            {fragmentItems.map((fragment, index) => (
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
  fragments,
  activeFragmentId,
  setActiveFragmentId,
  setAddFragmentModal,
}: {
  fragments: FlickFragmentFragment[]
  activeFragmentId: string
  setActiveFragmentId: (id: string) => void
  setAddFragmentModal: (isOpen: boolean) => void
}) => {
  return (
    <div className="flex flex-col w-1/6 h-screen py-2 px-4 bg-background-alt">
      <div className="flex flex-row justify-between items-center mb-8">
        <Heading className="flex-1">Fragments</Heading>
        <FiPlus
          className="text-grey-lighter"
          size={20}
          onClick={() => {
            setAddFragmentModal(true)
          }}
        />
      </div>
      <FragmentDND
        activeFragmentId={activeFragmentId}
        setActiveFragmentId={setActiveFragmentId}
        fragments={fragments}
      />
    </div>
  )
}

export default FragmentsSidebar
