/* eslint-disable no-console */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { Dialog, Switch } from '@headlessui/react'
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
import { HiOutlinePencilAlt } from 'react-icons/hi'
import { IoArrowBack, IoSettingsOutline } from 'react-icons/io5'
import { Group, Layer, Stage } from 'react-konva'
import Modal from 'react-responsive-modal'
import { useHistory, useParams } from 'react-router-dom'
import useMeasure from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
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
  updateToast,
} from '../../components'
import config from '../../config'
import { Images } from '../../constants'
import {
  FlickParticipantsFragment,
  Fragment_Status_Enum_Enum,
  RecordedBlocksFragment,
  StudioFragmentFragment,
  useGetFragmentByIdLazyQuery,
  useGetRtcTokenMutation,
  useSaveRecordedBlockMutation,
} from '../../generated/graphql'
import { useCanvasRecorder, useUploadFile } from '../../hooks'
import useQuery from '../../hooks/use-query'
import { User, userState } from '../../stores/user.store'
import { logEvent } from '../../utils/analytics'
import { PageEvent } from '../../utils/analytics-types'
import { BlockProperties, TopLayerChildren } from '../../utils/configTypes'
import { EditorProvider } from '../Flick/components/EditorProvider'
import { TextEditorParser } from '../Flick/editor/utils/helpers'
import { Block, SimpleAST, VideoBlockProps } from '../Flick/editor/utils/utils'
import { TimerModal } from '../Studio/components'
import { CONFIG, GetTopLayerChildren } from '../Studio/components/Concourse'
import PermissionError from '../Studio/components/PermissionError'
import { FragmentState } from '../Studio/components/RenderTokens'
import { useAgora } from '../Studio/hooks'
import useMediaStream, {
  Device,
  MediaStreamError,
} from '../Studio/hooks/use-media-stream'
import { useRTDB } from '../Studio/hooks/use-rtdb'
import { StudioState } from '../Studio/stores'
import { getIntegerHW } from '../Studio/Studio'
import Countdown from './Countdown'
import FastRecord from './FastRecord'
import MiniTimeline from './MiniTimeline'
import Notes from './Notes'
import Preferences from './Preferences'
import Preload from './Preload'
import Publish from './Publish'
import RecordingControlsBar from './RecordingControlsBar'
import VideoFragment from './ScreenRecordingVideoFragment'

