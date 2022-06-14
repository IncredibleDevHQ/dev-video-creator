/* eslint-disable no-console */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { createClient } from '@liveblocks/client'
import {
  LiveblocksProvider,
  RoomProvider,
  useMap,
  useUpdateMyPresence,
} from '@liveblocks/react'
import * as Sentry from '@sentry/react'
import {
  createMicrophoneAndCameraTracks,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-react'
import getBlobDuration from 'get-blob-duration'
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AspectRatio from 'react-aspect-ratio'
import { BiErrorCircle, BiMicrophone, BiVideo } from 'react-icons/bi'
import { FiRotateCcw } from 'react-icons/fi'
import { IoArrowBack, IoCheckmarkOutline } from 'react-icons/io5'
import { Group, Layer, Stage } from 'react-konva'
import { useHistory, useParams } from 'react-router-dom'
import useMeasure from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
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
} from '../../components'
import config from '../../config'
import { Images } from '../../constants'
import {
  FlickParticipantsFragment,
  Fragment_Status_Enum_Enum,
  GetFragmentByIdQuery,
  RecordedBlocksFragment,
  StudioFragmentFragment,
  useDeleteBlockGroupMutation,
  useGetFragmentByIdLazyQuery,
  useGetRtcTokenMutation,
  useSaveMultipleBlocksMutation,
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
import { Block, useUtils } from '../Flick/editor/utils/utils'
import { Presence, PresencePage } from '../Flick/Flick'
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

const client = createClient({
  publicApiKey: config.liveblocks.publicKey,
})

const LiveblocksRoomProvider = () => {
  const { sub, displayName, picture } =
    (useRecoilValue(userState) as User) || {}
  const { fragmentId, id } = useParams<{ id: string; fragmentId: string }>()
  const initialPresence: Presence = useMemo(() => {
    return {
      user: {
        id: sub as string,
        name: displayName as string,
        picture: picture as string,
      },
      page: PresencePage.Backstage,
      formatId: fragmentId as string,
      cursor: { x: 0, y: 0 },
      inHuddle: false,
    }
  }, [sub, displayName, picture])

  return (
    <LiveblocksProvider client={client}>
      <RoomProvider id={`story-${id}`} initialPresence={initialPresence}>
        <StudioHoC />
      </RoomProvider>
    </LiveblocksProvider>
  )
}

const StudioHoC = () => {
  const [view, setView] = useState<'preview' | 'preload' | 'studio'>('preload')

  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ id: string; fragmentId: string }>()

  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  const viewConfigLiveMap = useMap<string, ViewConfig>('viewConfig')
  useEffect(() => {
    if (viewConfigLiveMap && !viewConfig) {
      setViewConfig(viewConfigLiveMap?.get(fragmentId))
    }
  }, [viewConfig, viewConfigLiveMap])

  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const [isUserAllowed, setUserAllowed] = useState(false)

  const continuousRecordedBlockIds = useRef<
    { blockId: string; duration: number }[]
  >([])

  const addContinuousRecordedBlockIds = (blockId: string, duration: number) => {
    continuousRecordedBlockIds.current.push({ blockId, duration })
  }

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
    if (!viewConfig) return
    setUserAllowed(
      !!viewConfig.speakers?.find((speaker: any) => speaker.userSub === sub)
    )
  }, [viewConfig])

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

  if (!isUserAllowed && viewConfigLiveMap) {
    return (
      <ScreenState
        title="Permission Denied"
        subtitle="Please contact the owner to add you as the speaker of the flick"
      />
    )
  }

  if (view === 'preload' && fragment && viewConfig)
    return (
      <Preload
        fragment={{ ...fragment, configuration: viewConfig }}
        setFragment={setFragment}
        setView={setView}
      />
    )

  if (view === 'preview' && fragment && viewConfig)
    return (
      <Preview
        data={{ ...fragment, configuration: viewConfig }}
        handleJoin={({ microphone, camera, liveStream: ls }) => {
          devices.current = { microphone, camera }
          liveStream.current = ls
          setView('studio')
        }}
      />
    )

  if (view === 'studio' && fragment && viewConfig)
    return (
      <EditorProvider>
        <Studio
          data={data}
          studioFragment={{ ...fragment, configuration: viewConfig }}
          branding={
            data?.Fragment?.[0].flick.useBranding
              ? data?.Fragment?.[0]?.flick.branding?.branding
              : null
          }
          devices={devices.current}
          liveStream={liveStream.current}
          continuousRecordedBlockIds={continuousRecordedBlockIds.current}
          addContinuousRecordedBlockIds={addContinuousRecordedBlockIds}
        />
      </EditorProvider>
    )

  return <ScreenState loading />
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

  const history = useHistory()

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
      <IoArrowBack
        size={18}
        type="button"
        className="max-w-max p-0 cursor-pointer text-black opacity-90 mb-8 mr-auto"
        onClick={() =>
          history.length > 2
            ? history.goBack()
            : history.push(`/story/${data?.flickId}`)
        }
      />
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

