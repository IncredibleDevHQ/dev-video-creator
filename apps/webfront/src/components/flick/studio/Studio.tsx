/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { css, cx } from '@emotion/css'
import { Dialog } from '@headlessui/react'
import { Block } from 'editor/src/utils/types'
import getBlobDuration from 'get-blob-duration'
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiRotateCcw } from 'react-icons/fi'
import { IoChevronBackOutline } from 'react-icons/io5'
import useMeasure from 'react-use-measure'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	Content_Types,
	SetupRecordingMutationVariables,
	useDeleteBlockGroupMutation,
	useGetRecordingsLazyQuery,
	useSaveRecordedBlockMutation,
	useSetupRecordingMutation,
} from 'src/graphql/generated'
import { flickAtom, flickNameAtom, openStudioAtom } from 'src/stores/flick.store'
import {
	activeObjectIndexAtom,
	agoraActionsAtom,
	isStudioControllerAtom,
	streamAtom,
	studioStateAtom,
} from 'src/stores/studio.store'
import useCanvasRecorder from 'src/utils/hooks/useCanvasRecorder'
import useUpdateState from 'src/utils/hooks/useUpdateState'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
	useMap,
} from 'src/utils/liveblocks.config'
import { useUser } from 'src/utils/providers/auth'
import { Button, dismissToast, emitToast, Heading, Text, updateToast } from 'ui/src'
import { useEnv, useUploadFile, ViewConfig } from 'utils/src'
import UploadIcon from '../../../../svg/RecordingScreen/Upload.svg'
import CanvasComponent, { StudioContext } from '../canvas/CanvasComponent'
import RecordingControls from '../RecordingControls'
import Countdown from './Countdown'
import MediaControls from './MediaControls'
import MiniTimeline from './MiniTimeline'
import Notes from './Notes'

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
	const { storage } = useEnv()

	const state = useRecoilValue(studioStateAtom)
	const { updateState, reset } = useUpdateState(true)
	const activeObjectIndex = useRecoilValue(activeObjectIndexAtom)
	const flick = useRecoilValue(flickAtom)
	const flickName = useRecoilValue(flickNameAtom)
	const setOpenStudio = useSetRecoilState(openStudioAtom)
	const agoraStreamData = useRecoilValue(streamAtom)
  const agoraActions = useRecoilValue(agoraActionsAtom)

	const [isHost, setIsHost] = useState(false)
	const [isStudioController, setIsStudioController] = useRecoilState(isStudioControllerAtom)
	const [controlsRequestorSub, setControlsRequestorSub] = useState('')
	// bool used to open the modal which asks the host to accept or reject the request from the collaborator to get controls
	const [openControlsApprovalModal, setOpenControlsApprovalModal] =
		useState(false)

	const recordedBlocks = useMap('recordedBlocks')
	const broadcast = useBroadcastEvent()

	const blockThumbnails = useRef<{ [key: string]: string }>({})
	const stageRef = useRef<Konva.Stage>(null)
	// ref to store the recording id
	const recordingId = useRef<string>('')
	// bool to warn and ask the users to retake the multi block recording
	const confirmMultiBlockRetake = useRef<boolean>(false)

	const [uploadFile] = useUploadFile()
	const [saveBlock] = useSaveRecordedBlockMutation()
	// const [saveMultiBlocks] = useSaveMultipleBlocksMutation()
	const [deleteBlockGroupMutation] = useDeleteBlockGroupMutation()
	// to get the recording id
	const [getRecordingId] = useGetRecordingsLazyQuery({
		variables: {
			flickId,
			fragmentId,
		},
		fetchPolicy: 'cache-first',
	})
	const [setupRecording] = useSetupRecordingMutation()

	// used to measure the div
	const [ref, bounds] = useMeasure()

	const {
		startRecording: startCanvasRecording,
		stopRecording: stopCanvasRecording,
		reset: resetCanvas,
		getBlobs,
	} = useCanvasRecorder({})

	const start = () => {
		try {
			const canvas = document
				.getElementsByClassName('konvajs-content')[0]
				.getElementsByTagName('canvas')[0]
			// if (
			// 	dataConfig &&
			// 	dataConfig[activeObjectIndex]?.type !== 'introBlock'
			// )
			// setTopLayerChildren({ id: nanoid(), state: 'transition moveAway' })
			startCanvasRecording(canvas, {
				localStream: agoraStreamData?.stream as MediaStream,
				remoteStreams: agoraStreamData?.audios as MediaStream[],
			})
		} catch (e) {
			console.log(e)
		}
		// setResetTimer(false)
	}

	// console.log('studio', agoraStreamData)

	// function which gets triggered on stop, used for converting the blobs in to url and
	// store it in recorded blocks and checking if the blobs are empty
	const prepareVideo = async () => {
		const currentBlockDataConfig = dataConfig[activeObjectIndex]
		console.log('Preparing video...')
		const blob = await getBlobs()
		if (!blob || blob?.size <= 0) {
			updateState('resumed')
			emitToast('Could not produce the video', {
				type: 'error',
				autoClose: 2000,
			})
			// Sentry.captureException(
			// 	new Error(
			// 		`Could not produce the video.Failed to get blobs when preparing video. ${JSON.stringify(
			// 			{
			// 				blobSize: blob?.size,
			// 				user: sub,
			// 				currentBlock: current,
			// 			}
			// 		)}`
			// 	)
			// )
			return
		}
		const url = URL.createObjectURL(blob)
		recordedBlocks?.set(currentBlockDataConfig.id, url)
		updateState('preview')
	}

	const upload = async (blockId: string) => {
		const toast = emitToast(
			'Pushing pixels... \n Our hamsters are gift-wrapping your Fragment. Do hold. :)',
			{
				type: 'info',
				autoClose: false,
			}
		)

		try {
			const uploadVideoFile = await getBlobs()
			resetCanvas()
			if (!uploadVideoFile) throw Error('Blobs is undefined')

			const duration = await getBlobDuration(uploadVideoFile)
			const { uuid: objectUrl } = await uploadFile({
				extension: 'webm',
				file: uploadVideoFile,
				handleProgress: ({ percentage }) => {
					updateToast(toast, `Pushing pixels... (${percentage}%)`, {
						type: 'info',
						autoClose: false,
					})
				},
			})

			let thumbnailFilename: string | null = null
			// Upload block thumbnail
			if (blockThumbnails.current[blockId]) {
				const thumbnailBlob = await fetch(
					blockThumbnails.current[blockId]
				).then(r => r.blob())

				const { uuid } = await uploadFile({
					extension: 'png',
					file: thumbnailBlob,
					handleProgress: ({ percentage }) => {
						updateToast(toast, `Pushing pixels... (${percentage}%)`, {
							type: 'info',
							autoClose: false,
						})
					},
				})
				thumbnailFilename = uuid
			}
			// TODO
			// if (
			// 	viewConfig.continuousRecording &&
			// 	continuousRecordedBlockIds
			// ) {
			// 	// if continuous recording is enabled, mark all the blocks that were recorded in the current take as saved
			// 	continuousRecordedBlockIds.forEach(block => {
			// 		updateRecordedBlocks(block.blockId, objectUrl)
			// 	})
			// 	console.log('continuous recorded blocks:', continuousRecordedBlockIds)
			// 	// save all continuous recorded blocks to hasura
			// 	await saveMultiBlocks({
			// 		variables: {
			// 			blocks: continuousRecordedBlockIds.map(block => ({
			// 				blockId: block.blockId,
			// 				duration: block.duration,
			// 				thumbnail: blockThumbnail, // TODO: generate thumbnail for each block in continuous recording mode
			// 			})),
			// 			flickId: fragment?.flickId,
			// 			fragmentId,
			// 			recordingId: studio.recordingId,
			// 			url: objectUrl,
			// 		},
			// 	})
			// 	history.push(`/story/${fragment?.flickId}/${fragmentId}`)
			// } else {
			// Once the block video is uploaded to s3 , save the block to the table
			await saveBlock({
				variables: {
					flickId,
					fragmentId,
					recordingId: recordingId.current,
					objectUrl,
					thumbnail: thumbnailFilename,
					// TODO: Update creation meta and playbackDuration when implementing continuous recording
					blockId,
					playbackDuration: duration,
				},
			})
			recordedBlocks?.set(blockId, objectUrl)
			// }
			dismissToast(toast)
		} catch (e) {
			console.error('Upload error : ', e)
			// Sentry.captureException(e)
			emitToast(
				'Upload failed.\n Click here to retry before recording another block.',
				{
					type: 'error',
					autoClose: false,
					onClick: () => upload(blockId),
				}
			)
		}
	}

	const stop = () => {
		const currentBlockDataConfig = dataConfig[activeObjectIndex]
		const thumbnailURL = stageRef.current?.toDataURL()
		if (thumbnailURL) {
			blockThumbnails.current[currentBlockDataConfig.id] = thumbnailURL
		}
		// if (dataConfig?.[payload?.activeObjectIndex].type !== 'outroBlock')
		// 	setTopLayerChildren({ id: nanoid(), state: 'transition moveIn' })
		// else {
		stopCanvasRecording()
		setTimeout(() => {
			prepareVideo()
		}, 250)
	}

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.RetakeButtonClick) {
			resetCanvas()
			// setTopLayerChildren?.({ id: nanoid(), state: '' })
			// setResetTimer(true)
		}
		if (event.type === RoomEventTypes.SaveButtonClick) {
			// setTopLayerChildren?.({ id: nanoid(), state: '' })
			// setResetTimer(true)
		}
		if (event.type === RoomEventTypes.RequestControls) {
			if (isStudioController) {
        if(event.payload.requestorSub === '') return
        setControlsRequestorSub(event.payload.requestorSub)
        setOpenControlsApprovalModal(true)
			}
		}
    if (event.type === RoomEventTypes.ApproveRequestControls) {
			if (event.payload.requestorSub === user?.uid) {
        setIsStudioController(true)
			}
		}
    if(event.type === RoomEventTypes.RevokeControls) {
      if(isStudioController) {
        setIsStudioController(false)
      }
    }
	})

	// Hooks
	const value = useMemo(
		() => ({
			start,
			stop,
		}),
		[start]
	)

	// on unmount changing the state back to ready
	useEffect(() => {
		updateState('ready')
		return () => {
			reset('ready')
		}
	}, [])

  // remove local blobs from recorded blocks on unmount
  // this happens only when the user records and doent take any action and leaves the page
  useEffect(() => () => {
      if (
				recordedBlocks?.get(dataConfig[activeObjectIndex].id)?.includes('blob')
			)
				recordedBlocks.delete(dataConfig[activeObjectIndex].id)
    },[activeObjectIndex])

  useEffect(() => () => {
      if(!agoraStreamData?.stream || !agoraActions?.leave) return
      agoraStreamData.stream.getTracks().forEach(track => {
				track.stop()
			})
      agoraActions.leave()
    },[agoraStreamData?.stream, agoraActions?.leave])

	// fetch recordingId on mount
	useEffect(() => {
		;(async () => {
			const { data: recordingsData, error: getRecordingsError } =
				await getRecordingId()
			const recording = recordingsData?.Recording?.find(
				r => r.fragmentId === fragmentId
			)
			if (recording) recordingId.current = recording.id
			else {
				const variables = {
					editorState: dataConfig,
					flickId,
					fragmentId,
					viewConfig,
					contentType:
						viewConfig.mode === 'Portrait'
							? Content_Types.VerticalVideo
							: Content_Types.Video,
				} as SetupRecordingMutationVariables
				const { data } = await setupRecording({ variables })
				recordingId.current = data?.StartRecording?.recordingId || ''
			}
		})()
	}, [])

	useEffect(() => {
		if (!flick?.owner) return
		if (flick.owner.sub === user?.uid) {
			setIsHost(true)
			setIsStudioController(true)
		}
	}, [flick?.owner])

	useEffect(() => {
		if (state === 'stopRecording') stop()
	}, [state])

	return (
		<StudioContext.Provider value={value}>
			<Countdown updateState={updateState} />
			<div className='flex flex-col w-screen h-screen overflow-hidden backdrop-blur-md bg-black/80'>
				<div className='flex h-12 w-full flex-row items-center justify-between bg-gray-900 px-5'>
					<button
						type='button'
						className='flex items-center gap-x-2 cursor-pointer'
						onClick={() => {
							setOpenStudio(false)
						}}
					>
						<IoChevronBackOutline className='text-gray-400 h-4 w-4' />
						<Text className='text-dark-title font-medium' textStyle='caption'>
							Go to Notebook
						</Text>
					</button>
					<Heading
						as='h1'
						textStyle='smallTitle'
						className='text-dark-title absolute left-0 right-0 mx-auto w-96 text-center truncate cursor-default'
					>
						{flickName}
					</Heading>
					<div className='flex gap-x-3'>
						{!isStudioController && (
							<button
								disabled={state === 'recording'}
								type='button'
								className='bg-dark-100 hover:bg-dark-200 active:bg-dark-300 text-gray-100 rounded-sm text-size-xs-title font-normal flex items-center px-2 disabled:opacity-70 disabled:cursor-not-allowed'
								onClick={() => {
									broadcast({
										type: RoomEventTypes.RequestControls,
										payload: {
											requestorSub: user?.uid || '',
										},
									})
								}}
							>
								Request Control
							</button>
						)}
						{isHost && !isStudioController && (
							<button
								disabled={state === 'recording'}
								type='button'
								className='bg-dark-100 hover:bg-dark-200 active:bg-dark-300 text-gray-100 rounded-sm text-size-xs-title font-normal flex items-center px-2 disabled:opacity-70 disabled:cursor-not-allowed'
								onClick={() => {
									broadcast({
										type: RoomEventTypes.RevokeControls,
										payload: {}
									})
                  setIsStudioController(true)
								}}
							>
								Request Control
							</button>
						)}
						<MediaControls
							flickId={flickId}
							fragmentId={fragmentId}
							participantId={
								viewConfig.speakers.find(({ userSub }) => userSub === user?.uid)
									?.id
							}
						/>
					</div>
				</div>
				{state !== 'preview' ? (
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
									stage={stageRef}
								/>
							</div>
							<Notes dataConfig={dataConfig} bounds={bounds} />
						</div>
						<RecordingControls
							dataConfig={dataConfig}
							viewConfig={viewConfig}
							shortsMode={viewConfig?.mode === 'Portrait'}
							isPreview={false}
							updateState={updateState}
						/>
					</>
				) : (
					<div className='flex items-center justify-center flex-col w-full flex-1 pt-4'>
						{recordedBlocks && (
							<div
								style={{
									height: '80vh',
									width:
										viewConfig?.mode === 'Portrait'
											? `${window.innerHeight / 2.25}px`
											: `${window.innerWidth / 1.5}px`,
								}}
								className='flex justify-center items-center w-full flex-col'
							>
								{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
								<video
									height='auto'
									className='w-full'
									controls
									autoPlay={false}
									src={(() => {
										const newSrc =
											recordedBlocks?.get(dataConfig[activeObjectIndex].id) ||
											''
										if (newSrc.includes('blob')) return newSrc
										return `${storage.cdn}${newSrc}`
									})()}
									key={nanoid()}
								/>
								{isStudioController && (
									<div
										style={
											recordedBlocks
												?.get(dataConfig[activeObjectIndex].id)
												?.includes('blob')
												? {
														background: 'rgba(39, 39, 42, 0.5)',
														border: '0.5px solid #52525B',
														boxSizing: 'border-box',
														backdropFilter: 'blur(40px)',
														borderRadius: '4px',
												  }
												: {}
										}
										className='flex items-center rounded-md gap-x-2 mt-2 z-10 p-2 px-3'
									>
										{
											// if block already has a recording dont show save button
											// checks if the url in the recorded blocks is a blob url
											recordedBlocks
												?.get(dataConfig[activeObjectIndex].id)
												?.includes('blob') && (
												// Save and continue button
												<button
													className='bg-green-600 text-white rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-lg text-sm'
													type='button'
													onClick={() => {
														if (
															activeObjectIndex === undefined &&
															activeObjectIndex < 0
														)
															return
														// TODO move to the next block on click of save and continue
														broadcast({
															type: RoomEventTypes.SaveButtonClick,
															payload: {},
														})
														// TODO if we change the active object index we need to update the state
														// setTopLayerChildren?.({ id: nanoid(), state: '',})
														// setResetTimer(true)

														if (dataConfig?.[activeObjectIndex]?.id)
															// calls the upload function
															upload(dataConfig?.[activeObjectIndex]?.id)
														else {
															emitToast(
																'Something went wrong! Please try again later',
																{
																	type: 'error',
																}
															)
														}
													}}
												>
													<UploadIcon className='h-5 w-5 my-px' />
													Save and continue
												</button>
											)
										}
										{/* Retake button */}
										<button
											className='bg-grey-500 text-white rounded-sm py-1.5 px-2.5 flex items-center gap-x-2 font-bold hover:shadow-md text-sm'
											type='button'
											onClick={() => {
												const currentBlockURL = recordedBlocks?.get(
													dataConfig[activeObjectIndex].id
												)
												if (currentBlockURL) {
													// if found in recordedBlocks, find if webm is duplicate (meaning its part of continuous recording)
													const isPartOfContinuousRecording =
														Object.keys(recordedBlocks).filter(
															key =>
																recordedBlocks?.get(key) === currentBlockURL
														).length > 1

													// this if handles the case when the retake button is clicked on a block that is part of continuous recording
													if (isPartOfContinuousRecording) {
														// call action to delete all blocks with currBlock.objectUrl
														if (!confirmMultiBlockRetake.current) {
															emitToast(
																'Are you sure?\nYou are about to delete the recordings of all blocks that were recorded continuously along with this block.This action cannot be undone. If you would like to continue press retake again.',
																{
																	type: 'warning',
																}
															)
															confirmMultiBlockRetake.current = true
															return
															// eslint-disable-next-line no-else-return
														} else {
															deleteBlockGroupMutation({
																variables: {
																	objectUrl: currentBlockURL,
																	recordingId: recordingId.current,
																},
															})
															confirmMultiBlockRetake.current = false

															// remove all the blocks with the current block url in recordedBlocks
															Object.keys(recordedBlocks).forEach(block => {
																if (
																	recordedBlocks.get(block) === currentBlockURL
																) {
																	recordedBlocks.delete(block)
																}
															})
														}
													} else {
														// deletes the current block id from recorded blocks
														recordedBlocks.delete(
															dataConfig[activeObjectIndex].id
														)
													}
												}
												broadcast({
													type: RoomEventTypes.RetakeButtonClick,
													payload: {},
												})
												resetCanvas()
												updateState('resumed')
												// setTopLayerChildren?.({ id: nanoid(), state: '' })
												// setResetTimer(true)
											}}
										>
											<FiRotateCcw className='h-4 w-4 my-1' />
											Retake
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				)}
				<MiniTimeline
					dataConfig={dataConfig}
					continuousRecording={viewConfig?.continuousRecording}
					updateState={updateState}
				/>
			</div>
			{/* Controls request modal */}
			<Dialog
				open={isHost && openControlsApprovalModal}
				onClose={() => {
					setControlsRequestorSub('')
					setOpenControlsApprovalModal(false)
				}}
				className={cx(
					'rounded-lg mx-auto px-8 pt-8 pb-4 text-white',
					css`
						background-color: #27272a !important;
					`
				)}
			>
				<Dialog.Panel>
					<Dialog.Title className='font-main font-medium text-md text-gray-100'>
						Would you like to hand over the controls ?
					</Dialog.Title>
					<Button
						appearance='solid'
						type='button'
						size='small'
						className=''
						onClick={() => {
							broadcast({
								type: RoomEventTypes.ApproveRequestControls,
								payload: {
									requestorSub: controlsRequestorSub,
								},
							})
							setIsStudioController(false)
							setControlsRequestorSub('')
							setOpenControlsApprovalModal(false)
						}}
					>
						Approve
					</Button>
					<button
						type='button'
						className='text-red-500 font-main font-semibold'
						onClick={() => {
							setControlsRequestorSub('')
							setOpenControlsApprovalModal(false)
						}}
					>
						Reject
					</button>
				</Dialog.Panel>
			</Dialog>
		</StudioContext.Provider>
	)
}

export default Studio
