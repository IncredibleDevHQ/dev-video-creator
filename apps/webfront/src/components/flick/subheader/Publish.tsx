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
/* eslint-disable arrow-body-style */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/media-has-caption */
import { css, cx } from '@emotion/css'
import { Dialog, Listbox, Popover, Transition } from '@headlessui/react'
import axios from 'axios'
import Link from 'next/link'
import React, {
	ChangeEvent,
	Fragment,
	useEffect,
	useRef,
	useState,
} from 'react'
import Dropzone from 'react-dropzone'
import { BiCheck } from 'react-icons/bi'
import { BsCloudCheck, BsCloudUpload } from 'react-icons/bs'
import {
	FiExternalLink,
	FiLoader,
	FiRefreshCw,
	FiUploadCloud,
} from 'react-icons/fi'
import { HiOutlineClock, HiOutlineDownload } from 'react-icons/hi'
import {
	IoAddOutline,
	IoChevronDownOutline,
	IoChevronUpOutline,
	IoCloseOutline,
	IoImageOutline,
	IoReloadOutline,
} from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import useMeasure from 'react-use-measure'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	CallToAction,
	flickAtom,
	fragmentTypeAtom,
	IPublish,
	publishConfigAtom,
	thumbnailObjectAtom,
} from 'src/stores/flick.store'
import { activeBrandIdAtom, recordedBlocksAtom } from 'src/stores/studio.store'
import CallToActionIcon from 'svg/CallToAction.svg'
import { Button, Confetti, emitToast, Heading, IconButton, Text } from 'ui/src'
import { useDebouncedCallback } from 'use-debounce'
import { useEnv, useGetHW, useUploadFile } from 'utils/src'
import {
	FragmentTypeEnum,
	RecordingStatusEnum,
	UploadType,
} from 'utils/src/enums'
import trpc, { inferQueryOutput } from '../../../server/trpc'
import ThumbnailModal from './ThumbnailModal'

interface Tab {
	name: string
	id: string
}

const tabs: Tab[] = [
	{
		name: 'Details',
		id: 'Details',
	},
	{
		name: 'Thumbnail',
		id: 'Thumbnail',
	},
	{
		name: 'Call to action',
		id: 'CallToAction',
	},
]

const getIcon = (tabId: string) => {
	switch (tabId) {
		case 'Details':
			return <MdOutlineTextFields size={18} />
		case 'Thumbnail':
			return <IoImageOutline size={18} />
		case 'CallToAction':
			return <CallToActionIcon className='transform scale-95' />
		default:
			return null
	}
}

const initialState: IPublish = {
	ctas: [],
	thumbnail: {
		method: 'generated',
	},
}

const noArrowInput = css`
	::-webkit-outer-spin-button,
	::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	[type='number'] {
		-moz-appearance: textfield;
	}
`

export interface YTIntegration {
	name: string
	picture: string
}

