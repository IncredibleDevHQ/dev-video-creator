import { css, cx } from '@emotion/css'
import { Block } from 'editor/src/utils/types'
import { useRef } from 'react'

const noScrollBar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

export const getBlockTitle = (block: Block): string => {
	switch (block.type) {
		case 'introBlock':
			return 'Intro'
		case 'codeBlock':
			return (
				block.title || block.fallbackTitle || 'Code Block'
			)
		case 'listBlock':
			return (
				block.title || block.fallbackTitle || 'List Block'
			)
		case 'imageBlock':
			return (
				block.title ||
				block.fallbackTitle ||
				'Image Block'
			)
		case 'videoBlock':
			return (
				block.title ||
				block.fallbackTitle ||
				'Video Block'
			)
		case 'headingBlock':
			return block.title || 'Heading Block'
		case 'outroBlock':
			return 'Outro'
		case 'interactionBlock':
			return (
				block.title ||
				block.fallbackTitle ||
				'Interaction Block'
			)
		default:
			return 'Block'
	}
}

const MiniTimeline = ({
	dataConfig,
	// continuousRecording,
}: {
	dataConfig: Block[]
  // continuousRecording: boolean
}) => {
	const timelineRef = useRef<HTMLDivElement>(null)
  // const state = useRecoilValue(studioStateAtom)

	return (
		<div
			ref={timelineRef}
			style={{
				background: '#27272A',
			}}
			onWheel={e => {
				if (timelineRef.current) {
					timelineRef.current.scrollLeft += e.deltaY
				}
			}}
			className={cx(
				'mt-auto flex gap-x-3 px-6 py-2 overflow-x-scroll h-12',
				// {
				// 	'pointer-events-none':
				// 		state === 'preview' && recordedBlocks && currentBlock
				// 			? recordedBlocks
				// 					?.find(b => b.id === currentBlock.id)
				// 					?.objectUrl?.includes('blob') || false
				// 			: false,
				// },
				noScrollBar
			)}
		>
			{dataConfig.map(block => (
				<button
					type='button'
					id={`timeline-block-${block.id}`}
					className={cx(
						'px-3 py-1.5 h-8 font-body cursor-pointer text-size-sm rounded-sm flex items-center justify-center transition-transform duration-500 bg-gray-700 relative text-gray-300 flex-shrink-0'
						// {
						// 	'transform scale-110 border border-brand':
						// 		payload?.activeObjectIndex === index,
						// 	'bg-grey-900 text-gray-500': index !== payload?.activeObjectIndex,
						// 	'cursor-not-allowed':
						// 		state === 'recording' ||
						// 		state === 'start-recording' ||
						// 		(recordedBlocks
						// 			?.find(b => b?.id === currentBlock?.id)
						// 			?.objectUrl?.includes('blob') &&
						// 			state === 'preview'),

						// 	// state !== 'ready' || state !== 'preview',
						// }
					)}
					// onClick={() => {
					// 	if (payload?.studioControllerSub !== sub) return
					// 	// if continuous recording is enabled, disable mini-timeline onclick
					// 	if (
					// 		continuousRecording &&
					// 		(state === 'recording' ||
					// 			state === 'start-recording' ||
					// 			state === 'preview')
					// 	) {
					// 		return
					// 	}
					// 	// maybe this is not the best thing to do , can actually be a feature.

					// 	// TODO: if current block is recorded by isnt saved to the cloud or if the user has not intentionally pressed retake to discard the rec, show warning.

					// 	const newSrc =
					// 		recordedBlocks && currentBlock
					// 			? recordedBlocks?.find(b => b.id === currentBlock.id)
					// 					?.objectUrl || ''
					// 			: ''
					// 	if (newSrc.includes('blob') && state === 'preview') return

					// 	// checking if block already has recording
					// 	const clickedBlock = recordedBlocks?.find(b => b.id === block.id)

					// 	updatePayload({
					// 		activeObjectIndex: index,
					// 	})

					// 	console.log('clickedBlock', clickedBlock)

					// 	// when block was previously rec and uploaded and we have a url to show preview
					// 	if (clickedBlock && clickedBlock.objectUrl) {
					// 		setState('preview')
					// 	} else {
					// 		// when the clicked block is not yet recorded.
					// 		setState('resumed')
					// 	}
					// }}
				>
					{/* {localRecordedBlocks
						?.find((b: RecordedBlocksFragment) => b.id === block.id)
						?.objectUrl?.includes('.webm') && (
						<div className='absolute top-0 right-0 rounded-tr-sm rounded-bl-sm bg-incredible-green-600'>
							<IoCheckmarkOutline className='m-px text-gray-200' size={8} />
						</div>
					)} */}
					<span>
						{getBlockTitle(block).substring(0, 40) +
							(getBlockTitle(block).length > 40 ? '...' : '')}
					</span>
				</button>
			))}
		</div>
	)
}

export default MiniTimeline
