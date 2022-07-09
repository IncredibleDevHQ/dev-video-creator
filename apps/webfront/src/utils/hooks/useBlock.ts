import { useCallback, useEffect, useState } from 'react'
import { BlockProperties } from 'utils/src'
import { useMap, useRoom } from '../liveblocks.config'

const useBlock = (fragmentId: string, blockId: string) => {
	const blocks = useMap('viewConfig')?.get(fragmentId)?.get('blocks')
	const block = useMap('viewConfig')
		?.get(fragmentId)
		?.get('blocks')
		?.get(blockId)

	const [blockProperties, setBlockProperties] = useState<
		BlockProperties | undefined
	>()

	useEffect(() => {
		if (block) {
			setBlockProperties(block)
		}
	}, [block])

	const room = useRoom()

	useEffect(() => {
		let unsubscribe: any
		if (blocks && !unsubscribe) {
			unsubscribe = room.subscribe(
				blocks,
				() => {
					setBlockProperties(blocks?.get(blockId))
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [blocks, block, blockId, room])

	const updateBlockProperties = useCallback(
		(properties: BlockProperties) => {
			blocks?.set(blockId, properties)
		},
		[blockId, blocks]
	)

	return { blockProperties, updateBlockProperties }
}

export default useBlock
