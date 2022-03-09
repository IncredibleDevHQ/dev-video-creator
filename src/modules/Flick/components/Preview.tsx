import { css, cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import { sentenceCase } from 'change-case'
import React, { useEffect, useState } from 'react'
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
import { MdOutlineTextFields } from 'react-icons/md'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import { ReactComponent as BulletListStyleIcon } from '../../../assets/BulletListStyle.svg'
import { ReactComponent as EditorStyleIcon } from '../../../assets/EditorStyle.svg'
import { ReactComponent as NumberListStyleIcon } from '../../../assets/NumberListStyle.svg'
import { ReactComponent as TerminalStyleIcon } from '../../../assets/TerminalStyle.svg'
import { Heading, Text } from '../../../components'
import {
  allLayoutTypes,
  BlockProperties,
  BlockView,
  CaptionTitleView,
  CodeAnimation,
  CodeBlockView,
  CodeStyle,
  CodeTheme,
  ImageBlockView,
  Layout,
  ListAppearance,
  ListBlockView,
  ListOrientation,
  ListViewStyle,
  VideoBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { getSurfaceColor } from '../../Studio/effects/fragments/CodeFragment'
import { studioStore } from '../../Studio/stores'
import { Block, IntroBlockProps } from '../editor/utils/utils'
import { CanvasPreview, LayoutSelector } from './BlockPreview'

const customScroll = css`
  ::-webkit-scrollbar {
    width: 18px;
  }
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-color: #d6dee1;
    border-radius: 20px;
    border: 6px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: #a8bbbf;
  }
`

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
  {
    id: 'Mode',
    name: 'Mode',
  },
]

const codeBlockTabs: Tab[] = [
  {
    id: 'TextSize',
    name: 'Text size',
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
    case 'Mode':
      if (block && block.view?.type !== 'codeBlock')
        return <IoSparklesOutline size={21} />
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
    case 'TextSize':
      return <MdOutlineTextFields size={21} />
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

  useEffect(() => {
    if (!block) return
    setActiveTab(commonTabs[0])
    const { type } = block
    switch (type) {
      case 'codeBlock':
        setTabs([...commonTabs, ...codeBlockTabs])
        break
      default:
        setTabs(commonTabs)
        break
    }
  }, [block])

  if (!block) return null

  return (
    <div className="flex justify-between flex-1 overflow-hidden">
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
            <div
              className={cx(
                'bg-white w-64 flex-1 overflow-y-scroll',
                customScroll
              )}
            >
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
              {activeTab.id === commonTabs[1].id && (
                <ModeSelector
                  view={config.blocks[block.id]?.view}
                  updateView={(view: BlockView) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      view,
                    })
                  }}
                />
              )}
              {activeTab.id === codeBlockTabs[0].id &&
                block.type === 'codeBlock' && (
                  <CodeTextSizeTab
                    view={config.blocks[block.id]?.view as CodeBlockView}
                    updateView={(view: CodeBlockView) => {
                      updateConfig(block.id, {
                        ...config.blocks[block.id],
                        view,
                      })
                    }}
                  />
                )}
              {activeTab.id === codeBlockTabs[1].id &&
                block.type === 'codeBlock' && (
                  <CodeAnimateTab
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

const ModeSelector = ({
  view,
  updateView,
}: {
  view: BlockView | undefined
  updateView: (view: BlockView) => void
}) => {
  if (!view) return null

  return (() => {
    switch (view.type) {
      case 'codeBlock':
        return <CodeBlockModeSelector view={view} updateView={updateView} />
      case 'imageBlock':
        return <ImageBlockModeSelector view={view} updateView={updateView} />
      case 'videoBlock':
        return <VideoBlockModeSelector view={view} updateView={updateView} />
      case 'listBlock':
        return <ListBlockModeSelector view={view} updateView={updateView} />
      default:
        return null
    }
  })()
}

const ListBlockModeSelector = ({
  view,
  updateView,
}: {
  view: ListBlockView
  updateView: (view: ListBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        List Style
      </Heading>
      <div className="grid grid-cols-3 mt-2 gap-x-2">
        {(['none', 'bullet', 'number'] as ListViewStyle[]).map((style) => {
          return (
            <div className="aspect-w-1 aspect-h-1">
              <button
                type="button"
                onClick={() =>
                  updateView({
                    ...view,
                    list: {
                      ...view.list,
                      viewStyle: style,
                    },
                  })
                }
                className={cx(
                  'border border-gray-200 h-full w-full rounded-sm p-px',
                  {
                    'border-gray-800': view.list.viewStyle === style,
                  }
                )}
              >
                {style === 'none' && (
                  <div
                    className={cx('bg-gray-100 w-full h-full', {
                      'bg-gray-200': view.list.viewStyle === style,
                    })}
                  >
                    <span
                      className={cx(
                        'flex items-center justify-center w-full h-full text-gray-300 rounded-sm text-xl',
                        {
                          'text-gray-800': view.list.viewStyle === style,
                        }
                      )}
                    >
                      -
                    </span>
                  </div>
                )}
                {(style === 'bullet' || style === 'number') && (
                  <div
                    style={{
                      paddingLeft: '13px',
                      paddingRight: '13px',
                    }}
                    className={cx(
                      'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                      {
                        'bg-gray-200': view.list.viewStyle === style,
                      }
                    )}
                  >
                    <div
                      className={cx('filter h-full w-full p-1.5', {
                        'brightness-0': view.list.viewStyle === style,
                      })}
                    >
                      {style === 'bullet' ? (
                        <BulletListStyleIcon className="h-full w-full" />
                      ) : (
                        <NumberListStyleIcon className="h-full w-full" />
                      )}
                    </div>
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>
      <Heading fontSize="small" className="font-bold mt-8">
        Appearance
      </Heading>
      <Listbox
        value={view.list.appearance}
        onChange={(value) =>
          updateView({
            ...view,
            list: {
              ...view.list,
              appearance: value,
            },
          })
        }
      >
        {({ open }) => (
          <div className="relative mt-2">
            <Listbox.Button className="w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800">
              <div className="flex items-center gap-x-2 w-full">
                <Text className="text-sm block truncate font-body">
                  {sentenceCase(view.list.appearance as string)}
                </Text>
              </div>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none ">
                {open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
              </span>
            </Listbox.Button>
            <Listbox.Options className="bg-dark-300 mt-2 rounded-md absolute w-full z-10">
              {(['stack', 'replace', 'allAtOnce'] as ListAppearance[]).map(
                (appearance, index) => (
                  <Listbox.Option
                    className={({ active }) =>
                      cx(
                        'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer',
                        {
                          'bg-dark-100': active,
                          'rounded-t-md pt-3': index === 0,
                          'rounded-b-md pb-3':
                            index ===
                            (
                              [
                                'stack',
                                'replace',
                                'allAtOnce',
                              ] as ListAppearance[]
                            ).length -
                              1,
                        }
                      )
                    }
                    key={appearance}
                    value={appearance}
                  >
                    {({ selected }) => (
                      <>
                        <Text className="text-sm block truncate ">
                          {sentenceCase(appearance)}
                        </Text>
                        {selected && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <BiCheck size={20} />
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                )
              )}
            </Listbox.Options>
          </div>
        )}
      </Listbox>
      <Heading fontSize="small" className="font-bold mt-8">
        Orientation
      </Heading>
      <div className="grid grid-cols-3 mt-2 gap-x-2">
        {(['vertical', 'horizontal'] as ListOrientation[]).map(
          (orientation) => {
            return (
              <div className="aspect-w-1 aspect-h-1">
                <button
                  type="button"
                  onClick={() =>
                    updateView({
                      ...view,
                      list: {
                        ...view.list,
                        orientation,
                      },
                    })
                  }
                  className={cx(
                    'border border-gray-200 h-full w-full rounded-sm p-px',
                    {
                      'border-gray-800': view.list.orientation === orientation,
                    }
                  )}
                >
                  <div
                    className={cx(
                      'flex items-center justify-center gap-1 bg-gray-100 w-full h-full',
                      {
                        'bg-gray-200': view.list.orientation === orientation,
                        'flex-row': orientation === 'horizontal',
                        'flex-col': orientation === 'vertical',
                      }
                    )}
                  >
                    {[1, 2, 3].map(() => {
                      return (
                        <div
                          style={{
                            borderRadius: '2px',
                          }}
                          className="h-1.5 w-1.5 bg-gray-800"
                        />
                      )
                    })}
                  </div>
                </button>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

const ImageBlockModeSelector = ({
  view,
  updateView,
}: {
  view: ImageBlockView
  updateView: (view: ImageBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Image Style
      </Heading>
      <div className="grid grid-cols-3 mt-2 gap-x-2">
        {(['titleOnly', 'captionOnly', 'none'] as CaptionTitleView[]).map(
          (style) => {
            return (
              <div className="aspect-w-1 aspect-h-1">
                <button
                  type="button"
                  onClick={() =>
                    updateView({
                      ...view,
                      image: {
                        ...view.image,
                        captionTitleView: style,
                      },
                    })
                  }
                  className={cx(
                    'border border-gray-200 h-full w-full rounded-sm p-px ',
                    {
                      'border-gray-800': view.image.captionTitleView === style,
                    }
                  )}
                >
                  {style === 'none' && (
                    <div
                      className={cx('bg-gray-100 w-full h-full p-2', {
                        'bg-gray-200': view.image.captionTitleView === style,
                      })}
                    >
                      <div
                        className={cx('w-full h-full bg-gray-300 rounded-sm', {
                          'bg-gray-800': view.image.captionTitleView === style,
                        })}
                      />
                    </div>
                  )}
                  {(style === 'titleOnly' || style === 'captionOnly') && (
                    <div
                      style={{
                        paddingLeft: '13px',
                        paddingRight: '13px',
                      }}
                      className={cx(
                        'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                        {
                          'flex-col-reverse': style === 'captionOnly',
                          'bg-gray-200': view.image.captionTitleView === style,
                        }
                      )}
                    >
                      <div
                        style={{
                          borderRadius: '2px',
                        }}
                        className={cx('w-full h-full bg-gray-300', {
                          'bg-gray-800': view.image.captionTitleView === style,
                        })}
                      />
                      <div className="aspect-w-1 aspect-h-1 w-full">
                        <div
                          style={{
                            borderRadius: '3px',
                          }}
                          className={cx('w-full h-full bg-gray-300', {
                            'bg-gray-800':
                              view.image.captionTitleView === style,
                          })}
                        />
                      </div>
                    </div>
                  )}
                </button>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

const VideoBlockModeSelector = ({
  view,
  updateView,
}: {
  view: VideoBlockView
  updateView: (view: VideoBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Video Style
      </Heading>
      <div className="grid grid-cols-3 mt-2 gap-x-2">
        {(['titleOnly', 'captionOnly', 'none'] as CaptionTitleView[]).map(
          (style) => {
            return (
              <div className="aspect-w-1 aspect-h-1">
                <button
                  type="button"
                  onClick={() =>
                    updateView({
                      ...view,
                      video: {
                        ...view.video,
                        captionTitleView: style,
                      },
                    })
                  }
                  className={cx(
                    'border border-gray-200 h-full w-full rounded-sm p-px',
                    {
                      'border-gray-800': view.video.captionTitleView === style,
                    }
                  )}
                >
                  {style === 'none' && (
                    <div
                      className={cx('bg-gray-100 w-full h-full p-2', {
                        'bg-gray-200': view.video.captionTitleView === style,
                      })}
                    >
                      <div
                        className={cx('w-full h-full bg-gray-300 rounded-sm', {
                          'bg-gray-800': view.video.captionTitleView === style,
                          'bg-gray-200': view.video.captionTitleView === style,
                        })}
                      />
                    </div>
                  )}
                  {(style === 'titleOnly' || style === 'captionOnly') && (
                    <div
                      style={{
                        paddingLeft: '13px',
                        paddingRight: '13px',
                      }}
                      className={cx(
                        'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                        {
                          'flex-col-reverse': style === 'captionOnly',
                          'bg-gray-200': view.video.captionTitleView === style,
                        }
                      )}
                    >
                      <div
                        style={{
                          borderRadius: '2px',
                        }}
                        className={cx('w-full h-full bg-gray-300', {
                          'bg-gray-800': view.video.captionTitleView === style,
                        })}
                      />
                      <div className="aspect-w-1 aspect-h-1 w-full">
                        <div
                          style={{
                            borderRadius: '3px',
                          }}
                          className={cx('w-full h-full bg-gray-300', {
                            'bg-gray-800':
                              view.video.captionTitleView === style,
                          })}
                        />
                      </div>
                    </div>
                  )}
                </button>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

const CodeBlockModeSelector = ({
  view,
  updateView,
}: {
  view: CodeBlockView
  updateView: (view: CodeBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Code Style
      </Heading>
      <div className="mt-2 grid grid-cols-2 w-full gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() => {
            updateView({
              ...view,
              code: {
                ...view.code,
                codeStyle: CodeStyle.Editor,
              },
            })
          }}
          className={cx('border border-gray-200 h-14 rounded-sm p-1', {
            'border-gray-800': view.code.codeStyle === CodeStyle.Editor,
          })}
        >
          <EditorStyleIcon className="w-full h-full" />
        </button>
        <button
          type="button"
          onClick={() => {
            updateView({
              ...view,
              code: {
                ...view.code,
                codeStyle: CodeStyle.Terminal,
              },
            })
          }}
          className={cx('border border-gray-200 h-14 rounded-sm p-1', {
            'border-gray-800': view.code.codeStyle === CodeStyle.Terminal,
          })}
        >
          <TerminalStyleIcon className="w-full h-full" />
        </button>
      </div>

      <Heading fontSize="small" className="font-bold mt-8">
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

const CodeTextSizeTab = ({
  view,
  updateView,
}: {
  view: CodeBlockView
  updateView: (view: CodeBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Text size
      </Heading>
      <div className="grid grid-cols-3 mt-2 gap-x-2">
        {[12, 16, 20].map((size) => {
          return (
            <div className="aspect-w-1 aspect-h-1">
              <button
                type="button"
                onClick={() => {
                  updateView({
                    ...view,
                    code: {
                      ...view.code,
                      fontSize: size,
                    },
                  })
                }}
                className={cx('border border-gray-200 rounded-sm p-px', {
                  'border-gray-800': view.code.fontSize === size,
                })}
              >
                <Text
                  className={cx(
                    'text-xs font-body w-full h-full flex items-center justify-center text-gray-400 bg-gray-100',
                    {
                      'text-gray-800 bg-gray-200': view.code.fontSize === size,
                    }
                  )}
                >
                  {size}px
                </Text>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CodeAnimateTab = ({
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
