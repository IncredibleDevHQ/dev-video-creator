import { cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import React, { useEffect, useState } from 'react'
import { IconType } from 'react-icons'
import { BiCheck } from 'react-icons/bi'
import { FiLayout } from 'react-icons/fi'
import {
  IoAddOutline,
  IoChevronBack,
  IoChevronDownOutline,
  IoChevronForward,
  IoChevronUpOutline,
  IoCloseOutline,
  IoSparklesOutline,
} from 'react-icons/io5'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import { Heading, Text } from '../../../components'
import {
  allLayoutTypes,
  BlockProperties,
  CodeAnimation,
  CodeBlockView,
  Layout,
  ViewConfig,
} from '../../../utils/configTypes'
import { studioStore } from '../../Studio/stores'
import { Block, IntroBlockProps } from '../editor/utils/utils'
import { CanvasPreview, LayoutSelector } from './BlockPreview'

interface Tab {
  name: string
  id: string
  Icon: IconType
}

const commonTabs: Tab[] = [
  {
    id: 'Layout',
    name: 'Layout',
    Icon: FiLayout,
  },
]

const codeBlockTabs: Tab[] = [
  {
    id: 'Animate',
    name: 'Animate',
    Icon: IoSparklesOutline,
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
  const [tabs, setTabs] = useState<Tab[]>(commonTabs)
  const [activeTab, setActiveTab] = useState<Tab>(commonTabs[0])
  const [ref, bounds] = useMeasure()
  const { payload, updatePayload } = useRecoilValue(studioStore)

  useEffect(() => {
    if (!block) return
    const { type } = block
    switch (type) {
      case 'codeBlock':
        setTabs([...commonTabs, ...codeBlockTabs])
        break
      default:
        setTabs(commonTabs)
    }
  }, [block])

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
              if (block.type === 'introBlock') {
                if (payload.activeIntroIndex === 0)
                  setCurrentBlock(blocks[block.pos - 1])
                else
                  updatePayload?.({
                    activeIntroIndex: payload.activeIntroIndex - 1,
                  })
              } else {
                if (blocks[block.pos - 1].type === 'introBlock') {
                  updatePayload?.({
                    activeIntroIndex:
                      (blocks[block.pos - 1] as IntroBlockProps).introBlock
                        .order.length - 1,
                  })
                }
                setCurrentBlock(blocks[block.pos - 1])
              }
            }}
            type="button"
            disabled={block.pos === 0 && payload.activeIntroIndex === 0}
            className={cx('bg-dark-100 text-white p-2 rounded-sm mr-4', {
              'opacity-50 cursor-not-allowed':
                block.pos === 0 && payload.activeIntroIndex === 0,
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
              if (block.type === 'introBlock') {
                if (
                  payload.activeIntroIndex ===
                  block.introBlock.order.length - 1
                )
                  setCurrentBlock(blocks[block.pos + 1])
                else
                  updatePayload?.({
                    activeIntroIndex: payload.activeIntroIndex + 1,
                  })
              } else setCurrentBlock(blocks[block.pos + 1])
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
              {activeTab.id === commonTabs[0].id && (
                <LayoutSelector
                  mode={config.mode}
                  layout={config.blocks[block.id]?.layout || allLayoutTypes[0]}
                  updateLayout={(layout: Layout) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      layout,
                    })
                  }}
                  type={block.type}
                />
              )}
              {activeTab.id === codeBlockTabs[0].id && (
                <AnimateTab
                  view={config.blocks[block.id]?.view as CodeBlockView}
                  updateView={(view: CodeBlockView) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      view,
                    })
                  }}
                />
              )}
            </div>
            <div className="flex flex-col bg-gray-50 px-2 pt-4 gap-y-2 relative w-24">
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

const AnimateTab = ({
  view,
  updateView,
}: {
  view: CodeBlockView
  updateView: (view: CodeBlockView) => void
}) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const { value } = e.target
    const [f, t] = value.split('-')

    const { from, to } = t
      ? { from: parseInt(f, 10), to: parseInt(t, 10) }
      : { from: parseInt(f, 10), to: parseInt(f, 10) }

    updateView({
      ...view,
      code: {
        ...view.code,
        highlightSteps: [
          ...(view.code.highlightSteps?.slice(0, index) || []),
          {
            step: value,
            valid:
              value.match(/^\d+-\d+$/) !== null ||
              value.match(/^\d+$/) !== null,
            from: from - 1,
            to: to - 1,
            fileIndex: 0,
          },
          ...(view.code.highlightSteps?.slice(index + 1) || []),
        ],
      },
    })
  }

  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Animation
      </Heading>
      <Listbox
        value={view.code.animation}
        onChange={(value) =>
          updateView({
            ...view,
            code: {
              ...view.code,
              animation: value,
            },
          })
        }
      >
        {({ open }) => (
          <div className="relative mt-2">
            <Listbox.Button className="w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800">
              <div className="flex items-center gap-x-2 w-full">
                <Text className="text-sm block truncate font-body">
                  {view.code.animation}
                </Text>
              </div>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none ">
                {open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
              </span>
            </Listbox.Button>
            <Listbox.Options className="bg-dark-300 mt-2 rounded-md absolute w-full">
              {Object.values(CodeAnimation).map((animation, index) => (
                <Listbox.Option
                  className={({ active }) =>
                    cx(
                      'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer',
                      {
                        'bg-dark-100': active,
                        'rounded-t-md pt-3': index === 0,
                        'rounded-b-md pb-3':
                          index === Object.keys(CodeAnimation).length - 1,
                      }
                    )
                  }
                  key={animation}
                  value={animation}
                >
                  {({ selected }) => (
                    <>
                      <Text className="text-sm block truncate ">
                        {animation}
                      </Text>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <BiCheck size={20} />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        )}
      </Listbox>
      {view.code.animation === CodeAnimation.HighlightLines && (
        <>
          <Heading fontSize="small" className="font-bold mt-8">
            Code Highlights
          </Heading>
          {view.code.highlightSteps?.map((step, index) => (
            <div className="mt-2">
              <div className="flex items-center bg-gray-100 w-full py-1.5 px-2 rounded-sm border border-transparent justify-between">
                <input
                  value={view.code.highlightSteps?.[index].step}
                  onChange={(e) => handleChange(e, index)}
                  placeholder="1-4"
                  className="bg-gray-100 rounded-sm focus:outline-none font-body text-sm placeholder-gray-400"
                />
                <IoCloseOutline
                  className="cursor-pointer"
                  onClick={() => {
                    updateView({
                      ...view,
                      code: {
                        ...view.code,
                        highlightSteps: view.code.highlightSteps?.filter(
                          (s, i) => i !== index
                        ),
                      },
                    })
                  }}
                />
              </div>
              {!view.code.highlightSteps?.[index].valid &&
                view.code.highlightSteps?.[index].step && (
                  <span className="text-xs font-body text-red-600 italic">
                    Enter a number or a range of numbers
                  </span>
                )}
            </div>
          ))}
          <button
            type="button"
            className="flex items-center gap-x-2 text-gray-800 mt-4 w-max"
            onClick={() => {
              updateView({
                ...view,
                code: {
                  ...view.code,
                  highlightSteps: [...(view.code.highlightSteps || []), {}],
                },
              })
            }}
          >
            <IoAddOutline />
            <Text className="text-left font-main text-sm">Add step</Text>
          </button>
        </>
      )}
    </div>
  )
}

export default Preview
