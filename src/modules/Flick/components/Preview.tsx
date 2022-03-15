import { cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import React, { useEffect, useRef, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { FiCode, FiLayout } from 'react-icons/fi'
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
import { Checkbox, Heading, Text, TextField } from '../../../components'
import {
  allLayoutTypes,
  BlockProperties,
  CodeAnimation,
  CodeBlockView,
  CodeTheme,
  Layout,
  ViewConfig,
} from '../../../utils/configTypes'
import { getSurfaceColor } from '../../Studio/effects/fragments/CodeFragment'
import { studioStore } from '../../Studio/stores'
import { Block, IntroBlockProps } from '../editor/utils/utils'
import { CanvasPreview, LayoutSelector } from './BlockPreview'

interface Tab {
  name: string
  id: string
  // Icon: IconType | HTMLElement
}

const commonTabs: Tab[] = [
  {
    id: 'Layout',
    name: 'Layout',
  },
]

const codeBlockTabs: Tab[] = [
  {
    id: 'CodeTheme',
    name: 'Code theme',
  },
  {
    id: 'Animate',
    name: 'Animate',
  },
]

const getIcon = (tab: Tab, block?: BlockProperties) => {
  switch (tab.id) {
    case 'Layout':
      return <FiLayout size={21} />
    case 'CodeTheme':
      return (
        <div
          className="rounded-sm border"
          style={{
            backgroundColor:
              block?.view?.type === 'codeBlock'
                ? getSurfaceColor({ codeTheme: block.view.code.theme })
                : '#fff',
          }}
        >
          <FiCode
            className="m-1"
            style={{
              color:
                block?.view?.type === 'codeBlock'
                  ? codeThemeConfig.find(
                      (themeConfig) =>
                        themeConfig.theme ===
                        (block.view as CodeBlockView).code.theme
                    )?.textColor
                  : '#fff',
            }}
          />
        </div>
      )
    case 'Animate':
      return <IoSparklesOutline size={21} />
    default:
      return <IoSparklesOutline size={21} />
  }
}

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

  const activeBlockRef = useRef<Block | undefined>(block)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      if (!block || (block.pos === 0 && payload.activeIntroIndex === 0)) return
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
              (blocks[block.pos - 1] as IntroBlockProps).introBlock.order
                .length - 1,
          })
        }
        setCurrentBlock(blocks[block.pos - 1])
      }
    }
    if (e.key === 'ArrowRight') {
      if (!block || block.pos === blocks.length - 1) return
      if (block.type === 'introBlock') {
        if (payload.activeIntroIndex === block.introBlock.order.length - 1)
          setCurrentBlock(blocks[block.pos + 1])
        else
          updatePayload?.({
            activeIntroIndex: payload.activeIntroIndex + 1,
          })
      } else setCurrentBlock(blocks[block.pos + 1])
    }
  }

  useEffect(() => {
    if (!block) return
    document.addEventListener('keydown', handleKeyDown)
  }, [blocks])

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
    <div className="flex justify-between flex-1">
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
        {block.type === 'outroBlock' && (
          <div className="bg-white w-full p-4">
            <OutroTab />
          </div>
        )}
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
                <CodeThemeTab
                  view={config.blocks[block.id]?.view as CodeBlockView}
                  updateView={(view: CodeBlockView) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      view,
                    })
                  }}
                />
              )}
              {activeTab.id === codeBlockTabs[1].id && (
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
            <div
              className="flex flex-col bg-gray-50 px-2 pt-4 gap-y-2 relative"
              style={{
                width: '6.75rem',
              }}
            >
              {tabs.map((tab) => (
                <button
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cx(
                    'flex flex-col items-center bg-transparent py-4 px-2 rounded-md text-gray-500 gap-y-2 transition-all',
                    {
                      'bg-gray-200 text-gray-800': activeTab.id === tab.id,
                      'hover:bg-gray-100': activeTab.id !== tab.id,
                    }
                  )}
                  key={tab.id}
                >
                  {getIcon(tab, config.blocks[block.id])}
                  <Text className="text-xs font-normal font-body">
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

interface CodeThemeConfig {
  theme: CodeTheme
  name: string
  textColor: string
}

const codeThemeConfig: CodeThemeConfig[] = [
  {
    theme: CodeTheme.Light,
    name: 'Light',
    textColor: '#000000',
  },
  {
    theme: CodeTheme.LightPlus,
    name: 'Light+',
    textColor: '#001081',
  },
  {
    theme: CodeTheme.QuietLight,
    name: 'Quiet Light',
    textColor: '#7A3F9D',
  },
  {
    theme: CodeTheme.SolarizedLight,
    name: 'Solarized Light',
    textColor: '#288DD2',
  },
  {
    theme: CodeTheme.Abyss,
    name: 'Abyss',
    textColor: '#6588CC',
  },
  {
    theme: CodeTheme.Dark,
    name: 'Dark',
    textColor: '#D4D5D4',
  },
  {
    theme: CodeTheme.DarkPlus,
    name: 'Dark+',
    textColor: '#9CDCFE',
  },
  {
    theme: CodeTheme.KimbieDark,
    name: 'Kimbie Dark',
    textColor: '#D3AF86',
  },
  {
    theme: CodeTheme.Monokai,
    name: 'Monokai',
    textColor: '#A6E22E',
  },
  {
    theme: CodeTheme.MonokaiDimmed,
    name: 'Monokai Dimmed',
    textColor: '#9872A2',
  },
  {
    theme: CodeTheme.Red,
    name: 'Red',
    textColor: '#FB9B4C',
  },
  {
    theme: CodeTheme.SolarizedDark,
    name: 'Solarized Dark',
    textColor: '#268BD2',
  },
  {
    theme: CodeTheme.TomorrowNightBlue,
    name: 'Tomorrow Night Blue',
    textColor: '#FF9EA4',
  },
  {
    theme: CodeTheme.HighContrast,
    name: 'High Contrast',
    textColor: '#9CDDFE',
  },
]

const SocialHandle = ({ title }: { title: string }) => {
  return (
    <div>
      <div className="flex justify-between items-center">
        <Heading>{title}</Heading>
        <Checkbox name="" label="" checked />
      </div>
      <TextField />
    </div>
  )
}

const OutroTab = () => {
  return (
    <div className="flex flex-col justify-center w-full">
      <SocialHandle title="Twitter" />
    </div>
  )
}

const CodeThemeTab = ({
  view,
  updateView,
}: {
  view: CodeBlockView
  updateView: (view: CodeBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Code Theme
      </Heading>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
        {codeThemeConfig.map((themeConfig, index) => (
          <button
            className={cx('border border-gray-200 h-14 rounded-sm p-1', {
              'border-gray-800': view.code.theme === themeConfig.theme,
            })}
            type="button"
            onClick={() => {
              updateView({
                ...view,
                code: {
                  ...view.code,
                  theme: themeConfig.theme,
                },
              })
            }}
            key={themeConfig.name}
          >
            <div
              style={{
                backgroundColor: getSurfaceColor({
                  codeTheme: themeConfig.theme,
                }),
              }}
              className={cx(
                'border border-transparent w-full h-full flex items-center justify-center rounded-sm',
                {
                  'border-gray-200': index === 0 || index === 1,
                }
              )}
            >
              <Text
                style={{
                  fontFamily: 'Monaco',
                  color: themeConfig.textColor,
                }}
                className="text-xs"
              >
                {themeConfig.name}
              </Text>
            </div>
          </button>
        ))}
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