const CTA = ({
	publish,
	setPublish,
	currentTime,
	cta,
	index,
}: {
	cta: CallToAction
	index: number
	publish: IPublish
	setPublish: React.Dispatch<React.SetStateAction<IPublish>>
	currentTime: number
}) => {
	const [time, setTime] = useState<{
		min: string | undefined
		sec: string | undefined
	}>({
		min: '00',
		sec: '00',
	})

	const getMinuteAndSecondsFromSeconds = (s: number) => {
		const minutes = Math.floor(s / 60)
		const seconds = Math.floor(s % 60)
		return {
			minutes,
			seconds,
		}
	}
	useEffect(() => {
		const { minutes, seconds } = getMinuteAndSecondsFromSeconds(
			cta?.seconds || currentTime
		)
		setTime({
			min: minutes.toLocaleString('en-US', {
				minimumIntegerDigits: 2,
				useGrouping: false,
			}),
			sec: seconds.toLocaleString('en-US', {
				minimumIntegerDigits: 2,
				useGrouping: false,
			}),
		})
	}, [])

	const convertToSecondsAndSet = (minutes: number, seconds: number) => {
		// convert time to seconds
		const sec = minutes * 60 + seconds
		setPublish({
			...publish,
			ctas: publish.ctas?.map((c, i) => {
				if (i === index) {
					return {
						...c,
						seconds: sec,
					}
				}
				return c
			}),
		})
	}

	return (
		<div className='mt-2'>
			<div className='flex items-center bg-gray-100 w-full pr-2 rounded-sm border border-transparent justify-between focus-within:border-brand relative'>
				<div className='flex items-center w-min flex-grow-0 px-3 py-1.5'>
					<input
						value={time.min}
						type='number'
						onChange={(e: ChangeEvent<HTMLInputElement>) => {
							const min = e.target.value
							setTime({
								...time,
								min,
							})
							if (Number.isNaN(min)) return
							convertToSecondsAndSet(Number(min), Number(time.sec))
						}}
						className={cx(
							'border-none bg-transparent text-size-xs font-body outline-none  focus:outline-none focus:ring-0 w-5 text-center p-0 px-px',
							noArrowInput
						)}
					/>
					<span
						style={{
							marginTop: '-2px',
							marginLeft: '1px',
						}}
					>
						:
					</span>
					<input
						value={time.sec}
						type='number'
						onChange={(e: ChangeEvent<HTMLInputElement>) => {
							const sec = e.target.value
							setTime({
								...time,
								sec,
							})
							if (Number.isNaN(sec)) return
							convertToSecondsAndSet(Number(time.min), Number(sec))
						}}
						className={cx(
							'border-none bg-transparent text-size-xs font-body outline-none focus:outline-none focus:ring-0 w-5 text-center p-0 px-px',
							noArrowInput
						)}
					/>
				</div>
				<CallToActionIcon className='flex-shrink-0 absolute inset-0 m-auto right-16 top-px opacity-50 transform scale-75' />

				<Popover as='div' className='relative'>
					{({ close }) => (
						<>
							<Popover.Button>
								<Text
									textStyle='caption'
									className={cx(
										'flex items-center cursor-pointer w-20 ml-1 justify-start truncate',
										{
											'text-gray-400': !cta.text,
										}
									)}
								>
									{!cta.text && <IoAddOutline />}
									{cta.text || 'Add CTA'}
								</Text>
							</Popover.Button>
							<Popover.Panel>
								<div
									style={{
										width: '300px',
									}}
									className='absolute -top-4 right-44 p-4 pt-2 mr-6 bg-white border border-gray-200 rounded-sm shadow-sm z-50'
								>
									<div className='flex items-center justify-between py-2 border-b'>
										<Heading textStyle='extraSmallTitle'>
											Add call to action
										</Heading>
										<IoCloseOutline
											className='ml-auto cursor-pointer'
											size={16}
											onClick={() => close()}
										/>
									</div>
									<div className='flex flex-col gap-y-2 mt-2'>
										<Text
											textStyle='caption'
											className='flex items-center gap-x-2'
										>
											<HiOutlineClock />
											{time.min}:{time.sec}
										</Text>
										<Heading textStyle='extraSmallTitle' className='mt-2'>
											Button text
										</Heading>
										<input
											className='bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-size-xs placeholder-gray-400'
											value={cta?.text}
											placeholder='Join Community'
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setPublish({
													...publish,
													ctas: publish.ctas?.map((c, i) => {
														if (i === index) {
															return {
																...c,
																text: e.target.value,
															}
														}
														return c
													}),
												})
											}
										/>
										<Heading textStyle='extraSmallTitle' className='mt-2'>
											Button URL
										</Heading>
										<input
											className='bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-size-xs placeholder-gray-400'
											value={cta?.url}
											placeholder='https://discord.gg/jJQWQs8Fh2'
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setPublish({
													...publish,
													ctas: publish.ctas?.map((c, i) => {
														if (i === index) {
															return {
																...c,
																url: e.target.value,
															}
														}
														return c
													}),
												})
											}
										/>
									</div>
								</div>
							</Popover.Panel>
						</>
					)}
				</Popover>
				<IoCloseOutline
					className='cursor-pointer flex-shrink-0'
					onClick={() => {
						setPublish({
							...publish,
							ctas: publish.ctas?.filter((_, i) => i !== index),
						})
					}}
				/>
			</div>
		</div>
	)
}

