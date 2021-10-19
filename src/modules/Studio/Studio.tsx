/* eslint-disable jsx-a11y/media-has-caption */
import React, { useEffect, useMemo, useState } from 'react'
import { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'
import AgoraRTC from 'agora-rtc-sdk-ng'
import { FiArrowLeft } from 'react-icons/fi'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import getBlobDuration from 'get-blob-duration'
import {
  AgoraVideoPlayer,
  createMicrophoneAndCameraTracks,
} from 'agora-rtc-react'
import AspectRatio from 'react-aspect-ratio'
import {
  emitToast,
  dismissToast,
  EmptyState,
  Heading,
  ScreenState,
  updateToast,
  Button,
} from '../../components'
import {
  Fragment_Status_Enum_Enum,
  GetFragmentByIdQuery,
  StudioFragmentFragment,
  useGetFragmentByIdQuery,
  useGetRtcTokenMutation,
  useMarkFragmentCompletedMutation,
} from '../../generated/graphql'
import { useCanvasRecorder, useTimekeeper } from '../../hooks'
import { User, userState } from '../../stores/user.store'
import { getEffect } from './effects/effects'
import { useUploadFile } from '../../hooks/use-upload-file'
import { useAgora } from './hooks'
import { StudioProviderProps, StudioState, studioStore } from './stores'
import { useRTDB } from './hooks/use-rtdb'
import { Timer, Countdown } from './components'
import { Device } from './hooks/use-agora'

const useMicrophoneAndCameraTracks = createMicrophoneAndCameraTracks()

// eslint-disable-next-line consistent-return
const StudioHoC = () => {
  const [view, setView] = useState<'preview' | 'studio'>('preview')
  const { ready, tracks } = useMicrophoneAndCameraTracks()

  const [currentDevice, setCurrentDevice] = useState<Device>({} as Device)

  const { sub } = (useRecoilValue(userState) as User) || {}
  const { fragmentId } = useParams<{ fragmentId: string }>()

  const { data, loading } = useGetFragmentByIdQuery({
    variables: { id: fragmentId, sub: sub as string },
  })

  if (loading) return <ScreenState title="Just a jiffy..." loading />

  if (view === 'preview')
    return (
      <Preview
        data={data}
        tracks={tracks}
        ready={ready}
        handleJoin={() => setView('studio')}
        currentDevice={currentDevice}
        setCurrentDevice={setCurrentDevice}
      />
    )
  if (view === 'studio')
    return <Studio data={data} currentDevice={currentDevice} />
}

const Preview = ({
  tracks,
  ready,
  data,
  handleJoin,
  currentDevice,
  setCurrentDevice,
}: {
  tracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null
  ready: boolean
  data?: GetFragmentByIdQuery
  handleJoin: () => void
  currentDevice?: Device
  setCurrentDevice: (currentDevice: Device) => void
}) => {
  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[]
    microphones: MediaDeviceInfo[]
  }>({
    cameras: [],
    microphones: [],
  })

  useEffect(() => {
    ;(async () => {
      const cameras = await AgoraRTC.getCameras()
      const microphones = await AgoraRTC.getMicrophones()

      setDevices({
        cameras,
        microphones,
      })

      setCurrentDevice({
        camera: cameras?.[0].deviceId,
        microphone: microphones?.[0].deviceId,
      })
    })()
  }, [])

  useEffect(() => {
    if (!ready || !currentDevice?.microphone) return
    tracks?.[0].setDevice(currentDevice?.microphone)
  }, [currentDevice?.microphone])

  useEffect(() => {
    if (!ready || !currentDevice?.camera) return
    tracks?.[1].setDevice(currentDevice?.camera)
  }, [currentDevice?.camera])

  return (
    <div className="min-h-screen p-8 flex items-center justify-center flex-1 flex-col">
      <div className="grid grid-cols-5 w-full gap-x-8">
        <div className="col-span-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {ready && tracks?.[1] && (
            <div className="relative">
              <AspectRatio ratio="16/9" className="rounded-lg overflow-hidden">
                <>
                  <AgoraVideoPlayer videoTrack={tracks[1]} />
                </>
              </AspectRatio>
            </div>
          )}
        </div>
        <div className="col-span-2 flex flex-col justify-center flex-1">
          <Heading className="mb-4" fontSize="medium">
            {data?.Fragment?.[0]?.name}
          </Heading>

          <Heading fontSize="extra-small" className="uppercase">
            Camera
          </Heading>
          <select
            className="w-full rounded-md mb-4 p-2 border border-gray-300"
            value={currentDevice?.camera}
            onChange={(e) =>
              // @ts-ignore
              setCurrentDevice({ ...currentDevice, camera: e.target.value })
            }
          >
            {devices.cameras.map((camera) => (
              <option value={camera.deviceId}>{camera.label}</option>
            ))}
          </select>

          <Heading fontSize="extra-small" className="uppercase">
            Microphone
          </Heading>
          <select
            className="w-full rounded-md mb-4 p-2 border border-gray-300"
            value={currentDevice?.microphone}
            onChange={(e) =>
              // @ts-ignore
              setCurrentDevice({ ...currentDevice, microphone: e.target.value })
            }
          >
            {devices.microphones.map((microphone) => (
              <option value={microphone.deviceId}>{microphone.label}</option>
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
  currentDevice,
}: {
  data?: GetFragmentByIdQuery
  currentDevice: Device
}) => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const { constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()
  const history = useHistory()

  const [markFragmentCompleted] = useMarkFragmentCompletedMutation()

  const [uploadFile] = useUploadFile()

  const {
    stream,
    join,
    users,
    mute,
    ready,
    leave,
    userAudios,
    tracks,
    renewToken,
  } = useAgora(
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
      },
    },
    currentDevice
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
    if (fragment && ready) {
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
  }, [fragment, ready])

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

  const { startRecording, stopRecording, reset, getBlobs } = useCanvasRecorder({
    options: {},
  })

  const { handleStart, handleReset, timer } = useTimekeeper(0)

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
    handleReset()
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
    if (timer === 0) return
    if (timer === 180) {
      updatePayload({ ...payload, status: Fragment_Status_Enum_Enum.Ended })
    }
  }, [timer])

  useEffect(() => {
    if (payload?.status === Fragment_Status_Enum_Enum.Live && timer === 0) {
      handleStart()
    }
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      handleReset()
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

  /**
   * =======================
   * END EVENT HANDLERS...
   * =======================
   */

  if (!fragment || fragment.id !== fragmentId)
    return <EmptyState text="Fragment not found" width={400} />

  const C = getEffect(fragment.type, fragment.configuration)

  return (
    <div>
      <Countdown />
      <div className="py-2 px-4">
        <div className="flex flex-row justify-between bg-gray-100 p-2 rounded-md">
          <div className="flex-1 flex flex-row items-center">
            <FiArrowLeft
              className="cursor-pointer mr-2"
              onClick={async () => {
                setFragment(undefined)
                setStudio({
                  ...studio,
                  fragment: undefined,
                })
                stream?.getTracks().forEach((track) => track.stop())
                history.goBack()
              }}
            />
            <Heading
              className="font-semibold"
              onClick={() => {
                stream?.getTracks().forEach((track) => track.stop())
                history.goBack()
              }}
            >
              {fragment.flick.name} / {fragment.name}
            </Heading>
          </div>
          {payload?.status === Fragment_Status_Enum_Enum.Live ? (
            <Timer target={180} timer={timer} />
          ) : (
            <></>
          )}
        </div>
        {fragment && <C />}
      </div>
    </div>
  )
}

export default StudioHoC
