/* eslint-disable react-hooks/exhaustive-deps */
import { Transformations, VideoBlockProps } from 'editor/src/utils/types'
import useEdit from 'icanvas/src/hooks/useEdit'
import { Video, VideoConfig } from 'icanvas/src/Video'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import {
	agoraUsersAtom,
	brandingAtom,
	controlsConfigAtom,
	payloadFamily,
	studioStateAtom,
	themeAtom,
} from 'src/stores/studio.store'
import {
	getFragmentLayoutConfig,
	ObjectConfig,
} from 'src/utils/canvasConfigs/fragmentLayoutConfig'
import {
	getShortsStudioUserConfiguration,
	getStudioUserConfiguration,
} from 'src/utils/canvasConfigs/studioUserConfig'
import {
	getThemeLayoutConfig,
	ObjectRenderConfig,
} from 'src/utils/canvasConfigs/themeConfig'
import { FragmentState } from 'src/utils/configs'
import usePoint from 'src/utils/hooks/usePoint'
import useUpdatePayload from 'src/utils/hooks/useUpdatePayload'
import {
	BlockProperties,
	CaptionTitleView,
	Layout,
	VideoBlockView,
	VideoBlockViewProps,
} from 'utils/src'
import Concourse from '../Concourse'
import FragmentBackground from '../FragmentBackground'

