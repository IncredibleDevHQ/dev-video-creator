import { LiveObject } from '@liveblocks/client'
import { useState, useEffect, useCallback } from 'react'
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
			setBlockProperties(block.toObject())
		}
	}, [block])

	const room = useRoom()

	useEffect(() => {
		let unsubscribe: any
		if (block && !unsubscribe) {
			unsubscribe = room.subscribe(
				block,
				() => {
					setBlockProperties(blocks?.get(blockId)?.toObject())
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
			blocks?.set(blockId, new LiveObject(properties))
		},
		[blockId, blocks]
	)

	return { blockProperties, updateBlockProperties }
}

export default useBlock
