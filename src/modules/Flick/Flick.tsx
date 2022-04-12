/* eslint-disable no-nested-ternary */
import { css, cx } from '@emotion/css'
import { Editor as CoreEditor } from '@tiptap/core'
import React, { useEffect, useMemo, useState } from 'react'
import { BiBlock } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { v4 as uuidv4 } from 'uuid'
import { Heading, ScreenState } from '../../components'
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
import TipTap from './editor/TipTap'
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
      introBlock: {},
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

const Flick = () => {
  const { id } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId, view }, setFlickStore] =
    useRecoilState(newFlickStore)

  const { sub } = (useRecoilValue(userState) as User) || {}

  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
    fetchPolicy: 'network-only',
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
  }, [currentBlock])

  useMemo(() => {
    setStudio((store) => ({
      ...store,
      payload,
      updatePayload,
      addMusic,
      stopMusic,
    }))
  }, [activeFragmentId, payload, flick?.fragments])

  useMemo(() => {
    const fragment = flick?.fragments.find(
      (f) => f.id === activeFragmentId
    ) as StudioFragmentFragment
    if (!fragment) return
    setStudio((store) => ({
      ...store,
      fragment,
    }))
  }, [flick?.fragments])

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

    setSimpleAST(fragment?.editorState || initialAST)
    setViewConfig(
      fragment?.configuration || {
        ...initialConfig,
        speakers: [flick.participants[0]],
        blocks: {
          [initialAST.blocks[0].id]: {
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
          [initialAST.blocks[1].id]: {
            layout: 'classic',
            view: {
              type: 'outroBlock',
              outro: {
                order: [{ enabled: true, state: 'titleSplash' }],
              },
            } as OutroBlockView,
          } as BlockProperties,
        },
      }
    )

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

  if (loading) return <ScreenState title="Loading your story" loading />

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
        <FlickNavBar togglePublishModal={() => setPublishModal(true)} />
        <FragmentBar
          simpleAST={simpleAST}
          editorValue={editorValue}
          config={viewConfig}
          setViewConfig={setViewConfig}
          currentBlock={currentBlock}
          setCurrentBlock={setCurrentBlock}
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
                  if (block === undefined) setCurrentBlock(undefined)
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
                simpleAST?.blocks?.length >= 2 && (
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
        />
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

export default Flick
