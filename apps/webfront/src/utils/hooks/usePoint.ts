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



import { ListItem } from 'editor/src/utils/types'
import Konva from 'konva'
import { useRef } from 'react'
import {
	getRichTextData,
	RichTextContent,
} from 'src/components/flick/canvas/RichText'
import { ListOrientation, Layout } from 'utils/src'
import {
	getPointsConfig,
	getBulletsConfig,
} from '../canvasConfigs/pointsConfig'
import { ComputedPoint } from '../configs'

const usePoint = () => {
	const presentY = useRef(0)
	const computedPoints = useRef<ComputedPoint[]>([])
	const startFromIndex = useRef(0)
	const textHeight = useRef(0)

	const initUsePoint = ({
		points,
		availableWidth,
		availableHeight,
		gutter,
		fontSize,
		fontFamily,
		lineHeight = 1,
		orientation,
		layout,
		isShorts,
		theme,
	}: {
		points: ListItem[]
		availableWidth: number
		availableHeight: number
		gutter: number
		fontSize: number
		fontFamily?: string
		lineHeight?: number
		orientation: ListOrientation
		layout: Layout
		isShorts: boolean
		theme: string
	}) => {
		computedPoints.current = []
		presentY.current = gutter
		textHeight.current = 0
		startFromIndex.current = 0
		if (orientation === 'vertical') {
			points.forEach((point, index) => {
				if (!point?.content) return
				if (
					point?.content?.filter(
						item => item?.type === 'richText' || item.type === 'text'
					).length <= 0
				)
					return
				const textOrRichText = point.content.filter(
					item => item.type === 'richText' || item.type === 'text'
				) as {
					type: 'richText' | 'text'
					content: RichTextContent | string
					line: number
				}[]
				const textData = getRichTextData({
					content: textOrRichText,
					fontSize,
					fontFamily,
					width: availableWidth - (41 * ((point.level || 1) - 1) || 0),
					lineHeight,
				})

				textHeight.current = textData[textData.length - 1].y - textData[0].y

				if (textHeight.current === 0) {
					textHeight.current = fontSize * lineHeight
				} else {
					textHeight.current += fontSize * lineHeight
				}

				if (presentY.current + textHeight.current + gutter > availableHeight) {
					presentY.current = 0
					startFromIndex.current = index
				}

				const computedPoint: ComputedPoint = {
					y: presentY.current,
					text: point.text || '',
					level: point.level || 1,
					startFromIndex: startFromIndex.current,
					pointNumber: index + 1,
					richTextData: textData,
					content: textOrRichText,
				}

				presentY.current += textHeight.current + gutter

				computedPoints.current.push(computedPoint)
			})
		}
		if (orientation === 'horizontal') {
			let maxHeight = 0
			const pointsConfig = getPointsConfig({ layout, isShorts })
			const bulletsConfig = getBulletsConfig({ theme, layout })
			const pointsRichTextData: any = []
			points.forEach(point => {
				if (!point?.content) return
				if (
					point?.content?.filter(
						item => item?.type === 'richText' || item.type === 'text'
					).length <= 0
				)
					return
				const textOrRichText = point.content.filter(
					item => item.type === 'richText' || item.type === 'text'
				) as {
					type: 'richText' | 'text'
					content: RichTextContent | string
					line: number
				}[]
				const textData = getRichTextData({
					content: textOrRichText,
					fontSize: pointsConfig.textFontSize,
					fontFamily,
					width: 228,
					lineHeight,
				})
				pointsRichTextData.push(textData)
				textHeight.current = textData[textData.length - 1].y - textData[0].y

				if (textHeight.current === 0) {
					textHeight.current = pointsConfig.textFontSize * lineHeight
				} else {
					textHeight.current += pointsConfig.textFontSize * lineHeight
				}

				if (textHeight.current > maxHeight) {
					maxHeight = textHeight.current
				}
			})
			points.forEach((point, index) => {
				if (!point?.content) return
				if (
					point?.content?.filter(
						item => item?.type === 'richText' || item.type === 'text'
					).length <= 0
				)
					return

				const textOrRichText = point.content.filter(
					item => item.type === 'richText' || item.type === 'text'
				) as {
					type: 'richText' | 'text'
					content: RichTextContent | string
					line: number
				}[]

				let pointText = ''
				textOrRichText.forEach(item => {
					if (item.type === 'text') {
						pointText += `${item.content} `
					} else if (item.type === 'richText') {
						pointText += (item.content as RichTextContent).text
					}
				})

				if (index % pointsConfig.noOfPoints === 0) {
					presentY.current = 0
					startFromIndex.current = index
				}
				const computedPoint: ComputedPoint = {
					y:
						(availableHeight -
							(maxHeight +
								bulletsConfig.bulletHeight +
								pointsConfig.paddingBtwBulletText)) /
						2,
					text: pointText || '',
					level: point.level || 1,
					width: 228,
					height: maxHeight,
					startFromIndex: startFromIndex.current,
					pointNumber: index + 1,
					richTextData: pointsRichTextData[index],
					content: textOrRichText,
				}
				computedPoints.current.push(computedPoint)
			})
		}
		return computedPoints.current
	}

	const getNoOfLinesOfText = ({
		text,
		availableWidth,
		fontSize,
		fontFamily,
		fontStyle,
	}: {
		text: string
		availableWidth: number
		fontSize: number
		fontFamily?: string
		fontStyle?: string
	}) => {
		const layer = new Konva.Layer({ width: availableWidth })
		let noOfLines = 1
		let currentWidth = 0

		const titleSplit = text?.split(' ')
		titleSplit?.forEach(subText => {
			const word = new Konva.Text({
				text: `${subText} `,
				fontSize,
				fontFamily,
				fontStyle,
			})
			layer.add(word)
			const width = word.width()
			if (Math.floor(width) + Math.floor(currentWidth) > availableWidth) {
				noOfLines += 1
				currentWidth = 0
			}
			currentWidth += Math.floor(width)
		})
		return noOfLines
	}

	const getPositionForReplaceMode = ({
		title,
		titleFontSize,
		titleFontFamily,
		titleFontStyle,
		points,
		availableWidth,
		availableHeight,
		fontSize,
		fontFamily,
		fontStyle,
	}: {
		title: string
		titleFontSize: number
		titleFontFamily?: string
		titleFontStyle?: string
		points: ListItem[]
		availableWidth: number
		availableHeight: number
		fontSize: number
		fontFamily?: string
		fontStyle?: string
	}) => {
		let maxHeightOfPoint = 0
		let noOfLines = 0

		points.forEach(point => {
			noOfLines = getNoOfLinesOfText({
				text: point.text || '',
				availableWidth: availableWidth - (41 * ((point.level || 1) - 1) || 0),
				fontSize,
				fontFamily,
				fontStyle,
			})
			if (noOfLines * (fontSize + fontSize * 0.3) > maxHeightOfPoint) {
				maxHeightOfPoint = noOfLines * (fontSize + fontSize * 0.3)
			}
		})

		const titleHeight =
			getNoOfLinesOfText({
				text: title,
				availableWidth: availableWidth + 30,
				fontSize: titleFontSize,
				fontFamily: titleFontFamily,
				fontStyle: titleFontStyle,
			}) * titleFontSize

		return (availableHeight - (maxHeightOfPoint + titleHeight + 20)) / 2
	}

	return {
		initUsePoint,
		computedPoints,
		getNoOfLinesOfText,
		getPositionForReplaceMode,
	}
}

export default usePoint
