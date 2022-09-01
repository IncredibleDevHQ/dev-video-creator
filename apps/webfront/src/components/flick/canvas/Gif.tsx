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

import 'gifler'
import React, { useEffect, useState } from 'react'
import { Image } from 'react-konva'

const Gif = ({
	image,
	x,
	y,
	width,
	height,
}: {
	image: HTMLImageElement | undefined
	x: number
	y: number
	width: number
	height: number
}) => {
	const imageRef = React.useRef<any>(null)
	const canvas = React.useMemo(() => {
		const node = document.createElement('canvas')
		return node
	}, [])

	const [startGif, setStartGif] = useState(false)

	useEffect(() => {
		let anim: any
		const gifSetTimeout = setTimeout(() => {
			setStartGif(true)
			;(window as any).gifler(image?.src).get((a: any) => {
				anim = a
				anim.animateInCanvas(canvas)
				anim.onDrawFrame = (ctx: any, frame: any) => {
					ctx.drawImage(frame.buffer, frame.x, frame.y)
					imageRef.current?.getLayer().draw()
				}
			})
		}, 1250)
		return () => {
			anim?.stop()
			clearTimeout(gifSetTimeout)
		}
	}, [image, canvas])

	return startGif ? (
		<>
			<Image
				image={image}
				x={x}
				y={y}
				width={width}
				height={height}
				ref={ref => {
					ref?.to({
						opacity: 0,
						duration: 1,
					})
				}}
			/>
			<Image
				image={canvas}
				ref={imageRef}
				x={x}
				y={y}
				width={width}
				height={height}
				// shadowOpacity={0.3}
				// shadowOffset={{ x: 0, y: 1 }}
				// shadowBlur={2}
			/>
		</>
	) : (
		<Image image={image} x={x} y={y} width={width} height={height} />
	)
}

export default Gif