const CTATab = ({
	publish,
	setPublish,
	currentTime,
}: {
	publish: IPublish
	setPublish: React.Dispatch<React.SetStateAction<IPublish>>
	currentTime: number
}) => (
	<div>
		<Heading textStyle='extraSmallTitle'>Call to action</Heading>
		{publish.ctas?.map((cta, index) => (
			<CTA
				publish={publish}
				setPublish={setPublish}
				currentTime={currentTime}
				cta={cta}
				index={index}
			/>
		))}
		<Button
			appearance='none'
			size='large'
			leftIcon={<IoAddOutline />}
			className='mt-2'
			onClick={() => {
				setPublish({
					...publish,
					ctas: [
						...(publish.ctas || []),
						{
							seconds: currentTime,
						},
					],
				})
			}}
		>
			Add {publish.ctas?.length > 0 && 'another'}
		</Button>
		<Heading textStyle='extraSmallTitle' className='mt-8'>
			Add discord link
		</Heading>
		<input
			className='bg-gray-100 border border-transparent mt-2 py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-size-xs placeholder-gray-400'
			value={publish.discordCTA?.url}
			placeholder='https://discord.gg/jJQWQs8Fh2'
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				setPublish({
					...publish,
					discordCTA: {
						url: e.target.value,
						text: 'Join discord',
					},
				})
			}
		/>
	</div>
)

const DetailsTab = ({
	publish,
	setPublish,
}: {
	publish: IPublish
	setPublish: React.Dispatch<React.SetStateAction<IPublish>>
}) => {
	const fragmentType = useRecoilValue(fragmentTypeAtom)

	return (
		<div>
			<Heading textStyle='extraSmallTitle'>Title*</Heading>
			<textarea
				className={cx(
					'mt-2 font-body text-size-xs rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
				)}
				value={publish.title}
				onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
					setPublish({
						...publish,
						title: e.target.value,
					})
				}
			/>
			{!publish.title && (
				<span className='text-size-xxs text-red-500 italic'>
					Title is required
				</span>
			)}
			{fragmentType !== FragmentTypeEnum.Portrait && (
				<>
					<Heading textStyle='extraSmallTitle' className='mt-8'>
						Description*
					</Heading>
					<textarea
						className={cx(
							'mt-2 font-body text-size-xs rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full bg-gray-100'
						)}
						value={publish.description}
						onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
							setPublish({
								...publish,
								description: e.target.value,
							})
						}
					/>
					{!publish.description && (
						<span className='text-size-xxs text-red-500 italic'>
							Description is required
						</span>
					)}
				</>
			)}
		</div>
	)
}

