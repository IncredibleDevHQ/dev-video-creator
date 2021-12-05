import React, { useCallback, useRef } from 'react'
import { BiNotepad } from 'react-icons/bi'
import { BlockComponentContext, Textbox } from '.'

const Note = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const textBoxRef = useRef()

  const clearable = useRef(false)

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!clearable.current) {
      if (
        e.key === 'Backspace' &&
        // @ts-ignore
        textBoxRef.current?.innerHTML?.length === 0
      )
        clearable.current = true
      // else clearable.current = false

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
      handleUpdateBlock?.({
        ...block,
        [block.type]: {
          // @ts-ignore
          ...block[block.type],
          note: undefined,
        },
      })

      clearable.current = false
    }
  }

  return (
    <div className="p-2 rounded-md overflow-hidden items-start bg-gray-50 flex text-gray-600">
      <div>
        <BiNotepad className="text-gray-300 text-xl mt-0.5 mr-2" />
      </div>
      <Textbox
        ref={textBoxRef}
        handleUpdateText={(text) => {
          handleUpdateBlock?.({
            ...block,
            [block.type]: {
              // @ts-ignore
              ...block[block.type],
              note: text,
            },
          })
        }}
        handleKeyUp={handleKeyUp}
        // @ts-ignore
        text={block?.[block?.type]?.note}
        placeholder="You can add notes to this block to help you present. They'll only be visible to you and won't appear in the final presentation."
      />
    </div>
  )
}

export default Note
