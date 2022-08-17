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

import React from 'react'
import { Group, Image, Rect, Star, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { brandingAtom } from 'src/stores/studio.store'
import { BulletsConfig } from 'src/utils/canvasConfigs/pointsConfig'
import { ObjectRenderConfig } from 'src/utils/canvasConfigs/themeConfig'
import useImage from 'use-image'
import { useEnv } from 'utils/src'

const HorizontalPointBullets = ({
	theme,
	bulletsConfig,
	pointNumber,
}: {
	theme: string
	bulletsConfig: BulletsConfig
	pointNumber: number
}) => {
	const branding = useRecoilValue(brandingAtom)
	switch (theme) {
		case 'DarkGradient':
		case 'PastelLines':
		case 'Rainbow':
		case 'Iceberg':
		case 'Midnight':
		case 'DevsForUkraine':
		case 'Obsidian':
		case 'CherryBlossom':
		case 'Lilac':
			return (
				<>
					<Rect
						x={bulletsConfig.bulletXOffset}
						y={bulletsConfig.bulletYOffset}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						fill={(bulletsConfig.bulletColor as string) || 'white'}
						cornerRadius={bulletsConfig.bulletCornerRadius}
						offsetX={bulletsConfig.bulletXOffset}
						offsetY={bulletsConfig.bulletYOffset}
						rotation={bulletsConfig.bulletRotation}
					/>
					<Text
						text={pointNumber.toString()}
						fontSize={bulletsConfig.bulletFontSize}
						fill={bulletsConfig.bulletTextColor || 'black'}
						fontFamily={branding?.font?.body?.family || 'Inter'}
						fontStyle={bulletsConfig.bulletFontStyle}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						align='center'
						verticalAlign='middle'
					/>
				</>
			)
		case 'Spiro':
			return (
				<>
					<Rect
						x={bulletsConfig.bulletBgRectXOffset}
						y={bulletsConfig.bulletBgRectYOffset}
						width={bulletsConfig.bulletBgRectWidth}
						height={bulletsConfig.bulletBgRectHeight}
						fill={
							(bulletsConfig.bulletBgRectColor as string[])?.[
								(pointNumber - 1) % 4
							] || 'white'
						}
						opacity={0.1}
						cornerRadius={bulletsConfig.bulletBgRectCornerRadius}
					/>
					<Rect
						x={bulletsConfig.bulletBgRectXOffset}
						y={bulletsConfig.bulletBgRectYOffset}
						width={bulletsConfig.bulletBgRectWidth}
						height={bulletsConfig.bulletBgRectHeight}
						stroke={
							(bulletsConfig.bulletBgRectColor as string[])?.[
								(pointNumber - 1) % 4
							] || 'white'
						}
						cornerRadius={bulletsConfig.bulletBgRectCornerRadius}
					/>
					<Rect
						x={bulletsConfig.bulletXOffset}
						y={bulletsConfig.bulletYOffset}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						fill={
							(bulletsConfig.bulletColor as string[])?.[
								(pointNumber - 1) % 4
							] || 'white'
						}
						cornerRadius={bulletsConfig.bulletCornerRadius}
						offsetX={bulletsConfig.bulletXOffset}
						offsetY={bulletsConfig.bulletYOffset}
						rotation={bulletsConfig.bulletRotation}
					/>
					<Text
						text={pointNumber.toString()}
						fontSize={bulletsConfig.bulletFontSize}
						fill={bulletsConfig.bulletTextColor || 'black'}
						fontFamily={branding?.font?.body?.family || 'Inter'}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						align='center'
						verticalAlign='middle'
					/>
				</>
			)
		case 'Cardinal':
			return (
				<Star
					x={bulletsConfig.bulletXOffset}
					y={bulletsConfig.bulletYOffset}
					numPoints={5}
					innerRadius={7}
					outerRadius={17}
					fill={bulletsConfig.bulletColor as string}
				/>
			)
		case 'Velvet':
			return (
				<>
					<Rect
						x={bulletsConfig.bulletXOffset}
						y={bulletsConfig.bulletYOffset}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						stroke={(bulletsConfig.bulletColor as string) || 'white'}
						cornerRadius={bulletsConfig.bulletCornerRadius}
						offsetX={bulletsConfig.bulletXOffset}
						offsetY={bulletsConfig.bulletYOffset}
						rotation={bulletsConfig.bulletRotation}
					/>
					<Text
						text={pointNumber.toString()}
						fontSize={bulletsConfig.bulletFontSize}
						fill={bulletsConfig.bulletTextColor || 'black'}
						fontFamily={branding?.font?.body?.family || 'Space Mono'}
						fontStyle={bulletsConfig.bulletFontStyle}
						width={bulletsConfig.bulletWidth}
						height={bulletsConfig.bulletHeight}
						align='center'
						verticalAlign='middle'
					/>
				</>
			)
		default:
			return null
	}
}

export const PointBullets = ({
	theme,
	objectRenderConfig,
	pointY,
	pointLevel,
	pointRenderMode,
}: {
	theme: string
	objectRenderConfig: ObjectRenderConfig
	pointY: number
	pointLevel: number
	pointRenderMode: string
}) => {
	const branding = useRecoilValue(brandingAtom)
	const { storage } = useEnv()
	const [lilacBullet] = useImage(
		`${storage.cdn}themes/Lilac/LilacBullet.svg`,
		'anonymous'
	)
	switch (theme) {
		case 'DarkGradient':
		case 'PastelLines':
		case 'Rainbow':
		case 'Iceberg':
		case 'Midnight':
		case 'DevsForUkraine':
		case 'Spiro':
		case 'CherryBlossom':
			return (
				<Rect
					key='points'
					x={
						pointRenderMode === 'stack'
							? -2 + (41 * (pointLevel - 1) || 0)
							: 0 + (41 * (pointLevel - 1) || 0)
					}
					y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
					width={12}
					height={12}
					cornerRadius={objectRenderConfig.pointsBulletCornerRadius}
					fill={
						branding?.colors?.text
							? branding?.colors?.text
							: (objectRenderConfig.pointsBulletColor as string)
					}
					ref={ref => {
						if (pointRenderMode !== 'stack') return
						ref?.to({
							x: 0 + (41 * (pointLevel - 1) || 0),
							duration: 0.3,
						})
					}}
					rotation={objectRenderConfig.pointsBulletRotation}
				/>
			)
		case 'Obsidian':
			return (
				<Group
					x={
						pointRenderMode === 'stack'
							? -2 + (41 * (pointLevel - 1) || 0)
							: 0 + (41 * (pointLevel - 1) || 0)
					}
					ref={ref => {
						if (pointRenderMode !== 'stack') return
						ref?.to({
							x: 0 + (41 * (pointLevel - 1) || 0),
							duration: 0.3,
						})
					}}
				>
					<Rect
						y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
						width={12}
						height={2}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: (objectRenderConfig.pointsBulletColor as string)
						}
					/>
					<Rect
						x={12}
						y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
						width={8}
						height={2}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: (objectRenderConfig.pointsBulletColor as string)
						}
						offsetX={8}
						rotation={45}
					/>
					<Rect
						x={12}
						y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
						width={10}
						height={2}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: (objectRenderConfig.pointsBulletColor as string)
						}
						offsetX={10}
						rotation={-45}
					/>
				</Group>
			)
		case 'Cardinal':
			return (
				<Star
					x={
						pointRenderMode === 'stack'
							? -2 + (41 * (pointLevel - 1) || 0)
							: 0 + (41 * (pointLevel - 1) || 0)
					}
					y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
					numPoints={5}
					innerRadius={3.5}
					outerRadius={8.5}
					fill={objectRenderConfig.pointsBulletColor as string}
					ref={ref => {
						if (pointRenderMode !== 'stack') return
						ref?.to({
							x: 0 + (41 * (pointLevel - 1) || 0),
							duration: 0.3,
						})
					}}
				/>
			)
		case 'Velvet':
			return (
				<Group
					x={
						pointRenderMode === 'stack'
							? -2 + (41 * (pointLevel - 1) || 0)
							: 0 + (41 * (pointLevel - 1) || 0)
					}
					ref={ref => {
						if (pointRenderMode !== 'stack') return
						ref?.to({
							x: 0 + (41 * (pointLevel - 1) || 0),
							duration: 0.3,
						})
					}}
				>
					<Rect
						x={12}
						y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
						width={8.4}
						height={2}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: (objectRenderConfig.pointsBulletColor as string)
						}
						offsetX={8}
						rotation={30}
					/>
					<Rect
						x={12.5}
						y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
						width={9.7}
						height={2}
						fill={
							branding?.colors?.text
								? branding?.colors?.text
								: (objectRenderConfig.pointsBulletColor as string)
						}
						offsetX={10}
						rotation={-30}
					/>
				</Group>
			)
		case 'Lilac':
			return (
				<Image
					key='points'
					image={lilacBullet}
					x={
						pointRenderMode === 'stack'
							? -2 + (41 * (pointLevel - 1) || 0)
							: 0 + (41 * (pointLevel - 1) || 0)
					}
					y={pointY + (objectRenderConfig.pointsBulletYOffset || 0)}
					width={12}
					height={12}
					cornerRadius={objectRenderConfig.pointsBulletCornerRadius}
					ref={ref => {
						if (pointRenderMode !== 'stack') return
						ref?.to({
							x: 0 + (41 * (pointLevel - 1) || 0),
							duration: 0.3,
						})
					}}
				/>
			)
		default:
			return null
	}
}

export default HorizontalPointBullets
