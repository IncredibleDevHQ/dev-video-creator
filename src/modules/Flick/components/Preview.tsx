import { cx } from '@emotion/css'
import React, { useState } from 'react'
import { IconType } from 'react-icons'
import { FiLayout } from 'react-icons/fi'
import { IoChevronBack, IoChevronForward } from 'react-icons/io5'
import useMeasure from 'react-use-measure'
import { Text } from '../../../components'
import {
  allLayoutTypes,
  BlockProperties,
  Layout,
  ViewConfig,
} from '../../../utils/configTypes'
import { Block } from '../editor/utils/utils'
import { CanvasPreview, LayoutSelector } from './BlockPreview'

interface Tab {
  name: string
  id: string
  Icon: IconType
}

const tabs: Tab[] = [
  {
    id: 'Layout',
    name: 'Layout',
    Icon: FiLayout,
  },
]

const Preview = ({
  block,
  blocks,
  config,
  centered,
  updateConfig,
  setCurrentBlock,
}: {
  block: Block | undefined
  blocks: Block[]
  config: ViewConfig
  centered: boolean
  updateConfig: (id: string, properties: BlockProperties) => void
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0])
  const [ref, bounds] = useMeasure()

  if (!block) return null

  return (
    <div className="flex-1 flex justify-between">
      <div
        className={cx(
          'flex justify-center items-start bg-gray-100 flex-1 pl-0',
          {
            'items-center': centered,
            'pt-8': !centered,
          }
        )}
        ref={ref}
      >
        <div className="flex items-center">
          <button
            onClick={() => {
              setCurrentBlock(blocks[block.pos - 1])
            }}
            type="button"
            disabled={block.pos === 0}
            className={cx('bg-dark-100 text-white p-2 rounded-sm mr-4', {
              'opacity-50 cursor-not-allowed': block.pos === 0,
              'opacity-90 hover:bg-dark-100 hover:opacity-100': block.pos > 0,
            })}
          >
            <IoChevronBack />
          </button>
          <CanvasPreview
            block={block}
            bounds={bounds}
            shortsMode={config.mode === 'Portrait'}
            config={config}
            scale={centered ? 0.83 : 0.77}
          />
          <button
            onClick={() => {
              setCurrentBlock(blocks[block.pos + 1])
            }}
            type="button"
            disabled={block.pos === blocks.length - 1}
            className={cx('bg-dark-100 text-white p-2 rounded-sm ml-4', {
              'opacity-50 cursor-not-allowed': block.pos === blocks.length - 1,
              'opacity-90 hover:bg-dark-100 hover:opacity-100':
                block.pos < blocks.length - 1,
            })}
          >
            <IoChevronForward />
          </button>
        </div>
      </div>
      <div
        style={{
          width: '350px',
        }}
        className="flex"
      >
        {block.type !== 'introBlock' && block.type !== 'outroBlock' && (
          <>
            <div className="bg-white w-64">
              <LayoutSelector
                mode={config.mode}
                layout={config.blocks[block.id]?.layout || allLayoutTypes[0]}
                updateLayout={(layout: Layout) => {
                  updateConfig(block.id, { ...config.blocks[block.id], layout })
                }}
                type={block.type}
              />
            </div>
            <div className="flex flex-col bg-gray-50 px-2 pt-4 gap-y-2 relative">
              {tabs.map((tab) => (
                <button
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cx(
                    'flex flex-col items-center bg-transparent py-4 px-5 rounded-md text-gray-500 gap-y-2 transition-all',
                    {
                      'bg-gray-200 text-gray-800': activeTab.id === tab.id,
                      'hover:bg-gray-100': activeTab.id !== tab.id,
                    }
                  )}
                  key={tab.id}
                >
                  <tab.Icon size={21} />
                  <Text className="font-body font-normal text-xs">
                    {tab.name}
                  </Text>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Preview
