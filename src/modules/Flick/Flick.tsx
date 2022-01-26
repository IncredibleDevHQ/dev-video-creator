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
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { BlockProperties, ViewConfig } from '../../utils/configTypes'
import studioStore from '../Studio/stores/studio.store'
import {
  EditorHeader,
  FlickNavBar,
  FragmentBar,
  Preview,
  ProcessingFlick,
  PublishFlick,
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
  const [integrationModal, setIntegrationModal] = useState(false)
  const [published, setPublished] = useState(false)
  const [previewPosition, setPreviewPosition] = useState<Position>()
  const [activeFragment, setActiveFragment] = useState<FlickFragmentFragment>()

  const [processingFlick, setProcessingFlick] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)

  const { updatePayload, payload, resetPayload } = useLocalPayload()

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
    console.log('useEffect', viewConfig)
  }, [viewConfig])

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
      activeFragmentId: fragmentsLength > 0 ? editorFragment?.id : '',
    }))
  }, [data])

  useEffect(() => {
    return () => {
      setFlickStore({
        flick: null,
        activeFragmentId: '',
        isMarkdown: true,
        view: View.Notebook,
      })
    }
  }, [])

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
    setSimpleAST(
      fragment?.editorState ||
        ({
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
        } as SimpleAST)
    )
    setEditorValue(flick.md || '')
  }, [activeFragmentId])

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

  if (processingFlick)
    return (
      <ProcessingFlick
        flickId={flick.id}
        joinLink={flick.joinLink}
        setProcessing={setProcessingFlick}
      />
    )

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden">
      <FlickNavBar toggleModal={setIntegrationModal} />
      <FragmentBar
        simpleAST={simpleAST}
        editorValue={editorValue}
        config={viewConfig}
        setViewConfig={setViewConfig}
      />
      {activeFragment &&
        view === View.Preview &&
        currentBlock &&
        currentBlock.type &&
        viewConfig &&
        simpleAST &&
        simpleAST?.blocks?.length > 0 && (
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
        <div className="grid grid-cols-12 flex-1 h-full pb-12 sticky top-0 overflow-y-auto">
          <div className="h-full pt-12 pb-96 col-start-4 col-span-6 ">
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
              initialContent={flick.md || ''}
              handleActiveBlock={(block) => {
                setCurrentBlock(block)
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
              simpleAST?.blocks?.length > 0 && (
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

      {integrationModal && (
        <PublishFlick
          flickId={flick.id}
          flickName={flick.name}
          flickDescription={flick.description as string}
          flickThumbnail={flick.thumbnail as string}
          setProcessingFlick={setProcessingFlick}
          setPublished={setPublished}
          fragments={flick.fragments.map((f) => {
            return {
              id: f.id as string,
              name: f.name as string,
            }
          })}
          isShortsPresentAndCompleted={flick?.fragments.some(
            (f) => f.producedShortsLink !== null
          )}
          isAllFlicksCompleted={flick?.fragments.every(
            (f) => f.producedLink !== null
          )}
          open={integrationModal}
          handleClose={() => setIntegrationModal(false)}
        />
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
