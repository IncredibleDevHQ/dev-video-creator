/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import {
  createMicrophoneAndCameraTracks,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-react'
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AspectRatio from 'react-aspect-ratio'
import { BiErrorCircle, BiMicrophone, BiVideo } from 'react-icons/bi'
import { IoArrowBack, IoCheckmarkOutline } from 'react-icons/io5'
import { Group, Layer, Stage } from 'react-konva'
import { useHistory, useParams } from 'react-router-dom'
import useMeasure from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import { ReactComponent as ReRecordIcon } from '../../assets/ReRecord.svg'
import { ReactComponent as UploadIcon } from '../../assets/Upload.svg'
import {
  Button,
  dismissToast,
  emitToast,
  EmptyState,
  Heading,
  ScreenState,
  TextField,
  updateToast,
  Video,
} from '../../components'
import config from '../../config'
import { Images } from '../../constants'
import {
  FlickParticipantsFragment,
  Fragment_Status_Enum_Enum,
  GetFragmentByIdQuery,
  RecordedBlocksFragment,
  StudioFragmentFragment,
  useGetFragmentByIdLazyQuery,
  useGetRtcTokenMutation,
  useSaveRecordedBlockMutation,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { useUploadFile } from '../../hooks/use-upload-file'
import { User, userState } from '../../stores/user.store'
import { logEvent } from '../../utils/analytics'
import { PageEvent } from '../../utils/analytics-types'
import { TopLayerChildren, ViewConfig } from '../../utils/configTypes'
import { BrandingJSON } from '../Branding/BrandingPage'
import { EditorProvider } from '../Flick/components/EditorProvider'
import { TextEditorParser } from '../Flick/editor/utils/helpers'
import { Block, SimpleAST, useUtils } from '../Flick/editor/utils/utils'
import { Countdown, TimerModal } from './components'
import {
  CONFIG,
  GetTopLayerChildren,
  SHORTS_CONFIG,
} from './components/Concourse'
import Notes from './components/Notes'
import PermissionError from './components/PermissionError'
import Preload from './components/Preload'
import RecordingControlsBar from './components/RecordingControlsBar'
import UnifiedFragment from './effects/fragments/UnifiedFragment'
import { useAgora, useMediaStream } from './hooks'
import { loadFonts } from './hooks/use-load-font'
import { Device, MediaStreamError } from './hooks/use-media-stream'
import { useRTDB } from './hooks/use-rtdb'
import { StudioProviderProps, StudioState, studioStore } from './stores'

const noScrollBar = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const StudioHoC = () => {
  const [view, setView] = useState<'preview' | 'preload' | 'studio'>('preload')

  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const [isUserAllowed, setUserAllowed] = useState(false)

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
    setUserAllowed(
      !!data.Fragment[0]?.configuration?.speakers?.find(
        (speaker: any) => speaker.userSub === sub
      )
    )
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

  if (!isUserAllowed) {
    return (
      <ScreenState
        title="Permission Denied"
        subtitle="Please contact the owner to add you as the speaker of the flick"
      />
    )
  }

  if (view === 'preload' && fragment)
    return (
      <Preload
        fragment={fragment}
        setFragment={setFragment}
        setView={setView}
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
      <EditorProvider>
        <Studio
          data={data}
          studioFragment={fragment}
          branding={
            data?.Fragment?.[0].flick.useBranding
              ? data?.Fragment?.[0]?.flick.branding?.branding
              : null
          }
          devices={devices.current}
          liveStream={liveStream.current}
        />
      </EditorProvider>
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
            video: { deviceId: camera.id, aspectRatio: 4 / 3 },
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
            {data?.flick?.name || data?.name}
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
              if (camera) {
                setDevice('camera', camera)
                logEvent(PageEvent.ChangeCamera)
              }
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
              if (microphone) {
                logEvent(PageEvent.ChangeMicrophone)
                setDevice('microphone', microphone)
              }
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

const getIntegerHW = ({
  maxH,
  maxW,
  aspectRatio,
  isShorts,
}: {
  maxH: number
  maxW: number
  aspectRatio: number
  isShorts: boolean
}) => {
  let calWidth = 0
  let calHeight = 0
  if (aspectRatio > maxW / maxH) {
    calWidth = Math.floor(maxW - (!isShorts ? maxW % 16 : maxW % 9))
    calHeight = calWidth * (1 / aspectRatio)
  } else if (aspectRatio <= maxW / maxH) {
    calHeight = Math.floor(maxH - (!isShorts ? maxH % 9 : maxH % 16))
    calWidth = calHeight * aspectRatio
  }
  return { width: calWidth, height: calHeight }
}

const Studio = ({
  data,
  devices,
  liveStream,
  branding,
  studioFragment,
}: {
  data?: GetFragmentByIdQuery
  studioFragment: StudioFragmentFragment
  devices: { microphone: Device | null; camera: Device | null }
  liveStream?: {
    enabled: boolean
    url: string
  }
  branding?: BrandingJSON | null
}) => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const { constraints, theme, staticAssets, recordedBlocks } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const history = useHistory()

  const [saveBlock] = useSaveRecordedBlockMutation()

  const [uploadFile] = useUploadFile()

  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  const [shortsMode, setShortsMode] = useState(false)

  const [stageBoundingDivRef, bounds] = useMeasure()

  const [mountStage, setMountStage] = useState(false)

  const [isTimerModalOpen, setIsTimerModalOpen] = useState(true)
  const [timeLimit, setTimeLimit] = useState<number | undefined>()
  const [timeLimitOver, setTimeLimitOver] = useState(false)
  const [resetTimer, setResetTimer] = useState(false)

  const [currentBlock, setCurrentBlock] = useState<Block>()

  const [localRecordedBlocks, setLocalRecordedBlocks] = useState<
    RecordedBlocksFragment[] | undefined
  >(recordedBlocks)

  const { height: stageHeight, width: stageWidth } = getIntegerHW({
    maxH: bounds.height,
    maxW: bounds.width,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
    isShorts: shortsMode,
  })

  useEffect(() => {
    if (!stageWidth) return
    Konva.pixelRatio = (shortsMode ? 1080 : 1920) / stageWidth
    setMountStage(true)
  }, [stageWidth])

  const tracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(
    null
  )

  const [recordedVideoSrc, setRecordedVideoSrc] = useState<string>()

  useEffect(() => {
    if (!fragment) return
    const viewConfig: ViewConfig = fragment.configuration
    if (viewConfig?.mode === 'Portrait') {
      setShortsMode(true)
    } else {
      setShortsMode(false)
    }
  }, [fragment])

  const { ready, tracks, error } = createMicrophoneAndCameraTracks(
    {
      microphoneId: devices.microphone?.id,
    },
    { cameraId: devices.camera?.id, encoderConfig: '720p_6' }
  )()

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
            clearRecordedBlocks()
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
            clearRecordedBlocks()
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
    setFragment(studioFragment)
  }, [data, fragmentId])

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    return () => {
      leave()
      clearRecordedBlocks()
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
    stopRecording: stopCanvasRecording,
    reset: resetCanvas,
    getBlobs,
    addMusic,
    // reduceSplashAudioVolume,
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
    resetCanvas()
    init()
    setState('ready')
  }

  const updateRecordedBlocks = (blockId: string, newSrc: string) => {
    let updatedBlocks = studio?.recordedBlocks ? [...studio.recordedBlocks] : []
    const currentBlockIndex = studio?.recordedBlocks?.findIndex(
      (block) => block.id === blockId
    )
    console.log('Current Block Index = ', currentBlockIndex)

    if (currentBlockIndex === -1) {
      updatedBlocks = [
        ...updatedBlocks,
        {
          id: blockId,
          objectUrl: newSrc,
          updatedAt: Date.now().toLocaleString(),
        },
      ]
    } else if (currentBlockIndex !== undefined && currentBlockIndex >= 0) {
      updatedBlocks[currentBlockIndex] = {
        id: blockId,
        objectUrl: newSrc,
        updatedAt: Date.now().toLocaleString(),
      }
    }
    // setStudio({ ...studio, recordedBlocks: updatedBlocks })
    setLocalRecordedBlocks(updatedBlocks)
  }

  const upload = async (blockId: string) => {
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
      resetCanvas()
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

      // Once the block video is uploaded to s3 , save the block to the table
      await saveBlock({
        variables: {
          flickId: fragment?.flickId,
          fragmentId,
          recordingId: studio.recordingId,
          objectUrl: uuid,
          // TODO: Update creation meta and playbackDuration when implementing continuous recording
          blockId,
        },
      })

      updateRecordedBlocks(blockId, uuid)
      // after updating the recorded blocks set this state which triggers the useEffect to update studio store

      // update block url in store for preview once upload is done
      // setRecordedVideoSrc(`${config.storage.baseUrl}${uuid}`)

      dismissToast(toast)
    } catch (e) {
      console.error('Upload error : ', e)
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

    setResetTimer(false)

    // if (fragment?.configuration?.mode === 'Portrait') {
    //   addMusic({
    //     type: 'shorts',
    //     volume: 0.2,
    //     musicURL: staticAssets?.shortsBackgroundMusic,
    //     action: 'start',
    //   })
    // }

    if (state === 'ready' && payload?.activeObjectIndex === 0)
      setState('start-recording')
    else if (state === 'ready' && payload?.activeObjectIndex !== 0)
      setState('recording')
    else if (state === 'resumed' && payload?.activeObjectIndex === 0) {
      setState('start-recording')
    } else if (state === 'resumed' && payload?.activeObjectIndex !== 0) {
      setState('recording')
    }
  }

  // const finalTransition = () => {
  //   if (!payload) return
  //   payload.playing = false
  //   // updatePayload?.({ status: Fragment_Status_Enum_Enum.Ended })
  // }

  const stop = () => {
    console.log('stop')
    // addMusic({ volume: 0.01, action: 'modifyVolume' })
    stopCanvasRecording()
    // addMusic({ action: 'stop' })

    setState('preview')
  }

  // useEffect(() => {
  //   if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
  //     finalTransition()
  //   }
  // }, [payload])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      stop()
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
    })
  }, [fragment])

  useMemo(() => {
    if (!fragment) return
    setStudio({
      ...studio,
      stream: stream as MediaStream,
      startRecording: start,
      stopRecording: stop,
      addMusic,
      // reduceSplashAudioVolume,
      stopMusic,
      // reset: resetRecording,
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
      recordedBlocks: localRecordedBlocks,
      isHost:
        fragment?.participants.find(
          ({ participant }) => participant.userSub === sub
        )?.participant.owner || false,
    })
  }, [
    stream,
    users,
    state,
    userAudios,
    payload,
    participants,
    branding,
    localRecordedBlocks,
  ])

  useMemo(() => {
    if (fragment?.flick?.branding?.branding?.font)
      loadFonts([
        {
          family: fragment?.flick?.branding?.branding?.font?.heading?.family,
          weights: ['400'],
          type: fragment?.flick?.branding?.branding?.font?.heading?.type,
          url: fragment?.flick?.branding?.branding?.font?.heading?.url,
        },
        {
          family: fragment?.flick?.branding?.branding?.font?.body?.family,
          weights: ['400'],
          type: fragment?.flick?.branding?.branding?.font?.body?.type,
          url: fragment?.flick?.branding?.branding?.font?.body?.url,
        },
      ])
  }, [fragment?.flick?.branding?.branding?.font])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Live) {
      start()
    }
  }, [payload?.status])

  // const getNote = (activeObjectIndex: number | undefined) => {
  //   if (!fragment || activeObjectIndex === undefined) return ''
  //   const blocks = fragment.editorState?.blocks
  //   switch (blocks[activeObjectIndex].type) {
  //     case 'codeBlock':
  //       return (blocks[activeObjectIndex] as CodeBlockProps).codeBlock.note
  //     case 'videoBlock':
  //       return (blocks[activeObjectIndex] as VideoBlockProps).videoBlock.note
  //     case 'listBlock':
  //       return (blocks[activeObjectIndex] as ListBlockProps).listBlock.note
  //     case 'imageBlock':
  //       return (blocks[activeObjectIndex] as ImageBlockProps).imageBlock.note
  //     default:
  //       return ''
  //   }
  // }

  // state which stores the type of layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<{
    id: string
    state: TopLayerChildren
  }>({ id: '', state: '' })

  const utils = useUtils()

  const timelineRef = useRef<HTMLDivElement>(null)

  function isInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  useEffect(() => {
    const block = fragment?.editorState?.blocks?.[payload?.activeObjectIndex]

    if (!block) return

    setCurrentBlock(block)

    // check if block was already recorded and if so show the video preview
    const previouslyRecordedBlock = recordedBlocks?.find((b) => {
      return b.id === block.id
    })
    if (previouslyRecordedBlock) {
      setRecordedVideoSrc(
        `${config.storage.baseUrl}${previouslyRecordedBlock.objectUrl}`
      )
      setState('preview')
    }

    // update timeline
    const ele = document.getElementById(`timeline-block-${block.id}`)
    if (!ele) return
    if (!isInViewport(ele) && timelineRef.current) {
      let scrollAmount = 0
      const slideTimer = setInterval(() => {
        if (!timelineRef.current) return
        timelineRef.current.scrollLeft += 100
        scrollAmount += 100
        if (scrollAmount >= 1000) {
          window.clearInterval(slideTimer)
        }
      }, 25)
    }
  }, [payload?.activeObjectIndex])

  useEffect(() => {
    if (
      payload?.activeObjectIndex === undefined ||
      payload?.activeObjectIndex === 0 ||
      payload?.status !== Fragment_Status_Enum_Enum.Live
    )
      return
    stop()
  }, [payload?.activeObjectIndex]) // undefined -> defined

  const clearRecordedBlocks = () => {
    setStudio({ ...studio, recordedBlocks: [], recordingId: '' })
  }

  const prepareVideo = async () => {
    if (state === 'preview' && currentBlock) {
      console.log('Preparing video...')
      const blob = await getBlobs()
      const url = URL.createObjectURL(blob)
      setRecordedVideoSrc(url)
      console.log('Settng src to:', url)
      updateRecordedBlocks(currentBlock.id, url)
    }
    if (state !== 'preview' && state !== 'upload') {
      setRecordedVideoSrc(undefined)
    }
  }

  useEffect(() => {
    console.log('State changed to', state)
    prepareVideo()
  }, [state])

  // Set 0th index for the first block - first time recording
  useEffect(() => {
    if (!recordedBlocks || recordedBlocks.length < 1) {
      updatePayload({
        activeObjectIndex: 0,
      })
    }
  }, [recordedBlocks])

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

  const miniTimeline = (
    <div
      ref={timelineRef}
      style={{
        background: '#27272A',
      }}
      onWheel={(e) => {
        if (timelineRef.current) {
          timelineRef.current.scrollLeft += e.deltaY
        }
      }}
      className={cx(
        'mt-auto flex gap-x-4 px-6 py-3 overflow-x-scroll h-14',
        {
          'pointer-events-none':
            state === 'preview' && recordedBlocks && currentBlock
              ? recordedBlocks
                  ?.find((b) => b.id === currentBlock.id)
                  ?.objectUrl?.includes('blob') || false
              : false,
        },
        noScrollBar
      )}
    >
      {fragment?.editorState &&
        (fragment.editorState as SimpleAST).blocks.map((block, index) => {
          return (
            <button
              type="button"
              id={`timeline-block-${block.id}`}
              className={cx(
                'px-3 py-1.5 font-body cursor-pointer text-sm rounded-sm flex items-center justify-center transition-transform duration-500 bg-brand-grey relative text-gray-300 flex-shrink-0',
                {
                  'transform scale-110 border border-brand':
                    payload?.activeObjectIndex === index,
                  'bg-grey-900 text-gray-500':
                    index > payload?.activeObjectIndex,
                  'cursor-not-allowed': state === 'recording',

                  // state !== 'ready' || state !== 'preview',
                }
              )}
              onClick={() => {
                // TODO: if current block is recorded by isnt saved to the cloud or if the user has not intentionally pressed retake to discard the rec, show warning.

                const newSrc =
                  recordedBlocks && currentBlock
                    ? recordedBlocks?.find((b) => b.id === currentBlock.id)
                        ?.objectUrl || ''
                    : ''
                if (newSrc.includes('blob') && state === 'preview') return

                // checking if block already has recording
                const clickedBlock = recordedBlocks?.find((b) => {
                  return b.id === block.id
                })

                console.log('clickedBlock', clickedBlock)

                // when block was previously rec and uploaded and we have a url to show preview
                if (clickedBlock && clickedBlock.objectUrl) {
                  updatePayload({
                    activeObjectIndex: index,
                  })
                  setState('preview')
                } else {
                  // when the clicked block is not yet recorded.
                  updatePayload({
                    activeObjectIndex: index,
                  })
                  setState('resumed')
                }
              }}
            >
              {recordedBlocks
                ?.find((b) => b.id === block.id)
                ?.objectUrl?.includes('.webm') && (
                <div className="absolute top-0 right-0 rounded-tr-sm rounded-bl-sm bg-incredible-green-600">
                  <IoCheckmarkOutline className="m-px text-gray-200" size={8} />
                </div>
              )}
              <span>
                {utils.getBlockTitle(block).substring(0, 40) +
                  (utils.getBlockTitle(block).length > 40 ? '...' : '')}
              </span>
            </button>
          )
        })}
    </div>
  )

  return (
    <div
      style={{
        background: '#18181B',
      }}
      className="flex flex-col w-screen h-screen overflow-hidden"
    >
      {state === 'ready' ||
      state === 'resumed' ||
      state === 'recording' ||
      state === 'countDown' ||
      state === 'start-recording' ? (
        <>
          <Countdown />
          {/* Stage and notes */}
          <IoArrowBack
            size={18}
            type="button"
            className="max-w-max p-0 cursor-pointer text-white opacity-90 ml-8 mt-8"
            onClick={() =>
              history.length > 2
                ? history.goBack()
                : history.push(`/story/${fragment?.flickId}`)
            }
          />
          <div className="grid grid-cols-11 gap-x-12 flex-1 items-center px-8 pb-8">
            {/* Stage */}
            <div
              className="flex justify-center flex-1 col-span-8 w-full h-full relative"
              ref={stageBoundingDivRef}
            >
              <div
                className={cx(
                  'animate-pulse rounded-sm absolute',
                  {
                    'bg-transparent': !timeLimitOver,
                    'bg-red-600': timeLimitOver,
                  },
                  css`
                    width: ${layerRef.current
                      ? layerRef.current?.width() + 10
                      : 0}px;
                    height: ${layerRef.current
                      ? layerRef.current.height() + 10
                      : 0}px;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                  `
                )}
              />
              {mountStage &&
                (state === 'ready' ||
                  state === 'start-recording' ||
                  state === 'resumed' ||
                  state === 'recording' ||
                  state === 'countDown') && (
                  <Stage
                    ref={stageRef}
                    className="mt-auto mb-auto"
                    width={stageWidth}
                    height={stageHeight}
                    scale={{
                      x:
                        stageHeight /
                        (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
                      y:
                        stageWidth /
                        (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
                    }}
                  >
                    <Bridge>
                      <Layer ref={layerRef}>
                        {(() => {
                          if (fragment) {
                            return (
                              <Group>
                                <UnifiedFragment
                                  stageRef={stageRef}
                                  setTopLayerChildren={setTopLayerChildren}
                                  // layerRef={layerRef}
                                />
                                <GetTopLayerChildren
                                  key={topLayerChildren?.id}
                                  topLayerChildrenState={
                                    topLayerChildren?.state || ''
                                  }
                                  setTopLayerChildren={setTopLayerChildren}
                                  isShorts={shortsMode || false}
                                  status={payload?.status}
                                  theme={theme}
                                />
                              </Group>
                            )
                          }
                          return <></>
                        })()}
                      </Layer>
                    </Bridge>
                  </Stage>
                )}
              <RecordingControlsBar
                stageRef={stageRef}
                stageHeight={stageHeight}
                stageWidth={stageWidth}
                timeLimit={timeLimit}
                shortsMode={shortsMode}
                timeOver={() => setTimeLimitOver(true)}
                openTimerModal={() => setIsTimerModalOpen(true)}
                resetTimer={resetTimer}
              />
            </div>
            <Notes key={payload?.activeObjectIndex} stageHeight={stageHeight} />
          </div>
          {/* Mini timeline */}

          {miniTimeline}
        </>
      ) : (
        <>
          <div className="flex items-center justify-center flex-col gap-y-12 w-full h-full">
            {recordedBlocks && (
              <div
                style={{
                  height: '80vh',
                  width: shortsMode
                    ? `${window.innerHeight / 2.25}px`
                    : `${window.innerWidth / 1.5}px`,
                }}
                className="flex justify-center items-center w-full"
              >
                <Video
                  height="auto"
                  className="w-full"
                  controls
                  autoPlay={false}
                  type="blob"
                  src={(() => {
                    const newSrc =
                      recordedBlocks && currentBlock
                        ? recordedBlocks?.find((b) => b.id === currentBlock.id)
                            ?.objectUrl || ''
                        : ''
                    if (newSrc.includes('blob')) return newSrc
                    return `${config.storage.baseUrl}${newSrc}`
                  })()}
                  key={nanoid()}
                />
              </div>
            )}

            {state === 'preview' && (
              <div className="flex items-center rounded-md gap-x-4">
                {
                  // if block already has a recording dont show save button
                  recordedVideoSrc?.includes('blob') && (
                    <button
                      className="bg-green-600 border-green-600 text-white border rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-lg text-sm"
                      type="button"
                      onClick={() => {
                        logEvent(PageEvent.SaveRecording)
                        if (
                          payload.activeObjectIndex === undefined ||
                          !(payload.activeObjectIndex >= 0)
                        ) {
                          console.error('Invalid activeObjectIndex :', payload)
                          return
                        }

                        const isOutro =
                          payload?.activeObjectIndex ===
                          fragment?.editorState?.blocks.length - 1

                        // move on to next block
                        const p = {
                          ...payload,
                          activeObjectIndex: isOutro
                            ? payload.activeObjectIndex
                            : payload.activeObjectIndex + 1,
                        }

                        const blockId =
                          fragment?.editorState?.blocks[
                            payload.activeObjectIndex
                          ]?.id
                        if (
                          p.activeObjectIndex <
                          fragment?.editorState?.blocks.length - 1
                        ) {
                          p.status = Fragment_Status_Enum_Enum.Paused
                        } else {
                          p.status = Fragment_Status_Enum_Enum.Completed
                        }

                        updatePayload?.(p)
                        // start async upload and move on to next block
                        upload(blockId)
                        setState(isOutro ? 'preview' : 'resumed')
                        setResetTimer(true)
                      }}
                    >
                      <UploadIcon className="h-6 w-6 " />
                      Save and continue
                    </button>
                  )
                }
                <button
                  className="border-red-600 text-red-600 border rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-md text-sm"
                  type="button"
                  onClick={() => {
                    logEvent(PageEvent.Retake)
                    resetCanvas()
                    setTopLayerChildren?.({ id: nanoid(), state: '' })

                    if (recordedBlocks && currentBlock) {
                      console.warn('DELETING FOR RETAKE')
                      const copyRecordedBlocks = [...recordedBlocks]
                      const currentRecordedBlock =
                        copyRecordedBlocks?.findIndex(
                          (b) => b.id === currentBlock?.id
                        )
                      copyRecordedBlocks.splice(currentRecordedBlock, 1)
                      console.log('Local Rec Blocks', copyRecordedBlocks)
                      // setStudio({
                      //   ...studio,
                      //   recordedBlocks: copyRecordedBlocks,
                      // })
                      setLocalRecordedBlocks(copyRecordedBlocks)
                    }

                    const isCloudBlock = recordedBlocks?.find(
                      (b) =>
                        b.id ===
                        fragment.editorState.blocks[payload?.activeObjectIndex]
                          .id
                    )
                    if (isCloudBlock) {
                      // remove the cloud block from local store and allow retake of the cloud block
                      const updatedRecordedBlocks =
                        studio.recordedBlocks?.filter(
                          (b) => b.id !== isCloudBlock.id
                        )
                      // setStudio({
                      //   ...studio,
                      //   recordedBlocks: updatedRecordedBlocks,
                      // })
                      setLocalRecordedBlocks(updatedRecordedBlocks)
                    }
                    updatePayload?.({
                      status: Fragment_Status_Enum_Enum.Paused,
                      // decrement active object index on retake to repeat the current block
                      // also reset the block's element active index
                      activeObjectIndex:
                        // eslint-disable-next-line no-nested-ternary
                        payload.activeObjectIndex - 1 >= 0
                          ? isCloudBlock
                            ? payload.activeObjectIndex
                            : payload.activeObjectIndex - 1
                          : 0,
                    })
                    setState('resumed')
                    setResetTimer(true)
                  }}
                >
                  <ReRecordIcon className="h-6 w-6 " />
                  Retake
                </button>
              </div>
            )}
          </div>
          {miniTimeline}
        </>
      )}
      <TimerModal
        open={isTimerModalOpen}
        timeLimit={timeLimit}
        setTimeLimit={setTimeLimit}
        handleClose={() => setIsTimerModalOpen(false)}
      />
    </div>
  )
}

export default StudioHoC
