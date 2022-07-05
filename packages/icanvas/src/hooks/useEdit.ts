import Konva from 'konva'

export interface ClipConfig {
	x: number
	y: number
	width: number
	height: number
	borderRadius?: number
}

export const useEdit = () => {
	const clipRect = (ctx: any, clipConfig: ClipConfig) => {
		const { x } = clipConfig
		const { y } = clipConfig
		const w = clipConfig.width
		const h = clipConfig.height
		const r = clipConfig.borderRadius || 0
		ctx.beginPath()
		ctx.moveTo(x + r, y)
		ctx.arcTo(x + w, y, x + w, y + h, r)
		ctx.arcTo(x + w, y + h, x, y + h, r)
		ctx.arcTo(x, y + h, x, y, r)
		ctx.arcTo(x, y, x + w, y, r)
		ctx.closePath()
	}

	const clipCircle = (ctx: any, clipConfig: ClipConfig) => {
		ctx.arc(
			clipConfig.width / 2,
			clipConfig.height / 2,
			clipConfig.width > clipConfig.height
				? clipConfig.height / 2
				: clipConfig.width / 2,
			0,
			Math.PI * 2,
			true
		)
	}

	const getImageDimensions = (
		img: { w: number; h: number },
		maxW: number,
		maxH: number,
		availableW: number,
		availableH: number,
		x: number,
		y: number
	) => {
		let calWidth = 0
		let calHeight = 0
		let calX = 0
		let calY = 0
		const aspectRatio = img.w / img.h
		if (aspectRatio > maxW / maxH) {
			// horizontal img
			calHeight = maxW * (1 / aspectRatio)
			calWidth = maxW
			calX = x + (availableW - calWidth) / 2
			calY = y + (availableH - calHeight) / 2
		} else if (aspectRatio <= maxW / maxH) {
			// sqr or vertical image
			calHeight = maxH
			calWidth = maxH * aspectRatio
			calX = x + (availableW - calWidth) / 2
			calY = y + (availableH - calHeight) / 2
		}
		return { width: calWidth, height: calHeight, x: calX, y: calY }
	}

	// function which returns the coordinates and dimensions of the image such that when cropped it crops the image in the center
	const getImageFitDimensions = ({
		imgWidth,
		imgHeight,
		maxWidth,
		maxHeight,
		x,
		y,
	}: {
		imgWidth: number
		imgHeight: number
		maxWidth: number
		maxHeight: number
		x: number
		y: number
	}) => {
		let calWidth = 0
		let calHeight = 0
		let calX = 0
		let calY = 0
		const aspectRatio = imgWidth / imgHeight
		if (aspectRatio > maxWidth / maxHeight) {
			// horizontal img
			calHeight = maxHeight
			calWidth = maxHeight * aspectRatio
			calX = x - (calWidth - maxWidth) / 2
			calY = y
		} else if (aspectRatio <= maxWidth / maxHeight) {
			// sqr or vertical image
			calWidth = maxWidth
			calHeight = maxWidth * (1 / aspectRatio)
			calX = x
			calY = y - (calHeight - maxHeight) / 2
		}
		return { width: calWidth, height: calHeight, x: calX, y: calY }
	}

	const getTextWidth = (
		text: string,
		fontFamily: string,
		fontSize: number,
		fontStyle: string
	) => {
		const layer = new Konva.Layer({ width: 250 })
		const konvaText = new Konva.Text({ text, fontSize, fontFamily, fontStyle })
		layer.add(konvaText)
		return konvaText.textWidth
	}

	return {
		clipRect,
		clipCircle,
		getImageDimensions,
		getTextWidth,
		getImageFitDimensions,
	}
}

export default useEdit
