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

import { useRef } from 'react'
import Konva from 'konva'
import { CodeAnimation } from 'utils/src'

interface Token {
	content: string
	color: string
	lineNumber: number
}

export interface ComputedToken extends Token {
	x: number
	y: number
	width: number
	startFromIndex: number
}

const useCode = () => {
	const computedLineNumber = useRef(0)
	const lineNumber = useRef(0)
	const computedTokens = useRef<ComputedToken[][]>([])
	const fileComputedTokens = useRef<ComputedToken[]>([])
	const currentWidth = useRef(0)
	let startFromIndex = 0

	const initUseCode = ({
		tokens,
		canvasWidth,
		canvasHeight,
		gutter,
		fontSize,
		fontFamily,
		codeAnimation,
	}: {
		tokens: Token[][]
		canvasWidth: number
		canvasHeight: number
		gutter: number
		fontSize: number
		fontFamily?: string
		codeAnimation: CodeAnimation
	}) => {
		const layer = new Konva.Layer({ width: canvasWidth })
		computedTokens.current = []
		tokens.forEach(fileTokens => {
			fileComputedTokens.current = []
			computedLineNumber.current = 0
			lineNumber.current = 0
			currentWidth.current = 0
			startFromIndex = 0
			fileTokens.forEach((token, index) => {
				if (lineNumber.current !== token.lineNumber) {
					computedLineNumber.current += token.lineNumber - lineNumber.current
					currentWidth.current = 0
					if (codeAnimation === 'Type lines') {
						if (
							(fontSize + gutter) * computedLineNumber.current >
							canvasHeight
						) {
							computedLineNumber.current = 0
							startFromIndex = index
						}
					}
					lineNumber.current = token.lineNumber
				}

				const text = new Konva.Text({
					text: token.content,
					fontSize,
					fontFamily,
				})
				layer.add(text)

				const width = text.textWidth

				// Check for wrapping...
				if (width + currentWidth.current > canvasWidth) {
					// wrap
					if (currentWidth.current !== 0) {
						computedLineNumber.current += 1
						currentWidth.current = 0
					}
				}

				const computedToken: ComputedToken = {
					...token,
					x: currentWidth.current,
					y: (fontSize + gutter) * computedLineNumber.current,
					width,
					startFromIndex,
				}

				currentWidth.current += width

				fileComputedTokens.current.push(computedToken)

				text.destroy()
			})
			computedTokens.current.push(fileComputedTokens.current)
		})
		return computedTokens.current
	}

	return { initUseCode, computedTokens }
}

export default useCode
