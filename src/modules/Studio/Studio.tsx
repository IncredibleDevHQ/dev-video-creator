/* eslint-disable jsx-a11y/media-has-caption */
import { cx } from '@emotion/css'
import { ILocalVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'
import getBlobDuration from 'get-blob-duration'
import Konva from 'konva'
import React, { createRef, useEffect, useMemo, useState } from 'react'
import AspectRatio from 'react-aspect-ratio'
import { FiArrowRight } from 'react-icons/fi'
import { Layer, Stage } from 'react-konva'
import { useHistory, useParams } from 'react-router-dom'
import _ from 'lodash/fp'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import { IoChevronBack } from 'react-icons/io5'
import {
  Button,
  dismissToast,
  emitToast,
  EmptyState,
  Heading,
  ScreenState,
  Text,
  updateToast,
} from '../../components'
import { TextEditorParser } from '../../components/TempTextEditor/utils'
import {
  CodeBlockProps,
  ImageBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../../components/TextEditor/utils'
import config from '../../config'
import {
  FlickParticipantsFragment,
  Fragment_Status_Enum_Enum,
  Fragment_Type_Enum_Enum,
  GetFragmentByIdQuery,
  StudioFragmentFragment,
  useGetFragmentByIdLazyQuery,
  useGetRtcTokenMutation,
  useMarkFragmentCompletedMutation,
  useUpdateFragmentShortMutation,
} from '../../generated/graphql'
import { useCanvasRecorder, useTimekeeper } from '../../hooks'
import { useUploadFile } from '../../hooks/use-upload-file'
import { User, userState } from '../../stores/user.store'
import { ConfigType } from '../../utils/configTypes'
import { ViewConfig } from '../../utils/configTypes2'
import { DiscordThemes } from '../Flick/components/IntroOutroView'
import { Countdown } from './components'
import { CONFIG, SHORTS_CONFIG } from './components/Concourse'
import {
  CodeJamControls,
  PointsControls,
  TriviaControls,
  VideoJamControls,
} from './components/Controls'
import RecordingControlsBar from './components/RecordingControlsBar'
import IntroFragment from './effects/fragments/IntroFragment'
import OutroFragment from './effects/fragments/OutroFragment'
import UnifiedFragment from './effects/fragments/UnifiedFragment'
import { useAgora, useVectorly } from './hooks'
import { Device } from './hooks/use-agora'
import { useRTDB } from './hooks/use-rtdb'
import { StudioProviderProps, StudioState, studioStore } from './stores'

const backgrounds = [
  { label: 'No effect', value: 'none' },
  { label: 'Blur', value: 'blur' },
  { label: 'Transparent', value: 'transparent' },
  {
    label: 'Wall',
    value: 'https://demo.vectorly.io/virtual-backgrounds/7.jpg',
  },
  {
    label: 'City',
    value: 'https://demo.vectorly.io/virtual-backgrounds/8.jpg',
  },
  {
    label: 'Beach',
    value: 'https://demo.vectorly.io/virtual-backgrounds/3.jpg',
  },
  {
    label: 'Bridge',
    value: 'https://demo.vectorly.io/virtual-backgrounds/2.jpg',
  },
  {
    label: 'Bloody Mary (Gradient)',
    value: 'https://i.ibb.co/rvbdFT9/Bloody-Mary.png',
  },
  { label: 'DIMIGO (Gradient)', value: 'https://i.ibb.co/bJSYLhj/DIMIGO.png' },
]

const StudioHoC = () => {
  const [view, setView] = useState<'preview' | 'studio'>('preview')

  const {
    devices,
    ready,
    tracks,
    updateBackground,
    updateCamera,
    updateMicrophone,
    currentDevice,
    effect,
  } = useVectorly(config.vectorly.token)

  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const [fragment, setFragment] = useState<StudioFragmentFragment>()

  const [getFragmentByIdLazy, { data, loading }] = useGetFragmentByIdLazyQuery()

  const [error, setError] = useState<'INVALID_AST' | undefined>()

  useEffect(() => {
    if (!sub) return
    ;(async () => {
      await getFragmentByIdLazy({
        variables: { id: fragmentId, sub: sub as string },
      })
    })()
  }, [sub])

  // useEffect(() => {
  //   return () => {
  //     if (_.isEmpty(tracks)) return
  //     tracks?.forEach((track) => {
  //       track.close()
  //       track.stop()
  //     })
  //   }
  // }, [tracks])

  useEffect(() => {
    if (!data) return
    setFragment(data.Fragment?.[0])

    if (
      data.Fragment[0].type === Fragment_Type_Enum_Enum.Intro ||
      data.Fragment[0].type === Fragment_Type_Enum_Enum.Outro
    )
      return
    if (!new TextEditorParser(data.Fragment[0].editorState).isValid()) {
      setError('INVALID_AST')
    }
  }, [data])

  if (loading || !ready) return <ScreenState title="Just a jiffy..." loading />

  if (error === 'INVALID_AST')
    return (
      <ScreenState
        title="Invalid Configuration"
        subtitle="The fragment contains an invalid data reference. Please correct it and try again."
      />
    )

  if (view === 'preview' && fragment)
    return (
      <Preview
        data={fragment}
        devices={devices}
        updateBackground={updateBackground}
        updateCamera={updateCamera}
        updateMicrophone={updateMicrophone}
        handleJoin={() => setView('studio')}
        tracks={tracks}
        currentDevice={currentDevice}
        effect={effect}
      />
    )
  if (view === 'studio') return <Studio data={data} tracks={tracks} />

  return null
}

const Preview = ({
  data,
  handleJoin,
  devices,
  updateBackground,
  updateCamera,
  updateMicrophone,
  tracks,
  currentDevice,
  effect,
}: {
  data?: StudioFragmentFragment
  devices?: MediaDeviceInfo[]
  handleJoin: () => void
  updateBackground: (value: string) => Promise<void>
  updateMicrophone: (deviceId: string) => Promise<void>
  updateCamera: (deviceId: string) => Promise<void>
  tracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  currentDevice?: Device
  effect?: string
}) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen p-8">
      <div className="grid w-full grid-cols-5 gap-x-8">
        <div className="col-span-3">
          {tracks?.[1] && (
            <div className="relative">
              <AspectRatio ratio="16/9" className="overflow-hidden rounded-lg">
                {/* using video tag because agora player failed due to updates */}
                <video
                  className="w-full"
                  ref={(ref) => {
                    if (!ref) return
                    const stream = new MediaStream([
                      tracks?.[1].getMediaStreamTrack(),
                    ])
                    // @ts-ignore
                    // eslint-disable-next-line no-param-reassign
                    ref.srcObject = stream
                    ref.addEventListener('loadeddata', () => {
                      ref.play()
                    })
                  }}
                />
              </AspectRatio>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center flex-1 col-span-2">
          <Heading className="mb-4" fontSize="medium">
            {data?.name}
          </Heading>

          <Heading fontSize="extra-small" className="uppercase">
            Camera
          </Heading>
          <select
            className="w-full p-2 mb-4 border border-gray-300 rounded-md"
            value={currentDevice?.camera}
            onChange={(e) =>
              // @ts-ignore
              updateCamera(e.target.value as string)
            }
          >
            {devices
              ?.filter((device) => device.kind === 'videoinput')
              .map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
          </select>

          <Heading fontSize="extra-small" className="uppercase">
            Microphone
          </Heading>
          <select
            className="w-full p-2 mb-4 border border-gray-300 rounded-md"
            value={currentDevice?.microphone}
            onChange={(e) =>
              // @ts-ignore
              updateMicrophone(e.target.value as string)
            }
          >
            {devices
              ?.filter((device) => device.kind === 'audioinput')
              .map((microphone) => (
                <option key={microphone.deviceId} value={microphone.deviceId}>
                  {microphone.label}
                </option>
              ))}
          </select>

          <Heading fontSize="extra-small" className="uppercase">
            Effect
          </Heading>
          <select
            className="w-full p-2 mb-4 border border-gray-300 rounded-md"
            value={effect}
            onChange={(e) =>
              // @ts-ignore
              updateBackground(e.target.value as string)
            }
          >
            {backgrounds.map((background) => (
              <option key={background.value} value={background.value}>
                {background.label}
              </option>
            ))}
          </select>
          <Button
            className="self-start"
            size="extraSmall"
            appearance="primary"
            type="button"
            onClick={() => handleJoin()}
          >
            Join now
          </Button>
        </div>
      </div>
    </div>
  )
}

const Studio = ({
  data,
  tracks,
}: {
  data?: GetFragmentByIdQuery
  tracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
}) => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const { constraints, controlsConfig } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const history = useHistory()

  const [markFragmentCompleted] = useMarkFragmentCompletedMutation()
  const [updateFragmentShort] = useUpdateFragmentShortMutation()

  const [uploadFile] = useUploadFile()

  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()
  Konva.pixelRatio = 2

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  const [shortsMode, setShortsMode] = useState(false)

  const { handleStart, handleReset, timer } = useTimekeeper(0)

  useEffect(() => {
    if (!fragment) return
    const viewConfig: ViewConfig = fragment.configuration
    if (viewConfig?.mode === 'Portrait') {
      setStageConfig(SHORTS_CONFIG)
      setShortsMode(true)
    } else {
      setStageConfig(CONFIG)
      setShortsMode(false)
    }
  }, [fragment])

  // const [canvas, setCanvas] = useRecoilState(canvasStore)

  const { stream, join, users, mute, leave, userAudios, renewToken } = useAgora(
    fragmentId,
    {
      onTokenWillExpire: async () => {
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          renewToken(data.RTCToken.token)
        }
      },
      onTokenDidExpire: async () => {
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          const participantId = fragment?.configuration?.speakers?.find(
            ({ participant }: { participant: FlickParticipantsFragment }) =>
              participant.userSub === sub
          )?.participant.id
          if (participantId) {
            join(data?.RTCToken?.token, participantId as string)
          } else {
            leave()
            emitToast({
              title: 'Yikes. Something went wrong.',
              type: 'error',
              description:
                'You do not belong to this studio!! Please ask the host to invite you again.',
            })
            history.goBack()
          }
        }
      },
    },
    tracks
  )

  const [getRTCToken] = useGetRtcTokenMutation({
    variables: { fragmentId },
  })

  const { participants, init, payload, updatePayload, updateParticipant } =
    useRTDB<any, any>({
      lazy: true,
      path: `rtdb/fragments/${fragmentId}`,
      participants: {
        enabled: true,
        path: `rtdb/fragments/${fragmentId}/participants`,
        childPath: `rtdb/fragments/${fragmentId}/participants/${
          fragment?.participants.find(
            ({ participant }) => participant.userSub === sub
          )?.participant.id
        }`,
      },
      presence: {
        enabled: true,
        path: `rtdb/fragments/${fragmentId}/participants/${
          fragment?.participants.find(
            ({ participant }) => participant.userSub === sub
          )?.participant.id
        }`,
      },
      payload: { enabled: true, path: `rtdb/fragments/${fragmentId}/payload` },
    })

  useEffect(() => {
    if (fragment) {
      ;(async () => {
        init()
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          const participantId = fragment?.participants.find(
            ({ participant }) => participant.userSub === sub
          )?.participant.id
          if (participantId) {
            join(data?.RTCToken?.token, participantId as string)
          } else {
            leave()
            emitToast({
              title: 'Yikes. Something went wrong.',
              type: 'error',
              description:
                'You do not belong to this studio!! Please ask the host to invite you again.',
            })
            history.goBack()
          }
        }
      })()
    }
  }, [fragment])

  useEffect(() => {
    if (data?.Fragment[0] === undefined) return
    setFragment(data.Fragment[0])
  }, [data, fragmentId])

  useEffect(() => {
    return () => {
      leave()
      setFragment(undefined)
      setStudio({
        ...studio,
        fragment: undefined,
        tracks,
      })
    }
  }, [])

  const [state, setState] = useState<StudioState>('ready')

  const {
    startRecording,
    stopRecording,
    reset,
    getBlobs,
    addMusic,
    reduceSplashAudioVolume,
    stopMusic,
  } = useCanvasRecorder({
    options: {},
  })

  /**
   * END STREAM HOOKS...
   */

  /**
   * =====================
   * Event Handlers...
   * =====================
   */

  const resetRecording = () => {
    reset()
    init()
    setState('ready')
  }

  const upload = async () => {
    setState('upload')

    const toastProps = {
      title: 'Pushing pixels...',
      type: 'info',
      autoClose: false,
      description: 'Our hamsters are gift-wrapping your Fragment. Do hold. :)',
    }

    // @ts-ignore
    const toast = emitToast(toastProps)

    try {
      const uploadVideoFile = await getBlobs()
      const { uuid } = await uploadFile({
        extension: 'webm',
        file: uploadVideoFile,
        handleProgress: ({ percentage }) => {
          updateToast({
            id: toast,
            ...toastProps,
            type: 'info',
            autoClose: false,
            title: `Pushing pixels... (${percentage}%)`,
          })
        },
      })

      const duration = await getBlobDuration(uploadVideoFile)

      if (shortsMode)
        updateFragmentShort({
          variables: {
            id: fragmentId,
            producedShortsLink: uuid,
            duration,
          },
        })
      else
        await markFragmentCompleted({
          variables: { id: fragmentId, producedLink: uuid, duration },
        })

      dismissToast(toast)
      leave()
      stream?.getTracks().forEach((track) => track.stop())
      setFragment(undefined)
      setStudio({
        ...studio,
        fragment: undefined,
        tracks,
      })
      history.push(`/flick/${fragment?.flickId}/${fragmentId}`)
    } catch (e) {
      emitToast({
        title: 'Yikes. Something went wrong.',
        type: 'error',
        autoClose: false,
        description: 'Our servers are a bit cranky today. Try in a while?',
      })
    }
  }

  const start = () => {
    const canvas = document
      .getElementsByClassName('konvajs-content')[0]
      .getElementsByTagName('canvas')[0]

    // @ts-ignore
    startRecording(canvas, {
      localStream: stream as MediaStream,
      remoteStreams: userAudios,
    })

    setState('recording')
  }

  const finalTransition = () => {
    if (!payload) return
    payload.playing = false
    updatePayload?.({ status: Fragment_Status_Enum_Enum.Ended })
  }

  const stop = () => {
    stopRecording()
    setState('preview')
  }

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      finalTransition()
    }
  }, [payload])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.NotStarted) {
      setState('ready')
    }
    if (
      !studio.isHost &&
      payload?.status === Fragment_Status_Enum_Enum.Completed
    ) {
      stream?.getTracks().forEach((track) => track.stop())
      history.goBack()
      emitToast({
        title: 'This Fragment is completed.',
        type: 'success',
        autoClose: 3000,
      })
    }
  }, [payload, studio.isHost])

  const [fragmentType, setFragmentType] = useState<ConfigType>()

  const [isButtonClicked, setIsButtonClicked] = useState(false)

  useEffect(() => {
    if (state === 'recording') {
      setIsButtonClicked(false)
    }
  }, [state])

  useMemo(() => {
    if (!fragment) return
    setStudio({
      ...studio,
      fragment,
      stream: stream as MediaStream,
      startRecording: start,
      stopRecording: stop,
      showFinalTransition: finalTransition,
      addMusic,
      reduceSplashAudioVolume,
      stopMusic,
      reset: resetRecording,
      upload,
      getBlobs,
      state,
      tracks,
      constraints: {
        audio: constraints ? constraints.audio : true,
        video: constraints ? constraints.video : true,
      },
      users,
      payload,
      mute: (type: 'audio' | 'video') => mute(type),
      participants,
      updateParticipant,
      updatePayload,
      participantId: fragment?.participants.find(
        ({ participant }) => participant.userSub === sub
      )?.participant.id,
      isHost:
        fragment?.participants.find(
          ({ participant }) => participant.userSub === sub
        )?.participant.owner || false,
    })
  }, [fragment, stream, users, state, userAudios, payload, participants, state])

  useEffect(() => {
    if (!studio.controlsConfig) return
    // const conf = fragment.configuration as Config
    setFragmentType(studio.controlsConfig.type)
  }, [payload?.activeObjectIndex, studio.controlsConfig])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Live) {
      setStudio({
        ...studio,
        state: 'recording',
      })
      start()
    }
  }, [payload?.status])

  const getNote = (activeObjectIndex: number | undefined) => {
    if (!fragment || activeObjectIndex === undefined) return ''
    const blocks = fragment.editorState?.blocks

    switch (blocks[activeObjectIndex].type) {
      case 'codeBlock':
        return (blocks[activeObjectIndex] as CodeBlockProps).codeBlock.note
      case 'videoBlock':
        return (blocks[activeObjectIndex] as VideoBlockProps).videoBlock.note

      case 'listBlock':
        return (blocks[activeObjectIndex] as ListBlockProps).listBlock.note

      case 'imageBlock':
        return (blocks[activeObjectIndex] as ImageBlockProps).imageBlock.note
      default:
        return ''
    }
  }

  /**
   * =======================
   * END EVENT HANDLERS...
   * =======================
   */

  if (!fragment || fragment.id !== fragmentId)
    return <EmptyState text="Fragment not found" width={400} />

  // const C = getEffect(fragment.type, fragment.configuration)

  return (
    <div className="h-screen">
      {/* Bottom bar with details and global controls */}
      <div className="fixed top-0 flex justify-center w-full px-10 py-4 bg-gray-50">
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className="absolute flex items-center rounded-md cursor-pointer left-4 bottom-3 hover:bg-gray-100"
          onClick={() => history.goBack()}
        >
          <IoChevronBack size={24} className="mr-4" />
          <div>
            <Heading className="font-semibold text-gray-800 text-md">
              {fragment.flick.name.length > 40
                ? `${fragment.flick.name.substring(0, 40)}...`
                : fragment.flick.name}
            </Heading>
            <Text className="text-gray-500 text-md">
              {fragment.name && fragment.name.length > 20
                ? `${fragment.name.substring(0, 20)}...`
                : fragment.name}
            </Text>
          </div>
        </div>
        <RecordingControlsBar
          handleStart={handleStart}
          handleReset={handleReset}
          timer={timer}
        />
      </div>
      {/* Studio or Video , Notes and layout controls */}
      <div className="flex items-center h-full px-10 pt-16 ">
        <Countdown />
        {state === 'ready' || state === 'recording' || state === 'countDown' ? (
          <div className="flex w-full mt-3 gap-x-8">
            <Stage
              ref={stageRef}
              height={stageConfig.height}
              width={stageConfig.width}
              // className={cx({
              //   'cursor-zoom-in': canvas?.zoomed && !isZooming,
              //   'cursor-zoom-out': canvas?.zoomed && isZooming,
              // })}
            >
              <Bridge>
                <Layer ref={layerRef}>
                  {(() => {
                    if (fragment) {
                      if (fragment.type === Fragment_Type_Enum_Enum.Intro)
                        return (
                          <IntroFragment
                            themeNumber={
                              `${fragment.configuration?.theme}` || '0'
                            }
                            gradientConfig={
                              fragment.configuration?.gradient || {
                                backgroundColor: '#1F2937',
                                textColor: '#ffffff',
                                theme: DiscordThemes.WhiteOnMidnight,
                              }
                            }
                            discordConfig={
                              fragment.configuration?.discord || {
                                cssString:
                                  'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
                                endIndex: { x: CONFIG.width, y: CONFIG.height },
                                startIndex: { x: 0, y: 0 },
                                values: [
                                  0,
                                  '#D397FA',
                                  0.0001,
                                  '#D397FA',
                                  1,
                                  '#8364E8',
                                ],
                              }
                            }
                          />
                        )
                      if (fragment.type === Fragment_Type_Enum_Enum.Outro)
                        return (
                          <OutroFragment
                            gradientConfig={
                              fragment.configuration?.gradient || {
                                backgroundColor: '#1F2937',
                                textColor: '#ffffff',
                                theme: DiscordThemes.WhiteOnMidnight,
                              }
                            }
                          />
                        )
                      return (
                        <UnifiedFragment
                          stageRef={stageRef}
                          layerRef={layerRef}
                        />
                      )
                    }
                    return <></>
                  })()}
                </Layer>
              </Bridge>
            </Stage>
            <div
              className={cx('grid grid-rows-2 flex-1 gap-y-4', {
                'my-12': shortsMode,
              })}
            >
              {/* Notes */}
              <div className="h-full">
                <Text className="text-gray-800 truncate whitespace-pre-wrap">
                  {getNote(payload?.activeObjectIndex)}
                </Text>
              </div>
              <div className="flex flex-col items-start justify-end h-full">
                {(() => {
                  if (
                    fragment.type === Fragment_Type_Enum_Enum.Intro ||
                    fragment.type === Fragment_Type_Enum_Enum.Outro
                  )
                    return <></>
                  switch (fragmentType) {
                    case ConfigType.CODEJAM:
                      return (
                        <CodeJamControls
                          position={controlsConfig?.position}
                          computedTokens={controlsConfig?.computedTokens}
                          fragmentState={controlsConfig?.fragmentState}
                          isCodexFormat={controlsConfig?.isCodexFormat}
                          noOfBlocks={controlsConfig?.noOfBlocks}
                        />
                      )
                    case ConfigType.VIDEOJAM:
                      return (
                        <VideoJamControls
                          playing={controlsConfig?.playing}
                          videoElement={controlsConfig?.videoElement}
                          fragmentState={controlsConfig?.fragmentState}
                        />
                      )
                    case ConfigType.TRIVIA:
                      return (
                        <TriviaControls
                          fragmentState={controlsConfig?.fragmentState}
                        />
                      )
                    case ConfigType.POINTS:
                      return (
                        <PointsControls
                          fragmentState={controlsConfig?.fragmentState}
                          noOfPoints={controlsConfig?.noOfPoints}
                        />
                      )
                    default: {
                      return <></>
                    }
                  }
                })()}
                {fragment.type !== Fragment_Type_Enum_Enum.Intro &&
                  fragment.type !== Fragment_Type_Enum_Enum.Outro && (
                    <button
                      type="button"
                      disabled={
                        payload?.activeObjectIndex ===
                        studio.controlsConfig?.dataConfigLength - 1
                      }
                      onClick={() => {
                        updatePayload?.({
                          activeObjectIndex: payload?.activeObjectIndex + 1,
                        })
                      }}
                      className="mt-4"
                    >
                      <div
                        className={cx(
                          'flex py-10 px-16 bg-blue-400 items-center justify-center gap-x-2 rounded-md',
                          {
                            'opacity-50 cursor-not-allowed':
                              payload?.activeObjectIndex ===
                              studio.controlsConfig?.dataConfigLength - 1,
                          }
                        )}
                      >
                        <Text className="text-white ">
                          {payload?.activeObjectIndex !==
                          studio.controlsConfig?.dataConfigLength - 1
                            ? 'Next Item'
                            : 'Reached end of items'}
                        </Text>
                        {payload?.activeObjectIndex !==
                          studio.controlsConfig?.dataConfigLength - 1 && (
                          <FiArrowRight className="text-white " size={21} />
                        )}
                      </div>
                    </button>
                  )}
                {fragment.type === Fragment_Type_Enum_Enum.Outro &&
                  state === 'recording' && (
                    <button
                      type="button"
                      disabled={isButtonClicked}
                      onClick={() => {
                        setIsButtonClicked(true)
                        controlsConfig?.setFragmentState?.('customLayout')
                      }}
                      className="mt-4"
                    >
                      <div
                        className={cx(
                          'flex py-10 px-16 bg-blue-400 items-center justify-center gap-x-2 rounded-md',
                          {
                            'opacity-50 cursor-not-allowed': isButtonClicked,
                          }
                        )}
                      >
                        <Text className="text-white ">Next</Text>
                        <FiArrowRight className="text-white " size={21} />
                      </div>
                    </button>
                  )}
              </div>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className={!shortsMode ? 'w-8/12 rounded-md' : 'w-1/4 rounded-md'}
            controls
            controlsList="nodownload"
            ref={async (ref) => {
              if (!ref || !getBlobs) return
              const blob = await getBlobs()
              const url = window.URL.createObjectURL(blob)
              // eslint-disable-next-line no-param-reassign
              ref.src = url
            }}
          />
        )}
      </div>
    </div>
  )
}

export default StudioHoC
