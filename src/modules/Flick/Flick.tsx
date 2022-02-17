import { css, cx } from '@emotion/css'
import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { v4 as uuidv4 } from 'uuid'
import { ScreenState } from '../../components'
import {
  FlickFragmentFragment,
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
  useGetThemesQuery,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import {
  BlockProperties,
  CodeAnimation,
  CodeTheme,
  ViewConfig,
} from '../../utils/configTypes'
import { logPage } from '../../utils/analytics'
import { PageCategory, PageTitle } from '../../utils/analytics-types'
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
import TipTap from './editor/TipTap'
import { Block, Position, SimpleAST } from './editor/utils/utils'
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
            },
          },
        }
      }

      setViewConfig({ ...viewConfig, blocks: filteredBlocks })
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

    if (fragment?.configuration)
      setViewConfig(
        fragment?.configuration || {
          ...initialConfig,
          speakers: [
            flick.participants.find((f) => f.id === fragment.participants[0]),
          ],
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

  if (!data && loading)
    return <ScreenState title="Loading your flick..." loading />

  if (error)
    return (
      <ScreenState
        title="Something went wrong!!"
        subtitle="Could not load your flick. Please try again"
        button="Retry"
        handleClick={() => {
          refetch()
        }}
      />
    )

  if (!flick) return null

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden">
      <FlickNavBar />
      <FragmentBar
        simpleAST={simpleAST}
        editorValue={editorValue}
        config={viewConfig}
        setViewConfig={setViewConfig}
      />
      {activeFragment && view === View.Preview && (
        <Preview
          block={currentBlock}
          config={viewConfig}
          updateConfig={updateBlockProperties}
          blocks={simpleAST?.blocks || []}
          setCurrentBlock={setCurrentBlock}
          centered={!showTimeline}
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
              handleUpdateAst={(ast, editorState) => {
                if (simpleAST)
                  setSimpleAST((prev) => ({
                    ...ast,
                    blocks: [
                      ...(prev?.blocks ? [prev.blocks[0]] : []),
                      ...ast.blocks,
                      ...(prev?.blocks
                        ? [
                            {
                              ...prev.blocks[prev.blocks.length - 1],
                              pos: ast.blocks.length + 1,
                            } as Block,
                          ]
                        : []),
                    ],
                  }))
                setEditorValue(editorState)
              }}
              handleActiveBlock={(block) => {
                if (block && block !== currentBlock) setCurrentBlock(block)
              }}
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
  )
}

export default Flick
