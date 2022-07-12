import { Block } from 'editor/src/utils/types'
import React, { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { astAtom } from 'src/stores/flick.store'
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
	const [viewConfig, setViewConfig] = useState<ViewConfig>()
	const [dataConfig, setDataConfig] = useState<Block[]>()
	const viewConfigLiveMap = useMap('viewConfig')
	const ast = useRecoilValue(astAtom)

	const StudioComponent = React.memo(Studio)

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

  // TODO on continous recording filter the dataConfig to only include the blocks that are recorded
	useEffect(() => {
		if (ast && !dataConfig) {
			setDataConfig(
				ast.blocks.filter((b: any) => b.type !== 'interactionBlock')
			)
		}
	}, [ast, dataConfig])

	if (!viewConfig || !dataConfig) return null
	return (
		<StudioComponent
			dataConfig={dataConfig}
			viewConfig={viewConfig}
			fragmentId={fragmentId}
			flickId={flickId}
		/>
	)
}
export default StudioHoC
