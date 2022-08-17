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
