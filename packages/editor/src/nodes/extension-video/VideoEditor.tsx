/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/require-default-props */
/* eslint-disable consistent-return */
/* eslint-disable react/no-this-in-sfc */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable func-names */
// eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events  */

import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react'
import { BiPause, BiPlay } from 'react-icons/bi'
import { Group, Image, Layer, Rect, Stage, Transformer } from 'react-konva'
// import useImage from 'use-image'
import CropIcon from '../../assets/crop-outline.svg'
import TrimIcon from '../../assets/trim.svg'

type Size = {
	width: number
	height: number
}

type Coordinates = {
	x: number
	y: number
	width: number
	height: number
}

interface Clip {
	start?: number
	end?: number
	change?: 'start' | 'end'
}

export interface Transformations {
	crop?: Coordinates
	clip?: Clip
}
export interface EditorProps {
	url: string
	width: number
	transformations?: Transformations
	handleAction?: (transformations: Transformations) => void
	action: string
}

const convertTimeToPx = ({
	width,
	duration,
	marker,
}: {
	width: number
	duration: number
	marker: number
}) => (marker / duration) * width

const convertPxToTime = ({
	width,
	duration,
	x,
}: {
	x: number
	width: number
	duration: number
}) => +((x / width) * duration)

const getAspectDimension = (
	videoElement: HTMLVideoElement,
	valueType: 'width' | 'height',
	value: number
) =>
	valueType === 'height'
		? value * (videoElement.videoHeight / videoElement.videoWidth)
		: value * (videoElement.videoWidth / videoElement.videoHeight)

const formattedTime = (seconds: number) => {
	const minutes = parseInt((seconds / 60).toFixed(0), 10)
	const secondsLeft = parseInt((seconds % 60).toFixed(0), 10)
	return `${minutes < 10 ? `0${minutes}` : minutes}:${
		secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft
	}`
}

export const VideoCanvas = ({
	videoElement,
	size,
	underlay,
	crop,
}: {
	videoElement: HTMLVideoElement
	size: Size
	underlay?: boolean
	crop?: Coordinates
}) => {
	const imageRef = React.useRef<Konva.Image>(null)

	useEffect(() => {
		// @ts-ignore
		const layer = imageRef.current?.getLayer()

		const anim = new Konva.Animation(() => {}, layer)
		anim.start()

		return () => {
			anim.stop()
		}
	}, [])

	return (
		<Group clip={crop}>
			<Image
				ref={imageRef}
				image={videoElement}
				width={size.width}
				height={size.height}
			/>
			{underlay && (
				<Rect
					width={size.width}
					height={size.height}
					fill='#000'
					opacity={0.8}
				/>
			)}
		</Group>
	)
}

const DarkButton = ({
	className,
	...rest
}: HTMLAttributes<HTMLButtonElement>) => (
	<button
		type='button'
		className={cx('rounded-sm text-gray-300 bg-gray-700 p-2', className)}
		{...rest}
	/>
)

// A conversion utility for clip values (px <-> %)
export const convertTo = (
	unit: 'px' | '%',
	size: Size,
	value: Coordinates
): Coordinates => {
	if (unit === 'px') {
		return {
			x: value.x * size.width,
			y: value.y * size.height,
			width: value.width * size.width,
			height: value.height * size.height,
		}
	}

	return {
		x: value.x / size.width,
		y: value.y / size.height,
		width: value.width / size.width,
		height: value.height / size.height,
	}
}

