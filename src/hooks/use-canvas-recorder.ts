/* eslint-disable @typescript-eslint/no-unused-vars */
import { saveAs } from 'file-saver'
import { extension } from 'mime-types'
import { useRef, useState } from 'react'
import transitionMusic from '../assets/TransitionMusic.mp3'
import splashMusic from '../assets/IntroOutroBgm.mp3'
import pointsMusic from '../assets/bubblePopMusic.mp3'
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

export type AudioType = 'transition' | 'splash' | 'points'

const useCanvasRecorder = ({
  options: { videoBitsPerSecond = 8000000, liveStream = false },
}: {
  options: {
    videoBitsPerSecond?: number
    liveStream: boolean
  }
}) => {
  // const [recordedBlobs, setRecordedBlobs] = useState<Blob[]>([])
  const recordedBlobs = useRef<Blob[]>([])
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  const [type, setType] = useState<ElementType<typeof types>>()

  const handleDataAvailable = (event: BlobEvent): any => {
    if (event.data && event.data.size > 0) {
      if (liveStream) {
        ws.send(event.data)
      } else {
        recordedBlobs.current.push(event.data)
      }
    }
  }

  const ctx = useRef<AudioContext | null>(null)
  const dest = useRef<MediaStreamAudioDestinationNode | null>(null)
  const splashAudio = new Audio(splashMusic)
  const splashAudioSourceNode = useRef<MediaElementAudioSourceNode | null>(null)

  const ws = new WebSocket(
    `${'ws://localhost:6249/rtmp/'}${encodeURIComponent(
      'rtmp://blr01.contribute.live-video.net/app/live_758848806_k52jBZbT3KviGqorIMg2XlY4U6U0td'
    )}`
  )

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

    const stream = (canvas as CanvasElement).captureStream(30)

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
      mediaRecorder.onstop = () => {
        ws.addEventListener('close', (e) => {
          console.log('WebSocket Close', e)
        })
      }

      // music.play()

      setMediaRecorder(mediaRecorder)
    } catch (e) {
      console.error(e)
    }
  }

  const addMusic = (type?: AudioType, volume?: number) => {
    if (!ctx || !dest || !ctx.current || !dest.current) return
    if (type === 'splash') {
      splashAudioSourceNode.current =
        ctx.current.createMediaElementSource(splashAudio)
      splashAudioSourceNode.current.connect(dest.current)
      splashAudio.loop = true
      splashAudio.volume = volume || 0.25
      splashAudio.play()
    } else if (type === 'points') {
      const pointsAudio = new Audio(pointsMusic)
      ctx.current.createMediaElementSource(pointsAudio).connect(dest.current)
      pointsAudio.play()
    } else {
      const transitionAudio = new Audio(transitionMusic)
      ctx.current
        .createMediaElementSource(transitionAudio)
        .connect(dest.current)
      transitionAudio.play()
    }
  }

  const reduceSplashAudioVolume = (volume: number) => {
    splashAudio.volume = volume
  }

  const stopMusic = () => {
    if (!splashAudioSourceNode || !splashAudioSourceNode.current) return
    splashAudioSourceNode.current.disconnect()
  }

  const stopRecording = (fileName?: string) => {
    if (mediaRecorder?.state === 'inactive') return
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder?.stop()
    } else console.error('Cannot stop canvas recorder', mediaRecorder?.state)
  }

  const download = async (fileName?: string) => {
    const blob = await getBlobs()
    // eslint-disable-next-line no-param-reassign
    fileName = fileName || `${'recording.'}${extension(type as string)}`
    saveAs(blob, fileName)
  }

  const getBlobs = async () => {
    const superblob = new Blob(recordedBlobs.current, { type })
    const arrayBuffer = await superblob.arrayBuffer()
    if (arrayBuffer) {
      return getSeekableWebM(arrayBuffer)
    }
    return superblob
  }

  const reset = () => {
    recordedBlobs.current = []
    // setRecordedBlobs([])
  }

  return {
    startRecording,
    stopRecording,
    download,
    getBlobs,
    reset,
    addMusic,
    reduceSplashAudioVolume,
    stopMusic,
  }
}

export default useCanvasRecorder
