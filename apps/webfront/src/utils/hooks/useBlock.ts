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
