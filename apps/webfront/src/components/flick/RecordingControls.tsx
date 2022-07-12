/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { Block, CodeBlockProps } from 'editor/src/utils/types'
import { useMemo } from 'react'
import {
	IoArrowBackOutline,
	IoArrowForwardOutline,
	IoPause,
	IoPlay,
} from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import {
	activeObjectIndexAtom,
	controlsConfigAtom,
	payloadFamily,
	StudioState,
	studioStateAtom,
} from 'src/stores/studio.store'
import {
	handleIntroBlock,
	handleCodeBlock,
	handleVideoBlock,
	handleImageBlock,
	handleListBlock,
	handleOutroBlock,
} from 'src/utils/helpers/recordingControlsFunctions'
import useUpdateActiveObjectIndex from 'src/utils/hooks/useUpdateActiveObjectIndex'
import {
	ViewConfig,
	CodeBlockView,
	OutroBlockView,
	CodeAnimation,
} from 'utils/src'
import CustomLayout from '../../../svg/RecordingScreen/CustomLayout.svg'
import OnlyUserMedia from '../../../svg/RecordingScreen/OnlyUserMedia.svg'
import StartRecordIcon from '../../../svg/RecordingScreen/StartRecord.svg'
import StopRecordIcon from '../../../svg/RecordingScreen/StopRecord.svg'
import ThreeWaySwap from '../../../svg/RecordingScreen/ThreeWaySwap.svg'

