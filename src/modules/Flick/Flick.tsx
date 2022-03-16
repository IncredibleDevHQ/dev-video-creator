/* eslint-disable no-nested-ternary */
import { css, cx } from '@emotion/css'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import UniqueID from '@tiptap-pro/extension-unique-id'
import { Editor as CoreEditor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import { Editor, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BiBlock } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { v4 as uuidv4 } from 'uuid'
import * as Y from 'yjs'
import { Heading, ScreenState } from '../../components'
import config from '../../config'
import {
  FlickFragmentFragment,
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
  useGetThemesQuery,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { User, userState } from '../../stores/user.store'
import { logPage } from '../../utils/analytics'
import { PageCategory, PageTitle } from '../../utils/analytics-types'
import {
  BlockProperties,
  CodeAnimation,
  CodeStyle,
  CodeTheme,
  ViewConfig,
} from '../../utils/configTypes'
import { loadFonts } from '../Studio/hooks/use-load-font'
import studioStore from '../Studio/stores/studio.store'
import {
  EditorHeader,
  FlickNavBar,
  FragmentBar,
  Preview,
  Timeline,
} from './components'
import BlockPreview from './components/BlockPreview'
import CodeBlock from './editor/blocks/CodeBlock'
import ImageBlock from './editor/blocks/ImageBlock'
import VideoBlock from './editor/blocks/VideoBlock'
import { getSuggestionItems } from './editor/slashCommand/items'
import renderItems from './editor/slashCommand/renderItems'
import { SlashCommands } from './editor/slashCommand/SlashCommands'
import editorStyle from './editor/style'
import TipTap, { generateLightColorHex } from './editor/TipTap'
import { DragHandler } from './editor/utils/drag'
import { TrailingNode } from './editor/utils/trailingNode'
import CustomTypography from './editor/utils/typography'
import { Block, Position, SimpleAST, useUtils } from './editor/utils/utils'
import { newFlickStore, View } from './store/flickNew.store'

const initialConfig: ViewConfig = {
  titleSplash: {
    enable: true,
  },
  speakers: [],
  mode: 'Landscape',
  blocks: {},
}

const initialAST: SimpleAST = {
  blocks: [
    {
      id: uuidv4(),
      type: 'introBlock',
      pos: 0,
      introBlock: {
        order: ['userMedia', 'introVideo', 'titleSplash'],
      },
    },
    {
      id: uuidv4(),
      type: 'outroBlock',
      pos: 1,
    },
  ],
}

const useLocalPayload = () => {
  const initialPayload = {
    activeObjectIndex: 0,
    activePointIndex: 0,
    currentIndex: 0,
    currentTime: 0,
    fragmentState: 'customLayout',
    isFocus: false,
    playing: false,
    prevIndex: -1,
    status: Fragment_Status_Enum_Enum.NotStarted,
    activeIntroIndex: 0,
  }

  const [payload, setPayload] = useState<any>()

  const updatePayload = (newPayload: any) => {
    setPayload({
      ...payload,
      ...newPayload,
    })
  }

  const resetPayload = () => {
    setPayload(initialPayload)
  }

  return { updatePayload, payload, resetPayload }
}

const Flick = () => {
  const { id } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId, view }, setFlickStore] =
    useRecoilState(newFlickStore)

  const { sub, displayName } = (useRecoilValue(userState) as User) || {}

  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })

  const setStudio = useSetRecoilState(studioStore)
  const { addMusic, stopMusic } = useCanvasRecorder({})

  const [currentBlock, setCurrentBlock] = useState<Block>()
  const [viewConfig, setViewConfig] = useState<ViewConfig>(initialConfig)

  const [simpleAST, setSimpleAST] = useState<SimpleAST>()
  const [editorValue, setEditorValue] = useState<string>()
  const [previewPosition, setPreviewPosition] = useState<Position>()
  const [activeFragment, setActiveFragment] = useState<FlickFragmentFragment>()

  const [showTimeline, setShowTimeline] = useState(false)

  const { updatePayload, payload, resetPayload } = useLocalPayload()
  const { data: themesData } = useGetThemesQuery()

  const updateBlockProperties = (id: string, properties: BlockProperties) => {
    const filteredBlocks: {
      [x: string]: BlockProperties
    } = {}

    Object.entries(viewConfig.blocks)
      .filter((x) => simpleAST?.blocks.map((b) => b.id).includes(x[0]))
      .forEach((a) => {
        filteredBlocks[a[0]] = {
          ...a[1],
        }
      })

    const newBlocks = { ...filteredBlocks, [id]: properties }
    setViewConfig({ ...viewConfig, blocks: newBlocks })
  }

  useEffect(() => {
    if (!currentBlock) return
    if (!viewConfig.blocks[currentBlock.id]) {
      let filteredBlocks: {
        [x: string]: BlockProperties
      } = {}
      const newBlocks = { ...viewConfig.blocks }
      if (Object.keys(newBlocks).length > 0) {
        Object.entries(newBlocks)
          .filter((x) => simpleAST?.blocks.map((b) => b.id).includes(x[0]))
          .forEach((a) => {
            filteredBlocks[a[0]] = {
              ...a[1],
            }
          })
      } else {
        filteredBlocks = { ...newBlocks }
      }

      filteredBlocks[currentBlock.id] = {
        layout: 'classic',
      }

      if (currentBlock.type === 'codeBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'codeBlock',
            code: {
              animation: CodeAnimation.TypeLines,
              theme: CodeTheme.DarkPlus,
              codeStyle: CodeStyle.Editor,
              fontSize: 16,
            },
          },
        }
      }

      if (currentBlock.type === 'imageBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'imageBlock',
            image: {
              captionTitleView: 'titleOnly',
            },
          },
        }
      }

      if (currentBlock.type === 'videoBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'videoBlock',
            video: {
              captionTitleView: 'titleOnly',
            },
          },
        }
      }

      if (currentBlock.type === 'listBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'listBlock',
            list: {
              appearance: 'stack',
              orientation: 'vertical',
              viewStyle: 'bullet',
            },
          },
        }
      }

      setViewConfig({ ...viewConfig, blocks: filteredBlocks })
    } else if (currentBlock.type === 'codeBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          view: {
            type: 'codeBlock',
            code: {
              animation: CodeAnimation.TypeLines,
              theme: CodeTheme.DarkPlus,
              codeStyle: CodeStyle.Editor,
              fontSize: 16,
            },
          },
        })
      }
    } else if (currentBlock.type === 'imageBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          view: {
            type: 'imageBlock',
            image: {
              captionTitleView: 'titleOnly',
            },
          },
        })
      }
    } else if (currentBlock.type === 'videoBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          view: {
            type: 'videoBlock',
            video: {
              captionTitleView: 'titleOnly',
            },
          },
        })
      }
    } else if (currentBlock.type === 'listBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          view: {
            type: 'listBlock',
            list: {
              appearance: 'stack',
              orientation: 'vertical',
              viewStyle: 'bullet',
            },
          },
        })
      }
    }
  }, [currentBlock])

  useMemo(() => {
    const fragment = flick?.fragments.find(
      (f) => f.id === activeFragmentId
    ) as StudioFragmentFragment
    if (!fragment) return
    setStudio((store) => ({
      ...store,
      payload,
      updatePayload,
      fragment,
      addMusic,
      stopMusic,
    }))
  }, [activeFragmentId, payload, flick?.fragments])

  useEffect(() => {
    resetPayload()
    setStudio((store) => ({
      ...store,
      shortsMode: false,
    }))
  }, [activeFragmentId])

  useEffect(() => {
    if (!data) return
    const fragmentsLength = data.Flick_by_pk?.fragments.length || 0
    const editorFragment = data.Flick_by_pk?.fragments.find((f) => !f.type)

    setFlickStore((store) => ({
      ...store,
      flick: data.Flick_by_pk || null,
      activeTheme: data.Flick_by_pk ? data.Flick_by_pk.theme : null,
      themes: themesData?.Theme ? themesData?.Theme : [],
      activeFragmentId: fragmentsLength > 0 ? editorFragment?.id : '',
    }))
  }, [data, themesData])

  useEffect(() => {
    return () => {
      setFlickStore({
        flick: null,
        activeFragmentId: '',
        isMarkdown: true,
        view: View.Notebook,
        activeTheme: null,
        themes: [],
      })
    }
  }, [])

  useEffect(() => {
    // Segment Tracking
    logPage(
      PageCategory.Studio,
      view === View.Notebook ? PageTitle.Notebook : PageTitle.Preview
    )
  }, [view])

  useEffect(() => {
    if (!activeFragmentId || !flick) return
    const fragment = flick?.fragments.find(
      (frag) => frag.id === activeFragmentId
    )
    if (!fragment) return
    setActiveFragment(fragment)

    setViewConfig(
      fragment?.configuration || {
        ...initialConfig,
        speakers: [flick.participants[0]],
      }
    )
    setSimpleAST(fragment?.editorState || initialAST)
    setCurrentBlock(fragment?.editorState?.blocks[0] || initialAST.blocks[0])
    setEditorValue(flick.md || '')
  }, [activeFragmentId])

  useMemo(() => {
    if (flick?.branding?.branding?.font)
      loadFonts([
        {
          family: flick?.branding?.branding?.font?.heading?.family,
          weights: ['400'],
          type: flick?.branding?.branding?.font?.heading?.type,
          url: flick?.branding?.branding?.font?.heading?.url,
        },
        {
          family: flick?.branding?.branding?.font?.body?.family,
          weights: ['400'],
          type: flick?.branding?.branding?.font?.body?.type,
          url: flick?.branding?.branding?.font?.body?.url,
        },
      ])
  }, [flick?.branding?.branding?.font])

  const utils = useUtils()

  const handleEditorChange = (editor: CoreEditor) => {
    // log all blockquotes in editor
    // const blockquotes = editor
    //   .getJSON()
    //   .content?.filter((block) => block.type === 'blockquote')
    // console.log(blockquotes?.map((b) => b.attrs.id))
    utils.getSimpleAST(editor.getJSON()).then((simpleAST) => {
      if (simpleAST)
        setSimpleAST((prev) => ({
          ...simpleAST,
          blocks: [
            ...(prev?.blocks ? [prev.blocks[0]] : []),
            ...simpleAST.blocks,
            ...(prev?.blocks
              ? [
                  {
                    ...prev.blocks[prev.blocks.length - 1],
                    pos: simpleAST.blocks.length + 1,
                  } as Block,
                ]
              : []),
          ],
        }))
      setEditorValue(editor.getHTML())
      if (!editor || editor.isDestroyed) return
      const transaction = editor.state.tr
      editor.state.doc.descendants((node, pos) => {
        const { id } = node.attrs
        if (node.attrs.id !== id) {
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id,
          })
        }
      })
      transaction.setMeta('preventUpdate', true)
      editor.view.dispatch(transaction)
    })
  }

  if (!data && loading)
    return <ScreenState title="Loading your story" loading />

  if (error)
    return (
      <ScreenState
        title="Something went wrong!!"
        subtitle="Could not load your story. Please try again"
        button="Retry"
        handleClick={() => {
          refetch()
        }}
      />
    )

  if (!flick) return null

  if (!flick.participants.some((p) => p.userSub === sub))
    return (
      <div className="w-screen min-h-screen bg-dark-500 flex flex-col items-center justify-center">
        <BiBlock className="text-red-500" size={96} />
        <Heading fontSize="large" className="text-white font-main mt-4">
          You do not have access to this story
        </Heading>
      </div>
    )

  return (
    <EditorProvider
      flickId={id}
      userName={displayName || 'Anonymous'}
      handleUpdate={handleEditorChange}
    >
      <div className="relative flex flex-col w-screen h-screen overflow-hidden">
        <FlickNavBar />
        <EditorContext.Consumer>
          {(editor) => (
            <FragmentBar
              simpleAST={simpleAST}
              editorValue={
                editor?.providerStatus
                  ? editor.providerStatus === WebSocketStatus.Connected
                    ? editorValue
                    : (flick.md as string)
                  : (flick.md as string)
              }
              config={viewConfig}
              setViewConfig={setViewConfig}
            />
          )}
        </EditorContext.Consumer>
        {activeFragment && view === View.Preview && (
          <Preview
            block={currentBlock}
            config={viewConfig}
            updateConfig={updateBlockProperties}
            blocks={simpleAST?.blocks || []}
            setCurrentBlock={setCurrentBlock}
            centered={!showTimeline}
            simpleAST={simpleAST}
            setSimpleAST={setSimpleAST}
          />
        )}
        {activeFragment && view === View.Notebook && (
          <div
            className="grid grid-cols-12 flex-1 h-full pb-12 sticky top-0 overflow-y-auto"
            onScroll={() => {
              const dragHandle = document.getElementById('drag-handle')
              if (dragHandle) {
                dragHandle.style.visibility = 'hidden'
                dragHandle.style.display = 'hidden'
              }
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '750px',
                margin: '0 auto',
              }}
              className="h-full pt-12 pb-96 col-start-4 col-span-6"
            >
              <EditorHeader
                viewConfig={viewConfig}
                setViewConfig={setViewConfig}
                activeFragment={activeFragment}
              />

              <TipTap
                key={activeFragment.id}
                handleUpdatePosition={(position) => {
                  setPreviewPosition(position)
                }}
                handleActiveBlock={(block) => {
                  if (block && block !== currentBlock) setCurrentBlock(block)
                }}
                ast={simpleAST}
              />
            </div>

            <div
              className={cx(
                'col-start-10 col-end-12 relative border-none outline-none w-full  ml-10',
                css`
                  max-height: 20vh;
                `
              )}
            >
              {currentBlock &&
                currentBlock.type &&
                viewConfig &&
                simpleAST &&
                simpleAST?.blocks?.length > 2 && (
                  <BlockPreview
                    block={currentBlock}
                    blocks={simpleAST?.blocks || []}
                    simpleAST={simpleAST}
                    setSimpleAST={setSimpleAST}
                    config={viewConfig}
                    updateConfig={updateBlockProperties}
                    setCurrentBlock={setCurrentBlock}
                    className={cx(
                      'absolute w-full h-full',
                      css`
                        top: ${previewPosition?.y}px;
                      `
                    )}
                  />
                )}
            </div>
          </div>
        )}

        <Timeline
          blocks={simpleAST?.blocks || []}
          showTimeline={showTimeline}
          setShowTimeline={setShowTimeline}
          currentBlock={currentBlock}
          setCurrentBlock={setCurrentBlock}
          persistentTimeline={false}
          shouldScrollToCurrentBlock
        />
      </div>
    </EditorProvider>
  )
}

