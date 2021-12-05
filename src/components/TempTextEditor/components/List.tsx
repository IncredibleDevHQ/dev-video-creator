import { nanoid } from 'nanoid'
import React, { useCallback, useRef } from 'react'
import { BlockComponentContext, Textbox } from '.'
import { ListBlockProps } from '../types'

const List = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)

  return (
    <ul>
      {(block as ListBlockProps)?.listBlock?.list?.map((listItem, index) => {
        return (
          <ListItem
            text={listItem.text}
            index={index}
            key={listItem.id}
            handleDelete={() => {
              const candidateBlock = { ...block } as ListBlockProps
              candidateBlock.listBlock.list =
                candidateBlock.listBlock.list?.filter(
                  (item) => item.id !== listItem.id
                )

              // Remove list if empty
              if (candidateBlock.listBlock.list?.length === 0) {
                // @ts-ignore
                candidateBlock.listBlock = undefined
                // @ts-ignore
                candidateBlock.type = undefined
              }

              handleUpdateBlock?.(candidateBlock)
            }}
            handleAdd={() => {
              const list = (block as ListBlockProps)?.listBlock?.list
              if (!list) return
              const newList = [...list]

              newList.push({ id: nanoid(), text: '' })

              const candidateBlock = { ...block } as ListBlockProps
              candidateBlock.listBlock = {
                ...candidateBlock.listBlock,
                list: newList,
              }

              handleUpdateBlock?.(candidateBlock)
            }}
            handleUpdateText={(text) => {
              const candidateBlock = { ...block } as ListBlockProps

              candidateBlock.listBlock.list =
                candidateBlock?.listBlock?.list?.map((item) => {
                  if (item.id === listItem.id) {
                    // eslint-disable-next-line no-param-reassign
                    item.text = text
                  }
                  return item
                })

              handleUpdateBlock?.(candidateBlock)
            }}
          />
        )
      })}
    </ul>
  )
}

const ListItem = ({
  text,
  index,
  handleAdd,
  handleDelete,
  handleUpdateText,
}: {
  text?: string
  index: number
  handleAdd?: () => void
  handleDelete?: () => void
  handleUpdateText?: (text?: string) => void
}) => {
  const textBoxRef = useRef()

  const clearable = useRef(false)

  const handleKeyDown = useCallback((e) => {
    // Single line...
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd?.()
    }
  }, [])

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!clearable.current) {
      if (
        e.key === 'Backspace' &&
        // @ts-ignore
        textBoxRef.current?.innerHTML?.length === 0
      )
        clearable.current = true

      return
    }

    // @ts-ignore
    if (textBoxRef.current?.innerHTML?.length !== 0) {
      clearable.current = false
      return
    }

    if (clearable.current) {
      e.stopPropagation()
      e.preventDefault()
      handleDelete?.()

      clearable.current = false
    }
  }

  return (
    <li className="flex items-center text-gray-800 mb-2 last:mb-0">
      <span className="w-6 h-6 flex items-center mr-2 justify-center rounded bg-gray-100 text-gray-600">
        {index + 1}
      </span>
      <Textbox
        ref={textBoxRef}
        handleUpdateText={handleUpdateText}
        handleKeyDown={handleKeyDown}
        handleKeyUp={handleKeyUp}
        text={text || ''}
        placeholder="Write an item..."
        tagName="span"
      />
    </li>
  )
}

export default List
