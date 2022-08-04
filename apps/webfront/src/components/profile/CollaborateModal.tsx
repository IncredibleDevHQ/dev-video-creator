import { css, cx } from '@emotion/css'
import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { IoAlbumsOutline } from 'react-icons/io5'
import {
	ContentContainerTypes,
	useGetUserFlicksLazyQuery,
	UserFragment,
} from 'src/graphql/generated'
import { useUser } from 'src/utils/providers/auth'
import { Avatar, Button, emitToast, Heading, Text, TextField } from 'ui/src'
import FlickIcon from 'svg/Flick.svg'
import trpc, { inferMutationInput } from 'server/trpc'

const ChooseContent = ({
	modalState,
	setModalState,
}: {
	modalState: CollaborateModalState
	setModalState: React.Dispatch<React.SetStateAction<CollaborateModalState>>
}) => (
	<>
		<Text textStyle='body' className='mt-10 text-dark-title-200'>
			Choose what you’d like to collaborate on. You can create a new one, or
			choose from existing ones.
		</Text>
		<div className='flex flex-row items-center justify-center w-full mt-4 gap-x-4'>
			<button
				type='button'
				className={cx(
					'flex flex-col items-center justify-center bg-dark-100 w-24 h-24 rounded-lg gap-y-2',
					{
						'border-2 border-green-700':
							modalState.contentType === ContentContainerTypes.Flick,
					}
				)}
				onClick={() =>
					setModalState({
						...modalState,
						contentType: ContentContainerTypes.Flick,
					})
				}
			>
				<FlickIcon className='scale-75' />
				<Text textStyle='body' className='mt-1 text-gray-100'>
					Flick
				</Text>
			</button>
			<button
				type='button'
				className={cx(
					'flex flex-col items-center justify-center bg-dark-100 w-24 h-24 rounded-lg gap-y-2',
					{
						'border-2 border-green-700':
							modalState.contentType === ContentContainerTypes.Series,
					}
				)}
				onClick={() =>
					setModalState({
						...modalState,
						contentType: ContentContainerTypes.Series,
					})
				}
			>
				<IoAlbumsOutline size={36} className='text-dark-body-100' />
				<Text textStyle='body' className='mt-1 text-gray-100'>
					Series
				</Text>
			</button>
		</div>
		<Button
			colorScheme='dark'
			size='large'
			className='mt-8 w-full max-w-none'
			onClick={() => {
				setModalState({
					...modalState,
					existingContent: true,
					page: 1,
				})
			}}
		>
			Choose from existing one
		</Button>
		<Button
			size='large'
			className='mt-2 w-full max-w-none'
			onClick={() => {
				setModalState({
					...modalState,
					existingContent: false,
					page: 1,
				})
			}}
		>
			Create new
		</Button>
	</>
)

