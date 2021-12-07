import React, { useRef } from 'react'
import { BlockComponentContext, Textbox } from '.'

const Description = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)
  const textBoxRef = useRef()

  const clearable = useRef(false)

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
      handleUpdateBlock?.({
        ...block,
        [block.type]: {
          // @ts-ignore
          ...block[block.type],
          description: undefined,
        },
      })

      clearable.current = false
    }
  }

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
              description: text,
            },
          })
        }}
        handleKeyUp={handleKeyUp}
        // @ts-ignore
        text={block?.[block?.type]?.description}
        placeholder="Write a description..."
        className="font-body"
      />
    </div>
  )
}

export default Description