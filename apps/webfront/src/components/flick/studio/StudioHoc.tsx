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
