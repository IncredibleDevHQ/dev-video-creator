import { LiveMap, LiveObject } from '@liveblocks/client'
import { Block } from 'editor/src/utils/types'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Layer, Stage } from 'react-konva'
import { RectReadOnly } from 'react-use-measure'
import {
	useRecoilBridgeAcrossReactRoots_UNSTABLE,
	useRecoilValue,
} from 'recoil'
import { fragmentTypeAtom } from 'src/stores/flick.store'
import { CONFIG, SHORTS_CONFIG } from 'src/utils/configs'
import { RoomProvider } from 'src/utils/liveblocks.config'
import { ViewConfig } from 'utils/src'
import UnifiedFragment from './fragments/UnifiedFragment'

export const getIntegerHW = ({
	maxH,
	maxW,
	aspectRatio,
	isShorts,
}: {
	maxH: number
	maxW: number
	aspectRatio: number
	isShorts: boolean
}) => {
	let calWidth = 0
	let calHeight = 0
	if (aspectRatio > maxW / maxH) {
		calWidth = Math.floor(maxW - (!isShorts ? maxW % 16 : maxW % 9))
		calHeight = calWidth * (1 / aspectRatio)
	} else if (aspectRatio <= maxW / maxH) {
		calHeight = Math.floor(maxH - (!isShorts ? maxH % 9 : maxH % 16))
		calWidth = calHeight * aspectRatio
	}
	return { width: calWidth, height: calHeight }
}

const CanvasComponent = ({
	bounds,
	dataConfig,
	viewConfig,
	isPreview,
	flickId,
	scale = 1,
}: {
	bounds: RectReadOnly
	dataConfig: Block[]
	viewConfig: ViewConfig
	isPreview: boolean
	flickId: string
	scale?: number
}) => {
	const stageRef = useRef<Konva.Stage>(null)
	const layerRef = useRef<Konva.Layer>(null)
	const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

	const [mountStage, setMountStage] = useState(false)
	const shortsMode = useRecoilValue(fragmentTypeAtom) !== 'Landscape'

	// // state which stores the type of layer children which have to be placed over the studio user
	// const [topLayerChildren, setTopLayerChildren] = useState<{
	// 	id: string
	// 	state: TopLayerChildren
	// }>({ id: '', state: '' })

	const { height: stageHeight, width: stageWidth } = getIntegerHW({
		maxH: bounds.height * scale,
		maxW: bounds.width * scale,
		aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
		isShorts: shortsMode,
	})

	useEffect(() => {
		if (!stageWidth) return
		Konva.pixelRatio = (shortsMode ? 1080 : 1920) / stageWidth
		setMountStage(true)
	}, [stageWidth, shortsMode])

	console.log('CanvasComponent', stageWidth, stageHeight)

	return (
		<div>
			{mountStage && (
				<Stage
					ref={stageRef}
					className='mt-auto mb-auto'
					width={stageWidth || 1}
					height={stageHeight || 1}
					scale={{
						x:
							stageHeight / (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
						y: stageWidth / (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
					}}
				>
					<Bridge>
						<RoomProvider
							id={`story-${flickId}`}
							initialStorage={() => ({
								viewConfig: new LiveMap(),
								payload: new LiveMap(),
								activeObjectIndex: 0,
								state: 'ready',
								studioControls: new LiveObject(),
							})}
						>
							<Layer ref={layerRef}>
								{(() => (
									<Group>
										<UnifiedFragment
											stageRef={stageRef}
											// setTopLayerChildren={setTopLayerChildren}
											config={dataConfig}
											layoutConfig={viewConfig}
											isPreview={isPreview}
										/>
										{/* <GetTopLayerChildren
												key={topLayerChildren?.id}
												topLayerChildrenState={topLayerChildren?.state || ''}
												setTopLayerChildren={setTopLayerChildren}
												isShorts={shortsMode || false}
												theme={theme}
												transitionSettings={{
													blockTransition:
														fragment?.flick?.configuration?.transitions
															?.blockTransition?.name,
													swapTransition:
														fragment?.flick?.configuration?.transitions
															?.swapTransition?.name,
												}}
												performFinishAction={() => {
													stopCanvasRecording()
													setState('preview')
												}}
											/> */}
									</Group>
								))()}
							</Layer>
						</RoomProvider>
					</Bridge>
				</Stage>
			)}
		</div>
	)
}
export default CanvasComponent
