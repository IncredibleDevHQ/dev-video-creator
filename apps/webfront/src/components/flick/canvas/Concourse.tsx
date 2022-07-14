import { Block } from 'editor/src/utils/types'
import useEdit from 'icanvas/src/hooks/useEdit'
import Konva from 'konva'
import { Vector2d } from 'konva/lib/types'
import React, { createRef, useEffect, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import {
	agoraUsersAtom,
	brandingAtom,
	payloadFamily,
	streamAtom,
	themeAtom,
} from 'src/stores/studio.store'
import { getFragmentLayoutConfig } from 'src/utils/canvasConfigs/fragmentLayoutConfig'
import {
	CONFIG,
	FragmentPayload,
	FragmentState,
	SHORTS_CONFIG,
	StudioUserConfig,
} from 'src/utils/configs'
import { useObject } from 'src/utils/liveblocks.config'
import { useUser } from 'src/utils/providers/auth'
import useImage from 'use-image'
import { BlockProperties, GradientConfig } from 'utils/src'
import StudioUser from './StudioUser'

export interface TitleSplashProps {
	enable: boolean
	title?: string
	titleSplashConfig?: GradientConfig
}

interface ConcourseProps {
	layerChildren: any[]
	viewConfig?: BlockProperties
	stageRef?: React.RefObject<Konva.Stage>
	studioUserConfig?: StudioUserConfig[]
	isShorts?: boolean
	fragmentState?: FragmentState
	blockType: Block['type']
	updatePayload: (payload: FragmentPayload) => void
	blockId: string
}

const Concourse = ({
	layerChildren,
	viewConfig,
	stageRef,
	studioUserConfig,
	isShorts,
	fragmentState,
	blockType,
	updatePayload,
	blockId,
}: ConcourseProps) => {
	const users = useRecoilValue(agoraUsersAtom)
	const payload = useRecoilValue(payloadFamily(blockId))
	const stream = useRecoilValue(streamAtom)
	const theme = useRecoilValue(themeAtom)
	const branding = useRecoilValue(brandingAtom)
	const studioController = useObject('studioControls')

	const { user } = useUser()

	// const [canvas, setCanvas] = useRecoilState(canvasStore)
	const [isZooming, setIsZooming] = useState(false)

	const [logo] = useImage(branding?.logo || '', 'anonymous')

	const groupRef = createRef<Konva.Group>()
	const { clipRect } = useEdit()

	const [stageConfig, setStageConfig] = useState<{
		width: number
		height: number
	}>({ width: 0, height: 0 })

	useEffect(() => {
		if (!isShorts) setStageConfig(CONFIG)
		else setStageConfig(SHORTS_CONFIG)
	}, [isShorts])

	const defaultStudioUserConfig: StudioUserConfig = {
		x: 780,
		y: 400,
		width: 0,
		height: 0,
	}

	const userStudioImageGap = 170
	const zoomLevel = 2

	// useEffect(() => {
	// 	if (!canvas) return
	// 	if (!canvas.zoomed) onMouseLeave()
	// }, [canvas?.zoomed])

	// const handleZoom = (e: KonvaEventObject<WheelEvent>) => {
	//   e.evt.preventDefault()
	//   if (!stageRef.current) return
	//   const oldScale = stageRef.current.scaleX()
	//   const pointer = stageRef.current.getPointerPosition()

	//   if (!pointer || !oldScale) return

	//   const mousePointTo = {
	//     x: (pointer.x - stageRef.current.x()) / oldScale,
	//     y: (pointer.y - stageRef.current.y()) / oldScale,
	//   }

	//   const scaleBy = 1.01
	//   let newScale = 1
	//   if (e.evt.deltaY > 0) {
	//     newScale = oldScale / scaleBy > 1 ? oldScale / scaleBy : 1
	//   } else {
	//     newScale = oldScale * scaleBy > 4 ? 4 : oldScale * scaleBy
	//   }

	//   stageRef.current.scale({ x: newScale, y: newScale })

	//   const newPos = {
	//     x: pointer.x - mousePointTo.x * newScale,
	//     y: pointer.y - mousePointTo.y * newScale,
	//   }

	//   stageRef.current.position(newPos)
	// }

	const onLayerClick = ({
		pointer,
	}: {
		pointer: Vector2d | null | undefined
	}) => {
		if (!groupRef.current) return
		if (pointer) {
			groupRef.current.to({
				x: pointer.x,
				y: pointer.y,
				scaleX: zoomLevel,
				scaleY: zoomLevel,
				duration: 0.5,
			})
		}
	}

	const onMouseLeave = () => {
		if (!groupRef.current) return
		groupRef.current.to({
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			duration: 0.5,
		})
	}

	useEffect(() => {
		if (payload?.shouldZoom) {
			onLayerClick({ pointer: payload?.zoomPointer })
		} else {
			onMouseLeave()
		}
	}, [payload?.shouldZoom])

	// const onMouseMove = () => {
	//   if (!groupRef.current || !canvas?.zoomed) return
	//   const tZooming = isZooming
	//   if (tZooming) {
	//     const pointer = stageRef?.current?.getPointerPosition()
	//     if (pointer)
	//       groupRef.current.to({
	//         x: -pointer.x,
	//         y: -pointer.y,
	//         // scaleX: 1,
	//         // scaleY: 1,
	//         duration: 0.1,
	//       })
	//   }
	// }

	// const resetCanvas = () => {
	// 	if (!stageRef?.current) return
	// 	stageRef.current.position({ x: 0, y: 0 })
	// 	stageRef.current.scale({ x: 1, y: 1 })
	// 	onMouseLeave()
	// }

	// useEffect(() => {
	// 	setCanvas({ zoomed: false, resetCanvas })
	// }, [])
	return (
		<>
			{(viewConfig?.layout === 'full-left' ||
				viewConfig?.layout === 'full-right') &&
				// payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
				// payload?.status !== Fragment_Status_Enum_Enum.Ended &&
				users && (
					<>
							<StudioUser
								stream={stream?.stream}
								studioUserConfig={
									(studioUserConfig && studioUserConfig[0]) ||
									defaultStudioUserConfig
								}
								// picture={picture as string}
								type='local'
							/>
						{users.map((rtcUser, index) => (
							<StudioUser
								key={rtcUser.uid as string}
								type='remote'
								stream={rtcUser.mediaStream as MediaStream}
								// picture={participants?.[user.uid]?.picture || ''}
								studioUserConfig={
									(studioUserConfig && studioUserConfig[index + 1]) || {
										x:
											defaultStudioUserConfig.x -
											(index + 1) * userStudioImageGap,
										y: defaultStudioUserConfig.y,
										width: defaultStudioUserConfig.width,
										height: defaultStudioUserConfig.height,
									}
								}
							/>
						))}
					</>
				)}
			<Group>
				{(() => (
					// TODO
					// if (payload?.status === Fragment_Status_Enum_Enum.CountDown) {
					// 	return (
					// 		<Rect
					// 			x={0}
					// 			y={0}
					// 			width={stageConfig.width}
					// 			height={stageConfig.height}
					// 			fill='#000000'
					// 			cornerRadius={8}
					// 		/>
					// 	)
					// }
					<Group
						clipFunc={
							blockType === 'introBlock' || blockType === 'outroBlock'
								? undefined
								: (ctx: any) => {
										clipRect(
											ctx,
											getFragmentLayoutConfig({
												theme,
												layout:
													fragmentState === 'onlyFragment'
														? 'classic'
														: viewConfig?.layout || 'classic',
												isShorts: isShorts || false,
											})
										)
								  }
						}
					>
						<Group
							ref={groupRef}
							onClick={() => {
								if (
									studioController?.get('studioControllerSub') === user?.uid
								) {
									const pointer = stageRef?.current?.getPointerPosition()
									const scaleRatio =
										document.getElementsByClassName('konvajs-content')[0]
											.clientWidth / stageConfig.width
									if (pointer) {
										updatePayload?.({
											zoomPointer: {
												x: (pointer.x - pointer.x * zoomLevel) / scaleRatio,
												y: (pointer.y - pointer.y * zoomLevel) / scaleRatio,
											},
											shouldZoom: !isZooming,
										})
										setIsZooming(!isZooming)
									}
								}
							}}
							onMouseLeave={() => {
								if (
									studioController?.get('studioControllerSub') === user?.uid
								) {
									updatePayload?.({
										zoomPointer: undefined,
										shouldZoom: false,
									})
									setIsZooming(false)
								}
							}}
							// onMouseMove={onMouseMove}
						>
							{layerChildren}
						</Group>
					</Group>
				))()}
			</Group>
			{viewConfig?.layout !== 'full-left' &&
				viewConfig?.layout !== 'full-right' &&
				// payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
				// payload?.status !== Fragment_Status_Enum_Enum.Ended &&
				users && (
					<>
							<StudioUser
								stream={stream?.stream}
								studioUserConfig={
									(studioUserConfig && studioUserConfig[0]) ||
									defaultStudioUserConfig
								}
								// picture={picture as string}
								type='local'
							/>
						{users.map((rtcUser, index) => (
							<StudioUser
								key={rtcUser.uid as string}
								type='remote'
								stream={rtcUser.mediaStream as MediaStream}
								studioUserConfig={
									(studioUserConfig && studioUserConfig[index + 1]) || {
										x:
											defaultStudioUserConfig.x -
											(index + 1) * userStudioImageGap,
										y: defaultStudioUserConfig.y,
										width: defaultStudioUserConfig.width,
										height: defaultStudioUserConfig.height,
									}
								}
							/>
						))}
					</>
				)}
			{!isShorts &&
				logo &&
				logo?.width &&
				logo?.height &&
				blockType !== 'introBlock' &&
				blockType !== 'outroBlock' && (
					<Group>
						<Rect
							x={CONFIG.width - 24 - ((logo.width * 24) / logo.height + 24)}
							y={24}
							width={(logo.width * 24) / logo.height + 24}
							height={48}
							fill='#ffffff'
							opacity={0.3}
							cornerRadius={8}
						/>
						<Image
							x={CONFIG.width - 24 - (logo.width * 24) / logo.height - 12}
							y={36}
							width={(logo.width * 24) / logo.height}
							height={24}
							image={logo}
						/>
					</Group>
				)}
		</>
	)
}

export default Concourse