const Scrubber = ({
	duration,
	start,
	end,
	handleChange,
	scrubberSize = { width: 320, height: 40 },
}: // handleUpdateMarker,
{
	scrubberSize: { width?: number; height?: number }
	duration: number
	start?: number
	end?: number
	handleChange?: (props: {
		start: number
		end: number
		change: 'start' | 'end'
	}) => void
	// handleUpdateMarker?: (currentTime: number) => void
}) => {
	const mainRectRef = useRef<Konva.Rect | null>()
	const leftHandleRef = useRef<Konva.Rect | null>()
	const rightHandleRef = useRef<Konva.Rect | null>()
	const scrubAreaRectRef = useRef<Konva.Rect | null>()

	const handleMove = (type: 'start' | 'end') => {
		const left = leftHandleRef.current!.getClientRect()
		const right = rightHandleRef.current!.getClientRect()
		const main = mainRectRef.current!.getClientRect()

		scrubAreaRectRef.current!.setPosition({
			x: left.x - main.x + left.width / 2,
			y: 0,
		})
		scrubAreaRectRef.current!.setSize({
			width: right.x - left.x,
			height: scrubberSize.height,
		})

		const rect = scrubAreaRectRef.current!.getClientRect()

		// computeMarker()

		// -1 because of stroke width of 2px
		const startTime = convertPxToTime({
			width: scrubberSize.width as number,
			duration,
			x: rect.x - main.x + 1,
		})
		const endTime = convertPxToTime({
			width: scrubberSize.width as number,
			duration,
			x: rect.width + rect.x - main.x - 1,
		})

		handleChange?.({
			start: startTime,
			end: endTime,
			change: type,
		})
	}

	// const markerRef = useRef<Konva.Image | null>()

	// const [pin] = useImage(ASSETS.ICONS.PIN)

	const [trim] = useState<{ start: number; end: number }>({
		end: end || duration,
		start: start || 0,
	})

	useEffect(() => {
		if (!leftHandleRef.current) return

		handleMove('start')
	}, [leftHandleRef])

	useEffect(() => {
		if (!rightHandleRef.current) return

		handleMove('end')
	}, [rightHandleRef])

	// const computeMarker = () => {
	//   const scrubAreaRect = scrubAreaRectRef.current!.getClientRect()

	//   // Should be more than left bounds...
	//   let newX = Math.max(
	//     scrubAreaRect.x - markerRef.current!.width() / 2,
	//     markerRef.current!.getClientRect().x
	//   )

	//   // Should be less than right bounds...
	//   newX = Math.min(
	//     newX,
	//     scrubAreaRect.width + scrubAreaRect.x - markerRef.current!.width() / 2
	//   )

	//   markerRef.current!.setPosition({
	//     x: newX - mainRectRef.current!.getClientRect().x,
	//     y: -20,
	//   })
	// }

	return (
		<Group>
			<Rect
				fill='#D1D5DB'
				ref={ref => {
					mainRectRef.current = ref
				}}
				cornerRadius={8}
				width={scrubberSize.width}
				height={scrubberSize.height}
				opacity={0.5}
			/>

			<Rect
				fill='#f3f4f6'
				stroke='#16A34A'
				opacity={0.5}
				strokeWidth={2}
				cornerRadius={8}
				ref={ref => {
					scrubAreaRectRef.current = ref
				}}
			/>

			{/* <Image
        image={pin}
        height={scrubberSize.height ? scrubberSize.height + 30 : 6}
        width={16}
        draggable
        x={convertTimeToPx({
          marker,
          duration,
          width: scrubberSize.width as number,
        })}
        ref={(ref) => {
          markerRef.current = ref
        }}
        dragBoundFunc={function (pos) {
          const scrubAreaRect = scrubAreaRectRef.current!.getClientRect()

          if (!this)
            return {
              x: pos.x,
              y: pos.y,
            }

          // Should be less than right bounds...
          let newX = Math.min(
            pos.x + this.width() / 2,
            scrubAreaRect.width + scrubAreaRect.x - this.width() / 2
          )

          // Should be more than left bounds...
          newX = Math.max(newX, scrubAreaRect.x - this.width() / 2)

          handleUpdateMarker?.(
            convertPxToTime({
              x: newX,
              duration,
              width: scrubberSize.width as number,
            })
          )

          return {
            x: newX,
            y: this.absolutePosition().y,
          }
        }}
      /> */}

			<Rect
				id='left-handle'
				ref={ref => {
					leftHandleRef.current = ref
				}}
				dragBoundFunc={function (pos) {
					const mainRect = mainRectRef.current!.getClientRect()
					const rightHandleRect = rightHandleRef.current!.getClientRect()

					// Should be more than left bounds...
					let newX = Math.max(pos.x, mainRect.x - this.width() / 2)

					// Should be less than right handle...
					newX = Math.min(newX, rightHandleRect.x - rightHandleRect.width / 2)

					return {
						x: newX,
						y: this.absolutePosition().y,
					}
				}}
				fill='#4b5563'
				opacity={0.7}
				draggable
				cornerRadius={6}
				x={convertTimeToPx({
					width: scrubberSize.width as number,
					duration,
					marker: trim.start,
				})}
				width={20}
				height={20}
				y={10}
				onDragMove={() => handleMove('start')}
			/>
			<Rect
				x={convertTimeToPx({
					width: scrubberSize.width as number,
					duration,
					marker: trim.end,
				})}
				id='right-handle'
				// eslint-disable-next-line no-return-assign
				ref={ref => (rightHandleRef.current = ref)}
				dragBoundFunc={function (pos) {
					const mainRect = mainRectRef.current!.getClientRect()
					const leftHandleRect = leftHandleRef.current!.getClientRect()

					// Should be less than right bounds...
					let newX = Math.min(
						pos.x,
						mainRect.width + mainRect.x - this.width() / 2
					)

					// Should be more than left handle...
					newX = Math.max(newX, leftHandleRect.x + leftHandleRect.width / 2)

					return {
						x: newX,
						y: this.absolutePosition().y,
					}
				}}
				fill='#4b5563'
				opacity={0.7}
				draggable
				cornerRadius={6}
				width={20}
				height={20}
				y={10}
				onDragMove={() => handleMove('end')}
			/>
		</Group>
	)
}

