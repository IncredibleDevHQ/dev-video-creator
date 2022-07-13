import { cx } from '@emotion/css'
import { RefObject } from 'react'
import useMeasure from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import {
	flickAtom,
	activeFragmentIdAtom,
	currentBlockSelector,
} from 'src/stores/flick.store'
import useBlock from 'src/utils/hooks/useBlock'
import { useMap } from 'src/utils/liveblocks.config'
import CanvasComponent from '../canvas/CanvasComponent'

const BlockPreview = ({
	previewRef,
}: {
	previewRef: RefObject<HTMLDivElement>
}) => {
	const [ref, bounds] = useMeasure()

	const flickId = useRecoilValue(flickAtom)?.id
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const block = useRecoilValue(currentBlockSelector)

	const { blockProperties } = useBlock(
		activeFragmentId as string,
		block?.id as string
	)

	const config = useMap('viewConfig')
		?.get(activeFragmentId as string)
		?.toObject()

	return (
		<div
			className={cx('absolute w-full aspect-[16/9] border', {
				'border-transparent': !block,
			})}
			ref={previewRef}
		>
			<div className='w-full h-full' ref={ref}>
				{block && (
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
						flickId={flickId as string}
						scale={1.1}
					/>
				)}
			</div>
		</div>
	)
}

export default BlockPreview
