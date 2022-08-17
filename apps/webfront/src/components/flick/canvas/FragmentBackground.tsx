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
import { Circle, Group, Line, Rect } from 'react-konva'
import { inferQueryOutput } from 'src/server/trpc'
import { ObjectConfig } from 'src/utils/canvasConfigs/fragmentLayoutConfig'
import { getCanvasGradient } from 'src/utils/canvasConfigs/studioUserConfig'

const FragmentBackground = ({
	theme,
	objectConfig,
	backgroundRectColor,
}: {
	theme: inferQueryOutput<'util.themes'>[number]
	objectConfig: ObjectConfig
	backgroundRectColor: string
}) => {
	switch (theme.name) {
		case 'DarkGradient':
			return (
				<Group>
					<Rect
						x={objectConfig.x}
						y={objectConfig.y}
						width={objectConfig.width}
						height={40}
						fill='#ffffff'
						opacity={0.2}
					/>
					<Group
						x={objectConfig.x + 20}
						y={objectConfig.y + 20}
						key='circleGroup'
					>
						<Circle key='redCircle' x={0} y={0} fill='#FF605C' radius={6} />
						<Circle key='yellowCircle' x={20} y={0} fill='#FFBD44' radius={6} />
						<Circle key='greenCircle' x={40} y={0} fill='#00CA4E' radius={6} />
					</Group>
					<Rect
						x={objectConfig.x}
						y={objectConfig.y + 40}
						width={objectConfig.width}
						height={objectConfig.height - 40}
						fill={backgroundRectColor}
					/>
				</Group>
			)
		case 'PastelLines':
		case 'Spiro':
			return (
				<Rect
					x={objectConfig.x}
					y={objectConfig.y}
					width={objectConfig.width}
					height={objectConfig.height}
					fill={backgroundRectColor}
					stroke={objectConfig.borderColor}
					strokeWidth={1}
				/>
			)
		case 'DevsForUkraine':
		case 'Obsidian':
		case 'Cardinal':
		case 'CherryBlossom':
		case 'Lilac':
			return (
				<Rect
					x={objectConfig.x}
					y={objectConfig.y}
					width={objectConfig.width}
					height={objectConfig.height}
					fill={backgroundRectColor}
				/>
			)
		case 'Rainbow':
			return (
				<Group>
					<Rect
						x={objectConfig.x}
						y={objectConfig.y}
						width={objectConfig.width}
						height={56}
						fill='#fafafa'
						opacity={0.8}
					/>
					<Group
						x={objectConfig.x + 28}
						y={objectConfig.y + 28}
						key='circleGroup'
					>
						<Circle key='redCircle' x={0} y={0} fill='#FF605C' radius={6} />
						<Circle key='yellowCircle' x={20} y={0} fill='#FFBD44' radius={6} />
						<Circle key='greenCircle' x={40} y={0} fill='#00CA4E' radius={6} />
					</Group>
					<Line
						points={[
							objectConfig.x,
							objectConfig.y + 56,
							objectConfig.x + objectConfig.width,
							objectConfig.y + 56,
						]}
						stroke='#27272A'
						strokeWidth={1}
					/>
					<Rect
						x={objectConfig.x}
						y={objectConfig.y + 56}
						width={objectConfig.width}
						height={objectConfig.height - 56}
						fill={backgroundRectColor}
						opacity={0.8}
					/>
				</Group>
			)
		case 'Iceberg':
			return (
				<Group>
					<Rect
						x={objectConfig.x}
						y={objectConfig.y}
						width={objectConfig.width}
						height={objectConfig.height}
						cornerRadius={16}
						stroke={getCanvasGradient(
							[
								{ color: '#8BCBF97B', offset: 0.0 },
								{ color: '#5A80D67B', offset: 0.5204 },
								{ color: '#B7AEFA7B', offset: 1.0 },
							],
							{
								x0: objectConfig.x,
								y0: objectConfig.y,
								x1: objectConfig.width,
								y1: objectConfig.height,
							}
						)}
						strokeWidth={12}
						fill={backgroundRectColor}
					/>
				</Group>
			)
		case 'Midnight':
			return (
				<Rect
					x={objectConfig.x}
					y={objectConfig.y}
					width={objectConfig.width}
					height={objectConfig.height}
					fill={backgroundRectColor}
					stroke={objectConfig?.borderColor}
					strokeWidth={8}
				/>
			)
		case 'Velvet':
			return (
				<Rect
					x={objectConfig.x}
					y={objectConfig.y}
					width={objectConfig.width}
					height={objectConfig.height}
					fill={backgroundRectColor}
					stroke={getCanvasGradient(
						[
							{ color: '#FA709A', offset: 0.0 },
							{ color: '#FEE14080', offset: 0.5156 },
							{ color: '#FEE14000', offset: 1.0 },
						],
						{
							x0: objectConfig.x,
							y0: objectConfig.y + 20,
							x1: objectConfig.width * 0.9,
							y1: objectConfig.height / 1.75,
						}
					)}
					strokeWidth={1}
				/>
			)
		default:
			return null
	}
}

export default FragmentBackground
