import React, { useRef, useCallback } from 'react'
import { BlockComponentContext, Textbox } from '.'

const Title = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const textBoxRef = useRef()

  const clearable = useRef(false)

  const handleKeyDown = useCallback((e) => {
    // Single line...
    if (e.key === 'Enter') {
      e.preventDefault()
    }
  }, [])

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        handleUpdateBlock?.({
          ...block,
          [block.type]: {
            // @ts-ignore
            ...block[block.type],
            title: undefined,
          },
        })

        clearable.current = false
      }
    },
    [block]
  )

  return (
    <div className="overflow-hidden text-gray-600">
      <Textbox
        ref={textBoxRef}
        handleUpdateText={(text) => {
          handleUpdateBlock?.({
            ...block,
            [block.type]: {
              // @ts-ignore
              ...block[block.type],
              title: text,
            },
          })
        }}
        handleKeyDown={handleKeyDown}
        handleKeyUp={handleKeyUp}
        // @ts-ignore
        text={block?.[block?.type]?.title}
        placeholder="Write a title..."
        tagName="h3"
        className="text-xl font-bold"
      />
    </div>
  )
}

export default Title
