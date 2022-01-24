import { css, cx } from '@emotion/css'
import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { ScreenState } from '../../components'
import {
  FlickFragmentFragment,
  Fragment_Status_Enum_Enum,
  Fragment_Type_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { BlockProperties, ViewConfig } from '../../utils/configTypes'
import { CONFIG } from '../Studio/components/Concourse'
import studioStore from '../Studio/stores/studio.store'
import {
  EditorHeader,
  FlickNavBar,
  FragmentBar,
  ProcessingFlick,
  PublishFlick,
  Timeline,
} from './components'
import BlockPreview, {
  getGradientConfig,
  gradients,
} from './components/BlockPreview'
import {
  DiscordThemes,
  IntroOutroConfiguration,
  SplashThemes,
} from './components/IntroOutroView'
import TipTap from './editor/TipTap'
import { Block, Position, SimpleAST } from './editor/utils/utils'
import { newFlickStore, View } from './store/flickNew.store'

const initialConfig: ViewConfig = {
  titleSplash: {
    enable: true,
    titleSplashConfig: getGradientConfig(gradients[0]),
  },
  speakers: [],
  mode: 'Landscape',
  blocks: {},
}

const defaultIntroOutroConfiguration: IntroOutroConfiguration = {
  discord: {
    backgroundColor: '#1F2937',
    textColor: '#ffffff',
    theme: DiscordThemes.WhiteOnMidnight,
  },
  gradient: {
    id: 1,
    cssString:
      'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
    endIndex: { x: CONFIG.width, y: CONFIG.height },
    startIndex: { x: 0, y: 0 },
    values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
  },
  theme: SplashThemes.Lines,
  mode: 'Landscape',
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
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })

  const setStudio = useSetRecoilState(studioStore)
  const { addMusic, stopMusic } = useCanvasRecorder({})

  const [currentBlock, setCurrentBlock] = useState<Block>()
  const [viewConfig, setViewConfig] = useState<ViewConfig>(initialConfig)
  const [introOutroConfiguration, setIntroOutroConfiguration] =
    useState<IntroOutroConfiguration>(defaultIntroOutroConfiguration)

  const [simpleAST, setSimpleAST] = useState<SimpleAST>()
  const [editorValue, setEditorValue] = useState<string>()
  const [integrationModal, setIntegrationModal] = useState(false)
  const [published, setPublished] = useState(false)
  const [previewPosition, setPreviewPosition] = useState<Position>()
  const [activeFragment, setActiveFragment] = useState<FlickFragmentFragment>()

  const [processingFlick, setProcessingFlick] = useState(false)

  const { updatePayload, payload, resetPayload } = useLocalPayload()

  const updateBlockProperties = (id: string, properties: BlockProperties) => {
    const newBlocks = { ...viewConfig.blocks, [id]: properties }
    setViewConfig({ ...viewConfig, blocks: newBlocks })
  }

  useEffect(() => {
    if (!currentBlock) return
    if (!viewConfig.blocks[currentBlock.id]) {
      const newBlocks = { ...viewConfig.blocks }
      newBlocks[currentBlock.id] = {
        layout: 'classic',
        gradient: getGradientConfig(gradients[0]),
      }
      setViewConfig({ ...viewConfig, blocks: newBlocks })
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
    if (fragment) setActiveFragment(fragment)
    if (
      fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
      fragment?.type !== Fragment_Type_Enum_Enum.Outro
    ) {
      if (fragment?.configuration)
        setViewConfig(
          fragment?.configuration || {
            ...initialConfig,
            speakers: [
              flick.participants.find((f) => f.id === fragment.participants[0]),
            ],
          }
        )

      setEditorValue(flick.md || '')
    } else {
      setIntroOutroConfiguration(
        fragment?.configuration || defaultIntroOutroConfiguration
      )
    }
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
        introConfig={introOutroConfiguration}
      />
      {activeFragment && (
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
                setSimpleAST(ast)
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
                  config={viewConfig}
                  updateConfig={updateBlockProperties}
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
      <Timeline blocks={simpleAST?.blocks || []} currentBlock={currentBlock} />
    </div>
  )
}

export default Flick
