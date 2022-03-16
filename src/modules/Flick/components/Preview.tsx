/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import { sentenceCase } from 'change-case'
import React, {
  ChangeEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { BiCheck, BiNote } from 'react-icons/bi'
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
import { v4 as uuidv4 } from 'uuid'
import { ReactComponent as BulletListStyleIcon } from '../../../assets/BulletListStyle.svg'
import { ReactComponent as EditorStyleIcon } from '../../../assets/EditorStyle.svg'
import listAllAtOnceGif from '../../../assets/ListAllAtOnce.svg'
import listReplaceGif from '../../../assets/ListReplace.svg'
import listStackGif from '../../../assets/ListStack.svg'
import { ReactComponent as NumberListStyleIcon } from '../../../assets/NumberListStyle.svg'
import { ReactComponent as TerminalStyleIcon } from '../../../assets/TerminalStyle.svg'
import { Checkbox, Heading, Text, TextField } from '../../../components'
import {
  allLayoutTypes,
  BlockProperties,
  BlockView,
  CaptionTitleView,
  CodeAnimation,
  CodeBlockView,
  CodeStyle,
  CodeTheme,
  HandleDetails,
  ImageBlockView,
  Layout,
  ListAppearance,
  ListBlockView,
  ListOrientation,
  ListViewStyle,
  OutroBlockView,
  OutroLayout,
  VideoBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { getSurfaceColor } from '../../Studio/effects/fragments/CodeFragment'
import { studioStore } from '../../Studio/stores'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  OutroBlockProps,
  SimpleAST,
  VideoBlockProps,
} from '../editor/utils/utils'
import { EditorContext } from '../Flick'
import { CanvasPreview, LayoutSelector } from './BlockPreview'

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

const outroBlockTabs: Tab[] = [
  {
    id: 'Social',
    name: 'Content',
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
    case 'Social':
      return <MdOutlineTextFields size={21} />
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

  const activeBlockRef = useRef<Block | undefined>(block)

  const handleKeyDown = (e: KeyboardEvent) => {
    const block = activeBlockRef.current
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
    if (!activeBlockRef.current) return
    document.addEventListener('keydown', handleKeyDown)
  }, [activeBlockRef, blocks])

  useEffect(() => {
    if (!block) return
    const { type } = block
    if (type !== 'introBlock' && type !== 'outroBlock')
      setActiveTab(commonTabs[0])
    switch (type) {
      case 'introBlock':
        setActiveTab(commonTabs[2])
        break
      case 'outroBlock':
        setTabs([commonTabs[0], commonTabs[2], ...outroBlockTabs])
        setActiveTab(commonTabs[0])
        break
      case 'codeBlock':
        setTabs([...commonTabs, ...codeBlockTabs])
        break
      default:
        setTabs(commonTabs)
        break
    }
  }, [block?.id])

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
        <>
          <div
            className={cx(
              'bg-white w-64 flex-1 overflow-y-scroll',
              noScrollBar
            )}
          >
            {activeTab.id === outroBlockTabs[0].id && (
              <div>
                <OutroTab
                  view={config.blocks[block.id]?.view as OutroBlockView}
                  updateView={(view: OutroBlockView) => {
                    updateConfig(block.id, {
                      ...config.blocks[block.id],
                      view,
                    })
                  }}
                />
              </div>
            )}
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
                  block.type === 'introBlock' &&
                  (tab.id === commonTabs[0].id || tab.id === commonTabs[1].id)
                )
                  return false

                if (block.type === 'outroBlock' && tab.id === commonTabs[1].id)
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
    </div>
  )
}

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
      default:
        return {}
    }
  }, [block, simpleAST])

  const updateNotes = (nodeId: string | undefined, notes: string) => {
    if (!editor) return
    if (block.type !== 'introBlock' && block.type !== 'outroBlock') {
      let didInsert = false
      editor?.state.tr.doc.descendants((node, pos) => {
        if (node.attrs.id) {
          if (node.attrs.id === nodeId) {
            // console.log('found node with note', node, pos, node.nodeSize)
            node.descendants((childNode, childPos) => {
              // check for text node
              if (childNode.type.name === 'text') {
                // console.log(
                //   'found text node',
                //   childNode,
                //   childPos,
                //   childNode.nodeSize
                // )
                editor.view.dispatch(
                  editor.state.tr.insertText(
                    notes,
                    pos + 1,
                    pos + 2 + childNode.nodeSize
                  )
                )
                didInsert = true
              }
            })
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
            editor.view.dispatch(editor.state.tr.insert(pos, blockquote))
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

  return (
    <textarea
      key={block.id}
      placeholder="Add your notes here"
      className="w-full h-full focus:outline-none font-body text-left resize-none outline-none border-none placeholder-gray-400"
      value={localNote === undefined ? note : localNote}
      onChange={(e) => {
        setLocalNote(e.target.value)
        updateNotes(localNoteId || noteId, e.target.value)
      }}
    />
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

const SocialHandleTab = ({
  title,
  value,
  update,
  updateCount,
}: {
  title: string
  value?: HandleDetails
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
    <div className="flex flex-col justify-start p-5 gap-y-6">
      <SocialHandleTab
        title="Twitter"
        value={view?.outro?.twitter}
        update={updateHandle}
        updateCount={updateEnabledCount}
      />
      <SocialHandleTab
        title="Discord"
        value={view?.outro?.discord}
        update={updateHandle}
        updateCount={updateEnabledCount}
      />
      <SocialHandleTab
        title="Youtube"
        value={view?.outro?.youtube}
        update={updateHandle}
        updateCount={updateEnabledCount}
      />
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
