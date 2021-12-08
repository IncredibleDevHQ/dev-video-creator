import { nanoid } from 'nanoid'
import React, { useEffect, useRef } from 'react'
import { mergeRefs } from '../utils'
import { BlockComponentContext, Textbox } from '.'
import { ListBlockProps } from '../types'

const List = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)

  const itemsRef = useRef<HTMLSpanElement[]>([])
  // you can access the elements with itemsRef.current[n]

  useEffect(() => {
    const list = (block as ListBlockProps)?.listBlock?.list
    if (!list) return
    itemsRef.current = itemsRef.current.slice(0, list.length)
  }, [(block as ListBlockProps)?.listBlock?.list])

  return (
    <ul>
      {(block as ListBlockProps)?.listBlock?.list?.map((listItem, index) => {
        return (
          <ListItem
            text={listItem.text}
            index={index}
            ref={(el) => {
              itemsRef.current[index] = el
            }}
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
              } else if (index > 0) {
                setTimeout(() => {
                  const el = itemsRef.current[index - 1]

                  const selection = window.getSelection()
                  const range = document.createRange()
                  if (!selection) return

                  selection.removeAllRanges()
                  range.selectNodeContents(el)
                  range.collapse(false)
                  selection.addRange(range)

                  el.focus()
                }, 0)
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

              setTimeout(() => {
                itemsRef.current[index + 1].focus()
              }, 0)
            }}
            handleUpdateText={(text) => {
              const candidateBlock = { ...block } as ListBlockProps

              candidateBlock.listBlock.list =
                candidateBlock?.listBlock?.list?.map((item) => {
                  if (item.id === listItem.id) {
                    // eslint-disable-next-line no-param-reassign
                    item = { ...item, text }
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

interface ListItemProps {
  text?: string
  index: number
  handleAdd?: () => void
  handleDelete?: () => void
  handleUpdateText?: (text?: string) => void
}

const ListItem = React.forwardRef<any, ListItemProps>(
  ({ text, index, handleAdd, handleDelete, handleUpdateText }, ref) => {
    const textBoxRef = useRef()

    const clearable = useRef(false)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Single line...
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAdd?.()
      }
    }

    const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
          // FIXME: Due to mergeRefs, the ref passed inside is not what is expected. Disabling sanitization here so that the value returns.
          // composing refs did not work either. As a bug, content in list item won't be sanitized.
          ref={mergeRefs(textBoxRef, ref)}
          handleUpdateText={handleUpdateText}
          handleKeyDown={handleKeyDown}
          handleKeyUp={handleKeyUp}
          text={text || ''}
          placeholder="Write an item..."
          tagName="span"
          sanitize={false}
        />
      </li>
    )
  }
)

export default List
