/* eslint-disable @next/next/no-img-element */
import { css, cx } from '@emotion/css'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { IoCheckmark } from 'react-icons/io5'
import { Button, emitToast, Text } from 'ui/src'
import { ContentTypeEnum } from 'utils/src/enums'
import trpc, { inferQueryOutput } from '../../server/trpc'

const AddExistingFlickModal = ({
	open,
	handleClose,
	series,
}: {
	open: boolean
	handleClose: (refetch?: boolean) => void
	series: inferQueryOutput<'series.get'>
}) => {
	const [selectedFlicks, setSelectedFlicks] = useState<string[]>([])

	useEffect(() => {
		setSelectedFlicks(series.Flick_Series.map(fs => fs.Flick?.id as string))
	}, [])

	const { data, isLoading: loading } = trpc.useQuery(['story.dashboardStories'])

	const {
		mutateAsync: addFlicks,
		data: addData,
		isLoading: addLoading,
	} = trpc.useMutation(['series.add'])

	const addFlicksToSeries = async () => {
		try {
			await addFlicks({
				storyIds: selectedFlicks,
				seriesId: series.id,
			})
		} catch (e) {
			emitToast('Failed to add stories. Please try again', {
				type: 'error',
			})
		}
	}

	useEffect(() => {
		if (!addData) return
		emitToast('Stories added to series', {
			type: 'success',
		})
		handleClose(true)
	}, [addData])

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
				open={open}
				onClose={() => {
					handleClose()
				}}
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
				<div className='fixed inset-0 flex items-center justify-center p-4'>
					<Transition.Child
						as={Fragment}
						enter='ease-out duration-300'
						enterFrom='opacity-0 scale-95'
						enterTo='opacity-100 scale-100'
						leave='ease-in duration-200'
						leaveFrom='opacity-100 scale-100'
						leaveTo='opacity-0 scale-95'
					>
						<Dialog.Panel className='flex rounded-md flex-col md:max-w-[50%] lg:max-w-[35%] max-h-[80%] h-full w-full overflow-hidden bg-dark-100 p-4'>
							<div className='flex flex-col w-full h-full'>
								<Text className='mb-4 text-dark-title-200'>
									Choose stories for the series{' '}
									<span className='text-sm italic'>
										({selectedFlicks.length} selected)
									</span>
								</Text>

								{loading && (
									<div className='flex justify-center w-full my-12'>
										<FiLoader
											size={21}
											className='animate-spin text-incredible-dark-200'
										/>
									</div>
								)}

								{data && data.length > 0 && (
									<div
										className={cx(
											'flex-1 overflow-scroll',
											css`
												-ms-overflow-style: none;
												scrollbar-width: none;
												::-webkit-scrollbar {
													display: none;
												}
											`
										)}
									>
										<div className='grid grid-cols-2 mt-4 gap-x-4 gap-y-4'>
											{data.map(flick => (
												<div
													key={flick.id}
													className='relative flex flex-col w-full h-full'
												>
													{selectedFlicks.includes(flick.id) && (
														<div className='items-center absolute top-1 right-1 z-10 flex p-1 m-px px-2 rounded-md text-white shadow-2xl gap-x-1 bg-dark-100'>
															<IoCheckmark
																size={16}
																className=' text-dark-title'
															/>
															<span>
																{selectedFlicks.findIndex(
																	fid => fid === flick.id
																) + 1}
															</span>
														</div>
													)}
													<button
														type='button'
														className='relative aspect-w-16 aspect-h-9'
														onClick={() => {
															if (selectedFlicks.includes(flick.id))
																setSelectedFlicks(
																	selectedFlicks.filter(f => f !== flick.id)
																)
															else
																setSelectedFlicks([...selectedFlicks, flick.id])
														}}
													>
														<img
															src={
																flick.Content.find(
																	f => f.type === ContentTypeEnum.Video
																)?.thumbnail
																	? `${process.env.NEXT_PUBLIC_CDN_URL}/${
																			flick.Content.find(
																				f => f.type === ContentTypeEnum.Video
																			)?.thumbnail
																	  }`
																	: '/card_fallback.png'
															}
															alt='thumbnail'
															className={cx(
																'object-cover h-full w-full rounded-md',
																{
																	'border-2 border-incredible-green-500':
																		selectedFlicks.includes(flick.id),
																}
															)}
														/>
													</button>
													<span className='mt-2 text-sm text-gray-100 truncate overflow-ellipsis'>
														{flick.name}
													</span>
												</div>
											))}
										</div>
									</div>
								)}

								{data && data.length > 0 && (
									<Button
										className='mt-4 max-w-none w-full'
										size='large'
										loading={addLoading}
										onClick={() => {
											addFlicksToSeries()
										}}
									>
										Update
									</Button>
								)}

								{data && data.length === 0 && (
									<div className='flex flex-col items-center justify-center w-full h-full'>
										<div className='flex'>
											<div className='z-0 w-32 h-32 rounded-full bg-dark-100' />
											<div className='z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl' />
											<div className='z-10 w-24 h-24 -ml-10 rounded-full bg-dark-title-200' />
										</div>
										<span className='mt-8 text-dark-title-200'>
											Much Empty! Create a story to add to the series
										</span>
									</div>
								)}
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}

export default AddExistingFlickModal
