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
import { Video } from 'icanvas/src/Video'
import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
import { Group } from 'react-konva'
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
	getShortsStudioUserConfiguration,
	getStudioUserConfiguration,
} from 'src/utils/canvasConfigs/studioUserConfig'
import { CONFIG, SHORTS_CONFIG } from 'src/utils/configs'
import useUpdatePayload from 'src/utils/hooks/useUpdatePayload'
import { BlockProperties, TopLayerChildren } from 'utils/src'
import Concourse from '../Concourse'
import Thumbnail from '../Thumbnail'

export type IntroState = 'userMedia' | 'titleSplash' | 'introVideo'

const IntroFragment = ({
	shortsMode,
	viewConfig,
	isPreview,
	setTopLayerChildren,
	introSequence,
	blockId,
	speakersLength,
}: {
	shortsMode: boolean
	viewConfig: BlockProperties
	isPreview: boolean
	setTopLayerChildren?: React.Dispatch<
		React.SetStateAction<{
			id: string
			state: TopLayerChildren
		}>
	>
	introSequence: IntroState[]
	blockId: string
	speakersLength: number
}) => {
	const users = useRecoilValue(agoraUsersAtom)
	const state = useRecoilValue(studioStateAtom)
	const theme = useRecoilValue(themeAtom)
	const branding = useRecoilValue(brandingAtom)
	const payload = useRecoilValue(payloadFamily(blockId))
	const { updatePayload, reset } = useUpdatePayload({
		blockId,
		shouldUpdateLiveblocks: !isPreview,
	})
	const setControlsConfig = useSetRecoilState(controlsConfigAtom)

	const titleScreenRef = React.useRef<Konva.Group>(null)
	const brandVideoRef = React.useRef<Konva.Group>(null)

	const [stageConfig, setStageConfig] = useState<{
		width: number
		height: number
	}>({ width: 0, height: 0 })

	const [activeIntroIndex, setActiveIntroIndex] = useState<number>(
		payload?.activeIntroIndex || 0
	)

	const timer = useRef<any>(null)

	useEffect(() => {
		clearTimeout(timer.current)
		setControlsConfig({
			updatePayload,
			blockId,
		})
		return () => {
			clearTimeout(timer.current)
			reset({
				activeIntroIndex: 0,
			})
		}
	}, [])

	useEffect(() => {
		if (!shortsMode) setStageConfig(CONFIG)
		else setStageConfig(SHORTS_CONFIG)
	}, [shortsMode])

	const videoElement = React.useMemo(() => {
		if (!branding?.introVideoUrl) return
		const element = document.createElement('video')
		element.autoplay = false
		element.crossOrigin = 'anonymous'
		element.preload = 'auto'
		element.muted = true
		element.src = branding.introVideoUrl || ''
		// eslint-disable-next-line consistent-return
		return element
	}, [branding, stageConfig])

	useEffect(() => {
		if (payload?.activeIntroIndex === undefined) return
		if (payload?.activeIntroIndex === activeIntroIndex) return
		setActiveIntroIndex(payload?.activeIntroIndex)
	}, [payload?.activeIntroIndex])

	useEffect(() => {
		if (
			state === 'startRecording' ||
			state === 'recording' ||
			state === 'ready' ||
			state === 'resumed' ||
			isPreview
		) {
			if (introSequence[activeIntroIndex] === 'titleSplash') {
				// if (!isPreview) addMusic('splash')
				setTopLayerChildren?.({ id: '', state: '' })
				videoElement?.pause()
				if (videoElement) videoElement.currentTime = 0
				titleScreenRef.current?.opacity(1)
				brandVideoRef.current?.opacity(0)
			}
			if (introSequence[activeIntroIndex] === 'introVideo') {
				setTopLayerChildren?.({ id: '', state: '' })
				if (!videoElement) return
				videoElement.currentTime = 0
				videoElement?.play()
				titleScreenRef.current?.opacity(0)
				brandVideoRef.current?.opacity(1)
			}
			if (introSequence[activeIntroIndex] === 'userMedia') {
				setTopLayerChildren?.({ id: '', state: '' })
				videoElement?.pause()
				if (videoElement) videoElement.currentTime = 0
				titleScreenRef.current?.opacity(0)
				brandVideoRef.current?.opacity(0)
			}
		}
	}, [state, activeIntroIndex, videoElement])

	useEffect(() => {
		if (
			!isPreview &&
			introSequence[activeIntroIndex] === 'userMedia' &&
			state === 'recording'
		) {
			timer.current = setTimeout(() => {
				setTopLayerChildren?.({ id: nanoid(), state: 'lowerThird' })
			}, 2000)
		}
	}, [activeIntroIndex, state])

	useEffect(() => {
		if (!videoElement) return
		if (isPreview) return
		if (introSequence[activeIntroIndex] !== 'introVideo') return
		videoElement.addEventListener('ended', () => {
			if (activeIntroIndex !== introSequence.length - 1) {
				updatePayload?.({ activeIntroIndex: activeIntroIndex + 1 })
			} else {
				videoElement.pause()
			}
		})
	}, [videoElement, activeIntroIndex])

	const layerChildren = [
		<Group>
			<Group x={0} y={0} ref={titleScreenRef} opacity={0}>
				<Thumbnail
					isShorts={shortsMode}
					viewConfig={{
						layout: viewConfig?.layout || 'bottom-right-tile',
						view: viewConfig?.view,
					}}
					isIntro
				/>
			</Group>
			<Group x={0} y={0} ref={brandVideoRef} opacity={0}>
				{videoElement && (
					<Video
						videoElement={videoElement}
						videoConfig={{
							x: 0,
							y: 0,
							width: stageConfig.width,
							height: stageConfig.height,
							videoFill: branding?.background?.color?.primary,
							cornerRadius: 0,
							performClip: true,
							clipVideoConfig: {
								x: 0,
								y: 0,
								width: 1,
								height: 1,
							},
						}}
					/>
				)}
			</Group>
		</Group>,
	]

	const studioUserConfig = !shortsMode
		? getStudioUserConfiguration({
				layout: 'classic',
				noOfParticipants: !isPreview
					? (users?.length || 0) + 1
					: speakersLength,
				fragmentState:
					introSequence[payload?.activeIntroIndex || 0] === 'userMedia'
						? 'onlyUserMedia'
						: 'customLayout',
				theme,
		  })
		: getShortsStudioUserConfiguration({
				layout: 'classic',
				noOfParticipants: 0,
				fragmentState:
					introSequence[payload?.activeIntroIndex || 0] === 'userMedia'
						? 'onlyUserMedia'
						: 'customLayout',
				theme,
		  })

	return (
		<Concourse
			studioUserConfig={studioUserConfig}
			layerChildren={layerChildren}
			blockType='introBlock'
			isShorts={shortsMode}
			speakersLength={speakersLength}
		/>
	)
}

export default IntroFragment