export const EditorContext = React.createContext<{
  editor: Editor | null
  providerStatus: string | undefined
  dragHandleRef: React.RefObject<HTMLDivElement>
} | null>(null)

export const EditorProvider = ({
  children,
  flickId,
  userName,
  handleUpdate,
}: {
  children: JSX.Element
  flickId: string
  userName: string
  handleUpdate?: (editor: CoreEditor) => void
}): JSX.Element => {
  // const [providerStatus, setProviderStatus] = useState<string>()

  const dragRef = useRef<HTMLDivElement>(null)

  const providerRef = useRef<HocuspocusProvider>()
  const yDocRef = useRef<Y.Doc>()
  const [providerStatus, setProviderStatus] = useState<string>()

  useEffect(() => {
    if (providerRef.current || yDocRef.current) return
    const yDoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      document: yDoc,
      url: config.hocusPocus.server,
      name: `flick-doc-${flickId}`,
      onStatus: (statusObj: any) => {
        setProviderStatus(statusObj.status)
      },
    })
    providerRef.current = provider
    yDocRef.current = yDoc
  }, [])

  const editor = useEditor(
    {
      onUpdate: ({ editor }) => handleUpdate?.(editor),
      editorProps: {
        attributes: {
          class: cx(
            'prose prose-sm max-w-none w-full h-full border-none focus:outline-none',
            editorStyle
          ),
        },
      },
      autofocus: 'start',
      extensions: [
        UniqueID.configure({
          attributeName: 'id',
          types: [
            'paragraph',
            'blockquote',
            'heading',
            'bulletList',
            'orderedList',
            'codeBlock',
            'video',
            'image',
          ],
        }),
        DragHandler(dragRef.current),
        Focus,
        CustomTypography,
        StarterKit.configure({
          history: false,
          codeBlock: false,
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
          bulletList: {
            itemTypeName: 'listItem',
          },
          dropcursor: {
            width: 3.5,
            color: '#C3E2F0',
            class: 'transition-all duration-200 ease-in-out',
          },
        }),
        SlashCommands.configure({
          suggestion: {
            items: getSuggestionItems,
            render: renderItems,
          },
        }),
        Placeholder.configure({
          showOnlyWhenEditable: true,
          includeChildren: true,
          showOnlyCurrent: false,
          emptyEditorClass: 'is-editor-empty',
          placeholder: ({ node, editor }) => {
            const headingPlaceholders: {
              [key: number]: string
            } = {
              1: 'Heading 1',
              2: 'Heading 2',
              3: 'Heading 3',
              4: 'Heading 4',
              5: 'Heading 5',
              6: 'Heading 6',
            }

            if (node.type.name === 'heading') {
              const level = node.attrs.level as number
              return headingPlaceholders[level]
            }

            if (
              node.type.name === 'paragraph' &&
              editor.getJSON().content?.length === 1
            ) {
              return 'Type / to get started'
            }

            if (node.type.name === 'paragraph') {
              const selectedNode = editor.view.domAtPos(
                editor.state.selection.from
              ).node
              if (
                selectedNode.nodeName === 'P' &&
                selectedNode.firstChild?.parentElement?.id === node.attrs.id
              ) {
                return 'Type / for commands'
              }
            }

            return ''
          },
        }),
        CodeBlock,
        ImageBlock.configure({
          inline: false,
        }),
        VideoBlock,
        TrailingNode,
        CharacterCount.configure({
          limit: 20000,
        }),
      ].concat(
        providerRef.current
          ? [
              Collaboration.configure({
                document: yDocRef.current,
              }),
              CollaborationCursor.configure({
                provider: providerRef.current,
                user: {
                  name: userName,
                  color: generateLightColorHex(),
                },
              }),
            ]
          : []
      ),
    },
    [providerRef.current]
  )

  useEffect(() => {
    return () => {
      editor?.destroy()
      providerRef.current?.destroy()
    }
  }, [])

  return (
    <EditorContext.Provider
      value={{
        editor,
        dragHandleRef: dragRef,
        providerStatus,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

// const FlickHoC = () => {
//   const { id } = useParams<{ id: string; fragmentId?: string }>()
//   const { displayName } = (useRecoilValue(userState) as User) || {}

//   return (
//     <EditorProvider flickId={id} userName={displayName || 'Anonymous'}>
//       <EditorContentComp />
//     </EditorProvider>
//   )
// }

// const EditorContentComp = () => {
//   const { editor } = useContext(EditorContext) || {}

//   if (!editor) return null

//   return <EditorContent editor={editor} />
// }

// const FlickHoc = () => {
//   const { id } = useParams<{ id: string; fragmentId?: string }>()
//   const user = useRecoilValue(databaseUserState)

//   return <Flick />
// }

export default Flick
