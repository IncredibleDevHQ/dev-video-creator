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

import { Block } from 'editor/src/utils/types'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { astAtom } from 'src/stores/flick.store'
import { recordingIdAtom } from 'src/stores/studio.store'
import { useMap } from 'src/utils/liveblocks.config'
import { ViewConfig } from 'utils/src'
import Studio from './Studio'

const StudioHoC = ({
	fragmentId,
	flickId,
}: {
	fragmentId: string
	flickId: string
}) => {
	const { replace, query } = useRouter()

	const [viewConfig, setViewConfig] = useState<ViewConfig>()
	const [dataConfig, setDataConfig] = useState<Block[]>()
	const ast = useRecoilValue(astAtom)
	const recordingId = useRecoilValue(recordingIdAtom)

	const viewConfigLiveMap = useMap('viewConfig')

	useEffect(() => {
		if (viewConfigLiveMap && !viewConfig) {
			const fragmentViewConfig = viewConfigLiveMap.get(fragmentId)?.toObject()
			const blocks = Object.fromEntries(
				viewConfigLiveMap.get(fragmentId)?.get('blocks')?.entries() ?? []
			)
			setViewConfig({
				...fragmentViewConfig,
				blocks,
			} as ViewConfig)
		}
	}, [fragmentId, viewConfig, viewConfigLiveMap])

	useEffect(() => {
		if (ast && !dataConfig && viewConfig) {
			const config = ast.blocks.filter(
				(b: any) => b.type !== 'interactionBlock'
			)
			if (viewConfig.continuousRecording) {
				setDataConfig(
					config.filter(b =>
						viewConfig.selectedBlocks.find(blk => blk.blockId === b.id)
					)
				)
			} else {
				setDataConfig(config)
			}
		}
	}, [ast, dataConfig, viewConfig])

	useEffect(
		() => () => {
			const { slug, openStudio, ...rest } = query
			if (openStudio === 'true') {
				replace(
					{ pathname: `/story/${flickId}/${fragmentId}`, query: rest },
					undefined,
					{
						shallow: true,
					}
				)
			}
		},
		[]
	)

	if (!viewConfig || !dataConfig || !recordingId) return null
	return (
		<Studio
			dataConfig={dataConfig}
			viewConfig={viewConfig}
			fragmentId={fragmentId}
			flickId={flickId}
			recordingId={recordingId}
		/>
	)
}
export default StudioHoC