const RecordingControls = ({
	dataConfig,
	viewConfig,
	shortsMode,
	isPreview,
	updateState,
}: {
	dataConfig: Block[]
	viewConfig: ViewConfig
	shortsMode: boolean
	isPreview: boolean
	updateState?: (state: StudioState) => void
}) => {
	const state = useRecoilValue(studioStateAtom)
	const controlsConfig = useRecoilValue(controlsConfigAtom)
	const activeObjectIndex = useRecoilValue(activeObjectIndexAtom)
	const payload = useRecoilValue(payloadFamily(controlsConfig?.blockId || ''))
	const { updatePayload } = controlsConfig

	const { updateActiveObjectIndex } = useUpdateActiveObjectIndex(!isPreview)

	const { isIntro, isOutro, isImage, isVideo, codeAnimation } = useMemo(() => {
		const blockType = dataConfig[activeObjectIndex]?.type
		const codeBlockProps = dataConfig[activeObjectIndex || 0] as CodeBlockProps
		const codeBlockViewProps = viewConfig.blocks[codeBlockProps?.id]
			?.view as CodeBlockView

		const codeAnim = codeBlockViewProps?.code?.animation
		return {
			isIntro: blockType === 'introBlock',
			isOutro: blockType === 'outroBlock',
			isImage: blockType === 'imageBlock',
			isVideo: blockType === 'videoBlock',
			isCode: blockType === 'codeBlock',
			codeAnimation: codeAnim,
		}
	}, [activeObjectIndex, dataConfig, viewConfig.blocks])

	const isBackDisabled = () =>
		(activeObjectIndex === 0 && payload?.activeIntroIndex === 0) ||
		payload?.activePointIndex === 0 ||
		isVideo ||
		isImage ||
		(codeAnimation === CodeAnimation.HighlightLines &&
			payload?.activeBlockIndex === 0 &&
			payload?.focusBlockCode === false) ||
		(codeAnimation === CodeAnimation.TypeLines &&
			payload?.currentIndex === 0) ||
		isOutro

	const performAction = (
		blockPayload: any,
		direction: 'next' | 'previous' = 'next'
	): boolean | undefined => {
		const block = dataConfig[activeObjectIndex]

		switch (block.type) {
			case 'introBlock':
				return handleIntroBlock(
					viewConfig,
					blockPayload,
					updatePayload,
					updateActiveObjectIndex,
					activeObjectIndex,
					direction,
					block.id
				)
			// break
			case 'codeBlock':
				return handleCodeBlock(
					viewConfig,
					blockPayload,
					updatePayload,
					controlsConfig,
					direction,
					block.id
				)
			// break
			case 'videoBlock':
				return handleVideoBlock(direction)
			// break
			case 'imageBlock':
				return handleImageBlock(direction)
			// break
			case 'listBlock':
				return handleListBlock(
					viewConfig,
					blockPayload,
					updatePayload,
					controlsConfig,
					direction,
					block
				)
			// break
			case 'headingBlock':
				return handleImageBlock(direction)
			// break
			case 'outroBlock':
				return handleOutroBlock(
					viewConfig,
					blockPayload,
					updatePayload,
					updateActiveObjectIndex,
					activeObjectIndex,
					direction,
					block.id
				)
			default:
				return false
		}
	}

	return (
		<div className='grid grid-cols-12 w-full'>
			<div
				// style={{
				// 	top: `${
				// 		(stageRef?.current?.y() || 0) + stageHeight + (shortsMode ? 0 : 25)
				// 	}px`,
				// 	width: `${shortsMode ? stageWidth + 35 : stageWidth}px`,
				// }}
				className='flex items-center col-span-8 col-start-3 pb-6'
			>
				{/* Stop Recording Button */}
				{(state === 'recording' || state === 'startRecording') && (
					<button
						type='button'
						onClick={() => {
							// studio.stopRecording()
							updateState?.('stopRecording')
						}}
						className={cx(
							'flex gap-x-2 items-center justify-between border backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm w-24 absolute min-w-max'
							// {
							// 	'left-0': shortsMode,
							// 	'bg-grey-500 bg-opacity-50 border-gray-600': timeLimit
							// 		? timer < timeLimit * 60
							// 		: true,
							// 	'bg-error-10 text-error border-error': timeLimit
							// 		? timer >= timeLimit * 60
							// 		: false,
							// }
						)}
					>
						<StopRecordIcon className='m-px w-5 h-5 flex-shrink-0' />
						{/* <Timer target={(timeLimit || 3) * 60} timer={timer} /> */}
						{/* {timeLimit && (
						<small className='text-xs flex-shrink-0 text-dark-title'>
							Limit: {timeLimit}min{' '}
						</small>
					)} */}
					</button>
				)}
				{/* Start Recording button */}
				{(state === 'ready' || state === 'resumed') && (
					<button
						className={cx(
							'bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm absolute flex items-center',
							{
								'left-0': shortsMode,
							}
						)}
						type='button'
						onClick={() => {
							console.log(
								'start recording',
								document
									.getElementsByClassName('konvajs-content')[0]
									.getElementsByTagName('canvas')[0]
							)
							updateState?.('countDown')
						}}
					>
						<StartRecordIcon className='m-px w-5 h-5' />
						<small
							className='text-xs text-dark-title hover:text-white ml-2'
							// onClick={e => {
							// 	e.stopPropagation()
							// 	openTimerModal()
							// }}
						>
							{/* {timeLimit ? `Limit: ${timeLimit}min` : 'No Time Limit'} */}
							Limit: min
						</small>
					</button>
				)}
				<div className='flex items-center ml-auto'>
					{/* Video Play button */}
					{isVideo && (
						<button
							className='bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100'
							type='button'
							onClick={() => {
								const { playing, videoElement } = controlsConfig
								const next = !playing
								updatePayload?.({
									playing: next,
									currentTime: videoElement?.currentTime || 0,
								})
							}}
						>
							{controlsConfig?.playing ? (
								<IoPause className='m-px w-5 h-5 p-px' />
							) : (
								<IoPlay className='m-px w-5 h-5 p-px' />
							)}
						</button>
					)}
					{/* Swap buttons */}
					{state !== 'preview' && state !== 'upload' && (
						<button
							type='button'
							className={cx(
								'flex gap-x-2 items-center justify-between border bg-grey-400 bg-opacity-50 backdrop-filter backdrop-blur-2xl border-gray-600 rounded-sm ml-4',
								{
									'bg-grey-500 bg-opacity-100': !isIntro && !isOutro,
									'cursor-not-allowed': isIntro || isOutro,
								}
							)}
							disabled={isIntro || isOutro}
						>
							<div
								className={cx(
									'bg-transparent py-1 px-1 rounded-sm my-1 ml-1 transition-all duration-200 filter',
									{
										'bg-transparent': isIntro || isOutro,
										'bg-grey-900':
											payload?.fragmentState === 'onlyUserMedia' &&
											!isIntro &&
											!isOutro,
										'brightness-50': isIntro || isOutro,
										'brightness-75':
											(payload?.fragmentState === 'customLayout' ||
												payload?.fragmentState === 'onlyFragment') &&
											!isIntro &&
											!isOutro,
									}
								)}
								onClick={() =>
									updatePayload?.({
										fragmentState: 'onlyUserMedia',
									})
								}
							>
								<OnlyUserMedia className={cx('m-px w-5 h-4 ', {})} />
							</div>
							<div
								className={cx(
									'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
									{
										'bg-transparent': isIntro || isOutro,
										'bg-grey-900':
											payload?.fragmentState === 'customLayout' &&
											!isIntro &&
											!isOutro,
										'brightness-50': isIntro || isOutro,
										'brightness-75':
											(payload?.fragmentState === 'onlyUserMedia' ||
												payload?.fragmentState === 'onlyFragment') &&
											!isIntro &&
											!isOutro,
									}
								)}
								onClick={() =>
									updatePayload?.({
										fragmentState: 'customLayout',
									})
								}
							>
								<ThreeWaySwap className={cx('m-px w-5 h-4', {})} />
							</div>
							<div
								className={cx(
									'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
									{
										'bg-transparent': isIntro || isOutro,
										'bg-grey-900':
											payload?.fragmentState === 'onlyFragment' &&
											!isIntro &&
											!isOutro,
										'brightness-50': isIntro || isOutro,
										'brightness-75':
											(payload?.fragmentState === 'customLayout' ||
												payload?.fragmentState === 'onlyUserMedia') &&
											!isIntro &&
											!isOutro,
									}
								)}
								onClick={() =>
									updatePayload?.({
										fragmentState: 'onlyFragment',
									})
								}
							>
								<CustomLayout className={cx('m-px w-5 h-4', {})} />
							</div>
						</button>
					)}
					{/* previous button */}
					<button
						className={cx(
							'bg-grey-400 border border-gray-600 backdrop-filter bg-opacity-50 backdrop-blur-2xl p-1.5 rounded-sm ml-4',
							{
								'bg-grey-500 bg-opacity-100 text-gray-100': !isBackDisabled(),
								'text-gray-500 cursor-not-allowed': isBackDisabled(),
							}
						)}
						type='button'
						disabled={isBackDisabled()}
						onClick={() => {
							if (payload) performAction(payload, 'previous')
						}}
					>
						<IoArrowBackOutline
							style={{
								margin: '3px',
							}}
							className='w-4 h-4 p-px'
						/>
					</button>
					{/* next button */}
					<button
						className={cx(
							'bg-grey-500 border border-gray-600 backdrop-filter bg-opacity-100 backdrop-blur-2xl p-1.5 rounded-sm ml-2 text-gray-100',
							{
								'text-gray-500 cursor-not-allowed':
									activeObjectIndex === dataConfig.length - 1 &&
									payload.activeOutroIndex ===
										((
											viewConfig?.blocks[dataConfig[activeObjectIndex].id]
												?.view as OutroBlockView
										)?.outro?.order?.length || 0) -
											1,
							}
						)}
						type='button'
						disabled={
							activeObjectIndex === dataConfig.length - 1 &&
							payload.activeOutroIndex ===
								((
									viewConfig?.blocks[dataConfig[activeObjectIndex].id]
										?.view as OutroBlockView
								)?.outro?.order?.length || 0) -
									1
						}
						onClick={() => {
							let isBlockCompleted: boolean | undefined = false
							if (payload) {
								isBlockCompleted = performAction(payload, 'next')
								if (
									isBlockCompleted &&
									(state === 'recording' ||
										state === 'startRecording' ||
										state === 'resumed' ||
										state === 'ready')
								) {
									if (!viewConfig.continuousRecording) {
										if (state === 'recording' || state === 'startRecording') {
											// studio.stopRecording()
											updateState?.('stopRecording')
										}
									} else {
										// TODO
										// If continuous recording is enabled, we need to track block completions and add metadata
										// if (!currentBlock)
										// 	throw new Error('currentBlock is not defined')

										// addContinuousRecordedBlockIds(currentBlock.id, timer)

										// After tracking metadata , update active object index
										// eslint-disable-next-line no-lonely-if
										if (
											activeObjectIndex <
											viewConfig.selectedBlocks.length - 1
										) {
											updateActiveObjectIndex?.(activeObjectIndex + 1)
											isBlockCompleted = false
										} else if (
											state === 'recording' ||
											state === 'startRecording'
										) {
											// studio.stopRecording()
											updateState?.('stopRecording')
										}
									}
								}
							}
						}}
					>
						<IoArrowForwardOutline
							style={{
								margin: '3px',
							}}
							className='w-4 h-4 p-px'
						/>
					</button>
				</div>
			</div>
		</div>
	)
}
export default RecordingControls
