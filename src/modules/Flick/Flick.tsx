/* eslint-disable no-unneeded-ternary */
/* eslint-disable no-nested-ternary */
import { css, cx } from '@emotion/css'
import { createClient, LiveMap } from '@liveblocks/client'
import { LiveblocksProvider, RoomProvider, useMap } from '@liveblocks/react'
import { Editor as CoreEditor } from '@tiptap/core'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BiBlock } from 'react-icons/bi'
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
  emitToast,
  ErrorBoundary,
  Heading,
  ScreenState,
} from '../../components'
import config from '../../config'
import {
  FlickFragmentFragment,
  Fragment_Status_Enum_Enum,
  Fragment_Type_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
  useGetFlickFragmentLazyQuery,
  useGetThemesQuery,
  useUpdateNotebookVersionMutation,
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
  IntroBlockView,
  OutroBlockView,
  ViewConfig,
} from '../../utils/configTypes'
import { loadFonts } from '../Studio/hooks/use-load-font'
import studioStore from '../Studio/stores/studio.store'
import {
  EditorHeader,
  FlickNavBar,
  FragmentBar,
  Preview,
  Publish,
  Timeline,
} from './components'
import BlockPreview from './components/BlockPreview'
import { EditorProvider } from './components/EditorProvider'
import Sidebar from './components/Sidebar'
import TipTap from './editor/TipTap'
import { Block, Position, SimpleAST, useUtils } from './editor/utils/utils'
import { newFlickStore, View } from './store/flickNew.store'

export enum PresencePage {
  Notebook = 'notebook',
  Preview = 'preview',
  Backstage = 'backstage',
  Recording = 'recording',
}
export type Presence = {
  user: {
    id: string
    name: string
    picture: string
  }
  page: PresencePage
  formatId?: string
  cursor: {
    x: number
    y: number
  }
  inHuddle: boolean
}

export enum FlickBroadcastEvent {
  ThemeChanged = 'themeChanged',
  BrandingChanged = 'brandingChanged',
  TransitionChanged = 'transitionChanged',
  FlickNameChanged = 'flickNameChanged',
}

const initialConfig: ViewConfig = {
  titleSplash: {
    enable: true,
  },
  speakers: [],
  mode: 'Landscape',
  blocks: {},
  selectedBlocks: [],
  continuousRecording: false,
}

