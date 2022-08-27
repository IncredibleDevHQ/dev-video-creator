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