const VideoEditor = ({
	url,
	width,
	transformations,
	handleAction,
	action,
}: EditorProps) => {
	const videoRef = React.useRef<HTMLVideoElement | null>(null)

	const [mode, setMode] = React.useState<'crop' | 'trim' | null>(null)
	const [crop, setCrop] = React.useState<Coordinates>(
		transformations?.crop || {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		}
	)

	const [clip, setClip] = React.useState<Clip>(transformations?.clip || {})
	const [time, setTime] = useState(transformations?.clip?.start || 0)
	const [playing, setPlaying] = useState(false)
	const [size, setSize] = useState({
		width: 1,
		height: 1,
	})
	const [, setOrientation] = useState<'landscape' | 'portrait'>('landscape')

	const layerRef = React.useRef<Konva.Layer | null>(null)
	const transformerRectRef = React.useRef<Konva.Rect | null>(null)
	const transformerRef = React.useRef<Konva.Transformer | null>(null)

	useEffect(() => {
		if (mode === 'crop') {
			if (!transformerRectRef.current) return
			transformerRef.current?.nodes([transformerRectRef.current])
			transformerRef.current?.getLayer()?.batchDraw()
		}

		// eslint-disable-next-line consistent-return
		return () => {
			transformerRef.current?.detach()
		}
	}, [mode])

	const cb = () => {
		if (!videoRef.current) return
		videoRef.current.currentTime = time || 0.1

		const tempOrientation =
			videoRef.current.videoWidth > videoRef.current.videoHeight
				? 'landscape'
				: 'portrait'

		setOrientation(tempOrientation)

		let height = videoRef.current.videoHeight
		if (tempOrientation === 'landscape') {
			height = getAspectDimension(videoRef.current, 'height', width)
			setSize({
				height,
				width,
			})
		} else {
			height = getAspectDimension(videoRef.current, 'height', width / 2.5)
			setSize({
				height,
				width: width / 2.5,
			})
		}
		//   videoRef.current.play()

		const tempCrop = convertTo(
			'px',
			{ height, width },
			transformations?.crop || {
				x: 0,
				y: 0,
				width: size.width,
				height: size.height,
			}
		)

		setCrop(tempCrop)
	}

	useEffect(() => {
		const video = document.createElement('video')
		// video.width = size.width
		// video.height = size.height
		video.src = url
		videoRef.current = video
	}, [url, width])

	useEffect(() => {
		if (!videoRef.current) return
		videoRef.current.addEventListener('loadedmetadata', cb)
		videoRef.current.addEventListener('timeupdate', e => {
			// @ts-ignore
			setTime(e.target.currentTime)
		})

		return () => {
			videoRef.current?.removeEventListener('loadedmetadata', cb)
		}
	}, [videoRef])

	useEffect(() => {
		if (videoRef.current && clip.start && clip.end) {
			if (time > clip.end || time < clip.start) {
				setPlaying(false)
				videoRef.current.pause()
			}
		}
	}, [time])

	if (!videoRef.current) return null

	return (
		<div className='my-auto flex flex-col w-full h-full items-center justify-between rounded-md relative'>
			<div className='flex-1 flex flex-col items-center justify-center'>
				<Stage {...size}>
					<Layer ref={layerRef}>
						<VideoCanvas underlay size={size} videoElement={videoRef.current} />
						<Group clip={crop}>
							<VideoCanvas
								crop={crop}
								size={size}
								videoElement={videoRef.current}
							/>
						</Group>

						{mode === 'crop' && (
							<>
								<Rect
									x={crop.x || 0}
									y={crop.y || 0}
									width={crop.width || size.width}
									height={crop.height || size.height}
									ref={transformerRectRef}
									onTransform={() => {
										const node = transformerRectRef.current
										if (!node) return
										const scaleX = node.scaleX()
										const scaleY = node.scaleY()

										node.scaleX(1)
										node.scaleY(1)

										setCrop({
											x: node.x(),
											y: node.y(),
											// set minimal value
											width: Math.max(40, node.width() * scaleX),
											height: Math.max(40, node.height() * scaleY),
										})
									}}
								/>
								<Transformer
									ref={transformerRef}
									anchorFill='#16A34A'
									anchorSize={14}
									borderStroke='#16A34A'
									borderStrokeWidth={1}
									rotateEnabled={false}
									boundBoxFunc={(_, newBox) => {
										const box = newBox

										// minimum dimensions = 40...
										box.width = Math.max(40, box.width)
										box.height = Math.max(40, box.height)

										// check if the new box is out of bounds
										if (box.x < 0) {
											// if it is, set the width to the current width + the difference
											box.width += box.x
											// and set the x to 0
											box.x = 0
										}

										if (box.y < 0) {
											box.height += box.y
											box.y = 0
										}

										if (box.x + box.width > size.width) {
											box.width = size.width - box.x
										}

										if (box.y + box.height > size.height) {
											box.height = size.height - box.y
										}

										return box
									}}
								/>
							</>
						)}

						{size.width > 0 && mode === 'trim' && (
							<Group y={size.height - 40 - 20} x={25}>
								<Scrubber
									scrubberSize={{
										width: size.width ? size.width - 50 : 0,
										height: 40,
									}}
									handleChange={t => {
										if (t.change === 'start')
											videoRef.current!.currentTime = t.start
										else if (t.change === 'end') {
											videoRef.current!.currentTime = t.end
										}
										setClip(() => t)
									}}
									// handleUpdateMarker={(time) => {
									//   videoRef.current!.currentTime = time
									//   setTime(time)
									// }}
									duration={videoRef.current.duration || 0}
									{...clip}
								/>
							</Group>
						)}
					</Layer>
				</Stage>
			</div>

			<div
				className='flex items-center justify-between px-4 py-3 bg-gray-600'
				style={{
					width: '100%',
				}}
			>
				<div className='grid grid-cols-2 gap-x-3'>
					<DarkButton
						className={cx('border', {
							'border-brand': mode === 'crop',
							'border-transparent': mode !== 'crop',
						})}
						onClick={() => {
							setMode(mode === 'crop' ? null : 'crop')
						}}
					>
						<CropIcon />
					</DarkButton>
					<DarkButton
						className={cx('border', {
							'border-brand': mode === 'trim',
							'border-transparent': mode !== 'trim',
						})}
						onClick={() => {
							setMode(mode === 'trim' ? null : 'trim')
						}}
					>
						<TrimIcon />
					</DarkButton>
				</div>
				<DarkButton
					className='flex'
					onClick={() => {
						if (!videoRef.current) return
						if (playing) {
							videoRef.current.pause()
							setPlaying(false)
						} else {
							videoRef.current.currentTime = clip.start || 0
							videoRef.current.play()
							setPlaying(true)
						}
					}}
				>
					{playing ? <BiPause size={24} /> : <BiPlay size={24} />}
					<p className='ml-1'>{`${formattedTime(
						videoRef.current?.currentTime || 0
					)} / ${formattedTime(videoRef.current?.duration || 0)}`}</p>
				</DarkButton>
				<div className='flex items-center gap-x-2'>
					<DarkButton
						onClick={() => {
							setCrop({
								x: 0,
								y: 0,
								width: 0,
								height: 0,
							})
							setClip({})
							setTime(0)
							setPlaying(false)
						}}
					>
						Reset
					</DarkButton>
					<DarkButton
						onClick={() =>
							handleAction?.({ crop: convertTo('%', size, crop), clip })
						}
					>
						{action}
					</DarkButton>
				</div>
			</div>
		</div>
	)
}

export default VideoEditor