const ThumbnailTab = ({
	publish,
	setPublish,
	flickId,
	fragmentId,
}: {
	publish: IPublish
	setPublish: React.Dispatch<React.SetStateAction<IPublish>>
	flickId?: string
	fragmentId?: string
}) => {
	const activeFragmentId = useRecoilValue(activeBrandIdAtom)
	const setThumbnailObject = useSetRecoilState(thumbnailObjectAtom)
	const [thumbnailModal, setThumbnailModal] = useState(false)
	const [uploadFile] = useUploadFile()
	const [fileUploading, setFileUploading] = useState(false)

	const { mutateAsync: updateThumbnailObject } = trpc.useMutation([
		'fragment.updateThumbnail',
	])

	const handleUploadFile = async (files: File[]) => {
		try {
			const file = files?.[0]
			if (!file) return

			if (!flickId || !fragmentId) {
				emitToast('Flick or fragment id is missing', {
					type: 'error',
				})
				return
			}

			setFileUploading(true)
			const { uuid } = await uploadFile({
				extension: file.name.split('.').pop() as any,
				file,
				tag: UploadType.Asset,
				meta: {
					fragmentId,
					flickId,
				},
			})

			setFileUploading(false)
			await updateThumbnailObject({
				id: activeFragmentId as string,
				thumbnailObject: uuid,
			})
			setPublish({
				...publish,
				thumbnail: {
					method: publish.thumbnail?.method || 'generated',
					objectId: uuid,
				},
			})
			setThumbnailObject(uuid)
		} catch (e) {
			emitToast('Could not upload file', {
				type: 'error',
			})
		}
	}

	const getButtonText = (method: string) => {
		if (method === 'generated') {
			return 'Generate Thumbnail'
		}
		return 'Upload Thumbnail'
	}

	const {
		storage: { cdn: baseUrl },
	} = useEnv()

	return (
		<div>
			<Heading textStyle='extraSmallTitle'>Thumbnail</Heading>
			<Listbox
				value={publish.thumbnail?.method || 'generated'}
				onChange={value =>
					setPublish({
						...publish,
						thumbnail: {
							...publish.thumbnail,
							method: value,
						},
					})
				}
			>
				{({ open }) => (
					<div className='relative mt-2'>
						<Listbox.Button className='w-full flex gap-x-4 text-left items-center justify-between rounded-sm bg-gray-100 shadow-sm py-2 px-3 pr-8 relative text-gray-800'>
							<div className='flex items-center gap-x-2 w-full'>
								<Text textStyle='caption' className='block truncate'>
									{getButtonText(publish.thumbnail?.method || 'generated')}
								</Text>
							</div>
							<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none '>
								{open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
							</span>
						</Listbox.Button>
						<Listbox.Options className='bg-dark-300 mt-2 rounded-md absolute w-full z-10 shadow-md p-1.5'>
							{['generated', 'uploaded'].map(method => (
								<Listbox.Option
									className={({ active }) =>
										cx(
											'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-sm',
											{
												'bg-dark-100': active,
											}
										)
									}
									key={method}
									value={method}
								>
									{({ selected }) => (
										<>
											<Text textStyle='caption' className='block truncate '>
												{getButtonText(method)}
											</Text>
											{selected && (
												<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
													<BiCheck size={20} />
												</span>
											)}
										</>
									)}
								</Listbox.Option>
							))}
						</Listbox.Options>
					</div>
				)}
			</Listbox>
			{thumbnailModal && (
				<ThumbnailModal
					open={thumbnailModal}
					handleClose={uuid => {
						if (uuid) {
							setPublish({
								...publish,
								thumbnail: {
									method: publish.thumbnail?.method || 'generated',
									objectId: uuid,
								},
							})
							setThumbnailObject(uuid)
						}
						setThumbnailModal(false)
					}}
					isPublishFlow
				/>
			)}

			{publish.thumbnail?.method === 'generated' && (
				<button
					className={cx(
						'flex flex-col items-center justify-center text-sm w-full  mt-2 rounded-md  gap-y-2',
						{
							'border border-dashed py-8': !publish.thumbnail?.objectId,
						}
					)}
					type='button'
					onClick={() => {
						setThumbnailModal(true)
					}}
				>
					{publish.thumbnail?.objectId ? (
						<div className='relative group flex flex-col items-center justify-center w-full h-full !text-size-xs'>
							<img
								className='w-full rounded-md'
								alt='thumbnail'
								src={`${baseUrl}${publish.thumbnail?.objectId}`}
							/>
							<div className='absolute bg-black opacity-50 w-full h-full hidden group-hover:block rounded-md' />
							<span className='absolute my-auto z-10 top-0 bottom-0 text-white w-full h-full items-center justify-center hidden group-hover:flex text-size-sm'>
								Regenerate
							</span>
						</div>
					) : (
						<>
							<IoImageOutline size={18} />
							<Text textStyle='caption'>Generate thumbnail</Text>
						</>
					)}
				</button>
			)}
			{publish.thumbnail?.method === 'uploaded' && (
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
							className={cx(
								'flex flex-col items-center  mt-2  rounded-md cursor-pointer',
								{
									'p-3 border border-gray-200 border-dashed':
										!fileUploading && !publish.thumbnail?.objectId,
								}
							)}
							{...getRootProps()}
						>
							<input {...getInputProps()} />
							{fileUploading && (
								<FiLoader className={cx('animate-spin my-6')} size={16} />
							)}
							{!fileUploading && !publish.thumbnail?.objectId && (
								<>
									<FiUploadCloud size={18} className='my-2 text-gray-600' />

									<div className='text-center '>
										<Text textStyle='bodySmall'>Drag and drop or</Text>
										<Text textStyle='bodySmall' className='font-semibold'>
											browse
										</Text>
									</div>
								</>
							)}
							{!fileUploading && publish.thumbnail?.objectId && (
								<div className='relative group flex flex-col items-center justify-center w-full h-full'>
									<img
										className='w-full rounded-md'
										alt='thumbnail'
										src={`${baseUrl}${publish.thumbnail?.objectId}`}
									/>
									<div className='absolute bg-black opacity-50 w-full h-full hidden group-hover:block rounded-md' />
									<span className='absolute my-auto z-10 top-0 bottom-0 text-white w-full h-full items-center justify-center hidden group-hover:flex'>
										Upload
									</span>
								</div>
							)}
						</div>
					)}
				</Dropzone>
			)}
		</div>
	)
}

