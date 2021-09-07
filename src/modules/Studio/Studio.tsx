import React, { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { useHistory, useParams } from 'react-router-dom'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  emitToast,
  dismissToast,
  EmptyState,
  Heading,
  ScreenState,
  updateToast,
  Text,
} from '../../components'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  useGetFragmentByIdQuery,
  useGetRtcTokenMutation,
  useMarkFragmentCompletedMutation,
} from '../../generated/graphql'
import { useCanvasRecorder } from '../../hooks'
import { User, userState } from '../../stores/user.store'
import { getEffect } from './effects/effects'
import { useUploadFile } from '../../hooks/use-upload-file'
import { useAgora } from './hooks'
import { StudioState, studioStore } from './stores'
import { useRTDB } from './hooks/use-rtdb'

const Studio = () => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub, picture } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()

  const history = useHistory()

  const { data, loading } = useGetFragmentByIdQuery({
    variables: { id: fragmentId, sub: sub as string },
  })

  const [markFragmentCompleted] = useMarkFragmentCompletedMutation()

  const [uploadFile] = useUploadFile()

  const {
    stream,
    join,
    users,
    mute,
    leave,
    ready,
    userAudios,
    tracks,
    renewToken,
  } = useAgora(fragmentId, {
    onTokenWillExpire: async () => {
      const { data } = await getRTCToken({ variables: { fragmentId } })
      if (data?.RTCToken?.token) {
        renewToken(data.RTCToken.token)
      }
    },
    onTokenDidExpire: async () => {
      const { data } = await getRTCToken({ variables: { fragmentId } })
      if (data?.RTCToken?.token) {
        join(data?.RTCToken?.token, sub as string)
      }
    },
  })

  const [getRTCToken] = useGetRtcTokenMutation({
    variables: { fragmentId },
  })

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

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
    console.log({ payload })
  }, [payload])

  useEffect(() => {
    if (fragment && ready) {
      ;(async () => {
        init()
        const { data } = await getRTCToken({ variables: { fragmentId } })
        if (data?.RTCToken?.token) {
          join(data?.RTCToken?.token, sub as string)
        }
      })()
    }
  }, [fragment, ready])

  useEffect(() => {
    if (!data?.Fragment) return
    setFragment(data.Fragment[0])
  }, [data])

  const [state, setState] = useState<StudioState>('ready')

  const { startRecording, stopRecording, reset, getBlobs } = useCanvasRecorder({
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

  const togglePresenterNotes = () => {}

  const resetRecording = () => {
    reset()
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
      const { uuid } = await uploadFile({
        extension: 'webm',
        file: await getBlobs(),
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
      await markFragmentCompleted({
        variables: { id: fragmentId, producedLink: uuid },
      })

      dismissToast(toast)
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
    payload.playing = false
    updatePayload?.({ status: Fragment_Status_Enum_Enum.Ended })
  }

  const stop = () => {
    stopRecording()
    stream?.getTracks().forEach((track) => track.stop())
    setState('preview')
  }

  useEffect(() => {
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
    if (!fragment || !stream) return
    setStudio({
      ...studio,
      fragment,
      togglePresenterNotes,
      stream: stream as MediaStream,
      startRecording: start,
      stopRecording: stop,
      showFinalTransition: finalTransition,
      reset: resetRecording,
      upload,
      getBlobs,
      state,
      picture: picture as string,
      constraints: { audio: true, video: true },
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
  }, [
    fragment,
    stream,
    users,
    state,
    userAudios,
    payload,
    participants,
    payload,
  ])

  /**
   * =======================
   * END EVENT HANDLERS...
   * =======================
   */

  if (loading) return <ScreenState title="Just a jiffy..." loading />

  if (!fragment) return <EmptyState text="Fragment not found" width={400} />

  const C = getEffect(fragment.type, fragment.configuration)

  return (
    <div>
      <div className="py-2 px-4">
        <div className="flex flex-row justify-between bg-gray-100 p-2 rounded-md">
          <div className="flex-1 flex flex-row items-center">
            <FiArrowLeft
              className="cursor-pointer mr-2"
              onClick={() => {
                stream?.getTracks().forEach((track) => track.stop())
                history.goBack()
              }}
            />
            <Heading className="font-semibold">{fragment.name}</Heading>
          </div>
          {payload?.status === Fragment_Status_Enum_Enum.Live ? (
            <div className="flex px-2 py-1 rounded-sm bg-error-10 animate-pulse">
              <Text className="text-sm text-error font-semibold">
                Recording
              </Text>
            </div>
          ) : (
            <></>
          )}
        </div>
        <C />
      </div>
    </div>
  )
}

export default Studio
