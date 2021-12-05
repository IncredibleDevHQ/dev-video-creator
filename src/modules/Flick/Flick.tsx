import { css, cx } from '@emotion/css'
import React, { useEffect, useMemo, useState } from 'react'
import {
  FiEye,
  FiEyeOff,
  FiPlus,
  FiRefreshCcw,
  FiSliders,
  FiUser,
  FiX,
} from 'react-icons/fi'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilState, useSetRecoilState } from 'recoil'
import {
  Heading,
  ScreenState,
  Text,
  TextEditor,
  Tooltip,
} from '../../components'
import { Position } from '../../components/TextEditor/components'
import { Block, useUtils } from '../../components/TextEditor/utils'
import {
  FlickFragmentFragment,
  FragmentParticipantFragment,
  Fragment_Status_Enum_Enum,
  Fragment_Type_Enum_Enum,
  StudioFragmentFragment,
  useGetFlickByIdQuery,
  UserAssetQuery,
  useUserAssetQuery,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { BlockProperties, ViewConfig } from '../../utils/configTypes2'
import { initEditor } from '../../utils/plateConfig/serializer/values'
import { CONFIG } from '../Studio/components/Concourse'
import studioStore from '../Studio/stores/studio.store'
import {
  FlickNavBar,
  FragmentBar,
  FragmentSideBar,
  ProcessingFlick,
  PublishFlick,
} from './components'
import BlockPreview, {
  getGradientConfig,
  gradients,
  GradientSelector,
} from './components/BlockPreview'
import IntroOutroView, {
  DiscordThemes,
  IntroOutroConfiguration,
  SplashThemes,
} from './components/IntroOutroView'
import { FragmentTypeIcon } from './components/LayoutGeneric'
import { newFlickStore } from './store/flickNew.store'

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

const SpeakersTooltip = ({
  fragment,
  speakers,
  addSpeaker,
  close,
}: {
  fragment: FlickFragmentFragment
  speakers: FragmentParticipantFragment[]
  addSpeaker: (speaker: FragmentParticipantFragment) => void
  close?: () => void
}) => {
  return (
    <div className="p-2 rounded-md bg-gray-50">
      {fragment.participants
        .filter(
          (p) => !speakers?.some((s) => s.participant.id === p.participant.id)
        )
        .map((participant) => (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={() => null}
            className="flex items-center px-2 py-1 transition-colors rounded-md hover:bg-gray-300"
            key={participant.participant.id}
            onClick={() => {
              if (participant) {
                addSpeaker(participant)
                close?.()
              }
            }}
          >
            <img
              src={participant.participant.user.picture as string}
              alt={participant.participant.user.displayName as string}
              className="w-6 h-6 rounded-full"
            />
            <Text fontSize="normal" className="ml-2">
              {participant.participant.user.displayName}
            </Text>
          </div>
        ))}
    </div>
  )
}

const Flick = () => {
  const { id, fragmentId } = useParams<{ id: string; fragmentId?: string }>()
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const { data, error, loading, refetch } = useGetFlickByIdQuery({
    variables: { id },
  })
  const setStudio = useSetRecoilState(studioStore)
  const { addMusic, stopMusic } = useCanvasRecorder({
    options: {},
  })
  const history = useHistory()

  const [currentBlock, setCurrentBlock] = useState<Block>()
  const [viewConfig, setViewConfig] = useState<ViewConfig>(initialConfig)
  const [introOutroConfiguration, setIntroOutroConfiguration] =
    useState<IntroOutroConfiguration>(defaultIntroOutroConfiguration)
  const [initialPlateValue, setInitialPlateValue] = useState<any>('')
  const [plateValue, setPlateValue] = useState<any>()
  const [integrationModal, setIntegrationModal] = useState(false)

  const [previewPosition, setPreviewPosition] = useState<Position>()
  const [activeFragment, setActiveFragment] = useState<FlickFragmentFragment>()
  const [isSpeakersTooltip, setSpeakersTooltip] = useState(false)
  const [isTitleGradientTooltip, setTitleGradientTooltip] = useState(false)
  const [processingFlick, setProcessingFlick] = useState(false)
  const [published, setPublished] = useState(false)
  const [fragmentMarkdown, setFragmentMarkdown] = useState<string>()

  const { updatePayload, payload, resetPayload } = useLocalPayload()
  const [myMediaAssets, setMyMediaAssets] = useState<UserAssetQuery>()
  const { data: assetsData, error: assetsError } = useUserAssetQuery()

  const { getSimpleAST } = useUtils()

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

  useEffect(() => {
    if (!assetsData) return
    setMyMediaAssets(assetsData)
  }, [assetsData])

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
  }, [activeFragmentId, payload])

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
    let activeId = ''
    if (fragmentId) activeId = fragmentId
    else {
      activeId = fragmentsLength > 0 ? data.Flick_by_pk?.fragments[0].id : ''
    }
    setFlickStore((store) => ({
      ...store,
      flick: data.Flick_by_pk || null,
      activeFragmentId: activeId,
    }))
  }, [data])

  useEffect(() => {
    return () => {
      setFlickStore({
        flick: null,
        activeFragmentId: '',
        isMarkdown: true,
      })
    }
  }, [])

  useEffect(() => {
    if (!activeFragmentId || !flick) return
    history.replace(`/flick/${flick.id}/${activeFragmentId}`)
    const fragment = flick?.fragments.find(
      (frag) => frag.id === activeFragmentId
    )
    if (fragment) setActiveFragment(fragment)
    if (
      fragment?.type !== Fragment_Type_Enum_Enum.Intro &&
      fragment?.type !== Fragment_Type_Enum_Enum.Outro
    ) {
      if (fragment?.configuration)
        setViewConfig(fragment?.configuration || initialConfig)
      if (fragment?.editorState) {
        if (
          typeof fragment?.editorState === 'object' &&
          Object.keys(fragment?.editorState).length < 1
        )
          setInitialPlateValue('')
        else setInitialPlateValue(fragment?.editorState || '')
      }
      setPlateValue(fragment?.editorState || initEditor)
    } else {
      setIntroOutroConfiguration(
        fragment?.configuration || defaultIntroOutroConfiguration
      )
    }
  }, [activeFragmentId])

  const addSpeaker = (speaker: FragmentParticipantFragment) => {
    setViewConfig({
      ...viewConfig,
      speakers: [...viewConfig?.speakers, speaker],
    })
  }

  const deleteSpeaker = (speaker: FragmentParticipantFragment) => {
    setViewConfig({
      ...viewConfig,
      speakers: viewConfig?.speakers?.filter(
        (s) => s.participant.user.sub !== speaker.participant.user.sub
      ),
    })
  }

  if (loading) return <ScreenState title="Just a jiffy" loading />

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
  if (assetsError) {
    return (
      <ScreenState
        title="Something went wrong!"
        subtitle={assetsError.message}
      />
    )
  }

  if (processingFlick)
    return (
      <ProcessingFlick
        flickId={flick.id}
        joinLink={flick.joinLink}
        setProcessing={setProcessingFlick}
      />
    )

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <FlickNavBar toggleModal={setIntegrationModal} />
      <div className="flex flex-1 overflow-y-auto">
        <FragmentSideBar plateValue={plateValue} />
        <div className="flex-1 pb-12">
          <FragmentBar
            markdown={fragmentMarkdown}
            plateValue={plateValue}
            config={viewConfig}
            setViewConfig={setViewConfig}
            introConfig={introOutroConfiguration}
          />
          {flick.fragments.length > 0 &&
            activeFragment &&
            (activeFragment.type === Fragment_Type_Enum_Enum.Intro ||
              activeFragment.type === Fragment_Type_Enum_Enum.Outro) && (
              <IntroOutroView
                config={introOutroConfiguration}
                setConfig={setIntroOutroConfiguration}
              />
            )}

          {flick.fragments.length > 0 &&
            activeFragment &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type !==
              Fragment_Type_Enum_Enum.Intro &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type !==
              Fragment_Type_Enum_Enum.Outro && (
              <div className="w-full h-full mx-8 my-4 overflow-y-auto">
                <div className="mx-12 mb-4">
                  <Heading className="font-bold text-4xl" fontSize="large">
                    {activeFragment.name}
                  </Heading>
                </div>
                <div className="flex items-center justify-start mx-12">
                  {viewConfig.speakers?.map((s) => (
                    <div
                      className="flex items-center px-2 py-1 mr-2 bg-gray-200 rounded-md"
                      key={s.participant.user.sub}
                    >
                      <img
                        src={s.participant.user.picture as string}
                        alt={s.participant.user.displayName as string}
                        className="w-6 h-6 rounded-full"
                      />
                      <Text fontSize="normal" className="mx-2">
                        {s.participant.user.displayName}
                      </Text>
                      <FiX
                        className="cursor-pointer"
                        onClick={() => deleteSpeaker(s)}
                      />
                    </div>
                  ))}
                  {viewConfig.speakers?.length <
                    activeFragment.participants.length && (
                    <Tooltip
                      containerOffset={8}
                      isOpen={isSpeakersTooltip}
                      setIsOpen={() => setSpeakersTooltip(false)}
                      placement="bottom-start"
                      content={
                        <SpeakersTooltip
                          fragment={activeFragment}
                          speakers={viewConfig.speakers}
                          addSpeaker={addSpeaker}
                          close={() => setSpeakersTooltip(false)}
                        />
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setSpeakersTooltip(true)}
                        className="flex items-center px-2 py-1 bg-gray-200 rounded-md"
                      >
                        <FiPlus className="mr-1.5" /> Add speakers
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center mx-12 mt-8 shadow-lg">
                  <hr className="w-full" />
                  <span className="w-48" />
                </div>
                <div className="relative flex items-stretch justify-between w-full h-full px-8 overflow-y-scroll pb-28">
                  <TextEditor
                    placeholder="Start writing..."
                    handleUpdateJSON={(json) => {
                      setPlateValue(json)
                    }}
                    initialContent={initialPlateValue}
                    handleActiveBlock={(block) => {
                      setCurrentBlock(block)
                    }}
                    handleUpdatePosition={(position) => {
                      // Relative position of the cursor.
                      setPreviewPosition(position)
                    }}
                    handleUpdateMarkdown={(markdown) => {
                      // Returns the markdown of current editor state.
                      setFragmentMarkdown(markdown)
                    }}
                  />
                  <div className="relative w-64 border-none outline-none">
                    {currentBlock && viewConfig && (
                      <BlockPreview
                        block={currentBlock}
                        config={viewConfig}
                        updateConfig={updateBlockProperties}
                        className={cx(
                          'absolute',
                          css`
                            top: ${previewPosition?.top}px;
                          `
                        )}
                      />
                    )}
                  </div>
                </div>
                {getSimpleAST(plateValue).blocks.length > 0 && (
                  <div className="fixed z-10 flex items-center justify-start p-2 mx-8 mb-4 border rounded-md bg-gray-50 bottom-4">
                    <div
                      className={cx(
                        'px-4 py-2 w-32 h-16 border border-r-2 group relative',
                        css`
                          background: ${viewConfig.titleSplash
                            ?.titleSplashConfig?.cssString};
                        `
                      )}
                    >
                      <div className="absolute flex top-1 right-2">
                        <Tooltip
                          isOpen={isTitleGradientTooltip}
                          setIsOpen={setTitleGradientTooltip}
                          placement="top-start"
                          content={
                            <GradientSelector
                              mode={viewConfig.mode}
                              currentGradient={
                                viewConfig.titleSplash?.titleSplashConfig ||
                                getGradientConfig(gradients[0])
                              }
                              updateGradient={(gradient) => {
                                setViewConfig({
                                  ...viewConfig,
                                  titleSplash: {
                                    ...viewConfig.titleSplash,
                                    titleSplashConfig: gradient,
                                  },
                                })
                              }}
                            />
                          }
                        >
                          <FiSliders
                            size={24}
                            className="hidden p-1 mr-1 bg-white border rounded-sm group-hover:block"
                            onClick={() => setTitleGradientTooltip(true)}
                          />
                        </Tooltip>
                        {viewConfig.titleSplash?.enable ? (
                          <FiEye
                            size={24}
                            className="hidden p-1 bg-white border rounded-sm group-hover:block"
                            onClick={() =>
                              setViewConfig({
                                ...viewConfig,
                                titleSplash: {
                                  ...viewConfig.titleSplash,
                                  enable: false,
                                },
                              })
                            }
                          />
                        ) : (
                          <FiEyeOff
                            size={24}
                            className="p-1 bg-white border rounded-sm "
                            onClick={() =>
                              setViewConfig({
                                ...viewConfig,
                                titleSplash: {
                                  ...viewConfig.titleSplash,
                                  enable: true,
                                },
                              })
                            }
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-center w-full h-full bg-white border rounded-md">
                        Title
                      </div>
                    </div>
                    <div className="relative w-32 h-16 px-4 py-2 bg-gray-100 border border-r-2">
                      <FiRefreshCcw
                        size={20}
                        className="absolute z-10 p-1 transform -translate-y-1/2 bg-white rounded-sm -right-3 top-1/2"
                      />
                      <div className="flex items-center justify-center w-full h-full bg-gray-500 border rounded-md">
                        <FiUser size={20} />
                      </div>
                    </div>
                    {getSimpleAST(plateValue).blocks.map((block) => (
                      <div className="relative w-32 h-16 px-4 py-2 bg-gray-100 border border-r-2">
                        <div
                          className={cx(
                            'border rounded-md flex justify-center items-center w-full h-full p-2',
                            {
                              'border-brand': block.id === currentBlock?.id,
                            }
                          )}
                        >
                          <FragmentTypeIcon type={block.type} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          <div />
        </div>
      </div>
      <div />
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
    </div>
  )
}

export default Flick
