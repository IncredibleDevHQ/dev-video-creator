import React, { useEffect, useState } from 'react'
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
} from '../../components'
import {
  StudioFragmentFragment,
  useGetFragmentByIdQuery,
  useGetRtcTokenLazyQuery,
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

  const { stream, join, users, leave, ready, userAudios, tracks } =
    useAgora(fragmentId)

  const [getRTCToken, { data: rtcData }] = useGetRtcTokenLazyQuery({
    variables: { fragmentId },
  })

  const [didInit, setDidInit] = useState(false)

  useEffect(() => {
    getRTCToken()

    return () => {
      leave()
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
    if (fragment) {
      init()
    }
  }, [fragment])

  useEffect(() => {
    if (!rtcData?.RTCToken?.token || didInit || !ready) return

    setDidInit(true)
    join(rtcData?.RTCToken?.token, sub as string)
  }, [rtcData, ready])

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
        file: getBlobs(),
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
      history.push(`/flick/${fragment?.flickId}`)
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

  const stop = () => {
    stopRecording()

    setState('preview')
  }

  useEffect(() => {
    if (!fragment || !stream) return
    setStudio({
      ...studio,
      fragment,
      togglePresenterNotes,
      stream: stream as MediaStream,
      startRecording: start,
      stopRecording: stop,
      reset: resetRecording,
      upload,
      getBlobs,
      state,
      picture: picture as string,
      constraints: { audio: true, video: true },
      users,
      payload,
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

  const C = getEffect(fragment.type)

  return (
    <div>
      <div className="py-2 px-4">
        <div className="flex flex-row justify-between bg-gray-100 p-2 rounded-md">
          <div className="flex-1 flex flex-row items-center">
            <FiArrowLeft
              className="cursor-pointer mr-2"
              onClick={() => history.goBack()}
            />
            <Heading className="font-semibold">{fragment.name}</Heading>
          </div>
          <button
            type="button"
            onClick={() => {
              updatePayload({ done: true })
            }}
          >
            Update
          </button>
          {/* <Timer target={10} timer={timer} /> */}
        </div>
        <C config="" />
      </div>
    </div>
  )
}

export default Studio
