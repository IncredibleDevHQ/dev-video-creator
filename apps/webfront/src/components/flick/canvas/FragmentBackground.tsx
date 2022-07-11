import React from 'react'
import { Circle, Group, Line, Rect } from 'react-konva'
import { ThemeFragment } from 'src/graphql/generated'
import { ObjectConfig } from 'src/utils/canvasConfigs/fragmentLayoutConfig'
import { getCanvasGradient } from 'src/utils/canvasConfigs/studioUserConfig'

const FragmentBackground = ({
	theme,
	objectConfig,
	backgroundRectColor,
}: {
	theme: ThemeFragment
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
		case 'Web3Auth':
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
		case 'Whitep4nth3r':
		case 'VetsWhoCode':
		case 'Mux':
			return (
				<Rect
					x={objectConfig.x}
					y={objectConfig.y}
					width={objectConfig.width}
					height={objectConfig.height}
					fill={backgroundRectColor}
				/>
			)
		case 'Cassidoo':
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
		case 'LambdaTest':
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
		case 'LeeRob':
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
		case 'ShrutiKapoor':
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
