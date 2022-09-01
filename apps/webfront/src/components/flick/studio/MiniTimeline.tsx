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

import { css, cx } from '@emotion/css'
import { Block } from 'editor/src/utils/types'
import { useRef } from 'react'
import { IoCheckmarkOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import {
	activeObjectIndexAtom,
	isStudioControllerAtom,
	recordedBlocksAtom,
	StudioState,
	studioStateAtom,
} from 'src/stores/studio.store'
import useUpdateActiveObjectIndex from 'src/utils/hooks/useUpdateActiveObjectIndex'

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
			return block.title || block.fallbackTitle || 'Code Block'
		case 'listBlock':
			return block.title || block.fallbackTitle || 'List Block'
		case 'imageBlock':
			return block.title || block.fallbackTitle || 'Image Block'
		case 'videoBlock':
			return block.title || block.fallbackTitle || 'Video Block'
		case 'headingBlock':
			return block.title || 'Heading Block'
		case 'outroBlock':
			return 'Outro'
		case 'interactionBlock':
			return block.title || block.fallbackTitle || 'Interaction Block'
		default:
			return 'Block'
	}
}

const MiniTimeline = ({
	dataConfig,
	updateState,
}: {
	dataConfig: Block[]
	updateState: (studioState: StudioState) => void
}) => {
	const timelineRef = useRef<HTMLDivElement>(null)
	const state = useRecoilValue(studioStateAtom)
	const activeObjectIndex = useRecoilValue(activeObjectIndexAtom)
	const isStudioController = useRecoilValue(isStudioControllerAtom)
	// const recordedBlocks = useMap('recordedBlocks')
	const recordedBlocks = useRecoilValue(recordedBlocksAtom)
	const { updateActiveObjectIndex } = useUpdateActiveObjectIndex(true)

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
				'mt-auto flex gap-x-3 px-6 py-2 overflow-x-scroll h-14 items-center',
				{
					'pointer-events-none':
						state === 'preview'
							? recordedBlocks[dataConfig[activeObjectIndex].id]?.includes(
									'blob'
							  ) || false
							: false,
				},
				noScrollBar
			)}
		>
			{dataConfig.map((block, index) => (
				<button
					type='button'
					id={`timeline-block-${block.id}`}
					className={cx(
						'px-3 py-1.5 h-8 font-body cursor-pointer text-size-sm rounded-sm flex items-center justify-center transition-transform duration-500 bg-gray-700 relative text-gray-300 flex-shrink-0',
						{
							'transform scale-110 border-[0.5px] border-gray-400':
								activeObjectIndex === index,
							'bg-grey-900 text-gray-500': index !== activeObjectIndex,
							'cursor-not-allowed':
								state === 'recording' ||
								(recordedBlocks[dataConfig[index].id]?.includes('blob') &&
									state === 'preview') ||
								!isStudioController,
						}
					)}
					onClick={() => {
						if (!isStudioController) return
						// if continuous recording is enabled, disable mini-timeline onclick
						if (
							state === 'recording' ||
							(recordedBlocks[dataConfig[index].id]?.includes('blob') &&
								state === 'preview')
						) {
							// TODO emit toast to notify the user to save and proceed
							return
						}
						updateActiveObjectIndex(index)
						// checking if block is recorded or not
						if (recordedBlocks[dataConfig[index].id]) {
							updateState('preview')
						} else {
							updateState('resumed')
						}
					}}
				>
					{recordedBlocks[dataConfig[index].id]?.includes('.webm') && (
						<div className='absolute top-0 right-0 rounded-tr-sm rounded-bl-sm bg-green-600'>
							<IoCheckmarkOutline className='m-px text-gray-200' size={8} />
						</div>
					)}
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
