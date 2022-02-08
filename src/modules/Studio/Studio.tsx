/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import {
  createMicrophoneAndCameraTracks,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-react'
import getBlobDuration from 'get-blob-duration'
import Konva from 'konva'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AspectRatio from 'react-aspect-ratio'
import { BiErrorCircle, BiMicrophone, BiVideo } from 'react-icons/bi'
import { FiArrowRight } from 'react-icons/fi'
import { IoChevronBack } from 'react-icons/io5'
import { Layer, Stage } from 'react-konva'
import { useHistory, useParams } from 'react-router-dom'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import {
  Button,
  dismissToast,
  emitToast,
  EmptyState,
  Heading,
  ScreenState,
  Text,
  TextField,
  updateToast,
} from '../../components'
import { Images } from '../../constants'
import {
  FlickParticipantsFragment,
  Fragment_Status_Enum_Enum,
  GetFragmentByIdQuery,
  StudioFragmentFragment,
  useGetFragmentByIdLazyQuery,
  useGetRtcTokenMutation,
  useMarkFragmentCompletedMutation,
  useUpdateFragmentShortMutation,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { useUploadFile } from '../../hooks/use-upload-file'
import { User, userState } from '../../stores/user.store'
import { ViewConfig } from '../../utils/configTypes'
import { BrandingJSON } from '../Branding/BrandingPage'
import { TextEditorParser } from '../Flick/editor/utils/helpers'
import {
  CodeBlock,
  CodeBlockProps,
  ImageBlockProps,
  ListBlock,
  ListBlockProps,
  VideoBlockProps,
} from '../Flick/editor/utils/utils'
import { Countdown } from './components'
import { CONFIG, SHORTS_CONFIG } from './components/Concourse'
import {
  CodeJamControls,
  PointsControls,
  TriviaControls,
  VideoJamControls,
} from './components/Controls'
import PermissionError from './components/PermissionError'
import RecordingControlsBar from './components/RecordingControlsBar'
import UnifiedFragment from './effects/fragments/UnifiedFragment'
import { useAgora, useMediaStream } from './hooks'
import { Device, MediaStreamError } from './hooks/use-media-stream'
import { useRTDB } from './hooks/use-rtdb'
import { StudioProviderProps, StudioState, studioStore } from './stores'

const StudioHoC = () => {
  const [view, setView] = useState<'preview' | 'studio'>('preview')

  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const [fragment, setFragment] = useState<StudioFragmentFragment>()

  const devices = useRef<{ microphone: Device | null; camera: Device | null }>({
    camera: null,
    microphone: null,
  })

  const liveStream = useRef<
    | {
        enabled: boolean
        url: string
      }
    | undefined
  >()

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

  useEffect(() => {
    if (!data) return
    setFragment(data.Fragment?.[0])

    if (!new TextEditorParser(data.Fragment[0].editorState).isValid()) {
      setError('INVALID_AST')
    }
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy..." loading />

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
        handleJoin={({ microphone, camera, liveStream: ls }) => {
          devices.current = { microphone, camera }
          liveStream.current = ls
          setView('studio')
        }}
      />
    )
  if (view === 'studio' && fragment)
    return (
      <Studio
        data={data}
        branding={
          data?.Fragment?.[0].flick.useBranding
            ? data?.Fragment?.[0]?.flick.branding?.branding
            : null
        }
        devices={devices.current}
        liveStream={liveStream.current}
      />
    )

  return null
}

const Preview = ({
  data,
  handleJoin,
}: {
  data?: StudioFragmentFragment
  handleJoin: (props: {
    microphone: Device | null
    camera: Device | null
    liveStream: {
      enabled: boolean
      url: string
    }
  }) => void
}) => {
  const {
    camera,
    permissions,
    devices,
    error,
    microphone,
    ready,
    setDevice,
    setError,
  } = useMediaStream()

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(
    null
  )

  const [liveStream, setLiveStream] = useState({
    enabled: false,
    url: '',
  })

  const videoRef = useRef<HTMLVideoElement>(null)

  const videoCSS = css`
    transform: rotateY(180deg);
    width: 100%;
    height: auto;
  `

  useEffect(() => {
    const setter = async () => {
      try {
        if (camera?.id) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: camera.id, aspectRatio: { ideal: 16 / 9 } },
          })

          setCameraStream(stream)
          setError((err) => ({ ...err, camera: null }))
        }
      } catch (e) {
        const error = e as unknown as MediaStreamError
        setError((err) => ({ ...err, camera: error }))
      }
    }

    setter()
  }, [camera])

  useEffect(() => {
    const lsCamera = localStorage.getItem('preferred-camera')
    const preferredCamera = lsCamera
      ? devices.videoDevices.find(({ id }) => lsCamera === id)
      : null
    setDevice('camera', preferredCamera || devices.videoDevices?.[0] || null)

    const lsMicrophone = localStorage.getItem('preferred-microphone')
    const preferredMicrophone = lsMicrophone
      ? devices.audioDevices.find(({ id }) => lsMicrophone === id)
      : null
    setDevice(
      'microphone',
      preferredMicrophone || devices.audioDevices?.[0] || null
    )
  }, [ready])

  useEffect(() => {
    const setter = async () => {
      try {
        if (microphone?.id) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: microphone.id },
          })

          setMicrophoneStream(stream)
          setError((err) => ({ ...err, microphone: null }))
        }
      } catch (e) {
        const error = e as unknown as MediaStreamError

        setError((err) => ({ ...err, microphone: error }))
      }
    }

    setter()
  }, [microphone])

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream

      videoRef.current.play()
    }

    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraStream])

  useEffect(() => {
    return () => {
      microphoneStream?.getTracks().forEach((track) => track.stop())
    }
  }, [microphoneStream])

  const join = () => {
    if (camera?.id) localStorage.setItem('preferred-camera', camera.id)
    if (microphone?.id)
      localStorage.setItem('preferred-microphone', microphone.id)

    handleJoin({ microphone, camera, liveStream })
  }

  if (permissions.camera === 'prompt') {
    return (
      <PermissionError
        heading={<>Camera permission is required</>}
        description={
          <>
            Chrome needs permission to get access to your 📷 camera. Please
            click <b>Allow</b> to continue.
          </>
        }
        icon={BiVideo}
        image={Images.askCameraPermission}
      />
    )
  }

  if (permissions.microphone === 'prompt') {
    return (
      <PermissionError
        heading={<>Microphone permission is required</>}
        description={
          <>
            Chrome needs permission to get access to your 🎙microphone. Please
            click <b>Allow</b> to continue.
          </>
        }
        icon={BiMicrophone}
        image={Images.askMicrophonePermission}
      />
    )
  }

  if (permissions.camera === 'denied') {
    return (
      <PermissionError
        heading={<>Looks like you&apos;ve denied access to camera 😲</>}
        description={
          <>
            To start recording, click 🔒 lock icon next to incredible.dev on the
            URL bar and <b>turn on</b> the toggle to allow camera.
          </>
        }
        icon={BiVideo}
        button={<>Reload</>}
        handleClick={() => window.location.reload()}
        byline={
          <>
            Once you grant permission, <b>Reload</b>.
          </>
        }
        image={Images.allowCameraPermission}
      />
    )
  }

  if (permissions.microphone === 'denied') {
    return (
      <PermissionError
        heading={<>Looks like you&apos;ve denied access to microphone 😲</>}
        description={
          <>
            To start recording, click 🔒 lock icon next to incredible.dev on the
            URL bar and <b>turn on</b> the toggle to allow microphone.
          </>
        }
        icon={BiMicrophone}
        button={<>Reload</>}
        handleClick={() => window.location.reload()}
        byline={
          <>
            Once you grant permission, <b>Reload</b>.
          </>
        }
        image={Images.allowMicrophonePermission}
      />
    )
  }

  if (error.camera || error.microphone) {
    return (
      <PermissionError
        heading={<>Oops</>}
        description={
          <>
            Something went wrong while trying to get access to your{' '}
            {error.camera ? 'camera' : 'microphone'} device.
          </>
        }
        icon={BiErrorCircle}
        byline={
          <>
            Error code:{' '}
            <b> {error.camera ? error.camera.name : error.microphone?.name}</b>.
          </>
        }
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen p-8">
      <div className="grid w-full grid-cols-5 gap-x-8">
        <div className="col-span-3">
          <div className="relative">
            <AspectRatio
              ratio="16/9"
              className="overflow-hidden bg-gray-800 rounded-lg"
            >
              {/* using video tag because agora player failed due to updates */}
              <video className={videoCSS} ref={videoRef} />
            </AspectRatio>
          </div>
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
            value={camera?.id}
            onChange={(e) => {
              const camera = devices.videoDevices.find(
                (device) => device.id === e.target.value
              )
              if (camera) setDevice('camera', camera)
            }}
          >
            {devices.videoDevices.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>

          <Heading fontSize="extra-small" className="uppercase">
            Microphone
          </Heading>
          <select
            className="w-full p-2 mb-4 border border-gray-300 rounded-md"
            value={microphone?.id}
            onChange={(e) => {
              const microphone = devices.audioDevices.find(
                (device) => device.id === e.target.value
              )
              if (microphone) setDevice('microphone', microphone)
            }}
          >
            {devices.audioDevices.map((microphone) => (
              <option key={microphone.id} value={microphone.id}>
                {microphone.label}
              </option>
            ))}
          </select>

          <div className="mb-4">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="inline-flex items-center mb-2">
              <input
                type="checkbox"
                className="w-5 h-5 text-green-600 cursor-pointer form-checkbox"
                checked={liveStream.enabled}
                onChange={() => {
                  setLiveStream((ls) => ({
                    ...ls,
                    enabled: !ls.enabled,
                  }))
                }}
              />
              <span className="ml-2 text-gray-700">This is a live stream</span>
            </label>
            {liveStream.enabled && (
              <TextField
                onChange={(e: any) => {
                  setLiveStream((ls) => ({
                    ...ls,
                    url: e.target.value,
                  }))
                }}
                value={liveStream.url}
                placeholder="rtmp://rtmpin.livestreamingest.com/rtmpin"
              />
            )}
          </div>

          <Button
            className="self-start"
            size="small"
            appearance="primary"
            type="button"
            onClick={join}
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
  devices,
  liveStream,
  branding,
}: {
  data?: GetFragmentByIdQuery
  devices: { microphone: Device | null; camera: Device | null }
  liveStream?: {
    enabled: boolean
    url: string
  }
  branding?: BrandingJSON | null
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

  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()
  Konva.pixelRatio = 2

  // const { isFontLoaded } = useLoadFont(
  //   branding?.font
  //     ? [
  //         {
  //           family: branding?.font.heading?.family as string,
  //           weights: ['400', '700', '500'],
  //         },
  //         {
  //           family: branding?.font.body?.family as string,
  //           weights: ['400', '700', '500'],
  //         },
  //       ]
  //     : []
  // )

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  const [shortsMode, setShortsMode] = useState(false)

  const tracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(
    null
  )

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

  const { ready, tracks, error } = createMicrophoneAndCameraTracks(
    {
      microphoneId: devices.microphone?.id,
    },
    { cameraId: devices.camera?.id }
  )()

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
          const participantId = (
            fragment?.configuration?.speakers as FlickParticipantsFragment[]
          ).find(({ userSub }) => userSub === sub)?.id
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
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    return () => {
      leave()
      tracksRef.current?.forEach((track) => track.close())
      setFragment(undefined)
      setStudio({
        ...studio,
        fragment: undefined,
        tracks,
      })
      updatePayload?.({ status: Fragment_Status_Enum_Enum.NotStarted })
      stopStreaming()
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
    stopStreaming,
  } = useCanvasRecorder({
    liveStreamEnabled: liveStream?.enabled,
    liveStreamUrl: liveStream?.url,
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
    // updatePayload?.({ status: Fragment_Status_Enum_Enum.Ended })
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
      branding: fragment.flick.branding ? branding : null,
      theme: fragment.flick.theme,
      participantId: fragment?.participants.find(
        ({ participant }) => participant.userSub === sub
      )?.participant.id,
      isHost:
        fragment?.participants.find(
          ({ participant }) => participant.userSub === sub
        )?.participant.owner || false,
    })
  }, [
    fragment,
    stream,
    users,
    state,
    userAudios,
    payload,
    participants,
    state,
    branding,
  ])

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

  if (error)
    return (
      <ScreenState title="Something went wrong." subtitle={error.message} />
    )

  if (!ready) return <ScreenState loading />

  return (
    <div className="w-full h-screen">
      {/* Bottom bar with details and global controls */}
      <div className="fixed top-0 z-20 flex justify-center w-full px-10 py-4 bg-gray-50">
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
        <RecordingControlsBar />
      </div>
      {/* Studio or Video , Notes and layout controls */}
      <div className="h-screen px-10 pt-16">
        <Countdown />
        {state === 'ready' || state === 'recording' || state === 'countDown' ? (
          <div className="flex items-center w-full h-full mt-3 gap-x-8">
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
                      return (
                        <UnifiedFragment
                          stageRef={stageRef}
                          // layerRef={layerRef}
                        />
                      )
                    }
                    return <></>
                  })()}
                </Layer>
              </Bridge>
            </Stage>
            <div
              className={cx(
                'flex-1 flex flex-col justify-end h-full mb-24 overflow-y-auto',
                {
                  'my-12': shortsMode,
                }
              )}
            >
              {/* Notes */}
              <div className="overflow-y-auto">
                <Text className="text-gray-800 truncate whitespace-pre-wrap">
                  {getNote(payload?.activeObjectIndex)}
                </Text>
              </div>
              <div className="flex flex-col items-start justify-end flex-1">
                {(() => {
                  switch (
                    fragment?.editorState?.blocks[
                      payload?.activeObjectIndex || 0
                    ]?.type
                  ) {
                    case 'codeBlock': {
                      const codeBlockProps = fragment?.editorState?.blocks[
                        payload?.activeObjectIndex || 0
                      ]?.codeBlock as CodeBlock
                      return (
                        <CodeJamControls
                          position={controlsConfig?.position}
                          computedTokens={controlsConfig?.computedTokens}
                          fragmentState={payload?.fragmentState}
                          isCodexFormat={codeBlockProps.isAutomated || false}
                          noOfBlocks={
                            (codeBlockProps.explanations?.length || 0) + 1
                          }
                        />
                      )
                    }
                    case 'videoBlock':
                      return (
                        <VideoJamControls
                          playing={controlsConfig?.playing}
                          videoElement={controlsConfig?.videoElement}
                          fragmentState={payload?.fragmentState}
                        />
                      )
                    case 'imageBlock':
                      return (
                        <TriviaControls
                          fragmentState={payload?.fragmentState}
                        />
                      )
                    case 'listBlock': {
                      const listBlockProps = fragment?.editorState?.blocks[
                        payload?.activeObjectIndex || 0
                      ]?.listBlock as ListBlock
                      return (
                        <PointsControls
                          fragmentState={payload?.fragmentState}
                          noOfPoints={listBlockProps?.list?.length || 0}
                        />
                      )
                    }
                    default: {
                      return <></>
                    }
                  }
                })()}
                {/* next item button */}
                <button
                  type="button"
                  disabled={
                    payload?.activeObjectIndex ===
                    fragment.editorState?.blocks.length - 1
                  }
                  onClick={() => {
                    if (
                      fragment?.editorState?.blocks[
                        payload?.activeObjectIndex || 0
                      ]?.type === 'introBlock'
                    ) {
                      if (
                        payload?.activeIntroIndex ===
                        (branding && branding?.introVideoUrl ? 2 : 1)
                      ) {
                        updatePayload?.({
                          activeObjectIndex: payload?.activeObjectIndex + 1,
                        })
                      } else {
                        updatePayload?.({
                          activeIntroIndex: payload?.activeIntroIndex + 1,
                        })
                      }
                    } else {
                      updatePayload?.({
                        activeObjectIndex: payload?.activeObjectIndex + 1,
                      })
                    }
                  }}
                  className="mt-4"
                >
                  <div
                    className={cx(
                      'flex py-10 px-16 bg-blue-400 items-center justify-center gap-x-2 rounded-md',
                      {
                        'opacity-50 cursor-not-allowed':
                          payload?.activeObjectIndex ===
                          fragment.editorState?.blocks.length - 1,
                      }
                    )}
                  >
                    <Text className="text-white ">
                      {payload?.activeObjectIndex !==
                      fragment.editorState?.blocks.length - 1
                        ? 'Next Item'
                        : 'Reached end of items'}
                    </Text>
                    {payload?.activeObjectIndex !==
                      fragment.editorState?.blocks.length - 1 && (
                      <FiArrowRight className="text-white " size={21} />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className={
              !shortsMode ? 'w-8/12 mt-24 rounded-md' : 'w-1/4 mt-16 rounded-md'
            }
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
