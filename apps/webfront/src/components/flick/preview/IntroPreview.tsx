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
/* eslint-disable @next/next/no-img-element */
import { cx } from '@emotion/css'
import { ChangeEvent, useEffect, useState } from 'react'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseCircle, IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5'
import { Heading, Text } from 'ui/src'
import { IntroBlockView, useUploadFile } from 'utils/src'
import Dropzone from 'react-dropzone'
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import { capitalCase } from 'change-case'
import { UploadType } from 'utils/src/enums'
import { useRecoilValue } from 'recoil'
import { flickAtom } from 'src/stores/flick.store'

const IntroContentTab = ({
	view,
	updateView,
}: {
	view: IntroBlockView | undefined
	updateView: (view: IntroBlockView) => void
}) => (
	<div className='flex flex-col p-5'>
		<Heading textStyle='extraSmallTitle'>Heading</Heading>
		<textarea
			value={view?.intro?.heading}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
				updateView({
					...view,
					type: 'introBlock',
					intro: {
						...view?.intro,
						heading: e.target.value,
					},
				})
			}
			className={cx(
				'mt-2 font-body text-size-xs rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-green-600 resize-none w-full bg-gray-100'
			)}
		/>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Name
		</Heading>
		<input
			className='bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-green-600 focus:outline-none font-body text-size-xs placeholder-gray-400'
			value={view?.intro?.name}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				updateView({
					...view,
					type: 'introBlock',
					intro: {
						...view?.intro,
						name: e.target.value,
					},
				})
			}
		/>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Designation
		</Heading>
		<textarea
			value={view?.intro?.designation}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
				updateView({
					...view,
					type: 'introBlock',
					intro: {
						...view?.intro,
						designation: e.target.value,
					},
				})
			}
			className={cx(
				'mt-2 font-body text-size-xs rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-green-600 w-full bg-gray-100 resize-none'
			)}
		/>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Organization
		</Heading>
		<input
			className='bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-green-600 focus:outline-none font-body text-size-xs placeholder-gray-400'
			value={view?.intro?.organization}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				updateView({
					...view,
					type: 'introBlock',
					intro: {
						...view?.intro,
						organization: e.target.value,
					},
				})
			}
		/>
	</div>
)

const PictureTab = ({
	view,
	updateView,
}: {
	view: IntroBlockView | undefined
	updateView: (view: IntroBlockView) => void
}) => {
	const [uploadFile] = useUploadFile()
	const [fileUploading, setFileUploading] = useState(false)
	const flick = useRecoilValue(flickAtom)

	const handleUploadFile = async (files: File[]) => {
		const file = files?.[0]
		if (!file) return

		setFileUploading(true)
		const { url } = await uploadFile({
			extension: file.name.split('.').pop() as any,
			file,
			tag: UploadType.Profile,
			meta: {
				flickId: flick?.id,
			},
		})

		setFileUploading(false)
		updateView({
			...view,
			type: 'introBlock',
			intro: {
				...view?.intro,
				displayPicture: url,
			},
		})
	}
	return (
		<div className='flex flex-col pt-6 px-4'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				Picture
			</Heading>
			{view?.intro?.displayPicture ? (
				<div className='relative rounded-sm ring-1 ring-offset-1 ring-gray-100 w-1/2 mt-2'>
					<IoCloseCircle
						className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
						size={16}
						onClick={() => {
							updateView({
								...view,
								type: 'introBlock',
								intro: {
									...view?.intro,
									displayPicture: undefined,
								},
							})
						}}
					/>
					<img
						src={view?.intro?.displayPicture || ''}
						alt='backgroundImage'
						className='object-contain w-full h-full rounded-md'
					/>
				</div>
			) : (
				<Dropzone
					onDrop={handleUploadFile}
					accept={{
						'image/*': [],
					}}
					maxFiles={1}
				>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-3 mt-2 border border-gray-200 border-dashed rounded-md cursor-pointer'
							{...getRootProps()}
						>
							<input {...getInputProps()} />
							{fileUploading ? (
								<FiLoader className={cx('animate-spin my-6')} size={16} />
							) : (
								<>
									<FiUploadCloud size={21} className='my-2 text-gray-600' />

									<div className='z-50 text-center '>
										<Text textStyle='bodySmall'>Drag and drop or</Text>
										<Text textStyle='bodySmall' className='font-semibold'>
											browse
										</Text>
									</div>
								</>
							)}
						</div>
					)}
				</Dropzone>
			)}
		</div>
	)
}

const IntroSequenceTab = ({
	view,
	updateView,
}: {
	view: IntroBlockView | undefined
	updateView: (view: IntroBlockView) => void
}) => {
	useEffect(() => {
		if (!view?.intro.order) {
			updateView({
				...view,
				type: 'introBlock',
				intro: {
					...view?.intro,
					order: [
						{
							state: 'userMedia',
							enabled: true,
						},
						{
							state: 'introVideo',
							enabled: true,
						},
						{
							state: 'titleSplash',
							enabled: true,
						},
					],
				},
			})
		}
	}, [updateView, view])

	return (
		<div className='flex flex-col pt-6 px-4'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				Sequence
			</Heading>
			<Text textStyle='bodySmall' className='text-gray-400'>
				Drag and drop to change sequence
			</Text>
			<DragDropContext
				onDragEnd={result => {
					const { destination, source } = result

					if (!destination || !view?.intro?.order) return

					if (
						destination.droppableId === source.droppableId &&
						destination.index === source.index
					)
						return

					const newOrder = Array.from(view.intro.order)
					newOrder.splice(source.index, 1)
					newOrder.splice(destination.index, 0, view.intro.order[source.index])
					updateView({
						...view,
						type: 'introBlock',
						intro: {
							...view?.intro,
							order: newOrder,
						},
					})
				}}
			>
				<Droppable droppableId='droppable'>
					{provided => (
						<div
							className='flex flex-col justify-center gap-y-2 w-full border border-dashed mt-4 rounded-md p-2'
							style={{
								height: view?.intro?.order?.length === 3 ? '150px' : '105px',
							}}
							{...provided.droppableProps}
							ref={provided.innerRef}
						>
							{view?.intro?.order?.map((o, i) => (
								<Draggable key={o.state} draggableId={o.state} index={i}>
									{draggableProvided => (
										<div
											className='flex justify-between border rounded-sm p-2 text-size-xs font-body bg-white'
											ref={draggableProvided.innerRef}
											{...draggableProvided.draggableProps}
											{...draggableProvided.dragHandleProps}
										>
											{capitalCase(o.state)}
											<button
												type='button'
												className='disabled:cursor-not-allowed'
												disabled={
													view?.intro?.order?.filter(order => order.enabled)
														.length === 1 && o.enabled
												}
												onClick={() => {
													updateView({
														...view,
														type: 'introBlock',
														intro: {
															...view?.intro,
															order: view?.intro?.order?.map(item => {
																if (item.state === o.state) {
																	return {
																		...o,
																		enabled: !o.enabled,
																	}
																}
																return item
															}),
														},
													})
												}}
											>
												{o.enabled ? (
													<IoEyeOutline size={16} />
												) : (
													<IoEyeOffOutline size={16} />
												)}
											</button>
										</div>
									)}
								</Draggable>
							))}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		</div>
	)
}

export { IntroContentTab, PictureTab, IntroSequenceTab }
