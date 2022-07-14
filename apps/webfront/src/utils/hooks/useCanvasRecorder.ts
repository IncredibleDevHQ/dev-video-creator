/* eslint-disable no-console */
import { useRef, useState } from 'react'
import { getSeekableWebM } from 'utils/src'

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
	// eslint-disable-next-line @typescript-eslint/no-shadow
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
	videoBitsPerSecond = 12000000,
}: {
	videoBitsPerSecond?: number
}) => {
	const recordedBlobs = useRef<Blob[]>([])
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

	// const ws = useRef<WebSocket>()

	const [type, setType] = useState<ElementType<typeof types>>()

	const handleDataAvailable = (event: BlobEvent): any => {
		if (event.data && event.data.size > 0) {
			recordedBlobs.current.push(event.data)
		}
	}

	const ctx = useRef<AudioContext | null>(null)
	const dest = useRef<MediaStreamAudioDestinationNode | null>(null)

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

		const canvasStream = (canvas as CanvasElement).captureStream(60)

		if (!canvasStream) {
			throw Error('No stream found')
		}

		const videoType = types.find(t => MediaRecorder.isTypeSupported(t))
		if (!videoType) {
			throw Error('No supported type found for MediaRecorder')
		}

		setType(videoType)

		try {
			ctx.current = new AudioContext({})

			const streams = remoteStreams.map(r => {
				const tracks = r.getTracks().filter(t => t.kind === 'audio')
				const stream = new MediaStream(tracks)
				return ctx.current?.createMediaStreamSource(stream)
			})

			dest.current = ctx.current.createMediaStreamDestination()

			streams.forEach(stream => {
				if (!dest.current || !stream) return
				stream.connect(dest.current)
			})

			ctx.current.createMediaStreamSource(localStream).connect(dest.current)

			const recorder = new MediaRecorder(
				new MediaStream([
					...canvasStream.getTracks(),
					...dest.current.stream.getTracks(),
				]),
				{
					videoBitsPerSecond,
					mimeType: videoType,
				}
			)

			recorder.ondataavailable = handleDataAvailable
			recorder.start(100) // collect 100ms of data blobs

			setMediaRecorder(recorder)
		} catch (e) {
			console.error(e)
		}
	}

	const stopRecording = () => {
		if (mediaRecorder?.state === 'inactive') return
		if (mediaRecorder?.state === 'recording') {
			try {
				mediaRecorder?.stop()
			} catch (e) {
				console.log('Stop recording error: ', e)
			}
		} else console.error('Cannot stop canvas recorder', mediaRecorder?.state)
	}

	// const download = async (fileName?: string) => {
	// 	// const blob = await getBlobs()
	// 	// // eslint-disable-next-line no-param-reassign
	// 	// fileName = fileName || `${'recording.'}${extension(type as string)}`
	// 	// saveAs(blob, fileName)
	// }

	const getBlobs = async () => {
		try {
			const superblob = new Blob(recordedBlobs.current, { type })
			const arrayBuffer = await superblob.arrayBuffer()
			// recordedBlobs.current = []
			// setMediaRecorder(null)
			if (arrayBuffer) {
				try {
					return getSeekableWebM(arrayBuffer)
				} catch (e) {
					console.error(e)
					// Sentry.captureException(
					// 	new Error(`Failed to make the blob seekable. ${JSON.stringify(e)}`)
					// )
				}
			}
			return superblob
		} catch (e) {
			console.error(e)
			// Sentry.captureException(
			// 	new Error(`Failed to get blobs. ${JSON.stringify(e)}`)
			// )
			return undefined
		}
	}

	const reset = () => {
		recordedBlobs.current = []
		setMediaRecorder(null)
	}

	return {
		startRecording,
		stopRecording,
		getBlobs,
		reset,
	}
}

export default useCanvasRecorder