const FlickCollaboration = ({
	modalState,
	setModalState,
	user,
	handleSubmit,
	submitting,
}: {
	submitting: boolean
	handleSubmit: () => void
	modalState: CollaborateModalState
	setModalState: React.Dispatch<React.SetStateAction<CollaborateModalState>>
	user: UserFragment
}) => {
	const { user: loggedInUser } = useUser()

	const [getFlicks, { data, loading }] = useGetUserFlicksLazyQuery({
		variables: {
			sub: loggedInUser?.sub as string,
		},
	})

	useEffect(() => {
		if (!data) return
		if (data.Flick.length === 0) return
		setModalState({ ...modalState, selectedFlickId: data.Flick[0].id })
	}, [data])

	useEffect(() => {
		if (modalState.existingContent) {
			getFlicks()
		}
	}, [modalState.existingContent, getFlicks])

	return modalState.existingContent ? (
		<div
			className={cx(
				'flex flex-col mt-8 w-full',
				css`
					height: 50vh;
				`
			)}
		>
			<Text textStyle='body' className='text-dark-title-200'>
				Choose a story to collaborate
			</Text>

			{loading && (
				<div className='flex justify-center w-full my-12'>
					<FiLoader size={21} className='animate-spin text-dark-title-200' />
				</div>
			)}

			{data && data.Flick.length > 0 && (
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
						{data.Flick.map(flick => (
							<div key={flick.id} className='flex flex-col w-full h-full'>
								<button
									type='button'
									className='aspect-w-16 aspect-h-9'
									onClick={() =>
										setModalState({
											...modalState,
											selectedFlickId: flick.id,
										})
									}
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={
											flick.thumbnail
												? `${process.env.NEXT_PUBLIC_CDN_URL}${flick.thumbnail}`
												: '/card_fallback.png'
										}
										alt='thumbnail'
										className={cx('object-cover h-full w-full rounded-md', {
											'border-2 border-green-600':
												modalState.selectedFlickId === flick.id,
										})}
									/>
								</button>
								<Text
									textStyle='body'
									className='mt-2 text-gray-100 truncate overflow-ellipsis'
								>
									{flick.name}
								</Text>
							</div>
						))}
					</div>
				</div>
			)}

			{data && data.Flick.length > 0 && (
				<Button
					className='mt-4 max-w-none w-full'
					size='large'
					onClick={() => {
						setModalState({
							...modalState,
							page: 2,
						})
					}}
				>
					Continue
				</Button>
			)}

			{data && data.Flick.length === 0 && (
				<div className='flex flex-col items-center justify-center w-full h-full'>
					<div className='flex mt-auto'>
						<div className='z-0 w-32 h-32 rounded-full bg-dark-100' />
						<div className='z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl' />
						<div className='z-10 w-24 h-24 -ml-10 rounded-full bg-dark-title-200' />
					</div>
					<span className='mt-8 text-dark-title-200'>Much Empty!</span>
					<Button
						className='mt-auto max-w-none w-full'
						size='large'
						onClick={() => {
							setModalState({
								...modalState,
								existingContent: false,
							})
						}}
					>
						Create a story
					</Button>
				</div>
			)}
		</div>
	) : (
		<div
			className={cx(
				'flex flex-col mt-8 w-full',
				css`
					height: 50vh;
				`
			)}
		>
			<Text textStyle='body' className='text-dark-title-200'>
				We will create a story with {user.displayName} as a collaborator and
				send them an invite to join.
			</Text>
			<TextField
				label='Name your flick'
				value={modalState.title}
				onChange={e => {
					setModalState({
						...modalState,
						title: e.currentTarget.value,
					})
				}}
				placeholder='Story name'
				className='w-full border-none py-3 mt-1.5 focus:outline-none text-gray-100 text-sm'
			/>
			<span className='mt-4 text-size-xs font-bold tracking-wide text-gray-100 font-main'>
				Write a message to {user.displayName}
			</span>
			<textarea
				value={modalState.message}
				onChange={e =>
					setModalState({
						...modalState,
						message: e.target.value,
					})
				}
				placeholder='Type your message'
				className='w-full bg-dark-400 border focus:bg-dark-300 border-transparent rounded-md py-3 px-2 mt-1.5 focus:ring-0 focus:border-green-600 text-gray-100 text-size-sm flex-1 resize-none'
			/>
			<Button
				className='mt-6 w-full max-w-none'
				size='large'
				disabled={!modalState.title || submitting}
				loading={submitting}
				onClick={() => {
					if (!modalState.title) return
					handleSubmit()
				}}
			>
				Send Invite
			</Button>
		</div>
	)
}