const VideoFragment = ({
	viewConfig,
	dataConfig,
	fragmentState,
	setFragmentState,
	stageRef,
	shortsMode,
	isPreview,
	speakersLength,
}: {
	viewConfig: BlockProperties
	dataConfig: VideoBlockProps
	fragmentState: FragmentState
	setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
	stageRef: React.RefObject<Konva.Stage>
	shortsMode: boolean
	isPreview: boolean
	speakersLength: number
}) => {
	const users = useRecoilValue(agoraUsersAtom)
	const state = useRecoilValue(studioStateAtom)
	const theme = useRecoilValue(themeAtom)
	const branding = useRecoilValue(brandingAtom)
	const payload = useRecoilValue(payloadFamily(dataConfig.id))
	const { updatePayload, reset } = useUpdatePayload({
		blockId: dataConfig.id,
		shouldUpdateLiveblocks: !isPreview,
	})
	const setControlsConfig = useSetRecoilState(controlsConfigAtom)

	// const [studio, setStudio] = useRecoilState(studioStore)

	const [videoConfig, setVideoConfig] = useState<VideoConfig>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		videoFill: '',
		cornerRadius: 0,
		performClip: true,
		clipVideoConfig: {
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		},
	})
	const [playing, setPlaying] = useState(false)

	// ref to the object grp
	const customLayoutRef = useRef<Konva.Group>(null)

	// const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')
	const [transformations, setTransformations] = useState<Transformations>()

	const [layout, setLayout] = useState<Layout | undefined>()

	const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		borderRadius: 0,
	})

	const [objectRenderConfig, setObjectRenderConfig] =
		useState<ObjectRenderConfig>({
			startX: 0,
			startY: 0,
			availableWidth: 0,
			availableHeight: 0,
			textColor: '',
			surfaceColor: '',
		})
	const [videoFragmentData, setVideoFragmentData] = useState<{
		title: string
		caption: string
	}>()
	const [renderMode, setRenderMode] = useState<CaptionTitleView>('titleOnly')
	const [noOfLinesOfText, setNoOfLinesOfText] = useState<{
		noOfLinesOfTitle: number
		noOfLinesOfCaption: number
	}>({ noOfLinesOfCaption: 0, noOfLinesOfTitle: 0 })

	const { getNoOfLinesOfText } = usePoint()
	const { getTextWidth } = useEdit()

	const videoElement = React.useMemo(() => {
		if (!dataConfig) return
		const element = document.createElement('video')
		element.autoplay = false
		element.crossOrigin = 'anonymous'
		element.preload = 'auto'
		element.muted = true
		element.src = dataConfig.videoBlock.url || ''

		setVideoFragmentData({
			title: dataConfig?.title || '',
			caption: dataConfig?.videoBlock?.caption || '',
		})
		const videoBlockViewProps: VideoBlockViewProps = (
			viewConfig?.view as VideoBlockView
		)?.video
		setRenderMode(videoBlockViewProps?.captionTitleView || 'titleOnly')
		if (dataConfig.videoBlock.transformations)
			setTransformations(dataConfig.videoBlock.transformations)
		// eslint-disable-next-line consistent-return
		return element
	}, [dataConfig, viewConfig, shortsMode, theme])

	useEffect(
		() => () => {
			videoElement?.pause()
			reset({
				playing: false,
				currentTime: transformations?.clip?.start || 0,
				fragmentState: 'customLayout',
			})
		},
		[reset, transformations?.clip?.start, videoElement]
	)

	useEffect(() => {
		setObjectConfig(
			getFragmentLayoutConfig({
				theme,
				layout: !isPreview
					? layout || viewConfig?.layout || 'classic'
					: viewConfig?.layout || 'classic',
				isShorts: shortsMode || false,
			})
		)
	}, [viewConfig, shortsMode, theme, layout, isPreview])

	useEffect(() => {
		setObjectRenderConfig(
			getThemeLayoutConfig({ theme, layoutConfig: objectConfig })
		)
	}, [objectConfig, theme])

	useEffect(() => {
		setControlsConfig({
			updatePayload,
			blockId: dataConfig.id,
			playing,
			videoElement,
		})
	}, [state, dataConfig, videoElement, playing])

	useEffect(() => {
		if (!videoElement) return
		switch (state) {
			case 'recording':
				updatePayload?.({
					playing: false,
					currentTime: transformations?.clip?.start || 0,
				})
				videoElement.currentTime = transformations?.clip?.start || 0
				break
			default:
				updatePayload?.({
					playing: false,
					currentTime: transformations?.clip?.start || 0,
				})
				videoElement.currentTime = transformations?.clip?.start || 0
		}
	}, [state, transformations, videoElement])

	// performing trim operation
	// on end time, reinitialize the video element's current time to start time
	videoElement?.addEventListener('timeupdate', () => {
		const { transformations: localTransformations } = dataConfig.videoBlock
		if (!localTransformations?.clip?.end) return
		if (videoElement.currentTime >= localTransformations.clip.end) {
			videoElement.pause()
			videoElement.currentTime = localTransformations?.clip?.start || 0
			videoElement.play()
		}
	})

	useEffect(() => {
		// eslint-disable-next-line
		setPlaying(!!payload?.playing)
		// eslint-disable-next-line
		if (!!payload?.playing) {
			videoElement?.play()
		} else {
			// eslint-disable-next-line
			if (videoElement && payload) {
				videoElement.currentTime =
					typeof payload.currentTime === 'number' ? payload.currentTime : 0
				videoElement?.pause()
			}
		}
	}, [payload?.playing])

	useEffect(() => {
		if (videoElement) {
			videoElement.currentTime = payload?.currentTime || 0
		}
	}, [payload?.currentTime, videoElement])

	useEffect(() => {
		// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
		if (payload.fragmentState === 'customLayout') {
			if (!shortsMode) {
				setTimeout(() => {
					setLayout(viewConfig?.layout || 'classic')
					setFragmentState('customLayout')
					customLayoutRef?.current?.to({
						opacity: 1,
						duration: 0.1,
					})
				}, 400)
			} else {
				setLayout(viewConfig?.layout || 'classic')
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 1,
					duration: 0.1,
				})
			}
		}
		// Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
		if (payload?.fragmentState === 'onlyUserMedia') {
			if (!shortsMode)
				setTimeout(() => {
					setFragmentState('onlyUserMedia')
					customLayoutRef?.current?.to({
						opacity: 0,
						duration: 0.1,
					})
				}, 400)
			else {
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 0,
					duration: 0.1,
				})
			}
		}
		if (payload?.fragmentState === 'onlyFragment') {
			if (!shortsMode)
				setTimeout(() => {
					setLayout('classic')
					setFragmentState('onlyFragment')
					customLayoutRef?.current?.to({
						opacity: 1,
						duration: 0.1,
					})
				}, 400)
			else {
				setLayout('classic')
				setFragmentState(payload?.fragmentState)
				customLayoutRef?.current?.to({
					opacity: 1,
					duration: 0.1,
				})
			}
		}
	}, [payload?.fragmentState])

	useEffect(() => {
		let noOfLinesOfTitle = getNoOfLinesOfText({
			text: videoFragmentData?.title || '',
			availableWidth: objectRenderConfig.availableWidth - 20,
			fontSize: objectRenderConfig?.blockTitleFontSize || 24,
			fontFamily:
				branding?.font?.heading?.family ||
				objectRenderConfig.titleFont ||
				'Gilroy',
			fontStyle: 'bold',
		})
		noOfLinesOfTitle =
			theme?.name === 'Whitep4nth3r' ? noOfLinesOfTitle + 0.8 : noOfLinesOfTitle
		const noOfLinesOfCaption = getNoOfLinesOfText({
			text: videoFragmentData?.caption || '',
			availableWidth: !shortsMode
				? objectRenderConfig.availableWidth - 220
				: objectRenderConfig.availableWidth - 40,
			fontSize: 16,
			fontFamily:
				branding?.font?.body?.family ||
				objectRenderConfig.bodyFont ||
				'GilroyRegular',
			fontStyle: 'normal',
		})
		setNoOfLinesOfText({
			noOfLinesOfCaption,
			noOfLinesOfTitle,
		})
		if (renderMode === 'titleOnly') {
			setVideoConfig({
				x: objectRenderConfig.startX + 10,
				y:
					objectRenderConfig.startY +
					// adding 16 bcoz its the starting y coordinate of the text
					16 +
					noOfLinesOfTitle *
						((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
					// this addition of 16 is for the pading between the title and the video
					16,
				width: objectRenderConfig.availableWidth - 20,
				height:
					objectRenderConfig.availableHeight -
					// this 48 constitutes of, the starting y coordinate of the text ie 16, padding between the title and the video ie 16, and the bottom padding
					48 -
					noOfLinesOfTitle *
						((objectRenderConfig?.blockTitleFontSize || 24) + 0.2),
				videoFill: objectConfig.color || '#1F2937',
				cornerRadius: objectRenderConfig.borderRadius,
				performClip: true,
				clipVideoConfig: {
					x: transformations?.crop?.x || 0,
					y: transformations?.crop?.y || 0,
					width: transformations?.crop?.width || 1,
					height: transformations?.crop?.height || 1,
				},
			})
		} else if (renderMode === 'captionOnly') {
			setVideoConfig({
				x: objectRenderConfig.startX + 10,
				// adding 16 is for the padding
				y: objectRenderConfig.startY + 16,
				width: objectRenderConfig.availableWidth - 20,
				height:
					objectRenderConfig.availableHeight -
					16 -
					noOfLinesOfCaption * (16 + 0.2) -
					// this 32 is the space for the caption and the bottom padding between the video and the caption
					32,
				videoFill: objectConfig.color || '#1F2937',
				cornerRadius: objectRenderConfig.borderRadius,
				performClip: true,
				clipVideoConfig: {
					x: transformations?.crop?.x || 0,
					y: transformations?.crop?.y || 0,
					width: transformations?.crop?.width || 1,
					height: transformations?.crop?.height || 1,
				},
			})
		} else if (renderMode === 'titleAndCaption') {
			setVideoConfig({
				x: objectRenderConfig.startX + 10,
				y:
					objectRenderConfig.startY +
					// adding 16 bcoz its the starting y coordinate of the text
					16 +
					noOfLinesOfTitle *
						((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
					// this addition of 16 is for the pading between the title and the video
					16,
				width: objectRenderConfig.availableWidth - 20,
				height:
					objectRenderConfig.availableHeight -
					// 16 bcoz its the starting y coordinate of the text
					16 -
					noOfLinesOfTitle *
						((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) -
					// padding between the title and the video
					16 -
					// padding between the video and the caption
					16 -
					noOfLinesOfCaption * (16 + 0.2) -
					// the bottom padding
					16,
				videoFill: objectConfig.color || '#1F2937',
				cornerRadius: objectRenderConfig.borderRadius,
				performClip: true,
				clipVideoConfig: {
					x: transformations?.crop?.x || 0,
					y: transformations?.crop?.y || 0,
					width: transformations?.crop?.width || 1,
					height: transformations?.crop?.height || 1,
				},
			})
		} else {
			setVideoConfig({
				x: objectRenderConfig.startX + 10,
				y: objectRenderConfig.startY + 10,
				width: objectRenderConfig.availableWidth - 20,
				height: objectRenderConfig.availableHeight - 20,
				videoFill: objectConfig.color || '#1F2937',
				cornerRadius: objectRenderConfig.borderRadius,
				performClip: true,
				clipVideoConfig: {
					x: transformations?.crop?.x || 0,
					y: transformations?.crop?.y || 0,
					width: transformations?.crop?.width || 1,
					height: transformations?.crop?.height || 1,
				},
			})
		}
	}, [renderMode, objectRenderConfig, transformations, videoFragmentData])

	// useEffect(() => {
	// 	if (fragment?.configuration?.continuousRecording) {
	// 		if (
	// 			payload?.fragmentState === 'customLayout' ||
	// 			payload?.fragmentState === 'onlyFragment'
	// 		) {
	// 			setLayout(viewConfig?.layout || 'classic')
	// 			customLayoutRef?.current?.to({
	// 				opacity: 1,
	// 			})
	// 		}
	// 	}
	// }, [])

	const layerChildren: any[] = [
		<Group x={0} y={0} opacity={!isPreview ? 0 : 1} ref={customLayoutRef}>
			<FragmentBackground
				theme={theme}
				objectConfig={objectConfig}
				backgroundRectColor={
					branding?.colors?.primary
						? branding?.colors?.primary
						: objectRenderConfig.surfaceColor
				}
			/>
			{videoElement && (
				<Video videoElement={videoElement} videoConfig={videoConfig} />
			)}
			<Group x={objectRenderConfig.startX} y={objectRenderConfig.startY}>
				{(renderMode === 'titleOnly' || renderMode === 'titleAndCaption') && (
					<Group>
						{theme.name === 'Whitep4nth3r' && videoFragmentData?.title !== '' && (
							<Rect
								x={
									(objectRenderConfig.availableWidth - 20) / 2 -
									(noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
										? getTextWidth(
												videoFragmentData?.title || '',
												branding?.font?.heading?.family ||
													objectRenderConfig.titleFont ||
													'Gilroy',
												objectRenderConfig?.blockTitleFontSize || 24,
												'bold'
										  ) + 30
										: objectRenderConfig.availableWidth - 80) /
										2 +
									10
								}
								y={
									16 +
									(noOfLinesOfText.noOfLinesOfTitle - 0.25) *
										(objectRenderConfig?.blockTitleFontSize || 24)
								}
								width={
									// checking if the no of lines of title is equal to 1, and based on that calculate the width of the title
									noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
										? getTextWidth(
												videoFragmentData?.title || '',
												branding?.font?.heading?.family ||
													objectRenderConfig.titleFont ||
													'Gilroy',
												objectRenderConfig?.blockTitleFontSize || 24,
												'bold'
										  ) + 30
										: objectRenderConfig.availableWidth - 80
								}
								height={5}
								fillLinearGradientColorStops={[0, '#F11012', 1, '#FFB626']}
								fillLinearGradientStartPoint={{ x: 0, y: 0 }}
								fillLinearGradientEndPoint={{
									x:
										noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
											? getTextWidth(
													videoFragmentData?.title || '',
													branding?.font?.heading?.family ||
														objectRenderConfig.titleFont ||
														'Gilroy',
													objectRenderConfig?.blockTitleFontSize || 24,
													'bold'
											  ) + 30
											: objectRenderConfig.availableWidth - 80,
									y: 0,
								}}
							/>
						)}
						<Text
							x={10}
							y={16}
							align='center'
							fontSize={objectRenderConfig?.blockTitleFontSize || 24}
							fill={
								branding?.colors?.text
									? branding?.colors?.text
									: objectRenderConfig.textColor
							}
							width={objectRenderConfig.availableWidth - 20}
							lineHeight={1.2}
							text={videoFragmentData?.title}
							fontStyle='bold'
							fontFamily={
								branding?.font?.heading?.family ||
								objectRenderConfig.titleFont ||
								'Gilroy'
							}
							textTransform='capitalize'
						/>
					</Group>
				)}

				{(renderMode === 'captionOnly' || renderMode === 'titleAndCaption') && (
					<Text
						x={!shortsMode ? 110 : 20}
						y={
							objectRenderConfig.availableHeight -
							noOfLinesOfText.noOfLinesOfCaption * (16 + 0.2) -
							16
						}
						align='center'
						fontSize={16}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: objectRenderConfig.textColor
						}
						width={
							!shortsMode
								? objectRenderConfig.availableWidth - 220
								: objectRenderConfig.availableWidth - 40
						}
						lineHeight={1.2}
						text={videoFragmentData?.caption}
						fontFamily={
							branding?.font?.body?.family ||
							objectRenderConfig.bodyFont ||
							'GilroyRegular'
						}
					/>
				)}
			</Group>
		</Group>,
	]

	const studioUserConfig = !shortsMode
		? getStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview ? users.length + 1 : speakersLength,
				fragmentState,
				theme,
		  })
		: getShortsStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview ? users.length + 1 : speakersLength,
				fragmentState,
				theme,
		  })

	return (
		<Concourse
			layerChildren={layerChildren}
			viewConfig={viewConfig}
			stageRef={stageRef}
			studioUserConfig={studioUserConfig}
			isShorts={shortsMode}
			blockType={dataConfig.type}
			fragmentState={fragmentState}
			updatePayload={updatePayload}
			blockId={dataConfig.id}
		/>
	)
}

export default VideoFragment
