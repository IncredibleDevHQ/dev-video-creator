// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { Block, CodeBlockProps } from 'editor/src/utils/types'
import Konva from 'konva'
import { SetStateAction, useMemo } from 'react'
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
import ThreeWaySwap from '../../../svg/RecordingScreen/ThreeWaySwap.svg'
import Timer from './studio/Timer'

const RecordingControls = ({
	dataConfig,
	viewConfig,
	shortsMode,
	isPreview,
	stageRef,
	updateState,
	setContinuousRecordedBlockIds,
}: {
	dataConfig: Block[]
	viewConfig: ViewConfig
	shortsMode: boolean
	isPreview: boolean
	stageRef?: React.RefObject<Konva.Stage>
	updateState?: (state: StudioState) => void
	setContinuousRecordedBlockIds?: React.Dispatch<
		SetStateAction<
			{
				blockId: string
				duration: number
			}[]
		>
	>
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
		<div
			style={{
				top: `${(stageRef?.current?.height() ?? 0) + (shortsMode ? 0 : 72)}px`,
			}}
			className='absolute grid grid-cols-12 w-full mb-2'
		>
			<div className='flex items-center col-span-8 col-start-3 pb-6'>
				{/* Stop Recording Button */}
				{(state === 'recording' || state === 'startRecording') && (
					<button
						type='button'
						onClick={() => {
							if (viewConfig.continuousRecording) {
								setContinuousRecordedBlockIds?.(prev => [
									...prev,
									{
										blockId: dataConfig[activeObjectIndex].id,
										duration: 0,
									},
								])
							}
							updateState?.('stopRecording')
						}}
						className='flex gap-x-3 bg-white font-main items-center justify-between border backdrop-filter backdrop-blur-2xl px-4 py-2 rounded-sm w-24 absolute min-w-max text-size-sm-title active:scale-95 transition-all'
					>
						<div className='w-3 h-3 bg-red-600 rounded-full' />
						<Timer />
					</button>
				)}
				{/* Start Recording button */}
				{(state === 'ready' || state === 'resumed') && (
					<button
						className={cx(
							'bg-red-500 text-white font-main backdrop-filter backdrop-blur-2xl px-4 py-2 rounded-sm absolute flex items-center gap-x-2 text-size-sm-title active:scale-95 transition-all'
						)}
						type='button'
						onClick={() => {
							updateState?.('countDown')
						}}
					>
						<div className='w-3 h-3 bg-white rounded-full' />
						Start Recording
					</button>
				)}
				<div className='flex items-center ml-auto'>
					{/* Video Play button */}
					{isVideo && (
						<button
							className='bg-gray-600 border-gray-600 p-1.5 rounded-sm text-gray-100'
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
								'flex gap-x-2 items-center justify-between border bg-gray-600 border-gray-600 rounded-sm ml-4',
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
										'!bg-gray-800':
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
								<OnlyUserMedia className='m-1' />
							</div>
							<div
								className={cx(
									'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
									{
										'bg-transparent': isIntro || isOutro,
										'!bg-gray-800':
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
								<ThreeWaySwap className='m-1' />
							</div>
							<div
								className={cx(
									'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
									{
										'bg-transparent': isIntro || isOutro,
										'!bg-gray-800':
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
								<CustomLayout className='m-1' />
							</div>
						</button>
					)}
					{/* previous button */}
					<button
						className={cx(
							'bg-gray-600 border border-gray-600 p-1.5 rounded-sm ml-4 transition-all',
							{
								'text-gray-100': !isBackDisabled(),
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
							'bg-gray-600 border border-gray-600 p-1.5 rounded-sm ml-2 text-gray-100 transition-all',
							{
								'cursor-not-allowed text-gray-500':
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
											updateState?.('stopRecording')
										}
									} else {
										// If continuous recording is enabled, we need to track block completions and add metadata
										setContinuousRecordedBlockIds?.(prev => [
											...prev,
											{
												blockId: dataConfig[activeObjectIndex].id,
												duration: 0,
											},
										])

										// After tracking metadata , update active object index
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
