import { Block } from 'editor/src/utils/types'
import React, { useState, useEffect } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import {
	Content_Types,
	SetupRecordingMutationVariables,
	useGetRecordedBlocksLazyQuery,
	useGetRecordingsLazyQuery,
	useSetupRecordingMutation,
} from 'src/graphql/generated'
import { astAtom } from 'src/stores/flick.store'
import { recordedBlocksAtom } from 'src/stores/studio.store'
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
	const [recordingId, setRecordingId] = useState<string>()
	const ast = useRecoilValue(astAtom)
	const setRecordedBlocks = useSetRecoilState(recordedBlocksAtom)
	const [isRecordedBlocksSet, setIsRecordedBlocksSet] = useState<boolean>(false)

	const viewConfigLiveMap = useMap('viewConfig')

	const [getRecordingId] = useGetRecordingsLazyQuery({
		variables: {
			flickId,
			fragmentId,
		},
		fetchPolicy: 'cache-first',
	})
	const [getRecordedBlocks] = useGetRecordedBlocksLazyQuery()
	const [setupRecording] = useSetupRecordingMutation()

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

	useEffect(() => {
		if (!viewConfig) return
		;(async () => {
			const { data: recordingsData } = await getRecordingId()
			const recording = recordingsData?.Recording?.find(
				r => r.fragmentId === fragmentId
			)
			if (recording) {
				setRecordingId(recording.id)
			} else {
				const variables = {
					editorState: dataConfig,
					flickId,
					fragmentId,
					viewConfig,
					contentType:
						viewConfig.mode === 'Portrait'
							? Content_Types.VerticalVideo
							: Content_Types.Video,
				} as SetupRecordingMutationVariables
				const { data } = await setupRecording({ variables })
				setRecordingId(data?.StartRecording?.recordingId || '')
			}
		})()
	}, [viewConfig])

	useEffect(() => {
		if (!recordingId) return
		;(async () => {
			const { data } = await getRecordedBlocks({
				variables: {
					recordingId,
				},
			})
			const recordedBlocks = data?.Blocks
			const temp: {
				[key: string]: string
			} = {}
			recordedBlocks?.forEach(b => {
				temp[b.id] = b.objectUrl || ''
			})
			setRecordedBlocks(temp)
			// makes sure that the recordedBlocks are set before the studio component is mounted
			setIsRecordedBlocksSet(true)
		})()
	}, [recordingId])

	if (!viewConfig || !dataConfig || !recordingId || !isRecordedBlocksSet)
		return null
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
