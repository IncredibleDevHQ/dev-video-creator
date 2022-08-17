// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
