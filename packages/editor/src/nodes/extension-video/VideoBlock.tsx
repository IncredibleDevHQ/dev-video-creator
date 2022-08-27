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



/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/no-this-in-sfc */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable func-names */
/* eslint-disable no-unsafe-optional-chaining */
import { css, cx } from '@emotion/css'
import { Editor } from '@tiptap/core'
import { NodeViewWrapper } from '@tiptap/react'
import { Video, VideoConfig } from 'icanvas/src/Video'
import Konva from 'konva'
import { NodeSelection } from 'prosemirror-state'
import { useEffect, useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { FiPause, FiPlay, FiUploadCloud } from 'react-icons/fi'
import { Circle, Group, Layer, Rect, Stage } from 'react-konva'
import useMeasure from 'react-use-measure'
import { Text } from 'ui/src'
import { useGetHW } from 'utils/src'
import AddVideo from './AddVideo'
import VideoTooltip from './VideoTooltip'

const size = {
	width: 960,
	height: 540,
}

const translateXY = css`
	transform: translate(-50%, -50%);
`

export const VideoBlock = (props: any) => {
	const { node, updateAttributes, editor, getPos } = props
	const { caption } = node.attrs
	const stageRef = useRef<Konva.Stage | null>(null)
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const seekbarRef = useRef<Konva.Rect | null>(null)
	const seekPointerRef = useRef<Konva.Circle | null>(null)

	const [transformations, setTransformations] = useState<any>()

	const [playing, setPlaying] = useState(false)
	const [editVideo, setEditVideo] = useState(false)
	const [retakeVideo, setRetakeVideo] = useState(false)
	const [currentSeekPosition, setCurrentSeekPosition] = useState(0)
	const [videoConfig, setVideoConfig] = useState<VideoConfig>()

	const [ref, bounds] = useMeasure()

	const { height: canvasHeight, width: canvasWidth } = useGetHW({
		maxH: bounds.height * 1,
		maxW: bounds.width * 1,
		aspectRatio: 16 / 9,
	})

	const { height: divHeight, width: divWidth } = useGetHW({
		maxH: bounds.height * 1,
		maxW: bounds.width * 1,
		aspectRatio: 16 / 9,
	})

	const deleteVideo = () => {
		updateAttributes({
			src: null,
		})
	}

	useEffect(() => {
		if (!videoRef.current) {
			const video = document.createElement('video')
			video.width = size.width
			video.height = size.height
      video.crossOrigin = 'anonymous'
			video.addEventListener('loadedmetadata', () => {
				video.currentTime = transformations?.clip?.start || 0.1
			})
			videoRef.current = video
		}

		const dataTransformations = JSON.parse(node.attrs['data-transformations'])
		setTransformations(dataTransformations)
		let offX = 0

		// eslint-disable-next-line func-names
		videoRef.current?.addEventListener('loadedmetadata', function () {
			const { duration, width, currentTime } = this
			offX =
				(transformations?.clip?.start || 0) *
				((width - 20) /
					(transformations?.clip?.end - transformations?.clip?.start ||
						duration))
			const finalPos =
				(currentTime - (transformations?.clip?.start || 0)) *
				((width - 20) /
					(transformations?.clip?.end - transformations?.clip?.start ||
						duration))
			setCurrentSeekPosition(finalPos > 0 ? finalPos : 0)
		})

		if (videoRef.current?.src !== node.attrs.src) {
			videoRef.current.src = node.attrs.src as string
		}

		videoRef.current.addEventListener('timeupdate', () => {
			if (!videoRef.current) return
			const origX =
				videoRef.current.currentTime *
				((videoRef.current.width - 20) /
					(transformations?.clip?.end - transformations?.clip?.start ||
						videoRef.current.duration))
			setCurrentSeekPosition(origX - offX > 0 ? origX - offX : 0)
			if (
				videoRef.current.currentTime >= transformations?.clip?.end ||
				videoRef.current.currentTime >= videoRef.current.duration
			) {
				videoRef.current.currentTime = transformations?.clip?.start || 0
				videoRef.current.pause()
				setPlaying(false)
			}
		})

		const tempVideoConfig: VideoConfig = {
			x: 0,
			y: 0,
			width: size.width,
			height: size.height,
			videoFill: '#1F2937',
			performClip: true,
			cornerRadius: 0,
			clipVideoConfig: {
				x: transformations?.crop?.x || 0,
				y: transformations?.crop?.y || 0,
				width: transformations?.crop?.width || 1,
				height: transformations?.crop?.height || 1,
			},
		}

		setVideoConfig(tempVideoConfig)
	}, [node?.attrs])

	useEffect(() => {
		if (!stageRef.current) return
		stageRef.current.container().style.cursor = 'pointer'
	}, [stageRef])

	useEffect(() => {
		if (playing) {
			videoRef.current?.play()
		} else {
			videoRef.current?.pause()
		}
	}, [playing])

	useEffect(
		() => () => {
			videoRef.current?.removeEventListener('timeupdate', () => {})
			videoRef.current = null
			stageRef.current = null
			seekbarRef.current = null
			seekPointerRef.current = null
		},
		[]
	)

	if (!node.attrs.src)
		return (
			<NodeViewWrapper>
				<Dropzone
					onDrop={undefined}
					accept={{
						'video/*': [],
					}}
					maxFiles={1}
				>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-12 my-3 border border-gray-200 border-dashed rounded-md cursor-pointer'
							{...getRootProps()}
							onClick={() => {
								setRetakeVideo(true)
							}}
						>
							<input {...getInputProps()} />
							<FiUploadCloud size={24} className='my-2' />

							<div className='z-50 text-center text-black'>
								{node.attrs.type === 'video' ? (
									<>
										<Text contentEditable={false} textStyle='caption'>
											Drag and drop a video or
										</Text>
										<Text
											contentEditable={false}
											textStyle='caption'
											className='font-semibold'
										>
											browse
										</Text>
									</>
								) : (
									<Text contentEditable={false} textStyle='caption'>
										Click to record the screen
									</Text>
								)}
							</div>
						</div>
					)}
				</Dropzone>
				{(editVideo || retakeVideo) && (
					<AddVideo
						open={editVideo || retakeVideo}
						initialValue={{
							url: node.attrs.src as string,
							transformations: JSON.parse(node.attrs['data-transformations']),
						}}
						shouldResetWhenOpened={node.attrs.type === 'video'}
						handleClose={() => {
							setEditVideo(false)
							setRetakeVideo(false)
						}}
						handleUpdateVideo={(url, transforms) => {
							updateAttributes({
								src: url,
								'data-transformations': JSON.stringify(transforms),
							})
						}}
						recordScreenMode
					/>
				)}
			</NodeViewWrapper>
		)

	return (
		<NodeViewWrapper
			as='div'
			id={node.attrs.id}
			className='w-full aspect-[16/9] relative group mb-4'
			ref={ref}
		>
			<VideoTooltip
				editVideo={setEditVideo}
				retakeVideo={setRetakeVideo}
				deleteVideo={deleteVideo}
				node={node}
				updateAttributes={updateAttributes}
			/>

			<div
				className='relative transition-all'
				style={{
					width: divWidth,
					height: divHeight,
					cursor: 'default',
				}}
			>
				<Stage
					height={canvasHeight}
					width={canvasWidth}
					ref={stageRef}
					className='bg-gray-100 rounded-md'
					scale={{
						x: Number((canvasHeight / size.height).toFixed(2)),
						y: Number((canvasWidth / size.width).toFixed(2)),
					}}
				>
					<Layer>
						<Group zIndex={-1}>
							{videoRef.current && videoConfig && (
								<Video
									videoElement={videoRef.current}
									videoConfig={videoConfig}
								/>
							)}
							{videoRef.current && (
								<Group>
									<Rect
										fill='#D1D5DB'
										cornerRadius={8}
										x={10}
										y={
											videoRef.current?.height
												? videoRef.current.height - 20
												: canvasHeight
										}
										width={
											videoRef.current?.width
												? videoRef.current.width - 20
												: canvasWidth
										}
										height={10}
										opacity={1}
									/>
									<Rect
										x={10}
										ref={seekbarRef}
										width={10 + currentSeekPosition}
										y={
											videoRef.current?.height
												? videoRef.current.height - 20
												: canvasHeight
										}
										height={10}
										fill='#16A34A'
										opacity={1}
										cornerRadius={8}
									/>
									<Circle
										ref={seekPointerRef}
										x={10 + currentSeekPosition}
										y={
											videoRef.current?.height
												? videoRef.current.height - 15
												: canvasHeight
										}
										width={20}
										height={20}
										draggable
										dragBoundFunc={function (pos: any) {
											return {
												x: pos.x,
												y: this.absolutePosition().y,
											}
										}}
										onDragMove={() => {
											if (!seekPointerRef.current) return
											seekPointerRef.current?.y(
												videoRef.current?.height
													? videoRef.current.height - 15
													: canvasHeight
											)
											if (!videoRef.current) return
											if (seekPointerRef.current.x() < 10)
												seekPointerRef.current.x(10)
											if (
												seekPointerRef.current.x() >
												videoRef.current?.width - 10
											)
												seekPointerRef.current.x(videoRef.current?.width - 10)
											seekbarRef.current?.width(seekPointerRef.current.x() - 10)
											const tt =
												seekPointerRef.current.x() *
												((transformations?.clip?.end -
													transformations?.clip?.start ||
													videoRef.current.duration) /
													(videoRef.current.width - 20))

											videoRef.current.currentTime =
												tt + (transformations?.clip?.start || 0)
										}}
										fill='#16A34A'
									/>
								</Group>
							)}
						</Group>
					</Layer>
				</Stage>
				<div
					className={cx(
						'absolute top-1/2 left-1/2 text-gray-50 items-center justify-center p-4 hidden group-hover:flex',
						{ 'bg-gray-800 opacity-50 rounded-full': playing },
						translateXY
					)}
				>
					<button
						type='button'
						onClick={() => setPlaying(isPlaying => !isPlaying)}
					>
						{playing ? <FiPause size={64} /> : <FiPlay size={64} />}
					</button>
				</div>
			</div>
			{caption !== null && (
				<input
					onFocus={() => {
						const coreEditor = editor as Editor
						coreEditor.view.dispatch(
							coreEditor.view.state.tr.setSelection(
								NodeSelection.create(coreEditor.view.state.doc, getPos())
							)
						)
					}}
					value={caption}
					placeholder='Write a caption...'
					className='border border-gray-200 w-full mt-1.5 group-hover:bg-gray-100 font-body px-2 py-1 focus:outline-none placeholder-italic text-black'
					onChange={e => {
						updateAttributes({ caption: e.target.value })
					}}
				/>
			)}
			<div className='w-full p-1' />
			{(editVideo || retakeVideo) && (
				<AddVideo
					open={editVideo || retakeVideo}
					initialValue={{
						url: node.attrs.src as string,
						transformations: JSON.parse(node.attrs['data-transformations']),
					}}
					shouldResetWhenOpened={retakeVideo}
					handleClose={() => {
						setEditVideo(false)
						setRetakeVideo(false)
					}}
					handleUpdateVideo={(url, transforms) => {
						updateAttributes({
							src: url,
							'data-transformations': JSON.stringify(transforms),
						})
					}}
				/>
			)}
		</NodeViewWrapper>
	)
}
