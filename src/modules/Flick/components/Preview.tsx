/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import { Text as TextNode } from '@tiptap/extension-text'
import { EditorContent, useEditor } from '@tiptap/react'
import { capitalCase, sentenceCase } from 'change-case'
import React, {
  ChangeEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import Dropzone from 'react-dropzone'
import { BiCheck, BiNote } from 'react-icons/bi'
import { CgProfile } from 'react-icons/cg'
import { FiCode, FiLayout, FiLoader, FiUploadCloud } from 'react-icons/fi'
import {
  IoAddOutline,
  IoArrowDownOutline,
  IoArrowUpOutline,
  IoChevronBack,
  IoChevronDownOutline,
  IoChevronForward,
  IoChevronUpOutline,
  IoCloseCircle,
  IoCloseOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoPlayForwardOutline,
  IoSparklesOutline,
} from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import useMeasure from 'react-use-measure'
import { useRecoilState, useRecoilValue } from 'recoil'
import { v4 as uuidv4 } from 'uuid'
import { ReactComponent as BulletListStyleIcon } from '../../../assets/BulletListStyle.svg'
import listAllAtOnceGif from '../../../assets/ListAllAtOnce.svg'
import listReplaceGif from '../../../assets/ListReplace.svg'
import listStackGif from '../../../assets/ListStack.svg'
import { ReactComponent as NumberListStyleIcon } from '../../../assets/NumberListStyle.svg'
import { Checkbox, Heading, Text } from '../../../components'
import { useUploadFile } from '../../../hooks'
import {
  allLayoutTypes,
  BlockProperties,
  BlockView,
  CaptionTitleView,
  CodeAnimation,
  CodeBlockView,
  CodeTheme,
  HandleDetails,
  ImageBlockView,
  IntroBlockView,
  Layout,
  ListAppearance,
  ListBlockView,
  ListOrientation,
  ListViewStyle,
  OutroBlockView,
  VideoBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { getSurfaceColor } from '../../Studio/effects/fragments/CodeFragment'
import { codePreviewStore, studioStore } from '../../Studio/stores'
import editorStyle from '../editor/style'
import {
  Block,
  CodeBlockProps,
  HeadingBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  OutroBlockProps,
  SimpleAST,
  VideoBlockProps,
} from '../editor/utils/utils'
import { CanvasPreview, LayoutSelector, useGetHW } from './BlockPreview'
import { EditorContext } from './EditorProvider'

const noScrollBar = css`
  ::-webkit-scrollbar {
    display: none;
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
  {
    id: 'Note',
    name: 'Note',
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

const introOutroBlockTabs: Tab[] = [
  {
    id: 'Content',
    name: 'Content',
  },
  {
    id: 'Sequence',
    name: 'Sequence',
  },
]

const introBlockTabs: Tab[] = [
  {
    id: 'Picture',
    name: 'Picture',
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
    case 'Note':
      return <BiNote size={21} />
    case 'TextSize':
      return <MdOutlineTextFields size={21} />
    case 'Animate':
      return <IoSparklesOutline size={21} />
    case 'Content':
      return <MdOutlineTextFields size={21} />
    case 'Picture':
      return <CgProfile size={21} />
    case 'Sequence':
      return <IoPlayForwardOutline size={21} />
    default:
      return <IoSparklesOutline size={21} />
  }
}

const Preview = ({
  block,
  blocks,
  config,
  centered,
  simpleAST,
  setSimpleAST,
  updateConfig,
  setCurrentBlock,
}: {
  block: Block | undefined
  blocks: Block[]
  config: ViewConfig
  centered: boolean
  simpleAST?: SimpleAST
  setSimpleAST?: React.Dispatch<React.SetStateAction<SimpleAST | undefined>>
  updateConfig: (id: string, properties: BlockProperties) => void
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
}) => {
  const [tabs, setTabs] = useState<Tab[]>(commonTabs)
  const [activeTab, setActiveTab] = useState<Tab>(commonTabs[0])
  const [ref, bounds] = useMeasure()
  const { payload, updatePayload } = useRecoilValue(studioStore)

  const [codePreviewValue, setCodePreviewValue] =
    useRecoilState(codePreviewStore)

  const activeBlockRef = useRef<Block | undefined>(block)

  const handleKeyDown = (e: KeyboardEvent) => {
    const block = activeBlockRef.current
    if (e.key === 'ArrowLeft') {
      if (!block || (block.pos === 0 && payload.activeIntroIndex === 0)) return
      if (block.type === 'introBlock') {
        updatePayload?.({
          activeIntroIndex: payload.activeIntroIndex - 1,
        })
      } else if (block.type === 'outroBlock') {
        if (payload.activeOutroIndex === 0)
          setCurrentBlock(blocks[block.pos - 1])
        else
          updatePayload?.({
            activeOutroIndex: payload.activeOutroIndex - 1,
          })
      } else {
        if (blocks[block.pos - 1].type === 'introBlock') {
          updatePayload?.({
            activeIntroIndex:
              ((config.blocks[blocks[block.pos - 1].id].view as IntroBlockView)
                .intro.order?.length || 0) - 1,
          })
        }
        setCurrentBlock(blocks[block.pos - 1])
      }
    }
    if (e.key === 'ArrowRight') {
      if (
        !block ||
        (block.pos === blocks.length - 1 &&
          payload.activeOutroIndex ===
            ((config.blocks[blocks[block.pos].id].view as OutroBlockView).outro
              .order?.length || 0) -
              1)
      )
        return
      if (block.type === 'introBlock') {
        if (
          payload.activeIntroIndex ===
          ((config.blocks[blocks[block.pos].id].view as IntroBlockView).intro
            .order?.length || 0) -
            1
        ) {
          setCurrentBlock(blocks[block.pos + 1])
        } else {
          updatePayload?.({
            activeIntroIndex: payload.activeIntroIndex + 1,
          })
        }
      } else if (block.type === 'outroBlock') {
        updatePayload?.({
          activeOutroIndex: payload.activeOutroIndex + 1,
        })
      } else {
        setCurrentBlock(blocks[block.pos + 1])
      }
    }
  }

  useEffect(() => {
    if (!activeBlockRef.current) return
    document.addEventListener('keydown', handleKeyDown)
  }, [activeBlockRef, blocks])

  // remove event listener on unmount
  useEffect(() => {
    if (block?.pos === 0) {
      const introBlock = blocks?.find((b) => b.type === 'introBlock')
      if (introBlock) {
        const introBlockView = config.blocks[introBlock.id]
          ?.view as IntroBlockView

        const titlePos = introBlockView?.intro?.order?.findIndex(
          (order) => order?.state === 'titleSplash'
        )
        updatePayload?.({
          activeIntroIndex: titlePos || 0,
        })
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!block) return
    const { type } = block
    if (type !== 'introBlock' && type !== 'outroBlock')
      setActiveTab(commonTabs[0])
    switch (type) {
      case 'introBlock':
        setTabs([...introOutroBlockTabs, ...introBlockTabs, commonTabs[2]])
        setActiveTab(introOutroBlockTabs[0])
        break
      case 'outroBlock':
        setTabs([commonTabs[0], ...introOutroBlockTabs, commonTabs[2]])
        setActiveTab(commonTabs[0])
        break
      case 'codeBlock': {
        setTabs([commonTabs[0], commonTabs[1], ...codeBlockTabs, commonTabs[2]])
        setCodePreviewValue(0)
        break
      }
      case 'headingBlock':
        setTabs([commonTabs[0], commonTabs[2]])
        break
      default:
        setTabs(commonTabs)
        break
    }
  }, [block?.id])

  useEffect(() => {
    if (!block) {
      setCurrentBlock(blocks?.[0])
    }
  }, [block])

  const { height, width } = useGetHW({
    maxH: bounds.height * 0.83,
    maxW: bounds.width * 0.83,
    aspectRatio: config.mode === 'Portrait' ? 9 / 16 : 16 / 9,
  })

  if (!block) return null

  return (
    <div className="flex justify-between flex-1 overflow-hidden">
      <div
        className={cx(
          'flex justify-center items-start bg-gray-100 flex-1 pl-0',
          {
            'items-center': centered,
            'pt-12': !centered,
          }
        )}
        ref={ref}
      >
        <div className="flex items-center relative">
          <button
            onClick={() => {
              if (block.type === 'introBlock') {
                updatePayload?.({
                  activeIntroIndex: payload.activeIntroIndex - 1,
                })
              } else if (block.type === 'outroBlock') {
                if (payload.activeOutroIndex === 0)
                  setCurrentBlock(blocks[block.pos - 1])
                else
                  updatePayload?.({
                    activeOutroIndex: payload.activeOutroIndex - 1,
                  })
              } else {
                if (blocks[block.pos - 1].type === 'introBlock') {
                  updatePayload?.({
                    activeIntroIndex:
                      ((
                        config.blocks[blocks[block.pos - 1].id]
                          .view as IntroBlockView
                      ).intro.order?.length || 0) - 1,
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
          {block.type !== 'interactionBlock' && (
            <CanvasPreview
              block={block}
              bounds={bounds}
              shortsMode={config.mode === 'Portrait'}
              config={config}
              scale={0.83}
            />
          )}
          {block.type === 'interactionBlock' && (
            <div
              style={{
                height,
                width,
              }}
              className="flex justify-center items-center flex-1 overflow-hidden font-body"
            >
              <span>Preview is unavailable for this block</span>
            </div>
          )}
          <button
            onClick={() => {
              if (block.type === 'introBlock') {
                if (
                  payload.activeIntroIndex ===
                  ((config.blocks[blocks[block.pos].id].view as IntroBlockView)
                    .intro.order?.length || 0) -
                    1
                ) {
                  setCurrentBlock(blocks[block.pos + 1])
                } else {
                  updatePayload?.({
                    activeIntroIndex: payload.activeIntroIndex + 1,
                  })
                }
              } else if (block.type === 'outroBlock') {
                updatePayload?.({
                  activeOutroIndex: payload.activeOutroIndex + 1,
                })
              } else {
                setCurrentBlock(blocks[block.pos + 1])
              }
            }}
            type="button"
            disabled={
              block.pos === blocks.length - 1 &&
              payload.activeOutroIndex ===
                ((config.blocks[blocks[block.pos].id].view as OutroBlockView)
                  .outro.order?.length || 0) -
                  1
            }
            className={cx('bg-dark-100 text-white p-2 rounded-sm ml-4', {
              'opacity-50 cursor-not-allowed':
                block.pos === blocks.length - 1 &&
                payload.activeOutroIndex ===
                  ((config.blocks[blocks[block.pos].id].view as OutroBlockView)
                    .outro.order?.length || 0) -
                    1,
              'opacity-90 hover:bg-dark-100 hover:opacity-100':
                block.pos < blocks.length - 1,
            })}
          >
            <IoChevronForward />
          </button>
          {block.type === 'codeBlock' && (
            <div className="absolute bottom-0 right-8 -mb-4">
              <button
                className={cx(
                  'bg-gray-800 border border-gray-200 text-white p-1.5 rounded-sm'
                )}
                type="button"
                onClick={() => {
                  setCodePreviewValue?.(
                    codePreviewValue ? codePreviewValue - 1 : 0
                  )
                }}
              >
                <IoArrowUpOutline
                  style={{
                    margin: '3px',
                  }}
                  className="w-4 h-4 p-px"
                />
              </button>
              <button
                className={cx(
                  'bg-gray-800 border border-gray-200 text-white p-1.5 rounded-sm ml-2'
                )}
                type="button"
                onClick={() => {
                  setCodePreviewValue?.(codePreviewValue + 1)
                }}
              >
                <IoArrowDownOutline
                  style={{
                    margin: '3px',
                  }}
                  className="w-4 h-4 p-px"
                />
              </button>
            </div>
          )}
        </div>
      </div>
      {block.type !== 'interactionBlock' && (
        <div
          style={{
            width: '350px',
          }}
          className="flex"
        >
          <>
            <div
              className={cx(
                'bg-white w-64 flex-1 overflow-y-scroll',
                noScrollBar
              )}
            >
              {activeTab.id === introOutroBlockTabs[0].id && (
                <div>
                  {block.type === 'introBlock' ? (
                    <IntroContentTab
                      view={config.blocks[block.id]?.view as IntroBlockView}
                      updateView={(view: IntroBlockView) => {
                        updateConfig(block.id, {
                          ...config.blocks[block.id],
                          view,
                        })
                      }}
                    />
                  ) : (
                    <OutroTab
                      view={config.blocks[block.id]?.view as OutroBlockView}
                      updateView={(view: OutroBlockView) => {
                        updateConfig(block.id, {
                          ...config.blocks[block.id],
                          view,
                        })
                      }}
                    />
                  )}
                </div>
              )}
              {activeTab.id === introBlockTabs[0].id && (
                <PictureTab
                  view={config.blocks[block.id]?.view as IntroBlockView}
                  updateView={(view: IntroBlockView) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      view,
                    })
                  }}
                />
              )}
              {activeTab.id === introOutroBlockTabs[1].id &&
                block.type === 'introBlock' && (
                  <SequenceTab
                    view={config.blocks[block.id]?.view as IntroBlockView}
                    updateView={(view: IntroBlockView) => {
                      updateConfig(block.id, {
                        ...config.blocks[block.id],
                        view,
                      })
                    }}
                  />
                )}
              {activeTab.id === introOutroBlockTabs[1].id &&
                block.type === 'outroBlock' && (
                  <OutroSequenceTab
                    view={config.blocks[block.id]?.view as OutroBlockView}
                    updateView={(view: OutroBlockView) => {
                      updateConfig(block.id, {
                        ...config.blocks[block.id],
                        view,
                      })
                    }}
                  />
                )}
              {activeTab.id === commonTabs[0].id && (
                <LayoutSelector
                  mode={config.mode}
                  layout={config.blocks[block.id]?.layout || allLayoutTypes[0]}
                  updateLayout={(layout: Layout) => {
                    if (block.type === 'introBlock') {
                      const introBlock = blocks?.find(
                        (b) => b.type === 'introBlock'
                      )
                      if (introBlock) {
                        const introBlockView = config.blocks[introBlock.id]
                          ?.view as IntroBlockView

                        const titlePos =
                          introBlockView?.intro?.order?.findIndex(
                            (order) => order?.state === 'titleSplash'
                          )
                        updatePayload?.({
                          activeIntroIndex: titlePos || 0,
                        })
                      }
                    }
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
              {activeTab.id === commonTabs[2].id && (
                <Note
                  block={block}
                  simpleAST={simpleAST}
                  setSimpleAST={setSimpleAST}
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
              {tabs
                .filter((tab) => {
                  if (
                    (block.type === 'outroBlock' ||
                      block.type === 'introBlock') &&
                    tab.id === commonTabs[1].id
                  )
                    return false

                  return true
                })
                .map((tab) => (
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
        </div>
      )}
    </div>
  )
}

const PictureTab = ({
  view,
  updateView,
}: {
  view: IntroBlockView | undefined
  updateView: (view: IntroBlockView) => void
}) => {
  const [uploadFile] = useUploadFile()
  const [fileUploading, setFileUploading] = useState(false)

  const handleUploadFile = async (files: File[]) => {
    const file = files?.[0]
    if (!file) return

    setFileUploading(true)
    const { url } = await uploadFile({
      extension: file.name.split('.').pop() as any,
      file,
    })

    setFileUploading(false)
    updateView({
      ...view,
      type: 'introBlock',
      intro: {
        ...view?.intro,
        displayPicture: url,
      },
    })
  }
  return (
    <div className="flex flex-col pt-6 px-4">
      <Heading fontSize="small" className="font-bold">
        Picture
      </Heading>
      {view?.intro?.displayPicture ? (
        <div className="relative rounded-sm ring-1 ring-offset-1 ring-gray-100 w-1/2 mt-2">
          <IoCloseCircle
            className="absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full"
            size={16}
            onClick={() => {
              updateView({
                ...view,
                type: 'introBlock',
                intro: {
                  ...view?.intro,
                  displayPicture: undefined,
                },
              })
            }}
          />
          <img
            src={view?.intro?.displayPicture || ''}
            alt="backgroundImage"
            className="object-contain w-full h-full rounded-md"
          />
        </div>
      ) : (
        <Dropzone onDrop={handleUploadFile} accept={['image/*']} maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className="flex flex-col items-center p-3 mt-2 border border-gray-200 border-dashed rounded-md cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              {fileUploading ? (
                <FiLoader className={cx('animate-spin my-6')} size={16} />
              ) : (
                <>
                  <FiUploadCloud size={21} className="my-2 text-gray-600" />

                  <div className="z-50 text-center ">
                    <Text className="text-xs text-gray-600 font-body">
                      Drag and drop or
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      browse
                    </Text>
                  </div>
                </>
              )}
            </div>
          )}
        </Dropzone>
      )}
    </div>
  )
}

const SequenceTab = ({
  view,
  updateView,
}: {
  view: IntroBlockView | undefined
  updateView: (view: IntroBlockView) => void
}) => {
  useEffect(() => {
    if (!view?.intro.order) {
      updateView({
        ...view,
        type: 'introBlock',
        intro: {
          ...view?.intro,
          order: [
            {
              state: 'userMedia',
              enabled: true,
            },
            {
              state: 'introVideo',
              enabled: true,
            },
            {
              state: 'titleSplash',
              enabled: true,
            },
          ],
        },
      })
    }
  }, [view])

  return (
    <div className="flex flex-col pt-6 px-4">
      <Heading fontSize="small" className="font-bold">
        Sequence
      </Heading>
      <span className="font-body text-xs text-gray-400">
        Drag and drop to change sequence
      </span>
      <DragDropContext
        onDragEnd={(result) => {
          const { destination, source } = result

          if (!destination || !view?.intro?.order) return

          if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
          )
            return

          const newOrder = Array.from(view.intro.order)
          newOrder.splice(source.index, 1)
          newOrder.splice(destination.index, 0, view.intro.order[source.index])
          updateView({
            ...view,
            type: 'introBlock',
            intro: {
              ...view?.intro,
              order: newOrder,
            },
          })
        }}
      >
        <Droppable droppableId="droppable">
          {(provided) => (
            <div
              className="flex flex-col justify-center gap-y-2 w-full border border-dashed mt-4 rounded-md p-2"
              style={{
                height: view?.intro?.order?.length === 3 ? '150px' : '105px',
              }}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {view?.intro?.order?.map((o, i) => (
                <Draggable key={o.state} draggableId={o.state} index={i}>
                  {(provided) => (
                    <div
                      className="flex justify-between border rounded-sm p-2 text-sm font-body bg-white"
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {capitalCase(o.state)}
                      <button
                        type="button"
                        className="disabled:cursor-not-allowed"
                        disabled={
                          view?.intro?.order?.filter((o) => o.enabled)
                            .length === 1 && o.enabled
                        }
                        onClick={() => {
                          updateView({
                            ...view,
                            type: 'introBlock',
                            intro: {
                              ...view?.intro,
                              order: view?.intro?.order?.map((item) => {
                                if (item.state === o.state) {
                                  return {
                                    ...o,
                                    enabled: !o.enabled,
                                  }
                                }
                                return item
                              }),
                            },
                          })
                        }}
                      >
                        {o.enabled ? <IoEyeOutline /> : <IoEyeOffOutline />}
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

const OutroSequenceTab = ({
  view,
  updateView,
}: {
  view: OutroBlockView | undefined
  updateView: (view: OutroBlockView) => void
}) => {
  useEffect(() => {
    if (!view?.outro.order) {
      updateView({
        ...view,
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          order: [
            {
              state: 'outroVideo',
              enabled: true,
            },
            {
              state: 'titleSplash',
              enabled: true,
            },
          ],
        },
      })
    }
  }, [view])

  return (
    <div className="flex flex-col pt-6 px-4">
      <Heading fontSize="small" className="font-bold">
        Sequence
      </Heading>
      <span className="font-body text-xs text-gray-400">
        Drag and drop to change sequence
      </span>
      <DragDropContext
        onDragEnd={(result) => {
          const { destination, source } = result

          if (!destination || !view?.outro?.order) return

          if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
          )
            return

          const newOrder = Array.from(view.outro.order)
          newOrder.splice(source.index, 1)
          newOrder.splice(destination.index, 0, view.outro.order[source.index])
          updateView({
            ...view,
            type: 'outroBlock',
            outro: {
              ...view?.outro,
              order: newOrder,
            },
          })
        }}
      >
        <Droppable droppableId="droppable">
          {(provided) => (
            <div
              className="flex flex-col justify-center gap-y-2 w-full border border-dashed mt-4 rounded-md p-2"
              style={{
                height: view?.outro?.order?.length === 2 ? '105px' : '60px',
              }}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {view?.outro?.order?.map((o, i) => (
                <Draggable key={o.state} draggableId={o.state} index={i}>
                  {(provided) => (
                    <div
                      className="flex justify-between border rounded-sm p-2 text-sm font-body bg-white"
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {capitalCase(o.state)}
                      <button
                        type="button"
                        className="disabled:cursor-not-allowed"
                        disabled={
                          view?.outro?.order?.filter((o) => o.enabled)
                            .length === 1 && o.enabled
                        }
                        onClick={() => {
                          updateView({
                            ...view,
                            type: 'outroBlock',
                            outro: {
                              ...view?.outro,
                              order: view?.outro?.order?.map((item) => {
                                if (item.state === o.state) {
                                  return {
                                    ...o,
                                    enabled: !o.enabled,
                                  }
                                }
                                return item
                              }),
                            },
                          })
                        }}
                      >
                        {o.enabled ? <IoEyeOutline /> : <IoEyeOffOutline />}
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

const IntroContentTab = ({
  view,
  updateView,
}: {
  view: IntroBlockView | undefined
  updateView: (view: IntroBlockView) => void
}) => {
  return (
    <div className="flex flex-col p-5">
      <Heading fontSize="small" className="font-bold">
        Heading
      </Heading>
      <textarea
        value={view?.intro?.heading}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          updateView({
            ...view,
            type: 'introBlock',
            intro: {
              ...view?.intro,
              heading: e.target.value,
            },
          })
        }
        className={cx(
          'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
        )}
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Name
      </Heading>
      <input
        className="bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
        value={view?.intro?.name}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          updateView({
            ...view,
            type: 'introBlock',
            intro: {
              ...view?.intro,
              name: e.target.value,
            },
          })
        }
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Designation
      </Heading>
      <textarea
        value={view?.intro?.designation}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          updateView({
            ...view,
            type: 'introBlock',
            intro: {
              ...view?.intro,
              designation: e.target.value,
            },
          })
        }
        className={cx(
          'mt-2 font-body text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand w-full bg-gray-100 resize-none'
        )}
      />
      <Heading fontSize="small" className="font-bold mt-8">
        Organization
      </Heading>
      <input
        className="bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
        value={view?.intro?.organization}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          updateView({
            ...view,
            type: 'introBlock',
            intro: {
              ...view?.intro,
              organization: e.target.value,
            },
          })
        }
      />
    </div>
  )
}

const CustomDocument = Document.extend({
  content: 'paragraph*',
})
const Note = ({
  block,
  simpleAST,
  setSimpleAST,
}: {
  block: Block
  simpleAST?: SimpleAST
  setSimpleAST?: React.Dispatch<React.SetStateAction<SimpleAST | undefined>>
}) => {
  const { editor } = useContext(EditorContext) || {}

  const [localNote, setLocalNote] = useState<string>()
  const [localNoteId, setLocalNoteId] = useState<string>()

  const { note, noteId } = useMemo(() => {
    if (!simpleAST) return {}
    if (block.type === 'introBlock' || block.type === 'outroBlock') {
      setLocalNote(undefined)
      setLocalNoteId(undefined)
    }
    switch (block.type) {
      case 'listBlock': {
        const listBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ListBlockProps
        return {
          note: listBlock.listBlock.note,
          noteId: listBlock.listBlock.noteId,
        }
      }
      case 'imageBlock': {
        const imageBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as ImageBlockProps
        return {
          note: imageBlock.imageBlock.note,
          noteId: imageBlock.imageBlock.noteId,
        }
      }
      case 'codeBlock': {
        const codeBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as CodeBlockProps
        return {
          note: codeBlock.codeBlock.note,
          noteId: codeBlock.codeBlock.noteId,
        }
      }
      case 'videoBlock': {
        const videoBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as VideoBlockProps
        return {
          note: videoBlock.videoBlock.note,
          noteId: videoBlock.videoBlock.noteId,
        }
      }
      case 'introBlock': {
        const introBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as IntroBlockProps
        return {
          note: introBlock.introBlock.note,
        }
      }
      case 'outroBlock': {
        const outroBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as OutroBlockProps
        return {
          note: outroBlock.outroBlock?.note,
        }
      }
      case 'headingBlock': {
        const headingBlock = simpleAST.blocks.find(
          (b) => b.id === block.id
        ) as HeadingBlockProps
        return {
          note: headingBlock.headingBlock.note,
          noteId: headingBlock.headingBlock.noteId,
        }
      }
      default:
        return {}
    }
  }, [block, simpleAST])

  const updateNotes = (nodeId: string | undefined, notes: string) => {
    if (!editor) return
    if (block.type !== 'introBlock' && block.type !== 'outroBlock') {
      let didInsert = false
      if (nodeId)
        editor?.state.tr.doc.descendants((node, pos) => {
          if (node.attrs.id) {
            if (node.attrs.id === nodeId) {
              editor.view.dispatch(
                editor.state.tr.replaceWith(
                  pos + 1,
                  pos + node.nodeSize,
                  notes.split('\n').map((line) => {
                    let lineText = line
                    if (line === '') {
                      lineText = ' '
                    }
                    const textNode = editor.view.state.schema.text(lineText)
                    const paragraphNode =
                      editor.view.state.schema.nodes.paragraph.create(
                        null,
                        textNode
                      )
                    return paragraphNode
                  })
                )
              )
              didInsert = true
            }
          }
        })
      if (!didInsert) {
        // insert blockquote text before block id
        editor?.state.tr.doc.descendants((node, pos) => {
          if (node.attrs.id === block.id) {
            // console.log('found node with note', node, pos, node.nodeSize)
            const textNode = editor.state.schema.text(notes)
            const paragraphNode = editor.state.schema.nodes.paragraph.create(
              null,
              textNode
            )
            const id = uuidv4()
            setLocalNoteId(id)
            // console.log('inserting paragraph node', id)
            const blockquote = editor.state.schema.nodes.blockquote.create(
              {
                id,
              },
              paragraphNode
            )
            const position =
              block.type === 'headingBlock' ? pos + node.nodeSize : pos
            editor.view.dispatch(editor.state.tr.insert(position, blockquote))
          }
        })
      }
    } else {
      if (!simpleAST) return
      setSimpleAST?.({
        ...simpleAST,
        blocks: simpleAST.blocks.map((b) => {
          if (b.id === block.id && block.type === 'introBlock') {
            const introBlock = b as IntroBlockProps
            return {
              ...b,
              introBlock: {
                ...introBlock.introBlock,
                note: notes,
              },
            }
          }
          if (b.id === block.id && block.type === 'outroBlock') {
            const outroBlock = b as OutroBlockProps
            return {
              ...outroBlock,
              outroBlock: {
                ...outroBlock.outroBlock,
                note: notes,
              },
            }
          }
          return b
        }),
      })
    }
  }

  useEffect(() => {
    if (localNote === undefined) return
    updateNotes(localNoteId || noteId, localNote)
  }, [localNote])

  const noteEditor = useEditor({
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      const notes =
        editor
          .getJSON()
          .content?.map((node) => {
            return node.content
              ?.map((n) => {
                return n.text
              })
              .join('')
          })
          .join('\n') || ''
      setLocalNote(notes)
    },
    editorProps: {
      attributes: {
        class: cx(
          'prose prose-sm max-w-none w-full h-full border-none focus:outline-none p-2.5',
          editorStyle
        ),
      },
    },
    extensions: [
      CustomDocument,
      TextNode,
      Paragraph,
      Placeholder.configure({
        placeholder: ({ editor }) => {
          if (
            editor.getText() === '' &&
            (editor.getJSON()?.content?.length || 0) <= 1
          ) {
            return 'Add a note...'
          }
          return ''
        },
        showOnlyWhenEditable: true,
        includeChildren: true,
        showOnlyCurrent: false,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content:
      localNote === undefined
        ? note
            ?.split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>'
        : localNote
            .split('\n')
            .map((line) => {
              return `<p>${line}</p>`
            })
            .join('') || '<p></p>',
  })

  useEffect(() => {
    return () => {
      noteEditor?.destroy()
    }
  }, [])

  return <EditorContent editor={noteEditor} />
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

const SocialHandleTab = ({
  title,
  value,
  enabledCount,
  update,
  updateCount,
}: {
  title: string
  value?: HandleDetails
  enabledCount: number
  update?: (title: string, value: HandleDetails) => void
  updateCount?: (handle: HandleDetails) => void
}) => {
  return (
    <div>
      <div className="flex justify-between items-center">
        <Heading fontSize="small" className="font-bold">
          {title}
        </Heading>
        <Checkbox
          disabled={enabledCount === 3 && !value?.enabled}
          checked={value?.enabled || false}
          onChange={(checked) => {
            update?.(title, {
              handle: value?.handle || '',
              enabled: checked,
            })
            updateCount?.({
              handle: value?.handle || '',
              enabled: checked,
            })
          }}
        />
      </div>
      <input
        className="bg-gray-100 mt-1.5 py-2 px-2 rounded-sm w-full h-full focus:outline-none font-body text-sm placeholder-gray-400"
        value={value?.handle}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          update?.(title, {
            enabled: value?.enabled || false,
            handle: e.target.value,
          })
        }}
      />
    </div>
  )
}

const OutroTab = ({
  view,
  updateView,
}: {
  view: OutroBlockView | undefined
  updateView: (view: OutroBlockView) => void
}) => {
  const [enabledCount, setEnabledCount] = useState(
    view?.outro?.noOfSocialHandles || 0
  )

  const updateHandle = (title: string, handle: HandleDetails) => {
    let socialDetails: OutroBlockView = {
      ...view,
      type: 'outroBlock',
      outro: view?.outro || {},
    }

    if (title === 'Twitter') {
      socialDetails = {
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          twitter: handle,
        },
      }
    }
    if (title === 'Discord') {
      socialDetails = {
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          discord: handle,
        },
      }
    }

    if (title === 'Youtube') {
      socialDetails = {
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          youtube: handle,
        },
      }
    }

    if (title === 'LinkedIn') {
      socialDetails = {
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          linkedin: handle,
        },
      }
    }

    if (title === 'Website') {
      socialDetails = {
        type: 'outroBlock',
        outro: {
          ...view?.outro,
          website: handle,
        },
      }
    }

    updateView(socialDetails)
  }

  const updateEnabledCount = (handle: HandleDetails) => {
    let count = view?.outro?.noOfSocialHandles || 0
    if (handle.enabled) {
      count += 1
    } else {
      count -= 1
    }
    setEnabledCount(count)
  }

  useEffect(() => {
    updateView({
      type: 'outroBlock',
      outro: {
        ...view?.outro,
        noOfSocialHandles: enabledCount,
      },
    })
  }, [enabledCount])

  return (
    <div className="flex flex-col justify-start p-5">
      <Heading fontSize="small" className="font-bold">
        Outro Text
      </Heading>
      <input
        className="bg-gray-100 rounded-sm focus:outline-none font-body text-sm placeholder-gray-400 px-2 py-2 mt-1.5"
        value={view?.outro?.title}
        placeholder="Thanks for watching"
        onChange={(e) => {
          updateView({
            type: 'outroBlock',
            outro: {
              ...view?.outro,
              title: e.target.value,
            },
          })
        }}
      />
      <div className="flex flex-col mt-6 gap-y-6">
        <SocialHandleTab
          title="Twitter"
          enabledCount={enabledCount}
          value={view?.outro?.twitter}
          update={updateHandle}
          updateCount={updateEnabledCount}
        />
        <SocialHandleTab
          title="Discord"
          enabledCount={enabledCount}
          value={view?.outro?.discord}
          update={updateHandle}
          updateCount={updateEnabledCount}
        />
        <SocialHandleTab
          title="Youtube"
          enabledCount={enabledCount}
          value={view?.outro?.youtube}
          update={updateHandle}
          updateCount={updateEnabledCount}
        />
        <SocialHandleTab
          title="LinkedIn"
          enabledCount={enabledCount}
          value={view?.outro?.linkedin}
          update={updateHandle}
          updateCount={updateEnabledCount}
        />
        <SocialHandleTab
          title="Website"
          enabledCount={enabledCount}
          value={view?.outro?.website}
          update={updateHandle}
          updateCount={updateEnabledCount}
        />
      </div>
    </div>
  )
}

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
  const [appearanceSrc, setAppearanceSrc] = useState<string>()

  useEffect(() => {
    let appearanceSrc = ''
    switch (view.list.appearance) {
      case 'stack':
        appearanceSrc = `${listStackGif}?${Date.now()}`
        break
      case 'replace':
        appearanceSrc = `${listReplaceGif}?${Date.now()}`
        updateView({
          ...view,
          list: {
            ...view.list,
            orientation: 'vertical',
            displayTitle: true,
          },
        })
        break
      case 'allAtOnce':
        appearanceSrc = `${listAllAtOnceGif}?${Date.now()}`
        break
      default:
        appearanceSrc = `${listStackGif}?${Date.now()}`
        break
    }
    setAppearanceSrc(appearanceSrc)
  }, [view.list.appearance])

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
            <Listbox.Options className="bg-dark-300 mt-2 rounded-md absolute w-full z-10 shadow-md">
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
      {appearanceSrc && (
        <img
          src={appearanceSrc}
          alt="Stack Preview"
          className="w-full h-full mt-2"
          onClick={(e) => {
            // invalidate image cache to force reload
            const src = e.currentTarget.src.split('?')[0]
            e.currentTarget.src = `${src}?${Date.now()}`
          }}
        />
      )}
      {view.list.appearance !== 'replace' && (
        <>
          <Heading fontSize="small" className="font-bold mt-8">
            Title appearance
          </Heading>
          <div className="grid grid-cols-3 mt-2 gap-x-2">
            <div className="aspect-w-1 aspect-h-1">
              <button
                type="button"
                onClick={() =>
                  updateView({
                    ...view,
                    list: {
                      ...view.list,
                      displayTitle: false,
                    },
                  })
                }
                className={cx(
                  'border border-gray-200 h-full w-full rounded-sm p-px ',
                  {
                    'border-gray-800': !view?.list?.displayTitle,
                  }
                )}
              >
                <div
                  className={cx('bg-gray-100 w-full h-full p-2', {
                    'bg-gray-200': !view?.list?.displayTitle,
                  })}
                >
                  <div
                    className={cx('w-full h-full bg-gray-300 rounded-sm', {
                      'bg-gray-800': !view?.list?.displayTitle,
                    })}
                  />
                </div>
              </button>
            </div>
            <div className="aspect-w-1 aspect-h-1">
              <button
                type="button"
                onClick={() =>
                  updateView({
                    ...view,
                    list: {
                      ...view.list,
                      displayTitle: true,
                    },
                  })
                }
                className={cx(
                  'border border-gray-200 h-full w-full rounded-sm p-px ',
                  {
                    'border-gray-800': view?.list?.displayTitle,
                  }
                )}
              >
                <div
                  style={{
                    paddingLeft: '13px',
                    paddingRight: '13px',
                  }}
                  className={cx(
                    'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                    {
                      'bg-gray-200': view?.list?.displayTitle,
                    }
                  )}
                >
                  <div
                    style={{
                      borderRadius: '2px',
                    }}
                    className={cx('w-full h-full bg-gray-300', {
                      'bg-gray-800': view?.list?.displayTitle,
                    })}
                  />
                  <div className="aspect-w-1 aspect-h-1 w-full">
                    <div
                      style={{
                        borderRadius: '3px',
                      }}
                      className={cx('w-full h-full bg-gray-300', {
                        'bg-gray-800': view?.list?.displayTitle,
                      })}
                    />
                  </div>
                </div>
              </button>
            </div>
          </div>
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
                          'border-gray-800':
                            view.list.orientation === orientation,
                        }
                      )}
                    >
                      <div
                        className={cx(
                          'flex items-center justify-center gap-1 bg-gray-100 w-full h-full',
                          {
                            'bg-gray-200':
                              view.list.orientation === orientation,
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
        </>
      )}
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
      <div className="grid grid-cols-3 mt-2 gap-2">
        {(
          [
            'none',
            'titleOnly',
            'captionOnly',
            'titleAndCaption',
          ] as CaptionTitleView[]
        ).map((style) => {
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
                          'bg-gray-800': view.image.captionTitleView === style,
                        })}
                      />
                    </div>
                  </div>
                )}
                {style === 'titleAndCaption' && (
                  <div
                    style={{
                      paddingLeft: '13px',
                      paddingRight: '13px',
                    }}
                    className={cx(
                      'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                      {
                        'bg-gray-200': view.image.captionTitleView === style,
                      }
                    )}
                  >
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-3 bg-gray-300', {
                        'bg-gray-800': view.image.captionTitleView === style,
                      })}
                    />
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-full bg-gray-300', {
                        'bg-gray-800': view.image.captionTitleView === style,
                      })}
                    />
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-3 bg-gray-300', {
                        'bg-gray-800': view.image.captionTitleView === style,
                      })}
                    />
                  </div>
                )}
              </button>
            </div>
          )
        })}
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
        {(
          [
            'none',
            'titleOnly',
            'captionOnly',
            'titleAndCaption',
          ] as CaptionTitleView[]
        ).map((style) => {
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
                          'bg-gray-800': view.video.captionTitleView === style,
                        })}
                      />
                    </div>
                  </div>
                )}
                {style === 'titleAndCaption' && (
                  <div
                    style={{
                      paddingLeft: '13px',
                      paddingRight: '13px',
                    }}
                    className={cx(
                      'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
                      {
                        'bg-gray-200': view.video.captionTitleView === style,
                      }
                    )}
                  >
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-3 bg-gray-300', {
                        'bg-gray-800': view.video.captionTitleView === style,
                      })}
                    />
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-full bg-gray-300', {
                        'bg-gray-800': view.video.captionTitleView === style,
                      })}
                    />
                    <div
                      style={{
                        borderRadius: '2px',
                      }}
                      className={cx('w-full h-3 bg-gray-300', {
                        'bg-gray-800': view.video.captionTitleView === style,
                      })}
                    />
                  </div>
                )}
              </button>
            </div>
          )
        })}
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
      {/* TODO : Code styles */}
      {/* <Heading fontSize="small" className="font-bold">
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
      </div> */}

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