const SeriesCollaboration = ({
	modalState,
	setModalState,
	user,
	handleSubmit,
	submitting,
}: {
	submitting: boolean
	handleSubmit: () => void
	modalState: CollaborateModalState
	setModalState: React.Dispatch<React.SetStateAction<CollaborateModalState>>
	user: UserFragment
}) => {
	const { user: loggedInUser } = useUser()

	// TODO: Implement pagination here
	const {
		refetch: getSeries,
		data,
		isLoading: loading,
	} = trpc.useQuery(
		[
			'series.dashboard',
			{
				limit: 25,
				offset: 0,
			},
		],
		{
			enabled: false,
		}
	)

	useEffect(() => {
		if (!data) return
		if (data.length === 0) return
		setModalState({ ...modalState, selectedSeriesId: data[0].id })
	}, [data])

	useEffect(() => {
		if (modalState.existingContent) {
			getSeries()
		}
	}, [modalState.existingContent, getSeries])

	return modalState.existingContent ? (
		<div
			className={cx(
				'flex flex-col mt-8 w-full',
				css`
					height: 50vh;
				`
			)}
		>
			<Text textStyle='body' className='text-dark-title-200'>
				Choose a series to collaborate
			</Text>

			{loading && (
				<div className='flex justify-center w-full my-12'>
					<FiLoader size={21} className='animate-spin text-dark-title-200' />
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
						{data
							.filter(series => series.ownerSub === loggedInUser?.sub)
							.map(series => (
								<div key={series.id} className='flex flex-col w-full h-full'>
									<button
										type='button'
										className='aspect-w-16 aspect-h-9'
										onClick={() =>
											setModalState({
												...modalState,
												selectedSeriesId: series.id,
											})
										}
									>
										<div
											className={cx(
												'flex items-center justify-center bg-dark-400 rounded-lg h-full w-full border-2 border-green-700 ',
												{
													'border-2 border-gray-700':
														modalState.selectedSeriesId !== series.id,
												}
											)}
										>
											<IoAlbumsOutline
												size={36}
												className='text-dark-body-100'
											/>
										</div>
									</button>
									<Text
										textStyle='body'
										className='mt-2 text-gray-100 truncate overflow-ellipsis'
									>
										{series.name}
									</Text>
								</div>
							))}
					</div>
				</div>
			)}

			{data && data.length > 0 && (
				<Button
					className='mt-4 max-w-none w-full'
					size='large'
					onClick={() => {
						setModalState({ ...modalState, page: 2 })
					}}
				>
					Continue
				</Button>
			)}

			{data && data.length === 0 && (
				<div className='flex flex-col items-center justify-center w-full h-full'>
					<div className='flex mt-auto'>
						<div className='z-0 w-32 h-32 rounded-full bg-dark-100' />
						<div className='z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl' />
						<div className='z-10 w-24 h-24 -ml-10 rounded-full bg-dark-title-200' />
					</div>
					<span className='mt-8 text-dark-title'>Much Empty!</span>
					<Button
						className='mt-auto max-w-none w-full'
						size='large'
						onClick={() => {
							setModalState({ ...modalState, existingContent: false })
						}}
					>
						Create a Series
					</Button>
				</div>
			)}
		</div>
	) : (
		<div
			className={cx(
				'flex flex-col mt-8 w-full',
				css`
					height: 50vh;
				`
			)}
		>
			<Text textStyle='body' className='text-dark-title-200'>
				We will create a series with {user.displayName} as a collaborator and
				send them an invite to join.
			</Text>
			<TextField
				label='Name your series'
				value={modalState.title}
				onChange={e => {
					setModalState({ ...modalState, title: e.currentTarget.value })
				}}
				placeholder='Series name'
				className='w-full border-none py-3 mt-1.5 focus:outline-none text-gray-100 text-sm'
			/>
			<span className='mt-4 text-size-xs font-bold tracking-wide text-gray-100 font-main'>
				Write a message to {user.displayName}
			</span>
			<textarea
				value={modalState.message}
				onChange={e =>
					setModalState({
						...modalState,
						message: e.target.value,
					})
				}
				placeholder='Type your message'
				className='w-full bg-dark-400 border focus:bg-dark-300 border-transparent rounded-md py-3 px-2 mt-1.5 focus:ring-0 focus:border-green-600 text-gray-100 text-size-sm flex-1 resize-none'
			/>
			<Button
				className='mt-6 w-full max-w-none'
				size='large'
				loading={submitting}
				disabled={!modalState.title || submitting}
				onClick={() => {
					if (!modalState.title) return
					handleSubmit()
				}}
			>
				Send Invite
			</Button>
		</div>
	)
}

const WriteMessage = ({
	user,
	modalState,
	loading,
	setModalState,
	handleSubmit,
}: {
	user: UserFragment
	loading: boolean
	handleSubmit: () => void
	modalState: CollaborateModalState
	setModalState: React.Dispatch<React.SetStateAction<CollaborateModalState>>
}) => (
	<div
		className={cx(
			'flex flex-col mt-8 w-full',
			css`
				height: 35vh;
			`
		)}
	>
		<Text textStyle='body' className='text-dark-title-200'>
			Tell {user.displayName} about you and why you&apos;d like to collaborate
		</Text>
		<span className='mt-4 text-size-xs font-bold tracking-wide text-gray-100 font-main'>
			Send a message
		</span>
		<textarea
			value={modalState.message}
			onChange={e =>
				setModalState({
					...modalState,
					message: e.target.value,
				})
			}
			placeholder='Type your message'
			className='w-full bg-dark-400 border focus:bg-dark-300 border-transparent rounded-md py-3 px-2 mt-1.5 focus:ring-0 focus:border-green-600 text-gray-100 text-size-sm flex-1 resize-none'
		/>
		<Button
			className='mt-6 w-full max-w-none'
			size='large'
			disabled={loading}
			loading={loading}
			onClick={() => handleSubmit()}
		>
			Send Invite
		</Button>
	</div>
)

