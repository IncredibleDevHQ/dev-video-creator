import { nanoid } from 'nanoid'

import React, { useCallback, useEffect } from 'react'
import { BiPlus } from 'react-icons/bi'

import { Block, Position, SimpleAST } from './types'
import { BlockComponent } from './components'
import { getCursorCoordinates } from './utils'

import { ASSETS } from '../../constants'
import { Heading, Text } from '..'

export const TempTextEditorPage = () => {
  return (
    <div className="p-4 container mx-auto">
      <TempTextEditor />
    </div>
  )
}

const DEFAULT: SimpleAST = {
  blocks: [],
}

export interface TempTextEditorProps {
  initialAst?: SimpleAST
  handleUpdateAst?: (ast: SimpleAST) => void
  controlled?: boolean
  ast?: SimpleAST
  handleUpdatePosition?: (position: Position) => void
  handleActiveBlock?: (block: Block) => void
}

const TempTextEditor = (props: TempTextEditorProps) => {
  const [ast, setAst] = React.useState<SimpleAST>(props.initialAst || DEFAULT)

  const divRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    props.handleUpdateAst?.(ast)
  }, [ast])

  const updateAst = useCallback(
    (ast: SimpleAST) => {
      if (props.controlled) {
        props.handleUpdateAst?.(ast)
      } else {
        setAst(ast)
      }
    },
    [props.controlled]
  )

  useEffect(() => {
    if (!divRef.current) return
    // eslint-disable-next-line func-names
    divRef.current.addEventListener('click', function (e) {
      if (!divRef.current) return
      // @ts-ignore
      // eslint-disable-next-line react/no-this-in-sfc
      if (this.contains(e?.target)) {
        const { x, y } = getCursorCoordinates(divRef.current, e.pageX, e.pageY)
        props.handleUpdatePosition?.({ x, y })
      }
    })
  }, [divRef.current])

  return (
    <div className="w-full">
      <div className="overflow-y-auto" ref={divRef}>
        {(props.controlled ? props.ast : ast)?.blocks?.map((block, index) => (
          <BlockComponent
            key={block.id}
            block={block}
            position={index}
            onFocus={() => {
              props.handleActiveBlock?.(block)
            }}
            handleRemoveBlock={() => {
              updateAst({
                ...ast,
                blocks: ast.blocks.filter((b) => b.id !== block.id),
              })
            }}
            handleUpdateBlock={(block) => {
              updateAst({
                ...ast,
                blocks: ast.blocks.map((b) => (b.id === block.id ? block : b)),
              })
            }}
            handleAddBlock={(position) => {
              const index = ast.blocks.findIndex(
                (b: Block) => b.id === block.id
              )

              const insert = (arr: any[], index: number, newItem: any) => {
                let i = Math.max(index, 0)
                i = Math.min(i, arr.length)

                return [...arr.slice(0, i), newItem, ...arr.slice(i)]
              }

              updateAst({
                ...ast,
                blocks: insert(
                  ast.blocks,
                  position === 'above' ? index : index + 1,
                  { id: nanoid() }
                ),
              })
            }}
          />
        ))}
      </div>
      {(props.controlled ? props.ast : ast)?.blocks?.length === 0 && (
        <Placeholder
          handleCreate={() => {
            // @ts-ignore
            updateAst({ blocks: [...ast.blocks, { id: nanoid() }] })
          }}
        />
      )}
    </div>
  )
}

const Placeholder = ({ handleCreate }: { handleCreate: () => void }) => {
  return (
    <div className="flex flex-col mt-16 items-center justify-center">
      <img
        className="w-40 animate-pulse duration-1000"
        src={ASSETS.ANIMATION.EDITOR}
        alt="Editor"
      />
      <Heading className="mb-4 mt-12" fontSize="medium">
        Start by creating a block
      </Heading>
      <Text className="text-center mb-4" style={{ maxWidth: 320 }}>
        Blocks are the elementary units of a fragment that let you introduce a
        multitude of content into your fragment.
      </Text>
      <button
        type="button"
        className="p-2 flex items-center border-gray-300 hover:bg-gray-100 transition-colors border rounded text-sm"
        onClick={() => handleCreate()}
      >
        <BiPlus className="mr-2" />
        Create a block
      </button>
    </div>
  )
}

export default TempTextEditor