const ScreenRecordHoC = () => {
  const [view, setView] = useState<'preview' | 'preload' | 'studio'>('preload')
  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ fragmentId: string }>()

  const [fragment, setFragment] = useState<StudioFragmentFragment>()

  const [localVideoUrl, setLocalVideoUrl] = useState<string>()
  const [recordingsData, setRecordingsData] = useState<{
    recordingId: string
    recordedBlocks: RecordedBlocksFragment[] | undefined
  }>()

  const [isUserAllowed, setUserAllowed] = useState(false)

  const devices = useRef<{ microphone: Device | null; camera: Device | null }>({
    camera: null,
    microphone: null,
  })

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
        setLocalVideoUrl={setLocalVideoUrl}
        setRecordingsData={setRecordingsData}
        setView={setView}
      />
    )

  if (view === 'preview' && fragment)
    return (
      <Preview
        data={fragment}
        handleJoin={({ microphone, camera }) => {
          devices.current = { microphone, camera }
          setView('studio')
        }}
      />
    )

  if (view === 'studio' && fragment)
    return (
      <EditorProvider>
        <ScreenRecord
          fragment={fragment}
          devices={devices.current}
          recordingsData={recordingsData}
          localVideoUrl={localVideoUrl}
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

    handleJoin({ microphone, camera })
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

const ScreenRecord = ({
  fragment: studioFragment,
  devices,
  recordingsData,
  localVideoUrl,
}: {
  fragment: StudioFragmentFragment
  devices: { microphone: Device | null; camera: Device | null }
  localVideoUrl?: string
  recordingsData:
    | {
        recordingId: string
        recordedBlocks: RecordedBlocksFragment[] | undefined
      }
    | undefined
}) => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const query = useQuery()
  const blockId = query.get('blockId')
  const history = useHistory()
  const { sub } = (useRecoilValue(userState) as User) || {}

  // STATES

  const [fragment, setFragment] =
    useState<StudioFragmentFragment>(studioFragment)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)

  const [isLowerThirdEnabled, setIsLowerThirdEnabled] = useState(true)

  const [blocks, setBlocks] = useState<Block[]>(
    fragment.editorState?.blocks?.filter(
      (block: any) =>
        block.type === 'videoBlock' &&
        (block.id === blockId || block.videoBlock.associatedBlockId === blockId)
    )
  )
  const [currentBlock, setCurrentBlock] = useState<Block | undefined>(
    fragment.editorState?.blocks.find((b: any) => b.id === blockId) || undefined
  )
  const [localRecordedBlocks, setLocalRecordedBlocks] = useState<
    RecordedBlocksFragment[] | undefined
  >(recordingsData?.recordedBlocks || [])

  const [recordedVideoSrc, setRecordedVideoSrc] = useState<string>()
  const [blockThumbnails, setBlockThumbnails] = useState<any>({})

  const [state, setState] = useState<StudioState>('ready')

  const [stageBoundingDivRef, bounds] = useMeasure()
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)

  const [isTimerModalOpen, setIsTimerModalOpen] = useState(true)
  const [timeLimit, setTimeLimit] = useState<number | undefined>()
  const [timeLimitOver, setTimeLimitOver] = useState(false)
  const [resetTimer, setResetTimer] = useState(false)

  const { height: stageHeight, width: stageWidth } = getIntegerHW({
    maxH: bounds.height,
    maxW: bounds.width,
    aspectRatio: 16 / 9,
    isShorts: false,
  })
  const [mountStage, setMountStage] = useState(false)
  useEffect(() => {
    if (!stageWidth) return
    Konva.pixelRatio = 1920 / stageWidth
    setMountStage(true)
  }, [stageWidth])

  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  // state which stores the type of layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<{
    id: string
    state: TopLayerChildren
  }>({ id: '', state: '' })

  const [controlsConfig, setControlsConfig] = useState({})

  const [fragmentState, setFragmentState] =
    useState<FragmentState>('customLayout')

  const {
    viewConfig,
    dataConfig,
  }: {
    viewConfig: BlockProperties | undefined
    dataConfig: Block | undefined
  } = useMemo(() => {
    console.log('useMemo', currentBlock)
    if (!currentBlock)
      return {
        viewConfig: undefined,
        dataConfig: undefined,
      }
    const { configuration } = fragment
    const dataConfig: SimpleAST | undefined = fragment.editorState

    const vc = configuration?.blocks?.[currentBlock.id]
    const dc = dataConfig?.blocks?.find((b) => b.id === currentBlock.id)

    return {
      viewConfig: vc,
      dataConfig: dc,
    }
  }, [currentBlock, fragment])

  // SETUP FIREBASE AND AGORA

  const tracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(
    null
  )
  const [getRTCToken] = useGetRtcTokenMutation({
    variables: { fragmentId },
  })

  const { ready, tracks, error } = createMicrophoneAndCameraTracks(
    {
      microphoneId: devices.microphone?.id,
    },
    { cameraId: devices.camera?.id, encoderConfig: '720p_6' }
  )()

  const { stream, join, users, leave, userAudios, renewToken } = useAgora(
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

  const { participants, init, payload, updatePayload } = useRTDB<any, any>({
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

  const {
    startRecording,
    stopRecording: stopCanvasRecording,
    reset: resetCanvas,
    getBlobs,
    stopStreaming,
  } = useCanvasRecorder({})

  useEffect(() => {
    if (studioFragment) {
      ;(async () => {
        init()
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          const participantId = (
            studioFragment?.configuration
              ?.speakers as FlickParticipantsFragment[]
          ).find(({ userSub }) => userSub === sub)?.id
          if (participantId) {
            join(data?.RTCToken?.token, participantId as string, tracks)
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
  }, [studioFragment])

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    return () => {
      leave()
      tracksRef.current?.forEach((track) => track.close())
      updatePayload?.({ status: Fragment_Status_Enum_Enum.NotStarted })
      stopStreaming()
    }
  }, [])

  /* 
    END OF STREAM SETUP
  */

  /*
    START OF EVENT HANDLERS
  */

  useEffect(() => {
    updatePayload?.({ activeObjectIndex: 0 })
  }, [])

  const start = () => {
    const canvas = document
      .getElementsByClassName('konvajs-content')[0]
      .getElementsByTagName('canvas')[0]

    setTopLayerChildren({ id: nanoid(), state: 'transition moveAway' })
    // @ts-ignore
    startRecording(canvas, {
      localStream: stream as MediaStream,
      remoteStreams: userAudios,
    })

    if (isLowerThirdEnabled)
      setTimeout(() => {
        setTopLayerChildren({ id: nanoid(), state: 'lowerThird' })
      }, 1000)

    setResetTimer(false)

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

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Live) {
      start()
    }
  }, [payload?.status])

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
    setTopLayerChildren({ id: nanoid(), state: 'transition moveIn' })
    // stopCanvasRecording()
    // setState('preview')
  }

  const prepareVideo = async () => {
    if (
      state === 'preview' &&
      currentBlock &&
      !localRecordedBlocks?.find((b) => b.id === currentBlock.id)
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
                currentBlock,
              }
            )}`
          )
        )
        return
      }

      const url = URL.createObjectURL(blob)
      console.log('Prepare video success', url)
      setRecordedVideoSrc(url)
    }
    if (state !== 'preview' && state !== 'upload') {
      setRecordedVideoSrc(undefined)
    }
  }

  useEffect(() => {
    console.log('State changed to', state)
    prepareVideo()
  }, [state, currentBlock?.id])

  useEffect(() => {
    console.log('payload is', payload)
    if (payload?.activeObjectIndex === undefined) return
    console.log('payload', payload?.fragmentState, fragmentState)
    if (payload?.fragmentState === fragmentState) return
    console.log('Payload is', payload)

    if (fragment?.configuration?.mode !== 'Portrait') {
      // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
      if (payload?.fragmentState === 'customLayout') {
        setTopLayerChildren?.({
          id: nanoid(),
          state:
            fragmentState === 'onlyUserMedia'
              ? 'transition right'
              : 'transition left',
        })
      }
      // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
      if (payload?.fragmentState === 'onlyUserMedia') {
        setTopLayerChildren?.({ id: nanoid(), state: 'transition left' })
      }
      if (payload?.fragmentState === 'onlyFragment') {
        setTopLayerChildren?.({ id: nanoid(), state: 'transition right' })
      }
    } else {
      setTopLayerChildren?.({ id: nanoid(), state: '' })
    }
  }, [payload?.fragmentState])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        // activeObjectIndex: 0,
        activeIntroIndex: 0,
        activeOutroIndex: 0,
        fragmentState: 'customLayout',
        currentIndex: 0,
        prevIndex: -1,
        isFocus: false,
        focusBlockCode: false,
        activeBlockIndex: 0,
        activePointIndex: 0,
        currentTime: 0,
        playing: false,
        status: Fragment_Status_Enum_Enum.NotStarted,
      })
    }
    if (state === 'start-recording') {
      updatePayload?.({
        activeObjectIndex: 0,
        activeIntroIndex: 0,
        activeOutroIndex: 0,
        fragmentState: 'customLayout',
        currentIndex: 0,
        prevIndex: -1,
        isFocus: false,
        focusBlockCode: false,
        activeBlockIndex: 0,
        activePointIndex: 0,
        currentTime: 0,
        playing: false,
      })
      // setTopLayerChildren?.({ id: '', state: '' })
    }
    if (state === 'recording') {
      // setTopLayerChildren?.({ id: '', state: '' })
      updatePayload?.({
        activeOutroIndex: 0,
      })
    }
  }, [state])

  const updateRecordedBlocks = (blockId: string, newSrc: string) => {
    let updatedBlocks = recordingsData?.recordedBlocks
      ? [...recordingsData?.recordedBlocks]
      : []
    const currentBlockIndex = recordingsData?.recordedBlocks?.findIndex(
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

  const [uploadFile] = useUploadFile()
  const [saveBlock] = useSaveRecordedBlockMutation()
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

      // Once the block video is uploaded to s3 , save the block to the table
      await saveBlock({
        variables: {
          flickId: fragment?.flickId,
          fragmentId,
          recordingId: recordingsData?.recordingId,
          objectUrl,
          thumbnail: blockThumbnail,
          blockId,
          playbackDuration: duration,
        },
      })
      updateRecordedBlocks(blockId, objectUrl)

      // after updating the recorded blocks set this state which triggers the useEffect to update studio store

      // update block url in store for preview once upload is done
      setRecordedVideoSrc(`${config.storage.baseUrl}${objectUrl}`)

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

  /*
    END OF EVENT HANDLERS
  */

  if (!fragment || fragment.id !== fragmentId)
    return <EmptyState text="Fragment not found" width={400} />

  if (error)
    return (
      <ScreenState title="Something went wrong." subtitle={error.message} />
    )

  if (!ready) return <ScreenState loading />

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
          <Countdown
            payload={payload}
            updatePayload={updatePayload}
            state={state}
            setState={setState}
          />
          {/* Stage and notes */}
          <div className="flex items-center justify-between mt-8 mx-8">
            <button
              onClick={() => history.push(`/story/${fragment?.flickId}`)}
              type="button"
              className="flex items-center cursor-pointer text-white gap-x-2 opacity-90"
            >
              <IoArrowBack size={16} type="button" className="max-w-max p-0" />
              <span className="text-xs">Go to notebook</span>
            </button>
            <div className="flex items-center gap-x-2">
              <Switch.Group
                as="div"
                className={cx(
                  'flex items-center gap-x-2 bg-dark-100 px-2 py-2 rounded-sm',
                  {
                    'opacity-70 cursor-not-allowed':
                      state === 'recording' || state === 'start-recording',
                  }
                )}
              >
                <Switch
                  checked={isLowerThirdEnabled}
                  onChange={() => {
                    setIsLowerThirdEnabled(!isLowerThirdEnabled)
                  }}
                  disabled={
                    state === 'recording' || state === 'start-recording'
                  }
                  className={`${
                    isLowerThirdEnabled ? 'bg-brand' : 'bg-gray-400'
                  }  relative inline-flex items-center h-3 rounded-full w-6 transition-colors focus:outline-none disabled:cursor-not-allowed`}
                >
                  <span
                    className={`${
                      isLowerThirdEnabled ? 'translate-x-3.5' : 'translate-x-px'
                    } inline-block w-2 h-2 transform bg-white rounded-full transition-transform`}
                  />
                </Switch>
                <Switch.Label className="text-white text-xs">
                  Show lower third
                </Switch.Label>
              </Switch.Group>
              <button
                disabled={state === 'recording' || state === 'start-recording'}
                type="button"
                className="bg-dark-100 hover:bg-dark-200 active:bg-dark-300 text-gray-100 rounded-sm flex items-center gap-x-2 text-xs px-2 py-2 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={() => {
                  setIsPreferencesOpen(true)
                }}
              >
                <IoSettingsOutline className="" />
                <span>Edit preferences</span>
              </button>
              <button
                disabled={state === 'recording' || state === 'start-recording'}
                type="button"
                className="bg-dark-100 hover:bg-dark-200 active:bg-dark-300 text-gray-100 rounded-sm flex items-center gap-x-2 text-xs px-2 py-2 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={() => {
                  setIsEditOpen(true)
                }}
              >
                <HiOutlinePencilAlt className="" />
                <span>Split, Trim & Crop</span>
              </button>
            </div>
          </div>
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
                      x: stageHeight / CONFIG.height,
                      y: stageWidth / CONFIG.width,
                    }}
                  >
                    <Bridge>
                      <Layer ref={layerRef}>
                        {(() => {
                          if (fragment) {
                            return (
                              <Group>
                                {viewConfig && dataConfig && (
                                  <VideoFragment
                                    key={currentBlock?.id}
                                    fragment={fragment}
                                    viewConfig={viewConfig}
                                    dataConfig={dataConfig as VideoBlockProps}
                                    fragmentState={fragmentState}
                                    stageRef={stageRef}
                                    shortsMode={false}
                                    theme={fragment.flick.theme}
                                    state={state}
                                    payload={payload}
                                    branding={
                                      fragment.flick.branding?.branding || null
                                    }
                                    setControlsConfig={setControlsConfig}
                                    setFragmentState={setFragmentState}
                                    updatePayload={updatePayload}
                                    users={users}
                                    stream={stream}
                                    participants={participants}
                                    localVideoUrl={localVideoUrl}
                                  />
                                )}
                                <GetTopLayerChildren
                                  key={topLayerChildren?.id}
                                  topLayerChildrenState={
                                    topLayerChildren?.state || ''
                                  }
                                  setTopLayerChildren={setTopLayerChildren}
                                  isShorts={false}
                                  status={payload?.status}
                                  theme={fragment.flick.theme}
                                  branding={
                                    fragment.flick.branding?.branding || null
                                  }
                                  performFinishAction={() => {
                                    stopCanvasRecording()
                                    setState('preview')
                                    updatePayload?.({
                                      ...payload,
                                      status: Fragment_Status_Enum_Enum.Ended,
                                      // activeObjectIndex: payload?.activeObjectIndex + 1,
                                    })
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
              <RecordingControlsBar
                stageRef={stageRef}
                stageHeight={stageHeight}
                stageWidth={stageWidth}
                timeLimit={timeLimit}
                shortsMode={false}
                timeOver={() => setTimeLimitOver(true)}
                openTimerModal={() => setIsTimerModalOpen(true)}
                resetTimer={resetTimer}
                state={state}
                fragment={fragment}
                payload={payload}
                controlsConfig={controlsConfig}
                stopRecording={stop}
                setState={setState}
                updatePayload={updatePayload}
              />
            </div>
            <Notes
              key={payload?.activeObjectIndex}
              stageHeight={stageHeight}
              fragment={fragment}
              state={state}
              payload={payload}
              setFragment={setFragment}
            />
          </div>
          {/* Mini timeline */}
          <MiniTimeline
            blocks={blocks}
            recordedBlocks={localRecordedBlocks}
            currentBlock={currentBlock}
            payload={payload}
            state={state}
            setCurrentBlock={setCurrentBlock}
            setState={setState}
            updatePayload={updatePayload}
            setRecordedVideoSrc={setRecordedVideoSrc}
          />
        </>
      ) : (
        <div className="flex flex-col h-full">
          <div className="w-full flex items-center justify-between px-8 mt-8">
            <button
              onClick={() => history.push(`/story/${fragment?.flickId}`)}
              type="button"
              className="flex items-center cursor-pointer text-white gap-x-2 opacity-90"
            >
              <IoArrowBack size={16} type="button" className="max-w-max p-0" />
              <span className="text-xs">Go to notebook</span>
            </button>
            {localRecordedBlocks && localRecordedBlocks?.length > 0 && (
              <Button
                onClick={() => setIsPublishOpen(true)}
                size="small"
                appearance="primary"
                type="button"
              >
                Publish
              </Button>
            )}
          </div>
          <div className="flex items-center justify-center flex-col w-full flex-1 pt-4">
            {localRecordedBlocks && (
              <div
                style={{
                  height: '80vh',
                  width:
                    fragment?.configuration?.mode === 'Portrait'
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
                  src={recordedVideoSrc}
                  key={nanoid()}
                />
                {(state === 'preview' || state === 'upload') && (
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
                      recordedVideoSrc?.includes('blob') &&
                        !localRecordedBlocks
                          ?.map((b) => b.id)
                          ?.includes(currentBlock?.id as string) &&
                        state !== 'upload' && (
                          <button
                            className="bg-incredible-green-600 text-white rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-lg text-sm"
                            type="button"
                            onClick={() => {
                              logEvent(PageEvent.SaveRecording)
                              if (
                                payload.activeObjectIndex === undefined ||
                                payload.activeObjectIndex < 0
                              ) {
                                console.error(
                                  'Invalid activeObjectIndex :',
                                  payload
                                )
                                return
                              }

                              // start async upload and move on to next block
                              if (blockId)
                                upload(blocks[payload?.activeObjectIndex].id)
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

                              const isLastBlock =
                                payload?.activeObjectIndex === blocks.length - 1
                              // move on to next block
                              const p = {
                                ...payload,
                                // eslint-disable-next-line no-nested-ternary
                                activeObjectIndex: isLastBlock
                                  ? 0
                                  : payload.activeObjectIndex + 1,
                              }
                              updatePayload?.(p)
                              // setState(isLastBlock ? 'preview' : 'resumed')
                              setResetTimer(true)
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
                        resetCanvas()
                        setTopLayerChildren?.({ id: nanoid(), state: '' })

                        // if currentBlock.id is in recordedBlocks
                        const currBlock = localRecordedBlocks.filter(
                          (b) => b.id === currentBlock?.id
                        )[0]
                        if (currBlock?.objectUrl) {
                          if (localRecordedBlocks && currentBlock) {
                            let copyRecordedBlocks = [...localRecordedBlocks]
                            copyRecordedBlocks = copyRecordedBlocks.filter(
                              (blk) => blk.objectUrl !== currBlock.objectUrl
                            )
                            setLocalRecordedBlocks(copyRecordedBlocks)
                          }
                        }

                        updatePayload?.({
                          status: Fragment_Status_Enum_Enum.Paused,
                        })

                        setState('resumed')
                        setResetTimer(true)
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
          <MiniTimeline
            blocks={blocks}
            recordedBlocks={localRecordedBlocks}
            currentBlock={currentBlock}
            payload={payload}
            state={state}
            setCurrentBlock={setCurrentBlock}
            setState={setState}
            updatePayload={updatePayload}
            setRecordedVideoSrc={setRecordedVideoSrc}
          />
        </div>
      )}
      <TimerModal
        open={isTimerModalOpen && (state === 'resumed' || state === 'ready')}
        timeLimit={timeLimit}
        setTimeLimit={setTimeLimit}
        handleClose={() => setIsTimerModalOpen(false)}
      />
      {blocks.length > 0 &&
        fragment.encodedEditorValue &&
        fragment.configuration &&
        fragment.editorState && (
          <>
            <Modal
              open={isEditOpen}
              onClose={() => {
                setIsEditOpen(false)
              }}
              styles={{
                modal: {
                  maxWidth: '90%',
                  width: '100%',
                  maxHeight: '90vh',
                  height: '100%',
                  padding: '0',
                },
              }}
              classNames={{
                modal: cx('rounded-md m-0 p-0'),
              }}
              center
              showCloseIcon={false}
            >
              <FastRecord
                blocks={blocks as VideoBlockProps[]}
                viewConfig={fragment.configuration}
                dataConfig={fragment.editorState}
                encodedEditorJSON={fragment.encodedEditorValue}
                setBlocks={setBlocks}
                setCurrentBlock={setCurrentBlock}
                fragment={fragment}
                setFragment={setFragment}
                handleClose={() => {
                  setIsEditOpen(false)
                }}
              />
            </Modal>

            <Dialog
              className="relative z-50"
              open={isPreferencesOpen}
              onClose={() => {
                setIsPreferencesOpen(false)
              }}
            >
              <div
                className="fixed inset-0 bg-black opacity-50"
                aria-hidden="true"
              />
              <Dialog.Panel>
                <div
                  style={{
                    maxWidth: '70%',
                    width: '100%',
                    maxHeight: '80vh',
                    height: '100%',
                    padding: '0',
                  }}
                  className="fixed inset-0 m-auto p-4 bg-dark-300 text-white rounded-md"
                >
                  <Preferences
                    blocks={blocks as VideoBlockProps[]}
                    viewConfig={fragment.configuration}
                    fragment={fragment}
                    setFragment={setFragment}
                    handleClose={() => {
                      setIsPreferencesOpen(false)
                    }}
                  />
                </div>
              </Dialog.Panel>
            </Dialog>

            {recordingsData?.recordingId && (
              <Dialog
                className="relative z-50"
                open={isPublishOpen}
                onClose={() => {
                  setIsPublishOpen(false)
                }}
              >
                <div
                  className="fixed inset-0 bg-black opacity-50"
                  aria-hidden="true"
                />
                <Dialog.Panel>
                  <div
                    style={{
                      width: '520px',
                      height: '450px',
                      padding: '0',
                    }}
                    className="fixed inset-0 m-auto p-4 bg-dark-300 text-white rounded-md"
                  >
                    <Publish
                      flickDescription={fragment.flick.description || undefined}
                      flickName={fragment.flick.name}
                      recordingId={recordingsData?.recordingId}
                      fragment={fragment}
                    />
                  </div>
                </Dialog.Panel>
              </Dialog>
            )}
          </>
        )}
    </div>
  )
}

export default ScreenRecordHoC
