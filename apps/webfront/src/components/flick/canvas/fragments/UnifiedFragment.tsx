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

/* eslint-disable react-hooks/exhaustive-deps */
import {
	Block,
	CodeBlockProps,
	HeadingBlockProps,
	ImageBlockProps,
	ListBlockProps,
	VideoBlockProps,
} from 'editor/src/utils/types'
import Konva from 'konva'
import { nanoid } from 'nanoid'
// import { nanoid } from 'nanoid'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import {
	activeObjectIndexAtom,
	payloadFamily,
	themeAtom,
} from 'src/stores/studio.store'
import { CONFIG, FragmentState, SHORTS_CONFIG } from 'src/utils/configs'
import {
	BlockProperties,
	IntroBlockView,
	OutroBlockView,
	TopLayerChildren,
	ViewConfig,
} from 'utils/src'
import VideoBackground from '../VideoBackground'
import CodeFragment from './CodeFragment'
import HeadingFragment from './HeadingFragment'
import ImageFragment from './ImageFragment'
import IntroFragment from './IntroFragment'
import OutroFragment from './OutroFragment'
import PointsFragment from './PointsFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
	stageRef,
	setTopLayerChildren,
	config,
	layoutConfig,
	isPreview,
}: {
	stageRef: React.RefObject<Konva.Stage>
	setTopLayerChildren?: React.Dispatch<
		React.SetStateAction<{
			id: string
			state: TopLayerChildren
		}>
	>
	config: Block[]
	layoutConfig: ViewConfig
	isPreview: boolean
}) => {
	const flickTheme = useRecoilValue(themeAtom)
	const storeActiveObjectIndex = useRecoilValue(activeObjectIndexAtom)

	// data config holds all the info abt the object
	const [dataConfig, setDataConfig] = useState<Block[]>()
	// view config holds all the info abt the view of the canvas
	const [viewConfig, setViewConfig] = useState<ViewConfig>()
	// holds the index of the present object
	const [activeObjectIndex, setActiveObjectIndex] = useState(-1)

	const { fragmentState: payloadFragmentState } = useRecoilValue(
		payloadFamily(config[activeObjectIndex]?.id)
	)

	// state of the fragment
	const [fragmentState, setFragmentState] =
		useState<FragmentState>('customLayout')

	useEffect(() => {
		if (!config && !layoutConfig) return
		setDataConfig(config)
		setViewConfig(layoutConfig)
	}, [config, layoutConfig])

	useEffect(() => {
		if (storeActiveObjectIndex === undefined || storeActiveObjectIndex === -1)
			return
		setActiveObjectIndex(storeActiveObjectIndex)
	}, [storeActiveObjectIndex])

	useEffect(() => {
		if (!storeActiveObjectIndex || storeActiveObjectIndex === 0) return
		if (payloadFragmentState === fragmentState) return
		if (viewConfig?.mode !== 'Portrait') {
			// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
			if (payloadFragmentState === 'customLayout') {
				setTopLayerChildren?.({
					id: nanoid(),
					state:
						fragmentState === 'onlyUserMedia'
							? 'transition right'
							: 'transition left',
				})
			}
			// Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
			if (payloadFragmentState === 'onlyUserMedia') {
				setTopLayerChildren?.({ id: nanoid(), state: 'transition left' })
			}
			if (payloadFragmentState === 'onlyFragment') {
				setTopLayerChildren?.({ id: nanoid(), state: 'transition right' })
			}
		} else {
			setTopLayerChildren?.({ id: nanoid(), state: '' })
		}
	}, [payloadFragmentState])

	const [stageConfig, setStageConfig] = useState<{
		width: number
		height: number
	}>({ width: 0, height: 0 })

	useEffect(() => {
		if (!viewConfig?.mode) return
		if (viewConfig?.mode === 'Landscape') setStageConfig(CONFIG)
		else setStageConfig(SHORTS_CONFIG)
	}, [viewConfig?.mode])

	if (!dataConfig || !viewConfig || dataConfig.length === 0) return null
	return (
		<>
			<VideoBackground
				theme={flickTheme}
				stageConfig={stageConfig}
				isShorts={viewConfig.mode === 'Portrait'}
			/>
			{(() => {
				switch (dataConfig?.[activeObjectIndex]?.type) {
					case 'codeBlock': {
						return (
							<CodeFragment
								key={activeObjectIndex}
								dataConfig={dataConfig[activeObjectIndex] as CodeBlockProps}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								fragmentState={fragmentState}
								setFragmentState={setFragmentState}
								stageRef={stageRef}
								shortsMode={viewConfig.mode === 'Portrait'}
								isPreview={isPreview}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'videoBlock': {
						return (
							<VideoFragment
								key={activeObjectIndex}
								dataConfig={dataConfig[activeObjectIndex] as VideoBlockProps}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								fragmentState={fragmentState}
								setFragmentState={setFragmentState}
								stageRef={stageRef}
								shortsMode={viewConfig.mode === 'Portrait'}
								isPreview={isPreview}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'imageBlock': {
						return (
							<ImageFragment
								key={activeObjectIndex}
								dataConfig={dataConfig[activeObjectIndex] as ImageBlockProps}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								fragmentState={fragmentState}
								setFragmentState={setFragmentState}
								stageRef={stageRef}
								shortsMode={viewConfig.mode === 'Portrait'}
								isPreview={isPreview}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'listBlock': {
						return (
							<PointsFragment
								key={activeObjectIndex}
								dataConfig={dataConfig[activeObjectIndex] as ListBlockProps}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								fragmentState={fragmentState}
								setFragmentState={setFragmentState}
								stageRef={stageRef}
								shortsMode={viewConfig.mode === 'Portrait'}
								isPreview={isPreview}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'headingBlock': {
						return (
							<HeadingFragment
								key={activeObjectIndex}
								dataConfig={dataConfig[activeObjectIndex] as HeadingBlockProps}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								fragmentState={fragmentState}
								setFragmentState={setFragmentState}
								stageRef={stageRef}
								shortsMode={viewConfig.mode === 'Portrait'}
								isPreview={isPreview}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'introBlock': {
						const introBlockViewProps = (
							viewConfig.blocks[
								dataConfig[activeObjectIndex].id
							] as BlockProperties
						)?.view as IntroBlockView
						return (
							<IntroFragment
								shortsMode={viewConfig.mode === 'Portrait'}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								isPreview={isPreview}
								setTopLayerChildren={setTopLayerChildren}
								introSequence={
									introBlockViewProps?.intro?.order
										?.filter(o => o.enabled)
										.map(o => o.state) || ['userMedia', 'titleSplash']
								}
								blockId={dataConfig[activeObjectIndex].id}
								speakersLength={viewConfig?.speakers?.length || 1}
							/>
						)
					}
					case 'outroBlock': {
						const outroBlockViewProps = (
							viewConfig.blocks[
								dataConfig[activeObjectIndex].id
							] as BlockProperties
						)?.view as OutroBlockView
						return (
							<OutroFragment
								isShorts={viewConfig.mode === 'Portrait'}
								viewConfig={
									viewConfig.blocks[
										dataConfig[activeObjectIndex].id
									] as BlockProperties
								}
								isPreview={isPreview}
								outroSequence={
									outroBlockViewProps?.outro?.order
										?.filter(o => o.enabled)
										.map(o => o.state) || ['titleSplash']
								}
								blockId={dataConfig[activeObjectIndex].id}
							/>
						)
					}
					default:
						return null
				}
			})()}
		</>
	)
}

export default UnifiedFragment
