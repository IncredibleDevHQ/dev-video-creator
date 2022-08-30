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



/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-nested-ternary */
import { ListBlockProps, ListItem } from 'editor/src/utils/types'
import useEdit from 'icanvas/src/hooks/useEdit'
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
	BulletsConfig,
	getBulletsConfig,
	getPointsConfig,
	PointsConfig,
} from 'src/utils/canvasConfigs/pointsConfig'
import {
	getShortsStudioUserConfiguration,
	getStudioUserConfiguration,
} from 'src/utils/canvasConfigs/studioUserConfig'
import {
	getThemeLayoutConfig,
	ObjectRenderConfig,
} from 'src/utils/canvasConfigs/themeConfig'
import { ComputedPoint, FragmentState } from 'src/utils/configs'
import usePoint from 'src/utils/hooks/usePoint'
import useUpdatePayload from 'src/utils/hooks/useUpdatePayload'
import {
	BlockProperties,
	Layout,
	ListAppearance,
	ListBlockView,
	ListBlockViewProps,
	ListOrientation,
	ListViewStyle,
} from 'utils/src'
import Concourse from '../Concourse'
import FragmentBackground from '../FragmentBackground'
import HorizontalPointBullets, { PointBullets } from '../PointBullets'
import RichText from '../RichText'

// returns total no of points to be rendered
// for a particular layout in horizontal orientation
export const getNoOfPointsBasedOnLayout = (layout: Layout) => {
	switch (layout) {
		case 'classic':
			return 3
		case 'float-full-left':
		case 'float-full-right':
		case 'float-half-right':
		case 'padded-bottom-right-tile':
		case 'padded-bottom-right-circle':
		case 'bottom-right-tile':
		case 'bottom-right-circle':
			return 2
		case 'padded-split':
		case 'split':
		case 'full-left':
		case 'full-right':
			return 1
		default:
			return 3
	}
}