export const getIntegerHW = ({
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
  continuousRecordedBlockIds,
  addContinuousRecordedBlockIds,
}: {
  data?: GetFragmentByIdQuery
  studioFragment: StudioFragmentFragment
  devices: { microphone: Device | null; camera: Device | null }
  liveStream?: {
    enabled: boolean
    url: string
  }
  branding?: BrandingJSON | null
  continuousRecordedBlockIds: { blockId: string; duration: number }[]
  addContinuousRecordedBlockIds: (blockId: string, duration: number) => void
}) => {
  const { fragmentId } = useParams<{ id: string; fragmentId: string }>()
  const { constraints, theme, recordedBlocks, isHost } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const [dataConfig, setDataConfig] = useState<Block[]>()
  const history = useHistory()

  const [saveBlock] = useSaveRecordedBlockMutation()
  const [saveMultiBlocks] = useSaveMultipleBlocksMutation()

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

  const [blockThumbnails, setBlockThumbnails] = useState<any>({})

  const [localRecordedBlocks, setLocalRecordedBlocks] = useState<
    RecordedBlocksFragment[] | undefined
  >(recordedBlocks)

  const [deleteBlockGroupMutation] = useDeleteBlockGroupMutation()

  const [confirmMultiBlockRetake, setConfirmMultiBlockRetake] = useState(false)

  const { height: stageHeight, width: stageWidth } = getIntegerHW({
    maxH: bounds.height,
    maxW: bounds.width,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
    isShorts: shortsMode,
  })

  // state which stores the type of layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<{
    id: string
    state: TopLayerChildren
  }>({ id: '', state: '' })

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
    {
      cameraId: devices.camera?.id,
      encoderConfig: {
        width: 960,
        height: 720,
        frameRate: 60,
        bitrateMax: 3000,
        bitrateMin: 2200,
      },
    }
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
            join(data?.RTCToken?.token, participantId as string, tracks)
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

  console.log(
    'stream',
    stream?.getVideoTracks()[0].getSettings().width,
    stream?.getVideoTracks()[0].getSettings().height,
    stream?.getVideoTracks()[0].getSettings().aspectRatio,
    stream?.getVideoTracks()[0].getSettings().frameRate
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
    if (fragment && tracks) {
      ;(async () => {
        init()
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          const participantId = (
            fragment?.configuration?.speakers as FlickParticipantsFragment[]
          ).find(({ userSub }) => userSub === sub)?.id
          if (participantId) {
            join(data?.RTCToken?.token, participantId as string, tracks)
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
  }, [fragment, tracks])

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
        preloadedBlobUrls: undefined,
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
      if (!uploadVideoFile) throw Error('Blobs is undefined')

      const duration = await getBlobDuration(uploadVideoFile)
      const { uuid: objectUrl } = await uploadFile({
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

      let blockThumbnail: string | null = null
      // Upload block thumbnail
      if (blockThumbnails[blockId]) {
        const thumbnailBlob = await fetch(blockThumbnails[blockId]).then((r) =>
          r.blob()
        )

        const { uuid } = await uploadFile({
          extension: 'png',
          file: thumbnailBlob,
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
        blockThumbnail = uuid
      }

      if (
        fragment?.configuration.continuousRecording &&
        continuousRecordedBlockIds
      ) {
        // if continuous recording is enabled, mark all the blocks that were recorded in the current take as saved
        continuousRecordedBlockIds.forEach((block) => {
          updateRecordedBlocks(block.blockId, objectUrl)
        })
        console.log('continuous recorded blocks:', continuousRecordedBlockIds)
        // save all continuous recorded blocks to hasura
        await saveMultiBlocks({
          variables: {
            blocks: continuousRecordedBlockIds.map((block) => ({
              blockId: block.blockId,
              duration: block.duration,
              thumbnail: blockThumbnail, // TODO: generate thumbnail for each block in continuous recording mode
            })),
            flickId: fragment?.flickId,
            fragmentId,
            recordingId: studio.recordingId,
            url: objectUrl,
          },
        })
        history.push(`/story/${fragment?.flickId}/${fragmentId}`)
      } else {
        // Once the block video is uploaded to s3 , save the block to the table
        await saveBlock({
          variables: {
            flickId: fragment?.flickId,
            fragmentId,
            recordingId: studio.recordingId,
            objectUrl,
            thumbnail: blockThumbnail,
            // TODO: Update creation meta and playbackDuration when implementing continuous recording
            blockId,
            playbackDuration: duration,
          },
        })
        updateRecordedBlocks(blockId, objectUrl)
      }
      // after updating the recorded blocks set this state which triggers the useEffect to update studio store

      // update block url in store for preview once upload is done
      // setRecordedVideoSrc(`${config.storage.baseUrl}${uuid}`)

      dismissToast(toast)
    } catch (e) {
      console.error('Upload error : ', e)
      Sentry.captureException(e)
      emitToast({
        title: 'Upload failed.',
        type: 'error',
        autoClose: false,
        description: 'Click here to retry before recording another block',
        onClick: () => upload(blockId),
      })
    }
  }

  const start = () => {
    const canvas = document
      .getElementsByClassName('konvajs-content')[0]
      .getElementsByTagName('canvas')[0]
    if (
      dataConfig &&
      dataConfig[payload.activeObjectIndex]?.type !== 'introBlock'
    )
      setTopLayerChildren({ id: nanoid(), state: 'transition moveAway' })
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

  const stop = () => {
    console.log('stop')

    const thumbnailURL = stageRef.current?.toDataURL()
    setBlockThumbnails((bts: any) => {
      if (currentBlock) {
        // eslint-disable-next-line no-param-reassign
        bts[currentBlock.id] = thumbnailURL
      }
      return bts
    })
    // TODO: update for continuous recording
    if (dataConfig?.[payload?.activeObjectIndex].type !== 'outroBlock')
      setTopLayerChildren({ id: nanoid(), state: 'transition moveIn' })
    else {
      stopCanvasRecording()
      setState('preview')
    }
    // addMusic({ volume: 0.01, action: 'modifyVolume' })
    // addMusic({ action: 'stop' })
  }

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      stop()
    }
  }, [payload?.status])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.NotStarted) {
      setState('ready')
    }
    if (
      !studio.isHost &&
      payload?.status === Fragment_Status_Enum_Enum.Completed
    ) {
      stream?.getTracks().forEach((track) => track.stop())
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
        fragment?.configuration?.speakers.find(
          (speaker: FlickParticipantsFragment) => speaker.userSub === sub
        )?.role === 'Host' || false,
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

  const updateMyPresence = useUpdateMyPresence<Presence>()
  useEffect(() => {
    if (
      state === 'recording' ||
      state === 'countDown' ||
      state === 'start-recording'
    ) {
      updateMyPresence({
        page: PresencePage.Recording,
      })
    } else {
      updateMyPresence({
        page: PresencePage.Backstage,
      })
    }
  }, [state])

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
    let block: Block | undefined

    if (!fragment?.configuration?.continuousRecording) {
      block = dataConfig?.[payload?.activeObjectIndex]
    } else {
      block = dataConfig?.[payload?.activeObjectIndex]
    }

    if (!block) return

    setCurrentBlock(block)

    // check if block was already recorded and if so show the video preview
    const previouslyRecordedBlock = recordedBlocks?.find((b) => {
      return b.id === block?.id
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
    if (!continuousRecordedBlockIds) stop()
  }, [payload?.activeObjectIndex]) // undefined -> defined

  useEffect(() => {
    if (!fragment) return
    if (fragment?.configuration.continuousRecording) {
      setDataConfig(
        fragment.editorState?.blocks.filter(
          (item: any) =>
            !!fragment.configuration.selectedBlocks.find(
              (blk: any) => blk.blockId === item.id
            )
        )
      )
    } else {
      setDataConfig(
        fragment.editorState?.blocks.filter(
          (b: any) => b.type !== 'interactionBlock'
        )
      )
    }
  }, [fragment])

  const clearRecordedBlocks = () => {
    setStudio({ ...studio, recordedBlocks: [], recordingId: '' })
  }

  const prepareVideo = async () => {
    const current = dataConfig?.[payload?.activeObjectIndex]

    if (
      state === 'preview' &&
      current &&
      !recordedBlocks?.find((b) => b.id === current.id)
    ) {
      console.log('Preparing video...')
      const blob = await getBlobs()

      if (!blob || blob?.size <= 0) {
        setState('resumed')
        emitToast({
          title: 'Something went wrong!',
          description: 'Could not produce the video :(',
          type: 'error',
        })
        Sentry.captureException(
          new Error(
            `Could not produce the video.Failed to get blobs when preparing video. ${JSON.stringify(
              {
                blobSize: blob?.size,
                user: sub,
                currentBlock: current,
              }
            )}`
          )
        )
        return
      }

      const url = URL.createObjectURL(blob)
      setRecordedVideoSrc(url)
      updateRecordedBlocks(current.id, url)
    }
    if (state !== 'preview' && state !== 'upload') {
      setRecordedVideoSrc(undefined)
    }
  }

  useEffect(() => {
    console.log('State changed to', state)
    prepareVideo()
  }, [state, payload?.activeObjectIndex])

  // Set 0th index for the first block - first time recording
  useEffect(() => {
    if (!recordedBlocks || recordedBlocks.length < 1) {
      updatePayload({
        activeObjectIndex: 0,
      })
    }
  }, [recordedBlocks])

  useEffect(() => {
    if (payload?.actionTriggered === '') return
    if (payload?.actionTriggered === 'Save and continue') {
      const isOutro =
        dataConfig?.[payload?.activeObjectIndex].type === 'outroBlock'
      setState(isOutro ? 'preview' : 'resumed')
      setResetTimer(true)
      updatePayload?.({
        actionTriggered: '',
      })
    }
    if (payload?.actionTriggered === 'Retake') {
      resetCanvas()
      setTopLayerChildren?.({ id: nanoid(), state: '' })

      if (recordedBlocks && currentBlock) {
        const currBlock = recordedBlocks.filter(
          (b) => b.id === currentBlock?.id
        )[0]
        let copyRecordedBlocks = [...recordedBlocks]
        copyRecordedBlocks = copyRecordedBlocks.filter(
          (blk) => blk.objectUrl !== currBlock.objectUrl
        )
        setLocalRecordedBlocks(copyRecordedBlocks)
      }

      setState('resumed')
      setResetTimer(true)
      updatePayload?.({
        actionTriggered: '',
      })
    }
    if (payload?.actionTriggered === 'RetakeMultipleBlocks') {
      resetCanvas()
      setTopLayerChildren?.({ id: nanoid(), state: '' })

      const currBlock = recordedBlocks?.filter(
        (b) => b.id === currentBlock?.id
      )[0]
      // remove all copies of currBlock.objectUrl from local state
      const updatedBlockList = recordedBlocks?.filter(
        (blk) => blk.objectUrl !== currBlock?.objectUrl
      )
      setLocalRecordedBlocks(updatedBlockList)

      setState('resumed')
      setResetTimer(true)
      updatePayload?.({
        actionTriggered: '',
      })
    }
  }, [payload?.actionTriggered])

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
      {dataConfig
        ?.filter((item) => {
          if (fragment.configuration.continuousRecording) {
            return !!fragment.configuration?.selectedBlocks.find(
              (blk: any) => blk.blockId === item.id
            )
          }
          return true
        })
        .map((block, index) => {
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
                    index !== payload?.activeObjectIndex,
                  'cursor-not-allowed':
                    state === 'recording' ||
                    state === 'start-recording' ||
                    (recordedBlocks
                      ?.find((b) => b?.id === currentBlock?.id)
                      ?.objectUrl?.includes('blob') &&
                      state === 'preview'),

                  // state !== 'ready' || state !== 'preview',
                }
              )}
              onClick={() => {
                if (!isHost) return
                // if continuous recording is enabled, disable mini-timeline onclick
                if (
                  studio.continuousRecording &&
                  (state === 'recording' ||
                    state === 'start-recording' ||
                    state === 'preview')
                ) {
                  return
                }
                // maybe this is not the best thing to do , can actually be a feature.

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

                updatePayload({
                  activeObjectIndex: index,
                })

                console.log('clickedBlock', clickedBlock)

                // when block was previously rec and uploaded and we have a url to show preview
                if (clickedBlock && clickedBlock.objectUrl) {
                  setState('preview')
                } else {
                  // when the clicked block is not yet recorded.
                  setState('resumed')
                }
              }}
            >
              {localRecordedBlocks
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
                    'bg-red-600':
                      timeLimitOver &&
                      (state === 'recording' || state === 'start-recording'),
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
                    width={stageWidth || 1}
                    height={stageHeight || 1}
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
                                  theme={theme}
                                  transitionSettings={{
                                    blockTransition:
                                      fragment?.flick?.configuration
                                        ?.transitions?.blockTransition?.name,
                                    swapTransition:
                                      fragment?.flick?.configuration
                                        ?.transitions?.swapTransition?.name,
                                  }}
                                  performFinishAction={() => {
                                    stopCanvasRecording()
                                    setState('preview')
                                  }}
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
              {isHost && (
                <RecordingControlsBar
                  stageRef={stageRef}
                  stageHeight={stageHeight}
                  stageWidth={stageWidth}
                  timeLimit={timeLimit}
                  shortsMode={shortsMode}
                  timeOver={() => setTimeLimitOver(true)}
                  openTimerModal={() => setIsTimerModalOpen(true)}
                  resetTimer={resetTimer}
                  currentBlock={currentBlock}
                  addContinuousRecordedBlockIds={addContinuousRecordedBlockIds}
                />
              )}
            </div>
            <Notes key={payload?.activeObjectIndex} stageHeight={stageHeight} />
          </div>
          {/* Mini timeline */}

          {miniTimeline}
        </>
      ) : (
        <div className="flex flex-col h-full">
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
          <div className="flex items-center justify-center flex-col w-full flex-1 pt-4">
            {recordedBlocks && (
              <div
                style={{
                  height: '80vh',
                  width: shortsMode
                    ? `${window.innerHeight / 2.25}px`
                    : `${window.innerWidth / 1.5}px`,
                }}
                className="flex justify-center items-center w-full flex-col"
              >
                <video
                  height="auto"
                  className="w-full"
                  controls
                  autoPlay={false}
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
                {(state === 'preview' || state === 'upload') && isHost && (
                  <div
                    style={
                      recordedVideoSrc?.includes('blob')
                        ? {
                            background: 'rgba(39, 39, 42, 0.5)',
                            border: '0.5px solid #52525B',
                            boxSizing: 'border-box',
                            backdropFilter: 'blur(40px)',
                            borderRadius: '4px',
                          }
                        : {}
                    }
                    className="flex items-center rounded-md gap-x-2 mt-2 z-10 p-2 px-3"
                  >
                    {
                      // if block already has a recording dont show save button
                      recordedVideoSrc?.includes('blob') && (
                        <button
                          className="bg-incredible-green-600 text-white rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-lg text-sm"
                          type="button"
                          onClick={() => {
                            logEvent(PageEvent.SaveRecording)
                            if (
                              payload.activeObjectIndex === undefined ||
                              !(payload.activeObjectIndex >= 0)
                            ) {
                              console.error(
                                'Invalid activeObjectIndex :',
                                payload
                              )
                              return
                            }

                            const isOutro =
                              dataConfig?.[payload?.activeObjectIndex].type ===
                              'outroBlock'

                            // move on to next block
                            const p = {
                              ...payload,
                              // eslint-disable-next-line no-nested-ternary
                              activeObjectIndex: isOutro
                                ? 0
                                : fragment.configuration.continuousRecording // if not outro check if its continuous recording , if not move on to next block
                                ? payload.activeObjectIndex
                                : payload.activeObjectIndex + 1,
                            }

                            const blockId =
                              dataConfig?.[payload.activeObjectIndex]?.id
                            if (
                              dataConfig &&
                              p.activeObjectIndex < dataConfig.length - 1
                            ) {
                              p.status = Fragment_Status_Enum_Enum.Paused
                            } else {
                              p.status = Fragment_Status_Enum_Enum.Completed
                            }
                            p.actionTriggered = 'Save and continue'

                            updatePayload?.(p)
                            // start async upload and move on to next block
                            if (blockId) upload(blockId)
                            else {
                              emitToast({
                                title: 'Something went wrong!',
                                type: 'error',
                                description: 'Please try again later',
                              })
                              Sentry.captureException(
                                new Error('No blockId in upload')
                              )
                            }
                            // setState(isOutro ? 'preview' : 'resumed')
                            // setResetTimer(true)
                          }}
                        >
                          <UploadIcon className="h-5 w-5 my-px" />
                          Save and continue
                        </button>
                      )
                    }
                    <button
                      className="bg-grey-500 text-white rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-md text-sm"
                      type="button"
                      onClick={() => {
                        logEvent(PageEvent.Retake)
                        // resetCanvas()
                        // setTopLayerChildren?.({ id: nanoid(), state: '' })

                        // if currentBlock.id is in recordedBlocks
                        const currBlock = recordedBlocks.filter(
                          (b) => b.id === currentBlock?.id
                        )[0]
                        if (currBlock?.objectUrl) {
                          // if found in recordedBlocks, find if webm is duplicate (meaning its part of continuous recording)
                          const isDuplicate =
                            recordedBlocks.filter(
                              (blk) => blk.objectUrl === currBlock.objectUrl
                            ).length > 1

                          // this if handles the case when the retake button is clicked on a block that is part of continuous recording
                          if (isDuplicate) {
                            // call action to delete all blocks with currBlock.objectUrl
                            if (!confirmMultiBlockRetake) {
                              emitToast({
                                title: 'Are you sure?',
                                type: 'warning',
                                description:
                                  'You are about to delete the recordings of all blocks that were recorded continuously along with this block. This action cannot be undone. If you would like to continue press retake again.',
                              })
                              setConfirmMultiBlockRetake(true)
                              // return
                              // eslint-disable-next-line no-else-return
                            } else {
                              deleteBlockGroupMutation({
                                variables: {
                                  objectUrl: currBlock.objectUrl,
                                  recordingId: studio.recordingId,
                                },
                              })
                              setConfirmMultiBlockRetake(false)

                              updatePayload?.({
                                actionTriggered: 'RetakeMultipleBlocks',
                              })

                              // // remove all copies of currBlock.objectUrl from local state
                              // const updatedBlockList = recordedBlocks.filter(
                              //   (blk) => blk.objectUrl !== currBlock.objectUrl
                              // )
                              // console.log(
                              //   'Removing blks with obj = ',
                              //   currBlock.objectUrl
                              // )
                              // console.log(
                              //   'UpdatedBlockList = ',
                              //   updatedBlockList
                              // )
                              // setLocalRecordedBlocks(updatedBlockList)
                            }
                          } else {
                            // if (recordedBlocks && currentBlock) {
                            //   let copyRecordedBlocks = [...recordedBlocks]
                            //   // const currentRecordedBlock =
                            //   //   copyRecordedBlocks?.findIndex(
                            //   //     (b) => b.id === currentBlock?.id
                            //   //   )
                            //   // copyRecordedBlocks.splice(currentRecordedBlock, 1)

                            //   // remove prev-recorded/continuously-recorded blocks with the same objectURL as the current block object url
                            //   copyRecordedBlocks = copyRecordedBlocks.filter(
                            //     (blk) => blk.objectUrl !== currBlock.objectUrl
                            //   )
                            //   setLocalRecordedBlocks(copyRecordedBlocks)
                            // }

                            const isCloudBlock = recordedBlocks?.find(
                              (b) =>
                                b.id ===
                                dataConfig?.[payload?.activeObjectIndex].id
                            )

                            // if (isCloudBlock) {
                            //   // remove the cloud block from local store and allow retake of the cloud block
                            //   const updatedRecordedBlocks =
                            //     studio.recordedBlocks?.filter(
                            //       (b) => b.id !== isCloudBlock.id
                            //     )
                            //   setLocalRecordedBlocks(updatedRecordedBlocks)
                            // }
                            updatePayload?.({
                              status: Fragment_Status_Enum_Enum.Paused,
                              actionTriggered: 'Retake',
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
                          }
                        }

                        // setState('resumed')
                        // setResetTimer(true)
                      }}
                    >
                      <FiRotateCcw className="h-4 w-4 my-1" />
                      Retake
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {miniTimeline}
        </div>
      )}
      <TimerModal
        open={isTimerModalOpen && (state === 'resumed' || state === 'ready')}
        timeLimit={timeLimit}
        setTimeLimit={setTimeLimit}
        handleClose={() => setIsTimerModalOpen(false)}
      />
    </div>
  )
}

export default LiveblocksRoomProvider
