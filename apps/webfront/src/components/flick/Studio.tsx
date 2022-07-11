/* eslint-disable @typescript-eslint/no-unused-vars */
import { Block } from 'editor/src/utils/types'
import React, { createContext, useMemo } from 'react'
import { IoChevronBackOutline } from 'react-icons/io5'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import { useGetRtcTokenMutation } from 'src/graphql/generated'
import { flickNameAtom } from 'src/stores/flick.store'
import useCanvasRecorder from 'src/utils/hooks/useCanvasRecorder'
import { useUser } from 'src/utils/providers/auth'
import { Heading, Text } from 'ui/src'
import { ViewConfig } from 'utils/src'
import CanvasComponent from './canvas/CanvasComponent'
import MediaControls from './MediaControls'
import MiniTimeline from './MiniTimeline'
import RecordingControls from './RecordingControls'

const Studio = ({
	fragmentId,
	flickId,
	dataConfig,
	viewConfig,
}: {
	fragmentId: string
	flickId: string
	dataConfig: Block[]
	viewConfig: ViewConfig
}) => {
	const StudioContext = createContext<{
		start?: () => void
		stop?: () => void
	}>({})

	// const state = useRecoilValue(studioStateAtom)
	const flickName = useRecoilValue(flickNameAtom)
	const { user } = useUser()

	// used to measure the div
	const [ref, bounds] = useMeasure()

	const Canvas = React.memo(CanvasComponent)

	const [getRTCToken] = useGetRtcTokenMutation({
		variables: { fragmentId, flickId },
	})

	// const { tracks, error } = createMicrophoneAndCameraTracks(
	// 	{
	// 		microphoneId: localStorage.getItem('preferred-microphone') || '',
	// 	},
	// 	{
	// 		cameraId: localStorage.getItem('preferred-camera') || '',
	// 		encoderConfig: {
	// 			width: 960,
	// 			height: 720,
	// 			frameRate: 60,
	// 			bitrateMax: 3000,
	// 			bitrateMin: 2200,
	// 		},
	// 	}
	// )()

	// const { stream, join, users, mute, leave, userAudios, renewToken } = useAgora(
	// 	fragmentId,
	// 	{
	// 		onTokenWillExpire: async () => {
	// 			const { data } = await getRTCToken({
	// 				variables: { fragmentId, flickId },
	// 			})
	// 			if (data?.RTCToken?.token) {
	// 				renewToken(data.RTCToken.token)
	// 			}
	// 		},
	// 		onTokenDidExpire: async () => {
	// 			const { data } = await getRTCToken({
	// 				variables: { fragmentId, flickId },
	// 			})
	// 			if (data?.RTCToken?.token) {
	// 				const participantId = viewConfig?.speakers?.find(
	// 					(participant: FlickParticipantsFragment) =>
	// 						participant.userSub === user?.uid
	// 				)?.id
	// 				if (participantId) {
	// 					join(data?.RTCToken?.token, participantId as string, tracks)
	// 				} else {
	// 					leave()
	// 					// clearRecordedBlocks()
	// 					emitToast(
	// 						'Yikes. Something went wrong.You do not belong to this studio!! Please ask the host to invite you again.',
	// 						{
	// 							type: 'error',
	// 						}
	// 					)
	// 					// history.goBack()
	// 				}
	// 			}
	// 		},
	// 	},
	// 	tracks
	// )

	const {
		startRecording,
		stopRecording,
		// reset: resetCanvas,
		// getBlobs,
	} = useCanvasRecorder({})

	const start = () => {
		const canvas = document
			.getElementsByClassName('konvajs-content')[0]
			.getElementsByTagName('canvas')[0]
		// if (
		// 	dataConfig &&
		// 	dataConfig[payload.activeObjectIndex]?.type !== 'introBlock'
		// )
		// 	setTopLayerChildren({ id: nanoid(), state: 'transition moveAway' })
		// startRecording(canvas, {
		// 	localStream: stream as MediaStream,
		// 	remoteStreams: userAudios,
		// })

		// setResetTimer(false)

		// if (state === 'ready' && payload?.activeObjectIndex === 0)
		// 	setState('start-recording')
		// else if (state === 'ready' && payload?.activeObjectIndex !== 0)
		// 	setState('recording')
		// else if (state === 'resumed' && payload?.activeObjectIndex === 0) {
		// 	setState('start-recording')
		// } else if (state === 'resumed' && payload?.activeObjectIndex !== 0) {
		// 	setState('recording')
		// }
	}

	const stop = () => {
		// const thumbnailURL = stageRef.current?.toDataURL()
		// setBlockThumbnails((bts: any) => {
		// 	if (currentBlock) {
		// 		// eslint-disable-next-line no-param-reassign
		// 		bts[currentBlock.id] = thumbnailURL
		// 	}
		// 	return bts
		// })
		// TODO: update for continuous recording
		// if (dataConfig?.[payload?.activeObjectIndex].type !== 'outroBlock')
		// 	setTopLayerChildren({ id: nanoid(), state: 'transition moveIn' })
		// else {
		stopRecording()
		// setState('preview')
		// }
	}

	const value = useMemo(
		() => ({
			start,
			stop,
		}),
		[]
	)

	console.log('Studio', bounds, dataConfig, viewConfig)
	return (
		<StudioContext.Provider value={value}>
			<div className='flex flex-col w-screen h-screen overflow-hidden backdrop-blur-md bg-black/80'>
				<div className='flex h-12 w-full flex-row items-center justify-between bg-gray-900 px-5'>
					<div className='flex items-center gap-x-2 cursor-pointer'>
						<IoChevronBackOutline className='text-gray-400 h-4 w-4' />
						<Text className='text-dark-title font-medium' textStyle='caption'>
							Go to Notebook
						</Text>
					</div>
					<Heading
						as='h1'
						textStyle='smallTitle'
						className='text-dark-title absolute left-0 right-0 mx-auto w-96 text-center truncate cursor-default'
					>
						{flickName}
					</Heading>
					<MediaControls />
				</div>
				<div className='grid grid-cols-8 flex-1 items-center'>
					<div
						className='flex justify-center col-span-6 col-start-2 w-full h-full pt-8'
						ref={ref}
					>
						<Canvas
							bounds={bounds}
							dataConfig={dataConfig}
							viewConfig={viewConfig}
							isPreview={false}
							flickId={flickId}
						/>
					</div>
				</div>
				{/* // TODO when calling recording controls bar filter dataConfig for continuousRecording */}
				<RecordingControls
					dataConfig={dataConfig}
					viewConfig={viewConfig}
					shortsMode={false}
				/>
				{/* // TODO when calling mini time line filter dataConfig for continuousRecording */}
        <MiniTimeline dataConfig={dataConfig}/>
			</div>
		</StudioContext.Provider>
	)
}

export default Studio
