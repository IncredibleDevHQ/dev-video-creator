/* eslint-disable @typescript-eslint/no-unused-vars */
import { Block } from 'editor/src/utils/types'
import React, {
  useEffect,
  useMemo
} from 'react'
import { IoChevronBackOutline } from 'react-icons/io5'
import useMeasure from 'react-use-measure'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { flickNameAtom } from 'src/stores/flick.store'
import studioAtom, {
  studioStateAtom
} from 'src/stores/studio.store'
import useCanvasRecorder from 'src/utils/hooks/useCanvasRecorder'
import useUpdateState from 'src/utils/hooks/useUpdateState'
import { useUser } from 'src/utils/providers/auth'
import { Heading, Text } from 'ui/src'
import { ViewConfig } from 'utils/src'
import CanvasComponent, {
  StudioContext
} from '../canvas/CanvasComponent'
import RecordingControls from '../RecordingControls'
import Countdown from './Countdown'
import MediaControls from './MediaControls'
import MiniTimeline from './MiniTimeline'

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
	const { user } = useUser()

	const state = useRecoilValue(studioStateAtom)
	const { updateState, reset } = useUpdateState(true)
	// const activeObjectIndex = useRecoilValue(activeObjectIndexAtom)
	const setStudio = useSetRecoilState(studioAtom)
	const flickName = useRecoilValue(flickNameAtom)

	// used to measure the div
	const [ref, bounds] = useMeasure()

	// const Canvas = React.memo(CanvasComponent)

	const {
		startRecording: startCanvasRecording,
		stopRecording: stopCanvasRecording,
		// reset: resetCanvas,
		// getBlobs,
	} = useCanvasRecorder({})

	const start = () => {
		try {
			const canvas = document
				.getElementsByClassName('konvajs-content')[0]
				.getElementsByTagName('canvas')[0]
			console.log('start', canvas)
			// // if (
			// // 	dataConfig &&
			// // 	dataConfig[activeObjectIndex]?.type !== 'introBlock'
			// // )
			// // setTopLayerChildren({ id: nanoid(), state: 'transition moveAway' })
			// if (canvas)
				// startCanvasRecording(canvas, {
				// 	localStream: stream as MediaStream,
				// 	remoteStreams: userAudios,
				// })
		} catch (e) {
			console.log(e)
		}

		// setResetTimer(false)
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
		stopCanvasRecording()
		updateState('preview')
		// }
	}

	// Hooks
	const value = useMemo(
		() => ({
			start,
			stop,
		}),
		[]
	)

	// // Write into studio store
	// useMemo(() => {
	// 	setStudio(prev => ({
	// 		...prev,
	// 		users,
	// 	}))
	// }, [users])

	useEffect(() => {
		// if (state === 'startRecording' || state === 'recording') start()
		if (state === 'stopRecording') stop()
	}, [state])

	console.log('Studio', state)

	return (
		<StudioContext.Provider value={value}>
			<Countdown updateState={updateState} />
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
				{/* TODO Think abt removing upload state, because it might interfere if the user moves to the next block and records */}
				{state !== 'preview' && state !== 'upload' ? (
					<>
						<div className='grid grid-cols-12 flex-1 items-center'>
							<div
								className='flex justify-center items-center col-span-8 col-start-3 w-full h-full'
								ref={ref}
							>
								<CanvasComponent
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
							shortsMode={viewConfig?.mode === 'Portrait'}
							isPreview={false}
							updateState={updateState}
						/>
					</>
				) : (
					<>Video</>
					//   <div className="flex items-center justify-center flex-col w-full flex-1 pt-4">
					//     {recordedBlocks && (
					//       <div
					//         style={{
					//           height: '80vh',
					//           width: viewConfig?.mode === 'Portrait'
					//             ? `${window.innerHeight / 2.25}px`
					//             : `${window.innerWidth / 1.5}px`,
					//         }}
					//         className="flex justify-center items-center w-full flex-col"
					//       >
					//         <video
					//           height="auto"
					//           className="w-full"
					//           controls
					//           autoPlay={false}
					//           src={(() => {
					//             const newSrc =
					//               recordedBlocks && currentBlock
					//                 ? recordedBlocks?.find((b) => b.id === currentBlock.id)
					//                     ?.objectUrl || ''
					//                 : ''
					//             if (newSrc.includes('blob')) return newSrc
					//             return `${config.storage.baseUrl}${newSrc}`
					//           })()}
					//           key={nanoid()}
					//         />

					// )}
					// </div>
				)}

				{/* // TODO when calling mini time line filter dataConfig for continuousRecording */}
				<MiniTimeline dataConfig={dataConfig} />
			</div>
		</StudioContext.Provider>
	)
}

export default Studio
