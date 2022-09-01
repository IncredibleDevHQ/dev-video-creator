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

/* eslint-disable consistent-return */
import useEdit, { ClipConfig } from 'icanvas/src/hooks/useEdit'
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import { StudioUserConfig } from 'src/utils/configs'
import useImage from 'use-image'
import { useEnv } from 'utils/src'

type StudioUserType = 'local' | 'remote'

const StudioUser = ({
	stream,
	studioUserConfig,
	type,
}: {
	stream: MediaStream | undefined
	type: StudioUserType
	studioUserConfig: StudioUserConfig
}) => {
	const {
		x,
		y,
		width,
		height,
		clipTheme,
		studioUserClipConfig,
		borderColor,
		borderWidth,
		backgroundRectX,
		backgroundRectY,
		backgroundRectWidth,
		backgroundRectHeight,
		backgroundRectOpacity,
		backgroundRectBorderRadius,
		backgroundRectColor,
		backgroundRectBorderColor,
		backgroundRectBorderWidth,
	} = studioUserConfig

	const { storage } = useEnv()
	const [image] = useImage(`${storage.cdn}StudioUser.png`, 'anonymous')

	const imageConfig = { width: width || 0, height: height || 0 }
	const imageRef = useRef<Konva.Image | null>(null)

	const { clipCircle, clipRect, getImageDimensions } = useEdit()
	const defaultStudioUserClipConfig: ClipConfig = {
		x: 0,
		y: 0,
		width: 160,
		height: 120,
		borderRadius: 8,
	}

	const [imgDim, setImgDim] = useState<{
		width: number
		height: number
		x: number
		y: number
	}>({ width: 0, height: 0, x: 0, y: 0 })

	const videoElement = React.useMemo(() => {
		if (!stream) return
		const element = document.createElement('video')
		element.srcObject = stream
		element.muted = true

		return element
	}, [stream])

	useEffect(() => {
		if (!videoElement || !imageRef.current) return
		videoElement.play()

		const layer = imageRef.current.getLayer()

		const anim = new Konva.Animation(() => {}, layer)
		anim.start()

		return () => {
			anim.stop()
		}
	}, [videoElement])

	const getClipFunc = ({
		ctx,
		clipConfig,
	}: {
		ctx: any
		clipConfig: ClipConfig
	}) => {
		if (clipTheme === 'circle') return clipCircle(ctx, clipConfig)
		return clipRect(ctx, clipConfig)
	}

	useEffect(() => {
		if (stream) return
		let maxWidth = studioUserClipConfig?.width
			? studioUserClipConfig.width / 1.5
			: 0
		let maxHeight = studioUserClipConfig?.height
			? studioUserClipConfig.height / 1.5
			: 0
		if (maxWidth >= 320) {
			maxWidth /= 1.5
			maxHeight /= 1.5
		}
		setImgDim(
			getImageDimensions(
				{
					w: (image && image.width) || 0,
					h: (image && image.height) || 0,
				},
				maxWidth,
				maxHeight,
				studioUserClipConfig?.width || 0,
				studioUserClipConfig?.height || 0,
				(studioUserClipConfig && studioUserClipConfig.x + x) || 0,
				(studioUserClipConfig && studioUserClipConfig.y + y + 3) || y
			)
		)
	}, [stream, image, studioUserConfig])

	return (
		<>
			<Rect
				x={backgroundRectX || 775}
				y={backgroundRectY || y}
				width={backgroundRectWidth}
				height={backgroundRectHeight}
				fill={backgroundRectColor}
				stroke={backgroundRectBorderColor}
				strokeWidth={backgroundRectBorderWidth || 0}
				cornerRadius={backgroundRectBorderRadius || 0}
				opacity={backgroundRectOpacity || 0}
			/>
			<Rect
				x={backgroundRectX || 775}
				y={backgroundRectY || y}
				width={backgroundRectWidth}
				height={backgroundRectHeight}
				stroke={backgroundRectBorderColor}
				strokeWidth={backgroundRectBorderWidth || 0}
				cornerRadius={backgroundRectBorderRadius || 0}
			/>
			<Rect
				x={(studioUserClipConfig && studioUserClipConfig.x + x) || 775}
				y={(studioUserClipConfig && studioUserClipConfig.y + y) || y}
				width={studioUserClipConfig?.width || defaultStudioUserClipConfig.width}
				height={
					studioUserClipConfig?.height || defaultStudioUserClipConfig.height
				}
				stroke={borderColor}
				strokeWidth={borderWidth || 0}
				cornerRadius={studioUserClipConfig?.borderRadius || 0}
			/>
			{stream ? (
				<Group
					x={x}
					y={y}
					clipFunc={(ctx: any) => {
						getClipFunc({
							ctx,
							clipConfig: studioUserClipConfig || defaultStudioUserClipConfig,
						})
					}}
					offsetX={imageConfig.width}
					scaleX={-1}
				>
					{type === 'local' && (
						<Image
							ref={imageRef}
							image={videoElement}
							width={imageConfig.width}
							height={imageConfig.height}
						/>
					)}
					{type === 'remote' && stream && (
						<Image
							ref={imageRef}
							image={videoElement}
							width={imageConfig.width}
							height={imageConfig.height}
						/>
					)}
				</Group>
			) : (
				<>
					<Group
						x={x}
						y={y}
						clipFunc={(ctx: any) => {
							getClipFunc({
								ctx,
								clipConfig: studioUserClipConfig || defaultStudioUserClipConfig,
							})
						}}
					>
						<Rect
							width={imageConfig.width}
							height={imageConfig.height}
							fill='#374151'
						/>
					</Group>
					<Image
						image={image}
						y={imgDim.y}
						x={imgDim.x}
						width={imgDim.width}
						height={imgDim.height}
					/>
				</>
			)}
		</>
	)
}

export default StudioUser