export const useLocalPayload = () => {
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
    activeOutroIndex: 0,
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

const client = createClient({
  publicApiKey: config.liveblocks.publicKey,
})

const Flick = () => {
  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId, view }, setFlickStore] =
    useRecoilState(newFlickStore)

  const { sub } = (useRecoilValue(userState) as User) || {}

  const history = useHistory()

  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
    fetchPolicy: 'network-only',
  })

  const [updateNotebookVersion] = useUpdateNotebookVersionMutation()
  const [updatingNotebook, setUpdatingNotebook] = useState(false)

  const setStudio = useSetRecoilState(studioStore)
  const { addMusic, stopMusic } = useCanvasRecorder({})

  const [currentBlock, setCurrentBlock] = useState<Block>()

  const viewConfigLiveMap = useMap<string, ViewConfig>('viewConfig')
  const viewConfig =
    (fragmentId ? viewConfigLiveMap?.get(fragmentId) : undefined) ||
    initialConfig
  const setViewConfig = useCallback(
    (vc: ViewConfig) => {
      if (!fragmentId) return
      viewConfigLiveMap?.set(fragmentId, vc)
    },
    [viewConfigLiveMap, fragmentId]
  )
  const [updatesQueue, setUpdatesQueue] = useState<
    { fid: string; viewConfig: ViewConfig }[]
  >([])
  useEffect(() => {
    if (!fragmentId) return
    if (!viewConfigLiveMap || viewConfigLiveMap?.get(fragmentId)) return
    updatesQueue
      .filter((q) => q.fid === fragmentId)
      .forEach((update) => {
        setViewConfig(update.viewConfig)
      })
  }, [viewConfigLiveMap, updatesQueue, fragmentId])

  const [getFragment] = useGetFlickFragmentLazyQuery()

  const [simpleAST, setSimpleAST] = useState<SimpleAST>()
  const [previewPosition, setPreviewPosition] = useState<Position>()
  const [activeFragment, setActiveFragment] = useState<FlickFragmentFragment>()

  const [showTimeline, setShowTimeline] = useState(false)
  const [publishModal, setPublishModal] = useState(false)

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

  const updateMultipleBlockProperties = (
    ids: string[],
    properties: BlockProperties[]
  ) => {
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

    const newBlocks = ids.reduce(
      (acc, id, index) => ({
        ...acc,
        [id]: {
          ...filteredBlocks[id],
          ...properties[index],
        },
      }),
      filteredBlocks
    )

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
              theme:
                flick?.theme?.name !== 'Mux'
                  ? CodeTheme.DarkPlus
                  : CodeTheme.LightPlus,
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
              displayTitle: true,
            },
          },
        }
      }

      if (currentBlock.type === 'headingBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'headingBlock',
          },
        }
      }

      if (currentBlock.type === 'outroBlock') {
        filteredBlocks[currentBlock.id] = {
          ...filteredBlocks[currentBlock.id],
          view: {
            type: 'outroBlock',
            outro: {},
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
              theme:
                flick?.theme?.name !== 'Mux'
                  ? CodeTheme.DarkPlus
                  : CodeTheme.LightPlus,
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
              displayTitle: true,
            },
          },
        })
      }
    } else if (currentBlock.type === 'headingBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          view: {
            type: 'headingBlock',
          },
        })
      }
    } else if (currentBlock.type === 'outroBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          layout: 'classic',
          view: {
            type: 'outroBlock',
            outro: {
              order: [
                { enabled: true, state: 'outroVideo' },
                { enabled: true, state: 'titleSplash' },
              ],
            },
          },
        })
      }
    } else if (currentBlock.type === 'introBlock') {
      if (!viewConfig.blocks[currentBlock.id].view) {
        updateBlockProperties(currentBlock.id, {
          ...viewConfig.blocks[currentBlock.id],
          layout: 'bottom-right-tile',
          view: {
            type: 'introBlock',
            intro: {
              order: [
                { enabled: true, state: 'userMedia' },
                { enabled: true, state: 'introVideo' },
                { enabled: true, state: 'titleSplash' },
              ],
            },
          },
        })
      }
    }
  }, [currentBlock, flick?.theme])

  useMemo(() => {
    setStudio((store) => ({
      ...store,
      payload,
      updatePayload,
      addMusic,
      stopMusic,
    }))
  }, [payload])

  useMemo(() => {
    const fragment = flick?.fragments.find(
      (f) => f.id === activeFragmentId
    ) as StudioFragmentFragment
    if (!fragment) return
    setStudio((store) => ({
      ...store,
      fragment,
    }))
  }, [flick?.fragments, activeFragmentId])

  useEffect(() => {
    resetPayload()
  }, [activeFragmentId])

  useEffect(() => {
    if (!data) return
    const fragmentsLength = data.Flick_by_pk?.fragments.length || 0
    const editorFragment = data.Flick_by_pk?.fragments?.[0]

    if (!fragmentId && fragmentsLength > 0) {
      history.push(`/story/${data.Flick_by_pk?.id}/${editorFragment?.id}`)
    }
    setFlickStore((store) => ({
      ...store,
      flick: data.Flick_by_pk || null,
      activeTheme: data.Flick_by_pk ? data.Flick_by_pk.theme : null,
      activeFragmentId: fragmentId
        ? fragmentId
        : fragmentsLength > 0
        ? editorFragment?.id
        : '',
    }))
  }, [data])

  useEffect(() => {
    if (!fragmentId) {
      setActiveFragment(undefined)
    } else {
      setFlickStore((store) => ({
        ...store,
        activeFragmentId: fragmentId,
      }))
    }
  }, [fragmentId])

  useEffect(() => {
    if (!themesData) return
    setFlickStore((store) => ({
      ...store,
      themes: themesData?.Theme ? themesData?.Theme : [],
    }))
  }, [themesData])

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

  const getMissingFragment = async (fid: string) => {
    if (!flick) return undefined
    try {
      const { data, error } = await getFragment({
        variables: {
          id: fid,
        },
      })
      if (error) throw new Error("Can't get fragment")
      if (data?.Fragment_by_pk) {
        const newFragments = [...flick?.fragments, data?.Fragment_by_pk]
        setFlickStore((store) => ({
          ...store,
          flick: {
            ...flick,
            fragments: newFragments,
          },
        }))
      }
      return data?.Fragment_by_pk || undefined
    } catch (e) {
      emitToast({
        title: 'Error fetching new format',
        type: 'error',
        autoClose: 3000,
      })
      return undefined
    }
  }

  useEffect(() => {
    ;(async () => {
      if (!activeFragmentId || !flick) return
      let fragment: FlickFragmentFragment | undefined = flick?.fragments.find(
        (frag) => frag.id === activeFragmentId
      )
      if (!fragment) {
        fragment = await getMissingFragment(activeFragmentId)
      }
      if (!fragment) return
      if (fragment.version === 1) {
        setUpdatingNotebook(true)
        await updateNotebookVersion({
          variables: {
            fragmentId: fragment.id,
          },
        })
        const newFragments = flick?.fragments.map((frag) => {
          if (frag.id === fragment?.id) {
            return {
              ...frag,
              version: 2,
            }
          }
          return frag
        })
        setFlickStore((store) => ({
          ...store,
          flick: {
            ...flick,
            fragments: newFragments,
          },
        }))
        setUpdatingNotebook(false)
      }
      setActiveFragment(fragment)
      if (fragment?.editorState && fragment?.editorState?.blocks?.length > 0) {
        setSimpleAST(fragment.editorState)
        let blocks: {
          [key: string]: BlockProperties
        } = {
          [fragment.editorState.blocks[0].id]: {
            layout: 'classic',
            view: {
              type: 'introBlock',
              intro: {
                order: [
                  { enabled: true, state: 'userMedia' },
                  { enabled: true, state: 'titleSplash' },
                ],
              },
            },
          },
        }
        if (fragment.editorState.blocks.length > 1) {
          blocks = {
            ...blocks,
            [fragment.editorState.blocks[1].id]: {
              layout: 'classic',
              view: {
                type: 'outroBlock',
                outro: {
                  order: [{ enabled: true, state: 'titleSplash' }],
                },
              } as OutroBlockView,
            } as BlockProperties,
          }
        }
        setUpdatesQueue((q) => [
          ...q,
          {
            fid: fragment?.id,
            viewConfig: {
              ...initialConfig,
              mode:
                fragment?.type === Fragment_Type_Enum_Enum.Portrait
                  ? 'Portrait'
                  : 'Landscape',
              speakers: [flick.participants[0]],
              blocks,
            },
          },
        ])
      }
    })()
  }, [
    activeFragmentId,
    flick?.id,
    flick?.fragments.find((f) => f.id === activeFragmentId)?.id,
  ])

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

  useEffect(() => {
    const intro = simpleAST?.blocks.find((b) => b.type === 'introBlock')
    const outro = simpleAST?.blocks.find((b) => b.type === 'outroBlock')
    if (!intro || !outro) return
    const introView = viewConfig.blocks[intro?.id].view as IntroBlockView
    const outroView = viewConfig.blocks[outro?.id].view as OutroBlockView
    if (!flick?.useBranding) {
      updateMultipleBlockProperties(
        [intro.id, outro.id],
        [
          {
            view: {
              ...introView,
              intro: {
                ...introView?.intro,
                order: introView?.intro?.order?.filter(
                  (i) => i.state !== 'introVideo'
                ),
              },
            },
          },
          {
            view: {
              ...outroView,
              outro: {
                ...outroView?.outro,
                order: outroView?.outro?.order?.filter(
                  (i) => i.state !== 'outroVideo'
                ),
              },
            },
          },
        ]
      )
    } else {
      updateMultipleBlockProperties(
        [intro.id, outro.id],
        [
          {
            view: {
              ...introView,
              intro: {
                ...introView?.intro,
                order: flick?.branding?.branding?.introVideoUrl
                  ? [
                      ...(introView?.intro?.order || []),
                      { enabled: true, state: 'introVideo' },
                    ]
                  : introView?.intro?.order?.filter(
                      (i) => i.state !== 'introVideo'
                    ),
              },
            },
          },
          {
            view: {
              ...outroView,
              outro: {
                ...outroView?.outro,
                order: flick?.branding?.branding?.outroVideoUrl
                  ? [
                      ...(outroView?.outro?.order || []),
                      { enabled: true, state: 'outroVideo' },
                    ]
                  : outroView?.outro?.order?.filter(
                      (i) => i.state !== 'outroVideo'
                    ),
              },
            },
          },
        ]
      )
    }
  }, [flick?.branding?.id, flick?.useBranding])

  const utils = useUtils()

  const [openSidebar, setOpenSidebar] = useState(true)

  const handleEditorChange = (editor: CoreEditor) => {
    utils.getSimpleAST(editor.getJSON()).then((simpleAST) => {
      if (simpleAST)
        setSimpleAST((prev) => ({
          ...simpleAST,
          blocks: [
            ...(prev?.blocks
              ? prev?.blocks[0]?.type === 'introBlock'
                ? [prev.blocks[0]]
                : []
              : []),
            ...simpleAST.blocks,
            ...(prev?.blocks
              ? prev?.blocks?.[prev?.blocks.length - 1]?.type === 'outroBlock'
                ? [
                    {
                      ...prev.blocks[prev.blocks.length - 1],
                      pos: simpleAST.blocks.length + 1,
                    } as Block,
                  ]
                : []
              : []),
          ],
        }))
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

  if ((!data && loading) || !viewConfigLiveMap)
    return <ScreenState title="Loading your story" loading />

  if (updatingNotebook) return <ScreenState title="Updating notebook" />

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
    <EditorProvider handleUpdate={handleEditorChange}>
      <div className="relative flex flex-col w-screen h-screen overflow-hidden">
        <FlickNavBar />
        <div className="flex flex-1 relative overflow-hidden">
          {openSidebar && <Sidebar storyName={flick.name} />}
          <button
            type="button"
            style={{
              height: 'min-content',
            }}
            className={cx(
              'absolute flex items-center justify-center  bg-white rounded-md z-50 border shadow-md top-0 bottom-0 mb-auto mt-auto',
              {
                'left-0 -ml-1': !openSidebar,
                'left-44 -ml-3': openSidebar,
              }
            )}
            onClick={() => setOpenSidebar(!openSidebar)}
          >
            {openSidebar ? (
              <IoChevronBackOutline className="text-black m-1" size={16} />
            ) : (
              <IoChevronForwardOutline className="text-black m-1" size={16} />
            )}
          </button>
          <div className="flex flex-col flex-1 overflow-hidden relative">
            <FragmentBar
              simpleAST={simpleAST}
              viewConfig={viewConfig}
              currentBlock={currentBlock}
              setCurrentBlock={setCurrentBlock}
              togglePublishModal={() => setPublishModal(true)}
            />
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
                    blocks={simpleAST?.blocks || []}
                    setCurrentBlock={setCurrentBlock}
                    viewConfig={viewConfig}
                    setViewConfig={setViewConfig}
                    activeFragment={activeFragment}
                    setPreviewPosition={setPreviewPosition}
                  />

                  <TipTap
                    key={activeFragment.id}
                    handleUpdatePosition={(position) => {
                      setPreviewPosition(position)
                    }}
                    handleActiveBlock={(block) => {
                      if (block === undefined) {
                        setCurrentBlock(undefined)
                      }
                      if (block && block !== currentBlock) {
                        setCurrentBlock(block)
                      }
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
                    simpleAST?.blocks?.length >= 2 &&
                    activeFragment.type !== Fragment_Type_Enum_Enum.Blog && (
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
              config={viewConfig}
              setConfig={setViewConfig}
            />
          </div>
        </div>

        {publishModal && (
          <Publish
            open={publishModal}
            simpleAST={simpleAST}
            activeFragment={activeFragment}
            handleClose={() => setPublishModal(false)}
          />
        )}
      </div>
    </EditorProvider>
  )
}

const FlickHoC = () => {
  const { id } = useParams<{ id: string; fragmentId?: string }>()

  const { sub, displayName, picture } =
    (useRecoilValue(userState) as User) || {}

  const initialPresence: Presence = useMemo(() => {
    return {
      user: {
        id: sub as string,
        name: displayName as string,
        picture: picture as string,
      },
      page: PresencePage.Notebook,
      cursor: { x: 0, y: 0 },
      inHuddle: false,
    }
  }, [sub, displayName, picture])

  return (
    <ErrorBoundary>
      <LiveblocksProvider client={client}>
        <RoomProvider
          id={`story-${id}`}
          initialPresence={initialPresence}
          initialStorage={() => ({
            viewConfig: new LiveMap(),
          })}
        >
          <Flick />
        </RoomProvider>
      </LiveblocksProvider>
    </ErrorBoundary>
  )
}

export default FlickHoC
