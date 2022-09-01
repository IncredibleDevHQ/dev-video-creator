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
import { Dialog, Transition } from '@headlessui/react'
import { saveAs } from 'file-saver'
import Konva from 'konva'
import { ChangeEvent, Fragment, useEffect, useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { IconType } from 'react-icons'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import { CgProfile } from 'react-icons/cg'
import { FiLayout, FiLoader, FiUploadCloud } from 'react-icons/fi'
import { HiOutlineDownload } from 'react-icons/hi'
import { IoCloseCircle } from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import { Layer, Stage } from 'react-konva'
import useMeasure from 'react-use-measure'
import {
	useRecoilBridgeAcrossReactRoots_UNSTABLE,
	useRecoilState,
	useRecoilValue,
} from 'recoil'
import {
	activeFragmentIdAtom,
	flickAtom,
	thumbnailAtom,
	ThumbnailProps,
} from 'src/stores/flick.store'
import { CONFIG } from 'src/utils/configs'
import { UploadType } from 'utils/src/enums'
import { useUser } from 'src/utils/providers/auth'
import { Button, emitToast, Heading, Text } from 'ui/src'
import { useDebouncedCallback } from 'use-debounce'
import { IntroBlockView, Layout, useUploadFile } from 'utils/src'
import { getIntegerHW } from '../canvas/CanvasComponent'
import Thumbnail from '../canvas/Thumbnail'
import trpc from '../../../server/trpc'
import LayoutSelector from '../preview/LayoutSelector'

interface Tab {
	name: string
	id: string
	Icon: IconType
}

const tabs: Tab[] = [
	{
		id: 'Layout',
		name: 'Layout',
		Icon: FiLayout,
	},
	{
		id: 'Content',
		name: 'Content',
		Icon: MdOutlineTextFields,
	},
	{
		id: 'Picture',
		name: 'Picture',
		Icon: CgProfile,
	},
]

const PictureTab = ({
	thumbnailConfig,
	setThumbnailConfig,
	flickId,
	fragmentId,
}: {
	thumbnailConfig: ThumbnailProps
	setThumbnailConfig: (thumbnailConfig: ThumbnailProps) => void
	flickId?: string
	fragmentId?: string
}) => {
	const [uploadFile] = useUploadFile()

	const [fileUploading, setFileUploading] = useState(false)

	const handleUploadFile = async (files: File[]) => {
		const file = files?.[0]
		if (!file) return

		setFileUploading(true)
		if (!flickId || !fragmentId) {
			emitToast('FlickId/FragmentId not found', {
				type: 'error',
			})
			setFileUploading(false)
		}
		const { url } = await uploadFile({
			extension: file.name.split('.').pop() as any,
			file,
			tag: UploadType.Asset,
			meta: {
				flickId,
				fragmentId,
			},
		})

		setFileUploading(false)
		setThumbnailConfig({
			...thumbnailConfig,
			displayPicture: url,
		})
	}
	return (
		<div className='flex flex-col pt-6 px-4'>
			<Heading textStyle='extraSmallTitle'>Picture</Heading>
			{thumbnailConfig.displayPicture ? (
				<div className='relative rounded-sm ring-1 ring-offset-1 ring-gray-100 w-1/2 mt-2'>
					<IoCloseCircle
						className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
						size={16}
						onClick={() => {
							setThumbnailConfig({
								...thumbnailConfig,
								displayPicture: undefined,
							})
						}}
					/>
					<img
						src={thumbnailConfig.displayPicture || ''}
						alt='backgroundImage'
						className='object-contain w-full h-full rounded-md'
					/>
				</div>
			) : (
				<Dropzone
					onDrop={handleUploadFile}
					accept={{ 'image/*': [] }}
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
									<FiUploadCloud size={18} className='my-2 text-gray-600' />

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

const ContentView = ({
	thumbnailConfig,
	setThumbnailConfig,
}: {
	thumbnailConfig: ThumbnailProps
	setThumbnailConfig: (thumbnailConfig: ThumbnailProps) => void
}) => (
	<div className='flex flex-col pt-6 px-4'>
		<Heading textStyle='extraSmallTitle'>Heading</Heading>
		<textarea
			value={thumbnailConfig.heading}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
				setThumbnailConfig({
					...thumbnailConfig,
					heading: e.target.value,
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
			value={thumbnailConfig.name}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				setThumbnailConfig({
					...thumbnailConfig,
					name: e.target.value,
				})
			}
		/>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Designation
		</Heading>
		<textarea
			value={thumbnailConfig.designation}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
				setThumbnailConfig({
					...thumbnailConfig,
					designation: e.target.value,
				})
			}
			className={cx(
				'mt-2 font-body text-size-xs rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-green-600 resize-none w-full bg-gray-100'
			)}
		/>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Organization
		</Heading>
		<input
			className='bg-gray-100 mt-1.5 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-green-600 focus:outline-none font-body text-size-xs placeholder-gray-400'
			value={thumbnailConfig.organization}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				setThumbnailConfig({
					...thumbnailConfig,
					organization: e.target.value,
				})
			}
		/>
	</div>
)

const ThumbnailModal = ({
	open,
	handleClose,
	isPublishFlow,
}: {
	open: boolean
	handleClose: (thumbnailObject?: string) => void
	isPublishFlow?: boolean
}) => {
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const flick = useRecoilValue(flickAtom)
	const [fragmentThumbnailConfig, setFragmentThumbnailConfig] =
		useRecoilState(thumbnailAtom)

	Konva.pixelRatio = 2
	const stageRef = useRef<Konva.Stage>(null)

	const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

	const [activeTab, setActiveTab] = useState<Tab>(tabs[0])
	const { user } = useUser()

	const [thumbnailConfig, setThumbnailConfig] = useState<ThumbnailProps>({
		heading: '',
		name: '',
		designation: '',
		organization: '',
		displayPicture: user?.picture || undefined,
		...(JSON.parse(
			localStorage.getItem('thumbnailConfig') || '{}'
		) as ThumbnailProps),
		layout: 'bottom-right-tile',
	})

	const [updatingThumbnail, setUpdatingThumbnail] = useState(false)
	const updateThumbnail = trpc.useMutation(['fragment.updateThumbnail'])
	// const [updateThumbnailObject] = useUpdateThumbnailObjectMutation()

	const updateConfig = async () => {
		setUpdatingThumbnail(true)
		try {
			if (!activeFragmentId)
				throw new Error('No active fragment to save thumbnail.')
			await updateThumbnail.mutateAsync({
				id: activeFragmentId,
				thumbnailConfig,
			})
		} catch (e) {
			emitToast('Failed to update thumbnail', {
				type: 'error',
			})
		} finally {
			setUpdatingThumbnail(false)
		}
	}

	const initialLoad = useRef<boolean>(true)
	const debounced = useDebouncedCallback(() => {
		updateConfig()
	}, 400)

	const [uploadFile] = useUploadFile()
	const [uploading, setUploading] = useState(false)

	const uploadAndContinue = async (dataURL: string) => {
		setUploading(true)
		try {
			const blob = await fetch(dataURL).then(r => r.blob())
			const { uuid } = await uploadFile({
				extension: 'png',
				file: blob,
				tag: UploadType.Asset,
				meta: {
					flickId: flick?.id,
					fragmentId: activeFragmentId ?? undefined,
				},
			})
			if (!activeFragmentId)
				throw new Error('No active fragment to save thumbnail.')
			await updateThumbnail.mutateAsync({
				id: activeFragmentId,
				thumbnailObject: uuid,
			})
			handleClose(uuid)
		} catch (e) {
			emitToast('Failed to upload file', {
				type: 'error',
			})
		} finally {
			setUploading(false)
		}
	}

	useEffect(() => {
		if (initialLoad.current) {
			initialLoad.current = false
			return
		}
		localStorage.setItem(
			'thumbnailConfig',
			JSON.stringify({
				designation: thumbnailConfig.designation,
				displayPicture: thumbnailConfig.displayPicture,
				name: thumbnailConfig.name,
				organization: thumbnailConfig.organization,
			} as ThumbnailProps)
		)
		debounced()
		setFragmentThumbnailConfig(thumbnailConfig)
	}, [debounced, setFragmentThumbnailConfig, thumbnailConfig])

	useEffect(() => {
		if (fragmentThumbnailConfig) {
			setThumbnailConfig(fragmentThumbnailConfig)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const [ref, bounds] = useMeasure()

	const { height, width } = getIntegerHW({
		maxH: bounds.height / 1.1,
		maxW: bounds.width / 1.1,
		aspectRatio: 16 / 9,
		isShorts: false,
	})

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
				onClose={() => {
					handleClose()
				}}
				className='relative z-50'
			>
				<Transition.Child
					as={Fragment}
					enter='ease-out duration-300'
					enterFrom='opacity-0'
					enterTo='opacity-100'
					leave='ease-in duration-200'
					leaveFrom='opacity-100'
					leaveTo='opacity-0'
				>
					<div className='fixed inset-0 bg-black/60' aria-hidden='true' />
				</Transition.Child>
				<Transition.Child
					as={Fragment}
					enter='ease-out duration-300'
					enterFrom='opacity-0 scale-95'
					enterTo='opacity-100 scale-100'
					leave='ease-in duration-200'
					leaveFrom='opacity-100 scale-100'
					leaveTo='opacity-0 scale-95'
				>
					<div className='fixed inset-0 flex items-center justify-center p-4'>
						<Dialog.Panel className='h-[85vh] w-[90%] flex flex-col bg-white rounded-md overflow-hidden'>
							<div className='flex justify-between items-center pl-4 pr-2 py-2'>
								<div className='flex items-center gap-x-4'>
									<Heading textStyle='smallTitle'>Thumbnail</Heading>
									{updatingThumbnail ? (
										<div className='flex items-center mt-px mr-4 text-gray-400'>
											<BsCloudUpload className='mr-1' />
											<Text textStyle='bodySmall'>Saving...</Text>
										</div>
									) : (
										<div className='flex items-center mt-px mr-4 text-gray-400'>
											<BsCloudCheck className='mr-1' />
											<Text textStyle='bodySmall'>Saved</Text>
										</div>
									)}
								</div>

								{!isPublishFlow ? (
									<Button
										appearance='none'
										type='button'
										leftIcon={<HiOutlineDownload size={20} />}
										onClick={() => {
											if (!stageRef.current) return
											const dataURL = stageRef.current.toDataURL({
												pixelRatio: 1920 / width,
											})
											saveAs(dataURL, 'thumbnail.png')
										}}
									/>
								) : (
									<div className='flex items-center gap-x-4'>
										<Button
											type='button'
											appearance='none'
											onClick={() => {
												handleClose()
											}}
										>
											Cancel
										</Button>
										<Button
											onClick={() => {
												if (!stageRef.current) return
												uploadAndContinue(
													stageRef.current.toDataURL({
														pixelRatio: 1920 / width,
													})
												)
											}}
											disabled={uploading}
										>
											{uploading ? (
												<div className='flex items-center'>
													<FiLoader className='mr-1.5 animate-spin' />
													Uploading
												</div>
											) : (
												'Continue'
											)}
										</Button>
									</div>
								)}
							</div>
							<hr className='w-full h-0.5 bg-gray-300' />

							<section className='flex flex-1 justify-between w-full'>
								<div
									ref={ref}
									className='relative flex items-center justify-center w-full bg-gray-100'
								>
									<Stage
										ref={stageRef}
										className='border'
										height={height || 1}
										width={width || 1}
										scale={{
											x: height / CONFIG.height,
											y: width / CONFIG.width,
										}}
									>
										<Bridge>
											<Layer>
												<Thumbnail
													viewConfig={{
														layout: thumbnailConfig.layout,
														view: {
															type: 'introBlock',
															intro: {
																...thumbnailConfig,
															},
														} as IntroBlockView,
													}}
													isShorts={false}
												/>
											</Layer>
										</Bridge>
									</Stage>
								</div>
								<div className='flex'>
									<div className='w-64 bg-white'>
										{activeTab === tabs[0] && (
											<LayoutSelector
												mode='Landscape'
												layout={thumbnailConfig.layout}
												updateLayout={(layout: Layout) => {
													setThumbnailConfig({
														...thumbnailConfig,
														layout,
													})
												}}
												type='introBlock'
											/>
										)}
										{activeTab === tabs[1] && (
											<ContentView
												thumbnailConfig={thumbnailConfig}
												setThumbnailConfig={setThumbnailConfig}
											/>
										)}
										{activeTab === tabs[2] && (
											<PictureTab
												thumbnailConfig={thumbnailConfig}
												setThumbnailConfig={setThumbnailConfig}
												flickId={flick?.id}
												fragmentId={activeFragmentId ?? undefined}
											/>
										)}
									</div>
									<div className='flex flex-col px-2 pt-4 bg-gray-50 gap-y-2 w-[88px]'>
										{tabs.map(tab => (
											<button
												type='button'
												onClick={() => setActiveTab(tab)}
												className={cx(
													'flex flex-col items-center bg-transparent py-3 px-1 rounded-md text-gray-500 gap-y-2 transition-all',
													{
														'!bg-gray-200 text-gray-800':
															activeTab.id === tab.id,
														'hover:bg-gray-100': activeTab.id !== tab.id,
													}
												)}
												key={tab.id}
											>
												<tab.Icon size={18} />
												<Text textStyle='bodySmall'>{tab.name}</Text>
											</button>
										))}
									</div>
								</div>
							</section>
						</Dialog.Panel>
					</div>
				</Transition.Child>
			</Dialog>
		</Transition>
	)
}

export default ThumbnailModal
