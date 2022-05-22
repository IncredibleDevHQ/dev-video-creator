/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Sentry from '@sentry/react'
import { saveAs } from 'file-saver'
import { extension } from 'mime-types'
import { useRef, useState } from 'react'
import pointsMusic from '../assets/bubblePopMusic.mp3'
import config from '../config'
import { getSeekableWebM } from '../utils/helpers'

const types = [
  'video/x-matroska;codecs=avc1',
  'video/webm;codecs=h264',
  'video/webm',
  'video/webm,codecs=vp9',
  'video/vp8',
  'video/webm;codecs=vp8',
  'video/webm;codecs=daala',
  'video/mpeg',
]

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never

interface CanvasElement extends HTMLCanvasElement {
  captureStream(frameRate?: number): MediaStream
}

export type AudioType = 'transition' | 'shorts' | 'points'
export type MusicAction = 'start' | 'stop' | 'modifyVolume'

const useCanvasRecorder = ({
  videoBitsPerSecond = 8000000,
  liveStreamEnabled = false,
  liveStreamUrl,
}: {
  videoBitsPerSecond?: number
  liveStreamEnabled?: boolean
  liveStreamUrl?: string
}) => {
  const recordedBlobs = useRef<Blob[]>([])
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  const ws = useRef<WebSocket>()

  const [type, setType] = useState<ElementType<typeof types>>()

  const handleDataAvailable = (event: BlobEvent): any => {
    if (event.data && event.data.size > 0) {
      if (liveStreamEnabled) {
        ws.current?.send(event.data)
      } else {
        recordedBlobs.current.push(event.data)
      }
    }
  }

  const ctx = useRef<AudioContext | null>(null)
  const dest = useRef<MediaStreamAudioDestinationNode | null>(null)
  const shortsAudioSourceNode = useRef<MediaElementAudioSourceNode | null>(null)

  /**
   * Starts recording...
   */
  const startRecording = (
    canvas: HTMLCanvasElement,
    {
      localStream,
      remoteStreams,
    }: { localStream: MediaStream; remoteStreams: MediaStream[] }
  ) => {
    if (!canvas) return

    ws.current =
      liveStreamEnabled && liveStreamUrl
        ? new WebSocket(
            config.liveStream.endpoint + encodeURIComponent(liveStreamUrl)
          )
        : undefined

    const stream = (canvas as CanvasElement).captureStream(60)

    if (!stream) {
      throw Error('No stream found')
    }

    const type = types.find((type) => MediaRecorder.isTypeSupported(type))
    if (!type) {
      throw Error('No supported type found for MediaRecorder')
    }

    setType(type)

    try {
      ctx.current = new AudioContext({})

      const streams = remoteStreams.map((r) => {
        const tracks = r.getTracks().filter((t) => t.kind === 'audio')
        const stream = new MediaStream(tracks)
        return ctx.current?.createMediaStreamSource(stream)
      })

      dest.current = ctx.current.createMediaStreamDestination()

      streams.forEach((stream) => {
        if (!dest.current || !stream) return
        stream.connect(dest.current)
      })

      ctx.current.createMediaStreamSource(localStream).connect(dest.current)

      // const music = new Audio(bgMusic)
      // music.loop = true
      // music.volume = 0.03
      // ctx.createMediaElementSource(music).connect(dest)

      const mediaRecorder = new MediaRecorder(
        new MediaStream([
          ...stream.getTracks(),
          ...dest.current.stream.getTracks(),
        ]),
        {
          videoBitsPerSecond,
          mimeType: type,
        }
      )

      mediaRecorder.ondataavailable = handleDataAvailable
      mediaRecorder.start(100) // collect 100ms of data blobs

      // music.play()

      setMediaRecorder(mediaRecorder)
    } catch (e) {
      console.error(e)
    }
  }

  const addMusic = ({
    type,
    volume,
    musicURL,
    action,
  }: {
    type?: AudioType
    volume?: number
    musicURL?: string
    action?: MusicAction
  }) => {
    if (!ctx || !dest || !ctx.current || !dest.current) return
    if (type === 'shorts') {
      const shortsAudio = new Audio(musicURL)
      if (action === 'start') {
        shortsAudioSourceNode.current =
          ctx.current.createMediaElementSource(shortsAudio)
        shortsAudioSourceNode.current.connect(dest.current)
        shortsAudio.loop = true
        shortsAudio.volume = volume || 0.25
        shortsAudio.play()
      } else if (action === 'stop') {
        shortsAudioSourceNode.current?.disconnect()
        shortsAudio.pause()
      } else if (action === 'modifyVolume') {
        shortsAudio.volume = volume || 0.25
      }
    } else if (type === 'points') {
      const pointsAudio = new Audio(pointsMusic)
      ctx.current.createMediaElementSource(pointsAudio).connect(dest.current)
      pointsAudio.volume = volume || 0.4
      pointsAudio.play()
    }
  }

  // const reduceSplashAudioVolume = (volume: number) => {
  //   // splashAudio.volume = volume
  // }

  const stopMusic = () => {
    if (!shortsAudioSourceNode || !shortsAudioSourceNode.current) return
    shortsAudioSourceNode.current.disconnect()
  }

  const stopStreaming = () => {
    if (ws.current?.readyState === ws.current?.OPEN) ws.current?.close()
  }

  const stopRecording = (fileName?: string) => {
    if (mediaRecorder?.state === 'inactive') return
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder?.stop()
    } else console.error('Cannot stop canvas recorder', mediaRecorder?.state)
  }

  const download = async (fileName?: string) => {
    // const blob = await getBlobs()
    // // eslint-disable-next-line no-param-reassign
    // fileName = fileName || `${'recording.'}${extension(type as string)}`
    // saveAs(blob, fileName)
  }

  const getBlobs = async () => {
    try {
      const superblob = new Blob(recordedBlobs.current, { type })
      const arrayBuffer = await superblob.arrayBuffer()
      // recordedBlobs.current = []
      // setMediaRecorder(null)
      if (arrayBuffer) {
        return getSeekableWebM(arrayBuffer)
      }
      return superblob
    } catch (e) {
      console.error(e)
      Sentry.captureException(
        new Error(`Failed to get blobs. ${JSON.stringify(e)}`)
      )
      return undefined
    }
  }

  const reset = () => {
    recordedBlobs.current = []
    setMediaRecorder(null)
    // setRecordedBlobs([])
  }

  return {
    startRecording,
    stopRecording,
    download,
    getBlobs,
    reset,
    addMusic,
    // reduceSplashAudioVolume,
    stopMusic,
    stopStreaming,
  }
}

export default useCanvasRecorder
