import { cx } from '@emotion/css'
import CodeSandbox from 'editor/src/assets/Command_CodeSandbox.svg'
import Replit from 'editor/src/assets/Command_Replit.svg'
import StackBlitz from 'editor/src/assets/Command_Stackblitz.svg'
import { useEffect } from 'react'
import { IoPlayOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockSelector,
	isTimelineVisibleAtom,
	View,
	viewAtom,
} from 'src/stores/flick.store'
import { useMap } from 'src/utils/liveblocks.config'
import TimelineIcon from 'svg/Timeline.svg'
import UserPlaceholder from 'svg/UserPlaceholder.svg'
import { Button } from 'ui/src'
import { IntroBlockView, OutroBlockView } from 'utils/src'
import { FragmentTypeIcon } from './LayoutGeneric'

const Timeline = ({
	persistentTimeline = false,
	shouldScrollToCurrentBlock = true,
}: {
	persistentTimeline: boolean
	shouldScrollToCurrentBlock: boolean
}) => {
	const blocks = useRecoilValue(astAtom)?.blocks
	const [currentBlock, setCurrentBlock] = useRecoilState(currentBlockSelector)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const view = useRecoilValue(viewAtom)
	const [showTimeline, setShowTimeline] = useRecoilState(isTimelineVisibleAtom)

	const viewConfig = useMap('viewConfig')?.get(activeFragmentId as string)

	useEffect(() => {
		if (view === View.Preview) {
			setShowTimeline(true)
		} else {
			setShowTimeline(false)
		}
	}, [persistentTimeline, setShowTimeline, view])

	return (
		<div
			className={cx('absolute flex flex-col bottom-0 left-0 w-full z-40', {
				relative: persistentTimeline,
			})}
		>
			{!persistentTimeline && (
				<div className='flex items-center'>
					<Button
						colorScheme='darker'
						type='button'
						className='ml-4 mb-2'
						onClick={() => {
							setShowTimeline(!showTimeline)
						}}
						leftIcon={<TimelineIcon />}
					>
						{showTimeline ? 'Close timeline' : 'Open timeline'}
					</Button>
				</div>
			)}

			{(showTimeline || persistentTimeline) && (
				<div className='flex'>
					<div className='h-24' />
					<div className='flex items-center w-full bg-dark-500 py-4 gap-x-4 overflow-x-auto'>
						{blocks?.map((block, index) => (
							<a
								className={cx(
									'group flex items-center gap-x-3 border border-transparent cursor-pointer relative',
									{
										'bg-dark-300 py-1.5 px-2 rounded-md':
											block.type === 'introBlock' ||
											block.type === 'outroBlock',
										'ml-5': index === 0,
										'mr-5': index === blocks.length - 1,
									}
								)}
								href={shouldScrollToCurrentBlock ? `#${block.id}` : undefined}
								onClick={() => {
									setCurrentBlock(block)
								}}
							>
								{(() => {
									switch (block.type) {
										case 'introBlock':
											return (
												viewConfig?.get('blocks')?.get(block.id)
													?.view as IntroBlockView
											)?.intro?.order
												?.filter(o => o.enabled)
												?.map(order => {
													switch (order.state) {
														case 'userMedia': {
															return (
																<button
																	type='button'
																	onClick={() => {
																		// updatePayload?.({
																		//   activeIntroIndex: orderIndex,
																		// })
																	}}
																	className={cx(
																		'border border-transparent rounded-md p-2 w-24 h-12 bg-dark-100 relative',
																		{
																			'!border-green-600':
																				// payload.activeIntroIndex ===
																				//   orderIndex &&
																				block.id === currentBlock?.id,
																		}
																	)}
																>
																	<UserPlaceholder className='transform w-full h-full' />
																</button>
															)
														}

														case 'titleSplash': {
															return (
																<button
																	type='button'
																	onClick={() => {
																		if (block.type === 'introBlock') {
																			//   updatePayload?.({
																			//     activeIntroIndex: orderIndex,
																			//   })
																		}
																	}}
																	className={cx(
																		'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
																		{
																			'bg-dark-100':
																				block.type === 'introBlock',
																			'!border-green-600':
																				// payload.activeIntroIndex ===
																				//   orderIndex &&
																				block.id === currentBlock?.id,
																		}
																	)}
																>
																	<FragmentTypeIcon type={block.type} />
																</button>
															)
														}

														case 'introVideo': {
															return (
																<button
																	type='button'
																	onClick={() => {
																		// updatePayload?.({
																		//   activeIntroIndex: orderIndex,
																		// })
																	}}
																	className={cx(
																		'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
																		{
																			'!border-green-600':
																				// payload.activeIntroIndex ===
																				//   orderIndex &&
																				block.id === currentBlock?.id,
																		}
																	)}
																>
																	<IoPlayOutline className='w-full h-full text-gray-400' />
																</button>
															)
														}

														default:
															return null
													}
												})

										case 'outroBlock':
											return (
												viewConfig?.get('blocks')?.get(block.id)
													?.view as OutroBlockView
											)?.outro?.order
												?.filter(o => o.enabled)
												?.map(order => {
													switch (order.state) {
														case 'titleSplash': {
															return (
																<button
																	type='button'
																	onClick={() => {
																		// updatePayload?.({
																		//   activeOutroIndex: outroIndex,
																		// })
																	}}
																	className={cx(
																		'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
																		{
																			'bg-dark-100':
																				block.type === 'outroBlock',
																			'!border-green-600':
																				// payload.activeOutroIndex ===
																				//   outroIndex &&
																				block.id === currentBlock?.id,
																		}
																	)}
																>
																	<FragmentTypeIcon type={block.type} />
																</button>
															)
														}

														case 'outroVideo': {
															return (
																<button
																	type='button'
																	onClick={() => {
																		// updatePayload?.({
																		//   activeOutroIndex: outroIndex,
																		// })
																	}}
																	className={cx(
																		'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100',
																		{
																			'!border-green-600':
																				// payload.activeOutroIndex ===
																				//   outroIndex &&
																				block.id === currentBlock?.id,
																		}
																	)}
																>
																	<IoPlayOutline className='w-full h-full text-gray-400' />
																</button>
															)
														}

														default:
															return null
													}
												})

										case 'interactionBlock':
											return (
												<div
													className={cx(
														'border border-dark-100 rounded-md flex justify-center items-center w-12 h-12 p-2 bg-dark-300',
														{
															'!border-green-600':
																block.id === currentBlock?.id,
														}
													)}
												>
													<div className='filter grayscale brightness-75'>
														{(() => {
															switch (block.interactionBlock.interactionType) {
																case 'codesandbox':
																	return <CodeSandbox />
																case 'stackblitz':
																	return <StackBlitz />
																case 'replit':
																	return <Replit />
																default:
																	return null
															}
														})()}
													</div>
												</div>
											)

										default:
											return (
												<button
													type='button'
													className={cx(
														'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-2 ',
														{
															'!border-green-600':
																block.id === currentBlock?.id,
														}
													)}
												>
													<FragmentTypeIcon type={block.type} />
												</button>
											)
									}
								})()}
							</a>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default Timeline
