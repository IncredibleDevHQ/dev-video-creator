import { nanoid } from 'nanoid'
import React, { useCallback } from 'react'
import {
  BiCode,
  BiErrorCircle,
  BiHeading,
  BiImage,
  BiListUl,
  BiNotepad,
  BiText,
  BiTrashAlt,
  BiVideo,
} from 'react-icons/bi'
import { cx } from '@emotion/css'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../types'
import {
  Description,
  Title,
  AddBlockRow,
  TabItem,
  Note,
  Code,
  List,
  Image,
  Video,
} from '.'

type Node =
  | 'code'
  | 'video'
  | 'image'
  | 'list'
  | 'note'
  | 'description'
  | 'title'

interface BlockComponentContextProps {
  block: Block
  handleUpdateBlock?: (block: Block) => void
  handleAddBlock?: (position: 'above' | 'below') => void
}

export const BlockComponentContext =
  React.createContext<BlockComponentContextProps>({} as any)

const BlockComponent = ({
  block,
  handleUpdateBlock,
  handleAddBlock,
  handleRemoveBlock,
  position,
  onFocus,
}: {
  block: Block
  position: number
  handleUpdateBlock?: (block: Block) => void
  handleAddBlock?: (position: 'above' | 'below') => void
  handleRemoveBlock?: () => void
  onFocus?: () => void
}) => {
  const addNode = useCallback(
    (node: Node) => {
      const candidateBlock = { ...block }

      switch (node) {
        case 'code':
          candidateBlock.type = 'codeBlock'
          ;(candidateBlock as CodeBlockProps).codeBlock = {
            code: '',
            language: 'typescript',
            title: '',
            description: '',
          }
          break
        case 'video':
          candidateBlock.type = 'videoBlock'
          ;(candidateBlock as VideoBlockProps).videoBlock = {
            title: '',
            description: '',
          }
          break
        case 'image':
          candidateBlock.type = 'imageBlock'
          ;(candidateBlock as ImageBlockProps).imageBlock = {
            title: '',
            description: '',
          }
          break
        case 'list':
          candidateBlock.type = 'listBlock'
          ;(candidateBlock as ListBlockProps).listBlock = {
            list: [{ id: nanoid(), text: '' }],
            title: '',
            description: '',
          }
          break
        case 'note':
          // @ts-ignore
          candidateBlock[candidateBlock.type].note = ''
          break
        case 'description':
          // @ts-ignore
          candidateBlock[candidateBlock.type].description = ''
          break
        case 'title':
          // @ts-ignore
          candidateBlock[candidateBlock.type].title = ''
          break
        default:
          break
      }

      handleUpdateBlock?.(candidateBlock)
    },
    [block]
  )

  return (
    <BlockComponentContext.Provider
      value={{ block, handleUpdateBlock, handleAddBlock }}
    >
      <div className="my-4">
        {position === 0 && (
          <AddBlockRow onClick={() => handleAddBlock?.('above')} />
        )}
        <div
          data-block-id={block.id}
          className="border-gray-200 border-b-2 relative group pb-6 p-2"
          onFocus={onFocus}
          tabIndex={-1}
        >
          {typeof block.type === 'undefined' && (
            <BiErrorCircle className="absolute right-2 top-2 text-red-600" />
          )}
          <div
            className={cx(
              'grid grid-flow-col group-hover:opacity-100 opacity-0 transition-opacity shadow-sm z-20 gap-x-2 absolute',
              {
                'top-2 right-2': typeof block.type !== 'undefined',
                'top-8 right-0.5': typeof block.type === 'undefined',
              }
            )}
          >
            <TabItem
              label="Remove block"
              icon={BiTrashAlt}
              appearance="icon"
              handleClick={handleRemoveBlock}
            />
          </div>
          <div className="grid grid-flow-row gap-y-2 pr-12">
            {/* @ts-ignore */}
            {typeof block[block.type]?.title !== 'undefined' && <Title />}
            {/* @ts-ignore */}
            {typeof block[block.type]?.description !== 'undefined' && (
              <Description />
            )}
            {block.type === 'codeBlock' &&
              typeof block.codeBlock.code !== 'undefined' && <Code />}
            {block.type === 'listBlock' &&
              typeof block.listBlock.list !== 'undefined' && <List />}
            {block.type === 'imageBlock' && <Image />}
            {block.type === 'videoBlock' && <Video />}

            {/* @ts-ignore */}
            {typeof block[block.type]?.note !== 'undefined' && <Note />}
          </div>

          <div className="mt-4 grid grid-flow-col gap-x-12 items-center">
            {!block.type && (
              <ul className="grid-flow-col justify-start grid gap-x-2">
                <TabItem
                  handleClick={() => addNode('code')}
                  icon={BiCode}
                  label="Code"
                  appearance="full"
                />
                <TabItem
                  handleClick={() => addNode('image')}
                  icon={BiImage}
                  label="Image"
                  appearance="full"
                />
                <TabItem
                  handleClick={() => addNode('video')}
                  icon={BiVideo}
                  label="Video"
                  appearance="full"
                />
                <TabItem
                  handleClick={() => addNode('list')}
                  icon={BiListUl}
                  label="List"
                  appearance="full"
                />
              </ul>
            )}
            {block.type && (
              <ul className="grid-flow-col justify-start items-center grid gap-x-2">
                {/* @ts-ignore */}
                {typeof block[block.type].title === 'undefined' && (
                  <TabItem
                    handleClick={() => addNode('title')}
                    icon={BiHeading}
                    label="Title"
                    appearance="full"
                  />
                )}
                {/* @ts-ignore */}
                {typeof block[block.type].description === 'undefined' && (
                  <TabItem
                    handleClick={() => addNode('description')}
                    icon={BiText}
                    label="Description"
                    appearance="full"
                  />
                )}
                {/* @ts-ignore */}
                {typeof block[block.type].note === 'undefined' && (
                  <TabItem
                    handleClick={() => addNode('note')}
                    icon={BiNotepad}
                    label="Note"
                    appearance="full"
                  />
                )}
              </ul>
            )}
          </div>
        </div>
        <AddBlockRow onClick={() => handleAddBlock?.('below')} />
      </div>
    </BlockComponentContext.Provider>
  )
}

export default BlockComponent
