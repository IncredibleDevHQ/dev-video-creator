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

import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'

export interface ComputedRichText {
	x: number
	y: number
	text: string
	width: number
	height?: number
	styles: string[]
}

export interface RichTextContent {
	text: string
	marks: string[]
}

export const getRichTextData = ({
	content,
	fontSize = 12,
	fontFamily,
	width,
	lineHeight = 1,
}: {
	content: {
		type: 'richText' | 'text'
		content: RichTextContent | string
		line: number
	}[]
	width: number
	fontSize?: number
	fontFamily?: string
	lineHeight?: number
}) => {
	const layer = new Konva.Layer({ width })
	const computedRichText: ComputedRichText[] = []
	let currentX = 0
	let currentY = 0
	content.forEach(item => {
		if (item.type === 'richText') {
			const richText = (item?.content as RichTextContent)?.text
			const styles = (item?.content as RichTextContent)?.marks

			if (styles.includes('code')) {
				const konvaText = new Konva.Text({
					text: richText,
					fontSize: fontSize * 0.9,
					fontFamily,
					fontStyle: styles
						.filter(style => style === 'bold' || style === 'italic')
						.join(' '),
					lineHeight,
				})
				const space = new Konva.Text({
					text: ' ',
					fontSize,
					fontFamily,
					lineHeight,
				})
				layer.add(konvaText)
				const textWidth = konvaText.textWidth + 10 + space.textWidth
				if (textWidth + currentX > width) {
					currentX = 0
					currentY += fontSize * lineHeight
				}
				computedRichText.push({
					x: currentX,
					y: currentY,
					text: richText,
					width: textWidth - space.textWidth,
					styles,
				})
				currentX += textWidth
				konvaText.destroy()
			} else {
				richText?.split(' ').forEach(text => {
					const konvaText = new Konva.Text({
						text: `${text} `,
						fontSize,
						fontFamily,
						fontStyle: styles
							.filter(style => style === 'bold' || style === 'italic')
							.join(' '),
						lineHeight,
					})
					layer.add(konvaText)
					const { textWidth } = konvaText
					if (textWidth + currentX > width) {
						currentX = 0
						currentY += fontSize * lineHeight
					}
					computedRichText.push({
						x: currentX,
						y: currentY,
						text: `${text} `,
						width: textWidth,
						styles,
					})

					currentX += textWidth
					konvaText.destroy()
				})
			}
		} else {
			const regularText = item?.content as string
			regularText?.split(' ').forEach(text => {
				const konvaText = new Konva.Text({
					text: `${text} `,
					fontSize,
					fontFamily,
					lineHeight,
				})
				layer.add(konvaText)
				const { textWidth } = konvaText
				if (textWidth + currentX > width) {
					currentX = 0
					currentY += fontSize * lineHeight
				}
				computedRichText.push({
					x: currentX,
					y: currentY,
					text: `${text} `,
					width: textWidth,
					styles: [],
				})

				currentX += textWidth
				konvaText.destroy()
			})
		}
	})
	return computedRichText
}

const RichText = ({
	content,
	x,
	y,
	width = 960,
	height,
	// align = 'left',
	fontSize = 12,
	fontFamily,
	fill = '#000000',
	lineHeight = 1,
	richTextData,
	animate,
}: {
	content: {
		type: 'richText' | 'text'
		content: RichTextContent | string
		line: number
	}[]
	x?: number
	y?: number
	width?: number
	height?: number
	// align?: 'left' | 'center' | 'right'
	fontSize?: number
	fontFamily?: string
	fill?: string
	lineHeight?: number
	richTextData?: ComputedRichText[]
	animate?: (ref: any) => void
}) => {
	const [computedRichText, setComputedRichText] = useState<ComputedRichText[]>(
		[]
	)
	useEffect(() => {
		if (richTextData) {
			setComputedRichText(richTextData)
		} else {
			setComputedRichText(
				getRichTextData({ content, width, fontSize, fontFamily, lineHeight })
			)
		}
	}, [content])

	return (
		<Group x={x} y={y} height={height} ref={ref => animate?.(ref)}>
			<>
				{computedRichText.map(item => {
					if (item.styles.includes('code')) {
						return (
							<Group x={item.x} y={item.y}>
								<Rect
									y={-2}
									width={item.width}
									height={fontSize + 4}
									//   fill="#F3F4F6"
									fill='#383E46'
									cornerRadius={4}
								/>
								<Text
									x={5}
									y={fontSize * 0.05}
									text={item.text}
									width={item.width - 10}
									height={fontSize}
									align='center'
									fill='#C5CED6'
									fontSize={fontSize * 0.9}
									fontFamily={fontFamily}
									fontStyle={item.styles
										.filter(style => style === 'bold' || style === 'italic')
										.join(' ')}
								/>
							</Group>
						)
					}
					return (
						<Text
							x={item.x}
							y={item.y}
							text={item.text}
							fontSize={fontSize}
							fontFamily={fontFamily}
							fontStyle={item.styles
								.filter(style => style === 'bold' || style === 'italic')
								.join(' ')}
							fill={fill}
						/>
					)
				})}
			</>
		</Group>
	)
}

export default RichText