const Publish = ({
	open,
	handleClose,
}: {
	open: boolean
	handleClose: (refresh?: boolean) => void
}) => {
	const [activeTab, setActiveTab] = useState<Tab>(tabs[0])
	const [ref, bounds] = useMeasure()
	const [downloading, setDownloading] = useState(false)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const [showConfetti, setShowConfetti] = useState(false)
	const flick = useRecoilValue(flickAtom)

	const simpleAST = useRecoilValue(astAtom)

	const thumbnailObject = useRecoilValue(thumbnailObjectAtom)
	const [publishConfig, setPublishConfig] = useRecoilState(publishConfigAtom)

	const [publish, setPublish] = useState<IPublish>(
		publishConfig ?? {
			...initialState,
			title: 'Untitled',
			thumbnail: {
				method: initialState.thumbnail?.method || 'generated',
				objectId: thumbnailObject ?? undefined,
			},
		}
	)

	const {
		mutate: doPublish,
		data: doPublishData,
		isLoading: publishing,
		error: errorPublishing,
	} = trpc.useMutation(['fragment.publish'])

	useEffect(() => {
		if (!doPublishData) return
		setShowConfetti(true)
		setTimeout(() => {
			setShowConfetti(false)
		}, 5000)
	}, [doPublishData])

	useEffect(() => {
		if (!errorPublishing) return
		emitToast(`Error publishing ${errorPublishing.message}`, {
			type: 'error',
		})
	}, [errorPublishing])

	const {
		mutateAsync: updatePublishConfig,
		isLoading: updatePublishLoading,
		error: updatePublishError,
	} = trpc.useMutation(['fragment.updatePublished'])

	useEffect(() => {
		if (!updatePublishError) return
		emitToast(`Couldn't update publish config ${updatePublishError.message}`, {
			type: 'error',
		})
	}, [updatePublishError])

	const initialLoad = useRef<boolean>(true)
	const debounced = useDebouncedCallback(() => {
		if (!activeFragmentId) return
		updatePublishConfig({
			id: activeFragmentId,
			publishConfig: publish,
		})
	}, 400)

	useEffect(() => {
		if (initialLoad.current) {
			initialLoad.current = false
			return
		}
		debounced()
		if (!flick) return
		setPublishConfig(publish)
	}, [publish])

	const {
		storage: { cdn: baseUrl },
	} = useEnv()

	const fragmentType = useRecoilValue(fragmentTypeAtom)
	const { height, width } = useGetHW({
		maxH: bounds.height / 1.1,
		maxW: bounds.width / 1.1,
		aspectRatio: fragmentType === 'Portrait' ? 9 / 16 : 16 / 9,
	})

	const [recording, setRecording] =
		useState<inferQueryOutput<'recording.get'>[number]>()

	const recordedBlocks = useRecoilValue(recordedBlocksAtom)

	const videoRef = useRef<HTMLVideoElement>(null)
	const [currentTime, setCurrentTime] = useState(0)

	videoRef.current?.addEventListener('timeupdate', () => {
		setCurrentTime(videoRef.current?.currentTime || 0)
	})

	const {
		data: recordingsData,
		error: getRecordingsError,
		isLoading: getRecordingsLoading,
		refetch,
	} = trpc.useQuery([
		'recording.get',
		{
			flickId: flick?.id as string,
			fragmentId: activeFragmentId as string,
		},
	])

	const timer = useRef<NodeJS.Timer>()
	const startPolling = () => {
		timer.current = setInterval(() => {
			refetch()
		}, 5000)
	}
	const stopPolling = () => {
		clearInterval(timer.current)
	}

	useEffect(
		() => () => {
			stopPolling()
		},
		[]
	)

	useEffect(() => {
		if (!recording) return
		if (recording.status === RecordingStatusEnum.Processing) {
			startPolling()
		} else {
			stopPolling()
		}
	}, [recording?.status])

	const downloadVideo = async () => {
		if (!recording) return
		setDownloading(true)
		axios({
			url: baseUrl + recording.url,
			method: 'GET',
			responseType: 'blob',
		}).then(response => {
			const url = window.URL.createObjectURL(new Blob([response.data]))
			const link = document.createElement('a')
			link.href = url
			link.setAttribute('download', `${recording.id}.mp4`)
			document.body.appendChild(link)
			link.click()
			setDownloading(false)
		})
	}

	const {
		mutateAsync: completeRecording,
		error: errorCompletingRecording,
		isLoading: loadingCompleteRecording,
	} = trpc.useMutation(['recording.complete'])

	const completeFragmentRecording = async (recordingId: string) => {
		const data = await completeRecording({
			editorState: JSON.stringify(simpleAST),
			recordingId,
		})
		if (data.success) await refetch()
	}

	useEffect(() => {
		if (!recordingsData) return
		if (recordingsData.length < 1) return
		setRecording(recordingsData[0])
	}, [recordingsData])

	useEffect(() => {
		if (errorCompletingRecording) {
			emitToast(
				`Error producing recording ${errorCompletingRecording.message}`,
				{
					type: 'error',
				}
			)
		} else if (getRecordingsError) {
			emitToast(`Error fetching recordings ${getRecordingsError.message}`, {
				type: 'error',
			})
		}
	}, [errorCompletingRecording, getRecordingsError])

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
							{doPublishData && (
								<>
									<Confetti fire={showConfetti} />
									<div className='flex w-full h-full items-center justify-center'>
										<div
											className='flex flex-col w-full h-full items-start justify-center'
											style={{
												maxWidth: '450px',
												width: '100%',
											}}
										>
											<div className='flex mx-auto'>
												<div className='h-32 w-32 bg-gray-100 rounded-full z-0' />
												<div className='z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl' />
												<div className='z-10 w-24 h-24 -ml-10 rounded-full bg-green-600' />
											</div>
											<Heading className='mb-4 font-bold text-3xl mt-12'>
												Congratulations! your story is out.
											</Heading>
											<Text className='font-body'>
												Your story is available in this link. You can share it
												with the world.
											</Text>
											<a
												href={`/watch/${flick?.joinLink}`}
												target='_blank'
												rel='noreferrer noopener'
												className='w-full flex my-4 border p-2 rounded-md items-center justify-between text-size-sm gap-x-12 text-gray-600 px-4 pr-0'
											>
												{`${process.env.NEXT_PUBLIC_PUBLIC_URL}/watch/${flick?.joinLink}`}
												<FiExternalLink size={21} className='mx-2' />
											</a>
										</div>
									</div>
								</>
							)}
							{!doPublishData && (
								<div className='flex flex-col w-full h-full'>
									{/* Top bar */}
									<div className='flex items-center justify-between w-full pl-4 pr-2 py-2 border-b border-gray-300'>
										<div className='flex items-center gap-x-4'>
											<Heading textStyle='smallTitle'>Publish</Heading>
											{updatePublishLoading ? (
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
										<div className='flex items-center gap-x-4'>
											{flick && flick.contents.length > 0 && (
												<Link href={`/watch/${flick?.joinLink}`}>
													<p className='flex items-center gap-x-2 text-size-xs hover:underline cursor-pointer'>
														Story page
													</p>
												</Link>
											)}
											<Button
												disabled={
													!publish.title ||
													(fragmentType !== 'Portrait' &&
														!publish.description) ||
													!recording?.id ||
													!recording.url ||
													recording?.status !== RecordingStatusEnum.Completed ||
													updatePublishLoading
												}
												loading={publishing}
												onClick={() => {
													if (!publish || !activeFragmentId) {
														emitToast(
															'Ops! Something went wrong, could not load the necessary data to publish.',
															{
																type: 'error',
															}
														)
														return
													}
													doPublish({
														data: publish,
														fragmentId: activeFragmentId,
														recordingId: recording?.id as string,
														publishToYoutube: false,
													})
												}}
											>
												Publish
											</Button>
										</div>
									</div>

									<div className='flex justify-between flex-1 w-full'>
										{/* Video Section */}
										<div
											className='relative flex items-center justify-center w-full bg-gray-100 '
											ref={ref}
										>
											{recording &&
											recording.url &&
											recording.status !== RecordingStatusEnum.Processing &&
											!getRecordingsLoading &&
											!loadingCompleteRecording ? (
												<div className='flex flex-col items-end gap-y-4'>
													<video
														ref={videoRef}
														height={height}
														width={width}
														style={{
															minWidth: width,
															minHeight: height,
														}}
														className='flex-shrink-0'
														controls
														autoPlay={false}
														src={baseUrl + recording.url}
													/>
													<div className='flex items-center gap-x-2'>
														<IconButton
															icon={<IoReloadOutline />}
															colorScheme='dark'
															onClick={() =>
																completeFragmentRecording(recording.id)
															}
															loading={loadingCompleteRecording}
														/>

														<IconButton
															colorScheme='dark'
															icon={<HiOutlineDownload />}
															onClick={downloadVideo}
															loading={downloading}
														/>
													</div>
												</div>
											) : (
												recording && (
													<div
														className='bg-gray-300 flex items-center justify-center gap-y-4 flex-col'
														style={{
															width: `${width}px`,
															height: `${height}px`,
														}}
													>
														{(() => {
															switch (recording.status) {
																case RecordingStatusEnum.Pending:
																case RecordingStatusEnum.Completed:
																	if (
																		Object.entries(recordedBlocks).length > 0
																	) {
																		return (
																			<>
																				<Text className='font-body'>
																					Produce video to see it here
																				</Text>
																				<Button
																					onClick={() =>
																						completeFragmentRecording(
																							recording.id
																						)
																					}
																					loading={loadingCompleteRecording}
																				>
																					Produce
																				</Button>
																			</>
																		)
																	}
																	return (
																		<Text className='text-center'>
																			No blocks have been recorded. Please
																			record and come back.
																		</Text>
																	)
																case RecordingStatusEnum.Processing:
																	return (
																		<>
																			<FiRefreshCw
																				size={21}
																				className='animate-spin'
																			/>
																			<Text className='font-body'>
																				Processing
																			</Text>
																		</>
																	)
																default:
																	return null
															}
														})()}
													</div>
												)
											)}
										</div>
										{/* Sidebar */}
										<div className='flex'>
											<div className='w-64 px-4 pt-6 bg-white'>
												{activeTab.id === tabs[0].id && (
													<DetailsTab
														publish={publish}
														setPublish={setPublish}
													/>
												)}
												{activeTab.id === tabs[1].id && (
													<ThumbnailTab
														publish={publish}
														setPublish={setPublish}
														flickId={flick?.id}
														fragmentId={activeFragmentId ?? undefined}
													/>
												)}
												{activeTab.id === tabs[2].id && (
													<CTATab
														publish={publish}
														setPublish={setPublish}
														currentTime={currentTime}
													/>
												)}
											</div>
											<div className='flex h-full flex-col px-2 pt-4 bg-gray-50 gap-y-2 w-[88px]'>
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
														{getIcon(tab.id)}
														<Text textStyle='bodySmall'>{tab.name}</Text>
													</button>
												))}
											</div>
										</div>
									</div>
								</div>
							)}
						</Dialog.Panel>
					</div>
				</Transition.Child>
			</Dialog>
		</Transition>
	)
}

export default Publish
