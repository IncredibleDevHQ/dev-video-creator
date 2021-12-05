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
  TempTextEditor,
  Text,
  TextEditor,
  Tooltip,
} from '../../components'
import { Position } from '../../components/TempTextEditor/types'
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
import studioStore from '../Studio/stores/studio.store'
import {
  FlickNavBar,
  FragmentBar,
  FragmentSideBar,
  IntroConfig,
  ProcessingFlick,
  PublishFlick,
} from './components'
import BlockPreview, {
  getGradientConfig,
  gradients,
  GradientSelector,
} from './components/BlockPreview'
import { OutroConfig } from './components/IntroConfig'
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
    <div className="bg-gray-50 p-2 rounded-md">
      {fragment.participants
        .filter(
          (p) => !speakers?.some((s) => s.participant.id === p.participant.id)
        )
        .map((participant) => (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={() => null}
            className="flex items-center px-2 py-1 hover:bg-gray-300 transition-colors rounded-md"
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
  const { addMusic } = useCanvasRecorder({
    options: {},
  })

  const history = useHistory()

  const [currentBlock, setCurrentBlock] = useState<Block>()
  const [viewConfig, setViewConfig] = useState<ViewConfig>(initialConfig)

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
      setPlateValue(fragment?.editorState)
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
    <div className="flex flex-col h-screen relative overflow-hidden">
      <FlickNavBar toggleModal={setIntegrationModal} />
      <div className="flex flex-1 overflow-y-auto">
        <FragmentSideBar />
        <div className="flex-1 pb-12">
          <FragmentBar
            markdown={fragmentMarkdown}
            plateValue={plateValue}
            config={viewConfig}
          />
          {flick.fragments.length > 0 &&
            activeFragment &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type ===
              Fragment_Type_Enum_Enum.Intro && <IntroConfig />}
          {flick.fragments.length > 0 &&
            activeFragment &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type ===
              Fragment_Type_Enum_Enum.Outro && <OutroConfig />}

          {flick.fragments.length > 0 &&
            activeFragment &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type !==
              Fragment_Type_Enum_Enum.Intro &&
            flick.fragments.find((f) => f.id === activeFragmentId)?.type !==
              Fragment_Type_Enum_Enum.Outro && (
              <div className="h-full w-full my-4 mx-8 overflow-y-auto">
                <div className="mx-12 mb-4">
                  <Heading fontSize="large">
                    {
                      flick.fragments.find((f) => f.id === activeFragmentId)
                        ?.name
                    }
                  </Heading>
                </div>
                <div className="flex items-center justify-start mx-12">
                  {viewConfig.speakers?.map((s) => (
                    <div
                      className="flex items-center mr-2 rounded-md bg-gray-200 px-2 py-1"
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
                        className="px-2 py-1 flex items-center bg-gray-200 rounded-md"
                      >
                        <FiPlus className="mr-1.5" /> Add speakers
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className="flex mx-12 mt-8 shadow-lg items-center">
                  <hr className="w-full" />
                  <span className="w-48" />
                </div>
                <div className="px-8 w-full relative overflow-y-scroll flex h-full justify-between items-stretch">
                  {/* <TextEditor
                    placeholder="Start writing..."
                    handleUpdateJSON={(json) => {
                      setPlateValue(json)
                    }}
                    initialContent={initialPlateValue}
                    handleActiveBlock={(block) => {
                      setCurrentBlock(block)
                    }}
                    handleUpdateSimpleAST={(s) => console.log(s)}
                    handleUpdatePosition={(position) => {
                      // Relative position of the cursor.
                      setPreviewPosition(position)
                    }}
                    handleUpdateMarkdown={(markdown) => {
                      // Returns the markdown of current editor state.
                      setFragmentMarkdown(markdown)
                    }}
                  /> */}

                  <TempTextEditor
                    handleUpdatePosition={(position) => {
                      setPreviewPosition(position)
                    }}
                    handleUpdateAst={(ast) => {
                      setPlateValue(ast)
                    }}
                    initialAst={plateValue}
                    handleActiveBlock={(block) => {
                      setCurrentBlock(block)
                    }}
                  />
                  <div className="w-48 relative border-none outline-none">
                    {currentBlock && viewConfig && (
                      <BlockPreview
                        block={currentBlock}
                        config={viewConfig}
                        updateConfig={updateBlockProperties}
                        className={cx(
                          'absolute',
                          css`
                            top: ${previewPosition?.y}px;
                          `
                        )}
                      />
                    )}
                  </div>
                </div>
                {getSimpleAST(plateValue).blocks.length > 0 && (
                  <div className="flex items-center justify-start border rounded-md bg-gray-50 mb-4 fixed p-2 mx-8 bottom-4 z-10">
                    <div className="flex items-center justify-center px-4 py-2 w-32 h-16 gap-x-2 bg-white">
                      <Text
                        className={cx(
                          'cursor-pointer bg-gray-200 text-gray-50 px-2.5 py-1 rounded-sm text-sm ',
                          {
                            'bg-gray-800 text-gray-100':
                              viewConfig.mode === 'Landscape',
                          }
                        )}
                        onClick={() =>
                          setViewConfig({ ...viewConfig, mode: 'Landscape' })
                        }
                      >
                        16:9
                      </Text>
                      <Text
                        className={cx(
                          'cursor-pointer bg-gray-200 text-gray-50 h-full rounded-sm text-sm flex px-1 items-center',
                          {
                            'bg-gray-800 text-gray-100':
                              viewConfig.mode === 'Portrait',
                          }
                        )}
                        onClick={() =>
                          setViewConfig({ ...viewConfig, mode: 'Portrait' })
                        }
                      >
                        9:16
                      </Text>
                    </div>
                    <div
                      className={cx(
                        'px-4 py-2 w-32 h-16 border border-r-2 group relative',
                        css`
                          background: ${viewConfig.titleSplash
                            ?.titleSplashConfig?.cssString};
                        `
                      )}
                    >
                      <div className="absolute top-1 right-2 flex">
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
                            className="bg-white border rounded-sm p-1 mr-1 hidden group-hover:block"
                            onClick={() => setTitleGradientTooltip(true)}
                          />
                        </Tooltip>
                        {viewConfig.titleSplash?.enable ? (
                          <FiEye
                            size={24}
                            className="bg-white border rounded-sm p-1 hidden group-hover:block"
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
                            className=" bg-white border rounded-sm p-1"
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
                      <div className="border rounded-md flex justify-center items-center w-full h-full bg-white">
                        Title
                      </div>
                    </div>
                    <div className="px-4 py-2 w-32 h-16 bg-gray-100 relative border border-r-2">
                      <FiRefreshCcw
                        size={20}
                        className="absolute -right-3 bg-white p-1 rounded-sm top-1/2 transform -translate-y-1/2 z-10"
                      />
                      <div className="border rounded-md flex justify-center items-center w-full h-full bg-gray-500">
                        <FiUser size={20} />
                      </div>
                    </div>
                    {getSimpleAST(plateValue).blocks.map((block) => (
                      <div className="px-4 py-2 w-32 h-16 bg-gray-100 relative border border-r-2">
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
