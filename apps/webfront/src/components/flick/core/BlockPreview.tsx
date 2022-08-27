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



import { cx } from '@emotion/css'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	currentBlockSelector,
	fragmentTypeAtom,
	openStudioAtom,
	previewPositionAtom,
} from 'src/stores/flick.store'
import useBlock from 'src/utils/hooks/useBlock'
import { useMap } from 'src/utils/liveblocks.config'
import CanvasComponent from '../canvas/CanvasComponent'
import Preview from '../preview/Preview'
import Timeline from '../preview/Timeline'

const BlockPreview = () => {
	const [ref, bounds] = useMeasure()
	const [previewOpen, setPreviewOpen] = useState(false)
	const previewPosition = useRecoilValue(previewPositionAtom)

	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const block = useRecoilValue(currentBlockSelector)
	const openStudio = useRecoilValue(openStudioAtom)
	const fragmentType = useRecoilValue(fragmentTypeAtom)

	const { blockProperties } = useBlock(
		activeFragmentId as string,
		block?.id as string
	)

	const config = useMap('viewConfig')
		?.get(activeFragmentId as string)
		?.toObject()

	return (
		<>
			<button
				type='button'
				onClick={() => setPreviewOpen(true)}
				style={{
					top: `${previewPosition}px`,
				}}
				className={cx('absolute w-full aspect-[16/9] border cursor-pointer', {
					'border-transparent': !block,
					'!aspect-[9/16] w-1/2 right-0 left-0 mx-auto':
						fragmentType === 'Portrait',
				})}
				ref={ref}
			>
				{block && !openStudio && (
					<CanvasComponent
						bounds={bounds}
						dataConfig={[block]}
						viewConfig={{
							mode: config?.mode || 'Landscape',
							speakers: config?.speakers || [],
							selectedBlocks: config?.selectedBlocks || [],
							continuousRecording: config?.continuousRecording || false,
							blocks: {
								[block.id]: blockProperties || {},
							},
						}}
						isPreview
						scale={1.03}
					/>
				)}
			</button>
			<Transition appear show={previewOpen} as={Fragment}>
				<Dialog onClose={() => setPreviewOpen(false)} className='relative z-50'>
					<Transition.Child
						as={Fragment}
						enter='ease-out duration-300'
						enterFrom='opacity-0'
						enterTo='opacity-100'
						leave='ease-in duration-200'
						leaveFrom='opacity-100'
						leaveTo='opacity-0'
					>
						<div className='fixed inset-0 bg-black/60' aria-hidden='true' />
					</Transition.Child>
					<div className='fixed inset-0 flex items-center justify-center p-4'>
						<Transition.Child
							as={Fragment}
							enter='ease-out duration-300'
							enterFrom='opacity-0 scale-95'
							enterTo='opacity-100 scale-100'
							leave='ease-in duration-200'
							leaveFrom='opacity-100 scale-100'
							leaveTo='opacity-0 scale-95'
						>
							<Dialog.Panel className='flex rounded-md flex-col h-[85vh] w-[90%] overflow-hidden'>
								<Preview centered handleClose={() => setPreviewOpen(false)} />
								<Timeline
									persistentTimeline
									shouldScrollToCurrentBlock={false}
								/>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</Dialog>
			</Transition>
		</>
	)
}

export default BlockPreview
