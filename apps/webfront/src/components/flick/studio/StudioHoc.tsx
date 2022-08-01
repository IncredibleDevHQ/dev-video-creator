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
			replace(
				{ pathname: `/story/${flickId}/${fragmentId}`, query: rest },
				undefined,
				{
					shallow: true,
				}
			)
		},
		[]
	)

	if (!viewConfig || !dataConfig || !recordingId) return null
	return (
		<StudioComponent
			dataConfig={dataConfig}
			viewConfig={viewConfig}
			fragmentId={fragmentId}
			flickId={flickId}
			recordingId={recordingId}
		/>
	)
}
export default StudioHoC