const PointsFragment = ({
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
	dataConfig: ListBlockProps
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

	const [activePointIndex, setActivePointIndex] = useState<number>(0)
	const [points, setPoints] = useState<ListItem[]>([])

	const { initUsePoint, getNoOfLinesOfText, getPositionForReplaceMode } =
		usePoint()
	const { getTextWidth } = useEdit()

	// ref to the object grp
	const [noOfLinesOfTitle, setNoOfLinesOfTitle] = useState<number>(0)

	const customLayoutRef = useRef<Konva.Group>(null)

	const [computedPoints, setComputedPoints] = useState<ComputedPoint[]>([])

	const [layout, setLayout] = useState<Layout | undefined>(viewConfig?.layout)

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

	const [viewStyle, setViewStyle] = useState<ListViewStyle>('bullet')
	const [appearance, setAppearance] = useState<ListAppearance>('stack')
	const [orientation, setOrientation] = useState<ListOrientation>('vertical')
	const [shouldDisplayTitle, setShouldDisplayTitle] = useState(true)
	// used for the replace mode
	const [titleY, setTitleY] = useState<number>(0)

	const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
		paddingBtwBulletText: 26,
		textFontSize: 16,
		noOfPoints: 3,
		noForSpacing: 4,
	})

	const [bulletsConfig, setBulletsConfig] = useState<BulletsConfig>({
		bulletWidth: 64,
		bulletHeight: 64,
		bulletFontSize: 32,
		bulletCornerRadius: 8,
		bulletXOffset: 0,
		bulletYOffset: 0,
		bulletColor: '#ffffff',
		bulletTextColor: '#000000',
		bulletRotation: 0,
	})

	useEffect(
		() => () => {
			reset({
				activePointIndex: 0,
				fragmentState: 'customLayout',
			})
		},
		[]
	)

	useEffect(() => {
		if (!dataConfig) return
		updatePayload?.({
			activePointIndex: 0,
		})
		setActivePointIndex(0)
		setPoints([])
		setComputedPoints([])
		setPoints(dataConfig.listBlock.list || [])
		const listBlockViewProps: ListBlockViewProps = (
			viewConfig?.view as ListBlockView
		)?.list
		if (listBlockViewProps?.viewStyle)
			setViewStyle(listBlockViewProps?.viewStyle)
		if (listBlockViewProps?.appearance)
			setAppearance(listBlockViewProps?.appearance)
		if (listBlockViewProps?.orientation)
			setOrientation(listBlockViewProps?.orientation)
		if (listBlockViewProps?.displayTitle !== undefined)
			setShouldDisplayTitle(listBlockViewProps?.displayTitle)
	}, [dataConfig, shortsMode, viewConfig, theme])

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
	}, [theme, layout, viewConfig, shortsMode, isPreview])

	useEffect(() => {
		setObjectRenderConfig(
			getThemeLayoutConfig({ theme, layoutConfig: objectConfig })
		)
	}, [objectConfig, theme])

	useEffect(() => {
		setControlsConfig({
			updatePayload,
			blockId: dataConfig.id,
			computedPoints,
		})
	}, [computedPoints])

	useEffect(() => {
		if (points.length === 0) return
		const listBlockViewProps: ListBlockViewProps = (
			viewConfig?.view as ListBlockView
		)?.list
		const tempNoOfLinesOfTitle = getNoOfLinesOfText({
			text: listBlockViewProps?.displayTitle ? dataConfig?.title || '' : '',
			availableWidth: objectRenderConfig.availableWidth - 80,
			fontSize: 40,
			fontFamily:
				branding?.font?.heading?.family ||
				objectRenderConfig.titleFont ||
				'Gilroy',
			fontStyle: 'normal 800',
		})
		setNoOfLinesOfTitle(
			theme?.name === 'Obsidian'
				? tempNoOfLinesOfTitle + 0.5
				: tempNoOfLinesOfTitle
		)
		setComputedPoints(
			initUsePoint({
				points,
				availableWidth: objectRenderConfig.availableWidth - 110,
				availableHeight:
					objectRenderConfig.availableHeight - 32 - 50 * tempNoOfLinesOfTitle,
				gutter: 25,
				fontSize: 16,
				fontFamily:
					branding?.font?.body?.family ||
					objectRenderConfig.bodyFont ||
					'Inter',
				orientation,
				layout: !isPreview
					? layout || viewConfig?.layout || 'classic'
					: viewConfig?.layout || 'classic',
				isShorts: shortsMode || false,
				lineHeight: 1.3,
				theme: theme.name || 'DarkGradient',
			})
		)
		if (orientation === 'horizontal') {
			setPointsConfig(
				getPointsConfig({
					layout: !isPreview
						? layout || viewConfig?.layout || 'classic'
						: viewConfig?.layout || 'classic',
					isShorts: shortsMode,
				})
			)
			setBulletsConfig(
				getBulletsConfig({
					theme: theme.name,
					layout: !isPreview
						? layout || viewConfig?.layout || 'classic'
						: viewConfig?.layout || 'classic',
				})
			)
		}
	}, [viewConfig, points, objectRenderConfig, orientation, theme, layout])

	useEffect(() => {
		if (computedPoints.length === 0) return
		if (!dataConfig) return
		setTitleY(
			getPositionForReplaceMode({
				title: dataConfig?.title || '',
				titleFontSize: 40,
				titleFontFamily:
					branding?.font?.heading?.family ||
					objectRenderConfig.titleFont ||
					'Gilroy',
				titleFontStyle: 'normal 800',
				points: computedPoints,
				availableWidth: objectRenderConfig.availableWidth - 110,
				availableHeight: objectRenderConfig.availableHeight - 16,
				fontSize: 24,
				fontFamily:
					branding?.font?.body?.family ||
					objectRenderConfig.bodyFont ||
					'Inter',
			})
		)
	}, [computedPoints, dataConfig])

	useEffect(() => {
		if (state === 'ready') {
			updatePayload?.({
				activePointIndex: 0,
			})
		}
		if (state === 'recording') {
			updatePayload?.({
				activePointIndex: 0,
			})
		}
	}, [state])

	useEffect(() => {
		setActivePointIndex(payload?.activePointIndex || 0)
	}, [payload?.activePointIndex])

	useEffect(() => {
		// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
		if (payload?.fragmentState === 'customLayout') {
			if (!shortsMode)
				setTimeout(() => {
					setLayout(viewConfig?.layout || 'classic')
					setFragmentState('customLayout')
					customLayoutRef?.current?.to({
						opacity: 1,
						duration: 0.1,
					})
				}, 400)
			else {
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
		<Group x={0} y={0} opacity={1} ref={customLayoutRef}>
			<FragmentBackground
				theme={theme}
				objectConfig={objectConfig}
				backgroundRectColor={
					branding?.colors?.primary
						? branding?.colors?.primary
						: objectRenderConfig.surfaceColor
				}
			/>
			<Text
				key='fragmentTitle'
				x={objectRenderConfig.startX + 30}
				y={
					appearance !== 'replace'
						? objectRenderConfig.startY + 32
						: objectRenderConfig.startY + titleY + 8
				}
				align='left'
				fontSize={40}
				fill={
					branding?.colors?.text
						? branding?.colors?.text
						: objectRenderConfig.textColor
				}
				width={objectRenderConfig.availableWidth - 80}
				lineHeight={1.15}
				text={shouldDisplayTitle ? dataConfig?.title || '' : ''}
				fontStyle='normal 800'
				fontFamily={
					branding?.font?.heading?.family ||
					objectRenderConfig.titleFont ||
					'Gilroy'
				}
			/>
			{theme.name === 'Obsidian' &&
				shouldDisplayTitle &&
				dataConfig?.title !== undefined && (
					<Rect
						x={objectRenderConfig.startX + 30}
						y={
							appearance !== 'replace'
								? // the no of line of title is used to calculate the height of the title and subtracting 0.25 bcoz we added 0.5 to no of lines if the theme is Obsidian, so subtracting 0.25 to center the line
								  objectRenderConfig.startY +
								  32 +
								  (noOfLinesOfTitle - 0.25) * 50
								: objectRenderConfig.startY +
								  titleY +
								  8 +
								  +(noOfLinesOfTitle - 0.25) * 50
						}
						width={
							// checking if the no of lines of title is equal to 1, and based on that calculate the width of the title
							noOfLinesOfTitle - 0.5 === 1
								? getTextWidth(
										shouldDisplayTitle ? dataConfig?.title || '' : '',
										branding?.font?.heading?.family ||
											objectRenderConfig.titleFont ||
											'Gilroy',
										40,
										'normal 800'
								  ) + 10
								: objectRenderConfig.availableWidth - 80
						}
						height={5}
						fillLinearGradientColorStops={[0, '#F11012', 1, '#FFB626']}
						fillLinearGradientStartPoint={{ x: 0, y: 0 }}
						fillLinearGradientEndPoint={{
							x:
								noOfLinesOfTitle - 0.5 === 1
									? getTextWidth(
											shouldDisplayTitle ? dataConfig?.title || '' : '',
											branding?.font?.heading?.family ||
												objectRenderConfig.titleFont ||
												'Gilroy',
											40,
											'normal 800'
									  ) + 10
									: objectRenderConfig.availableWidth - 80,
							y: 0,
						}}
					/>
				)}
			{orientation === 'vertical' ? (
				<Group
					x={objectRenderConfig.startX + 50}
					y={
						dataConfig?.title === undefined || !shouldDisplayTitle
							? objectRenderConfig.startY + 32
							: appearance !== 'replace'
							? objectRenderConfig.startY + 32 + 50 * noOfLinesOfTitle
							: objectRenderConfig.startY +
							  titleY +
							  8 +
							  50 * noOfLinesOfTitle +
							  20
					}
					key='verticalGroup'
				>
					{!isPreview
						? {
								stack: computedPoints
									.filter(
										(_, i) =>
											i < activePointIndex &&
											i >= computedPoints[activePointIndex - 1]?.startFromIndex
									)
									.map(point => (
										<>
											{
												{
													bullet: (
														<PointBullets
															theme={theme.name}
															objectRenderConfig={objectRenderConfig}
															pointY={point?.y}
															pointLevel={point?.level}
															pointRenderMode='stack'
														/>
													),
													number: (
														<Text
															key='points'
															x={-76}
															y={point.y}
															fill={
																branding?.colors?.text
																	? branding?.colors?.text
																	: objectRenderConfig.textColor
															}
															ref={ref =>
																ref?.to({
																	x: 0 + (41 * ((point?.level || 1) - 1) || 0),
																	duration: 0.3,
																})
															}
															text={point.pointNumber.toString()}
															fontSize={20}
															fontFamily={
																branding?.font?.body?.family ||
																objectRenderConfig.bodyFont ||
																'Inter'
															}
														/>
													),
													none: null,
												}[viewStyle]
											}
											<RichText
												key={point.pointNumber}
												x={-64}
												y={point.y + 2}
												// align="left"
												fontSize={16}
												fill={
													branding?.colors?.text
														? branding?.colors?.text
														: objectRenderConfig.textColor
												}
												// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
												// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
												width={
													viewStyle !== 'none'
														? objectRenderConfig.availableWidth -
														  110 -
														  (41 * ((point?.level || 1) - 1) || 0)
														: objectRenderConfig.availableWidth - 110
												}
												content={point.content}
												richTextData={point.richTextData}
												lineHeight={1.3}
												fontFamily={
													branding?.font?.body?.family ||
													objectRenderConfig.bodyFont ||
													'Inter'
												}
												animate={ref =>
													ref?.to({
														x:
															viewStyle !== 'none'
																? 30 + (41 * ((point?.level || 1) - 1) || 0)
																: 0,
														duration: 0.3,
													})
												}
											/>
										</>
									)),
								replace: computedPoints
									.filter((_, i) => i === activePointIndex - 1)
									.map(point => (
										<>
											{
												{
													bullet: (
														<PointBullets
															theme={theme.name}
															objectRenderConfig={objectRenderConfig}
															pointY={4}
															pointLevel={point?.level}
															pointRenderMode='replace'
														/>
													),
													number: (
														<Text
															key='points'
															x={0 + (41 * ((point?.level || 1) - 1) || 0)}
															y={4}
															fill={
																branding?.colors?.text
																	? branding?.colors?.text
																	: objectRenderConfig.textColor
															}
															text={point.pointNumber.toString()}
															fontSize={24}
															fontFamily={
																branding?.font?.body?.family ||
																objectRenderConfig.bodyFont ||
																'Inter'
															}
														/>
													),
													none: null,
												}[viewStyle]
											}
											<Group>
												<RichText
													key={point.pointNumber}
													x={
														viewStyle !== 'none'
															? 30 + (41 * ((point?.level || 1) - 1) || 0)
															: -10
													}
													y={3}
													// align='left'
													fontSize={24}
													fill={
														branding?.colors?.text
															? branding?.colors?.text
															: objectRenderConfig.textColor
													}
													// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
													// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
													width={
														viewStyle !== 'none'
															? objectRenderConfig.availableWidth -
															  110 -
															  (41 * ((point?.level || 1) - 1) || 0)
															: objectRenderConfig.availableWidth - 110
													}
													content={point.content}
													lineHeight={1.3}
													fontFamily={
														branding?.font?.body?.family ||
														objectRenderConfig.bodyFont ||
														'Inter'
													}
													height={
														objectRenderConfig.availableHeight - 32 - titleY
													}
												/>
											</Group>
										</>
									)),
								allAtOnce: computedPoints
									.filter(
										(_, i) =>
											i < activePointIndex &&
											i >= computedPoints[activePointIndex - 1]?.startFromIndex
									)
									.map(point => (
										<>
											{
												{
													bullet: (
														<PointBullets
															theme={theme.name}
															objectRenderConfig={objectRenderConfig}
															pointY={point?.y}
															pointLevel={point?.level}
															pointRenderMode='allAtOnce'
														/>
													),
													number: (
														<Text
															key='points'
															x={0 + (41 * ((point?.level || 1) - 1) || 0)}
															y={point.y}
															fill={
																branding?.colors?.text
																	? branding?.colors?.text
																	: objectRenderConfig.textColor
															}
															text={point.pointNumber.toString()}
															fontSize={20}
															fontStyle='normal 600'
															fontFamily={
																branding?.font?.body?.family ||
																objectRenderConfig.bodyFont ||
																'Inter'
															}
														/>
													),
													none: null,
												}[viewStyle]
											}
											<RichText
												key={point.pointNumber}
												x={
													viewStyle !== 'none'
														? 30 + (41 * ((point?.level || 1) - 1) || 0)
														: 0
												}
												y={point.y + 2}
												// align="left"
												fontSize={16}
												fill={
													branding?.colors?.text
														? branding?.colors?.text
														: objectRenderConfig.textColor
												}
												// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
												// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
												width={
													viewStyle !== 'none'
														? objectRenderConfig.availableWidth -
														  110 -
														  (41 * ((point?.level || 1) - 1) || 0)
														: objectRenderConfig.availableWidth - 110
												}
												content={point.content}
												richTextData={point.richTextData}
												lineHeight={1.3}
												fontFamily={
													branding?.font?.body?.family ||
													objectRenderConfig.bodyFont ||
													'Inter'
												}
											/>
										</>
									)),
						  }[appearance || 'stack']
						: appearance !== 'replace'
						? computedPoints
								.filter(point => point.startFromIndex === 0)
								.map(point => (
									<>
										{
											{
												bullet: (
													<PointBullets
														theme={theme.name}
														objectRenderConfig={objectRenderConfig}
														pointY={point?.y}
														pointLevel={point?.level}
														pointRenderMode='preview'
													/>
												),
												number: (
													<Text
														key='points'
														x={0 + (41 * ((point?.level || 1) - 1) || 0)}
														y={point.y}
														fill={
															branding?.colors?.text
																? branding?.colors?.text
																: objectRenderConfig.textColor
														}
														text={point.pointNumber.toString()}
														fontSize={20}
														// fontStyle="normal 600"
														fontFamily={
															branding?.font?.body?.family ||
															objectRenderConfig.bodyFont ||
															'Inter'
														}
													/>
												),
												none: null,
											}[viewStyle]
										}
										<RichText
											key={point.pointNumber}
											x={
												viewStyle !== 'none'
													? 30 + (41 * ((point?.level || 1) - 1) || 0)
													: 0
											}
											y={point.y + 2}
											// align="left"
											fontSize={16}
											fill={
												branding?.colors?.text
													? branding?.colors?.text
													: objectRenderConfig.textColor
											}
											// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
											// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
											width={
												viewStyle !== 'none'
													? objectRenderConfig.availableWidth -
													  110 -
													  (41 * ((point?.level || 1) - 1) || 0)
													: objectRenderConfig.availableWidth - 110
											}
											content={point.content}
											richTextData={point.richTextData}
											lineHeight={1.3}
											fontFamily={
												branding?.font?.body?.family ||
												objectRenderConfig.bodyFont ||
												'Inter'
											}
										/>
									</>
								))
						: computedPoints
								.filter((_, i) => i === 0)
								.map(point => (
									<Group>
										{
											{
												bullet: (
													<PointBullets
														theme={theme.name}
														objectRenderConfig={objectRenderConfig}
														pointY={4}
														pointLevel={point?.level}
														pointRenderMode='replace'
													/>
												),
												number: (
													<Text
														key='points'
														x={0 + (41 * ((point?.level || 1) - 1) || 0)}
														y={4}
														fill={
															branding?.colors?.text
																? branding?.colors?.text
																: objectRenderConfig.textColor
														}
														text={point.pointNumber.toString()}
														fontSize={24}
														// fontStyle="normal 600"
														fontFamily={
															branding?.font?.body?.family ||
															objectRenderConfig.bodyFont ||
															'Inter'
														}
													/>
												),
												none: null,
											}[viewStyle]
										}
										<RichText
											key={point.pointNumber}
											x={
												viewStyle !== 'none'
													? 30 + (41 * ((point?.level || 1) - 1) || 0)
													: -10
											}
											y={3}
											// align='left'
											fontSize={24}
											fill={
												branding?.colors?.text
													? branding?.colors?.text
													: objectRenderConfig.textColor
											}
											// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
											// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
											width={
												viewStyle !== 'none'
													? objectRenderConfig.availableWidth -
													  110 -
													  (41 * ((point?.level || 1) - 1) || 0)
													: objectRenderConfig.availableWidth - 110
											}
											content={point.content}
											lineHeight={1.3}
											fontFamily={
												branding?.font?.body?.family ||
												objectRenderConfig.bodyFont ||
												'Inter'
											}
											height={objectRenderConfig.availableHeight - 32 - titleY}
										/>
									</Group>
								))}
				</Group>
			) : (
				<Group
					x={objectRenderConfig.startX}
					y={
						shouldDisplayTitle
							? appearance !== 'replace' || isPreview
								? objectRenderConfig.startY + 50 * noOfLinesOfTitle
								: titleY + 50 * noOfLinesOfTitle + 20
							: objectRenderConfig.startY + 50
					}
					key='horizontalGroup'
				>
					{!isPreview
						? {
								stack: computedPoints
									.filter(
										(_, i) =>
											i < activePointIndex &&
											i >= computedPoints[activePointIndex - 1]?.startFromIndex
									)
									.map((point, index) => (
										<Group
											x={
												(objectRenderConfig.availableWidth -
													248 * pointsConfig.noOfPoints) /
													pointsConfig.noForSpacing +
												(248 +
													(objectRenderConfig.availableWidth -
														248 * pointsConfig.noOfPoints) /
														pointsConfig.noForSpacing) *
													index
											}
											y={point.y}
										>
											<Group x={(248 - bulletsConfig.bulletWidth) / 2}>
												<HorizontalPointBullets
													theme={theme.name}
													pointNumber={point.pointNumber}
													bulletsConfig={bulletsConfig}
												/>
											</Group>
											<Rect
												y={
													bulletsConfig.bulletHeight +
													pointsConfig.paddingBtwBulletText
												}
												width={248}
												height={(point.height || 0) + 32}
												fill={
													(objectRenderConfig.horizontalPointRectColor ||
														'') as string
												}
												stroke={
													objectRenderConfig.horizontalPointRectStrokeColor
												}
												strokeWidth={1}
												cornerRadius={
													objectRenderConfig.horizontalPointRectCornerRadius
												}
											/>
											<Text
												key={point.text}
												x={16}
												y={
													bulletsConfig.bulletHeight +
													pointsConfig.paddingBtwBulletText +
													16
												}
												fontSize={pointsConfig.textFontSize}
												fill={
													branding?.colors?.text
														? branding?.colors?.text
														: // using horizontal points text color for some themes and it falls back to text color
														  objectRenderConfig.horizontalPointsTextColor ||
														  objectRenderConfig.textColor
												}
												// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
												// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
												width={216}
												height={point.height}
												verticalAlign={
													objectRenderConfig.horizontalPointTextVerticalAlign ||
													'middle'
												}
												align='center'
												text={point.text}
												// text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
												lineHeight={1.3}
												fontFamily={
													branding?.font?.body?.family ||
													objectRenderConfig.bodyFont ||
													'Inter'
												}
											/>
										</Group>
									)),
								replace: null,
								allAtOnce: computedPoints
									.filter(
										(_, i) =>
											i < activePointIndex &&
											i >= computedPoints[activePointIndex - 1]?.startFromIndex
									)
									.map((point, index) => (
										<Group
											x={
												(objectRenderConfig.availableWidth -
													248 * pointsConfig.noOfPoints) /
													pointsConfig.noForSpacing +
												(248 +
													(objectRenderConfig.availableWidth -
														248 * pointsConfig.noOfPoints) /
														pointsConfig.noForSpacing) *
													index
											}
											y={point.y}
										>
											<Group x={(248 - bulletsConfig.bulletWidth) / 2}>
												<HorizontalPointBullets
													theme={theme.name}
													pointNumber={point.pointNumber}
													bulletsConfig={bulletsConfig}
												/>
											</Group>
											<Rect
												y={
													bulletsConfig.bulletHeight +
													pointsConfig.paddingBtwBulletText
												}
												width={248}
												height={(point.height || 0) + 32}
												fill={
													(objectRenderConfig.horizontalPointRectColor ||
														'') as string
												}
												stroke={
													objectRenderConfig.horizontalPointRectStrokeColor
												}
												strokeWidth={1}
												cornerRadius={
													objectRenderConfig.horizontalPointRectCornerRadius
												}
											/>
											<Text
												key={point.text}
												x={16}
												y={
													bulletsConfig.bulletHeight +
													pointsConfig.paddingBtwBulletText +
													16
												}
												fontSize={pointsConfig.textFontSize}
												fill={
													branding?.colors?.text
														? branding?.colors?.text
														: // using horizontal points text color for some themes and it falls back to text color
														  objectRenderConfig.horizontalPointsTextColor ||
														  objectRenderConfig.textColor
												}
												// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
												// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
												width={216}
												height={point.height}
												verticalAlign={
													objectRenderConfig.horizontalPointTextVerticalAlign ||
													'middle'
												}
												align='center'
												text={point.text}
												// text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
												lineHeight={1.3}
												fontFamily={
													branding?.font?.body?.family ||
													objectRenderConfig.bodyFont ||
													'Inter'
												}
											/>
										</Group>
									)),
						  }[appearance]
						: computedPoints
								.filter((_, i) => i < pointsConfig.noOfPoints)
								.map((point, index) => (
									<Group
										x={
											(objectRenderConfig.availableWidth -
												248 * pointsConfig.noOfPoints) /
												pointsConfig.noForSpacing +
											(248 +
												(objectRenderConfig.availableWidth -
													248 * pointsConfig.noOfPoints) /
													pointsConfig.noForSpacing) *
												index
										}
										y={point.y}
									>
										<Group x={(248 - bulletsConfig.bulletWidth) / 2}>
											<HorizontalPointBullets
												theme={theme.name}
												pointNumber={point.pointNumber}
												bulletsConfig={bulletsConfig}
											/>
										</Group>
										<Rect
											y={
												bulletsConfig.bulletHeight +
												pointsConfig.paddingBtwBulletText
											}
											width={248}
											height={(point.height || 0) + 32}
											fill={
												(objectRenderConfig.horizontalPointRectColor ||
													'') as string
											}
											stroke={objectRenderConfig.horizontalPointRectStrokeColor}
											strokeWidth={1}
											cornerRadius={
												objectRenderConfig.horizontalPointRectCornerRadius
											}
										/>
										<Text
											key={point.pointNumber}
											x={16}
											y={
												bulletsConfig.bulletHeight +
												pointsConfig.paddingBtwBulletText +
												16
											}
											fontSize={pointsConfig.textFontSize}
											fill={
												branding?.colors?.text
													? branding?.colors?.text
													: // using horizontal points text color for some themes and it falls back to text color
													  objectRenderConfig.horizontalPointsTextColor ||
													  objectRenderConfig.textColor
											}
											// why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
											// so we need to subtract 110 to get the correct x, to give 30 padding in the end too
											width={216}
											height={point.height}
											verticalAlign={
												objectRenderConfig.horizontalPointTextVerticalAlign ||
												'middle'
											}
											align='center'
											text={point.text}
											// content={point.content}
											// richTextData={point.richTextData}
											lineHeight={1.3}
											fontFamily={
												branding?.font?.body?.family ||
												objectRenderConfig.bodyFont ||
												'Inter'
											}
										/>
									</Group>
								))}
				</Group>
			)}
		</Group>,
	]

	const studioUserConfig = !shortsMode
		? getStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview
					? (users?.length || 0) + 1
					: speakersLength,
				fragmentState,
				theme,
		  })
		: getShortsStudioUserConfiguration({
				layout: !isPreview
					? layout || 'classic'
					: viewConfig?.layout || 'classic',
				noOfParticipants: !isPreview
					? (users?.length || 0) + 1
					: speakersLength,
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
			speakersLength={speakersLength}
		/>
	)
}

export default PointsFragment