interface CollaborateModalState {
	page: number
	existingContent: boolean
	selectedSeriesId: string
	selectedFlickId: string
	contentType: ContentContainerTypes
	description: string
	title: string
	message: string
}

const initialModalState: CollaborateModalState = {
	page: 0,
	existingContent: false,
	selectedSeriesId: '',
	selectedFlickId: '',
	contentType: ContentContainerTypes.Flick,
	description: '',
	title: '',
	message: '',
}

const CollaborateModal = ({
	open,
	handleClose,
	user,
}: {
	open: boolean
	handleClose: () => void
	user: UserFragment
}) => {
	const { user: loggedInUser } = useUser()
	const [modalState, setModalState] =
		useState<CollaborateModalState>(initialModalState)

	const {
		mutateAsync: collaborate,
		data,
		isLoading: loading,
	} = trpc.useMutation(['collab.invite'])

	useEffect(() => {
		if (!data) return
		emitToast('Sent collaboration invite!', {
			type: 'success',
		})
		setModalState(initialModalState)
		handleClose()
	}, [data])

	const submitCollaborationRequest = async () => {
		let params: inferMutationInput<'collab.invite'> = {
			flickId: modalState.selectedFlickId,
			senderId: loggedInUser?.sub as string,
			receiverId: user.sub,
			isNew: !modalState.existingContent,
			message: modalState.message,
		}

		if (modalState.existingContent) {
			if (modalState.contentType === ContentContainerTypes.Flick)
				params = {
					...params,
					flickId: modalState.selectedFlickId,
				}
			else
				params = {
					...params,
					seriesId: modalState.selectedSeriesId,
				}
		} else {
			params = {
				...params,
				title: modalState.title,
				isNew: true, // TODO: Verify if correct
			}
		}

		try {
			await collaborate(params)
		} catch (e) {
			emitToast('Failed to send invite.Please try again!', {
				type: 'error',
			})
		}
	}

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
				className='relative z-50'
				onClose={() => {
					setModalState(initialModalState)
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
						<Dialog.Panel className='flex flex-col items-center justify-center w-full md:max-w-[550px] p-6 bg-dark-200 rounded-sm'>
							<div className='flex gap-x-4'>
								<Avatar
									src={user.picture ?? ''}
									alt={user.displayName ?? ''}
									className='h-16 rounded-lg'
									name={user.displayName ?? ''}
								/>
								<Avatar
									src={loggedInUser?.picture ?? ''}
									alt={loggedInUser?.displayName ?? ''}
									className='h-16 rounded-lg'
									name={user.displayName ?? ''}
								/>
							</div>
							<Heading textStyle='mediumTitle' className='mt-4 text-dark-title'>
								Collaborate with {user.displayName}
							</Heading>
							{modalState.page === 0 && (
								<ChooseContent
									modalState={modalState}
									setModalState={setModalState}
								/>
							)}
							{modalState.page === 1 &&
								modalState.contentType === ContentContainerTypes.Flick && (
									<FlickCollaboration
										modalState={modalState}
										setModalState={setModalState}
										user={user}
										submitting={loading}
										handleSubmit={() => {
											submitCollaborationRequest()
										}}
									/>
								)}
							{modalState.page === 1 &&
								modalState.contentType === ContentContainerTypes.Series && (
									<SeriesCollaboration
										modalState={modalState}
										setModalState={setModalState}
										user={user}
										submitting={loading}
										handleSubmit={() => {
											submitCollaborationRequest()
										}}
									/>
								)}
							{modalState.page === 2 && (
								<WriteMessage
									user={user}
									modalState={modalState}
									setModalState={setModalState}
									loading={loading}
									handleSubmit={() => {
										submitCollaborationRequest()
									}}
								/>
							)}
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition>
	)
}

export default CollaborateModal
