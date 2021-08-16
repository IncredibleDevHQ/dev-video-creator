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

const Studio = () => {
  const { fragmentId } = useParams<{ fragmentId: string }>()
  const [studio, setStudio] = useRecoilState(studioStore)
  const { sub, picture } = (useRecoilValue(userState) as User) || {}
  const [fragment, setFragment] = useState<StudioFragmentFragment>()

  const [localStream, setLocalStream] = useState<MediaStream>()
  const history = useHistory()

  const { data, loading } = useGetFragmentByIdQuery({
    variables: { id: fragmentId, sub: sub as string },
  })

  const [markFragmentCompleted] = useMarkFragmentCompletedMutation()

  const [uploadFile] = useUploadFile()

  const { stream, tracks, join, users, ready, leave } = useAgora(fragmentId)

  const [getRTCToken, { data: rtcData, called }] = useGetRtcTokenLazyQuery({
    variables: { fragmentId },
  })

  useEffect(() => {
    getRTCToken()
  }, [])

  useEffect(() => {
    if (tracks?.length) {
      console.log({ stream, tracks })
      setLocalStream(stream)
    }
  }, [tracks, stream])

  useEffect(() => {
    if (!rtcData?.RTCToken?.token || called) return

    join(rtcData?.RTCToken?.token, sub as string)
  }, [rtcData])

  useEffect(() => {
    if (!data?.Fragment) return
    setFragment(data.Fragment[0])
  }, [data])

  const [state, setState] = useState<StudioState>('ready')

  const { startRecording, stopRecording, reset, getBlobs } = useCanvasRecorder({
    options: {},
  })

  // useEffect(() => {
  //   initiateUserStream({ audio: true, video: { width: 120, height: 120 } })

  //   return () => {
  //     stopRecording()
  //     stopUserStream()
  //   }
  // }, [])

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

    const audio = localStream?.getAudioTracks()[0]

    if (audio) {
      startRecording(canvas, audio)
    } else startRecording(canvas)
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
    })
  }, [fragment, stream])

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
          {/* <Timer target={10} timer={timer} /> */}
        </div>
        <C />
      </div>
    </div>
  )
}

export default Studio

/**
 *     <StudioContext.Provider
      value={{
        toggleAudio,
        toggleVideo,
        togglePresenterNotes,
        reset: resetRecording,
        upload,
        startRecording: start,
        stopRecording: stop,
        constraints,
        picture: picture as string,
        state,
        stream: localStream as MediaStream,
        getBlob,
        fragment,
      }}
    >


    */
