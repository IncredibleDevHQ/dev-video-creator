import { css, cx } from '@emotion/css'
import { Dialog, Menu, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import {
	IoChevronDownOutline,
	IoChevronUpOutline,
	IoCloseOutline,
} from 'react-icons/io5'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	CollaborationTypes,
	ContentContainerTypes,
	Participant_Role_Enum_Enum,
	useCollaborateWithUserMutation,
	useEmailInviteGuestUserMutation,
	useGetFlickParticipantsLazyQuery,
	useGetPendingInvitesQuery,
	useRemoveFlickParticipantMutation,
	useTransferFlickOwnershipMutation,
} from 'src/graphql/generated'
import {
	flickAtom,
	flickNameAtom,
	participantsAtom,
} from 'src/stores/flick.store'
import { useUser } from 'src/utils/providers/auth'
import {
	Avatar,
	Button,
	dismissToast,
	emitToast,
	Heading,
	Text,
	updateToast,
} from 'ui/src'

interface Invitee {
	name: string
	role: Participant_Role_Enum_Enum
	email: string
	sub: string
	image?: string
}

const customScroll = css`
	::-webkit-scrollbar {
		width: 18px;
	}
	::-webkit-scrollbar-track {
		background-color: transparent;
	}
	::-webkit-scrollbar-thumb {
		background-color: #d6dee1;
		border-radius: 20px;
		border: 6px solid transparent;
		background-clip: content-box;
	}
	::-webkit-scrollbar-thumb:hover {
		background-color: #a8bbbf;
	}
`

const AccessControl = ({
	isOwner,
	participantSub,
	participantId,
	isInvitee,
	refetch,
}: {
	participantSub: string
	participantId: string
	isOwner: boolean
	isInvitee: boolean
	refetch: () => void
}) => {
	const [flick, setFlick] = useRecoilState(flickAtom)

	const [removeParticipant, { data: removeData }] =
		useRemoveFlickParticipantMutation()

	const [transferOwnership, { data: transferData }] =
		useTransferFlickOwnershipMutation()

	useEffect(() => {
		if (removeData || transferData) {
			refetch()
		}
	}, [refetch, removeData, transferData])

	const handleRemoval = async (userId: string) => {
		const toast = emitToast('Removing participant...', {
			type: 'info',
		})
		try {
			await removeParticipant({
				variables: {
					flickId: flick?.id,
					userId,
				},
			})
			updateToast(toast, 'Participant removed', {
				type: 'success',
			})
		} catch (e) {
			dismissToast(toast)
			emitToast('Could not delete participant', {
				type: 'error',
			})
		}
	}

	const handleTransfer = async (pId: string, userId: string) => {
		const toast = emitToast('Transferring ownership...', {
			type: 'info',
		})
		try {
			await transferOwnership({
				variables: {
					flickId: flick?.id,
					newOwnerId: pId,
				},
			})
			if (flick) {
				setFlick({
					...flick,
					owner: {
						id: pId,
						sub: userId,
					},
				})
			}
			updateToast(toast, 'Ownership transferred', {
				type: 'success',
			})
			setTimeout(() => {
				dismissToast(toast)
			}, 3000)
		} catch (e) {
			dismissToast(toast)
			emitToast('Could not transfer ownership', {
				type: 'error',
			})
		}
	}

	return (
		<Menu>
			{({ open }) => (
				<div className='relative mt-1'>
					<Menu.Button
						disabled={participantSub === flick?.owner?.sub || !isOwner}
						className={cx(
							'w-full flex items-center justify-end pr-0 relative ml-3 text-gray-600',
							{
								'pr-5': participantSub !== flick?.owner?.sub && isOwner,
							}
						)}
					>
						<Text textStyle='caption' className='font-body'>
							{participantSub === flick?.owner?.sub ? 'Owner' : 'Contributor'}
						</Text>
						{participantSub !== flick?.owner?.sub && isOwner && (
							<span className='absolute inset-y-0 right-0 flex items-center pointer-events-none text-gray-600 mt-px'>
								{open ? (
									<IoChevronUpOutline size={14} />
								) : (
									<IoChevronDownOutline size={14} />
								)}
							</span>
						)}
					</Menu.Button>
					<Menu.Items className='absolute flex flex-col text-left bg-dark-300 bg-opacity-100 z-50 rounded-sm w-full mt-2 p-1 ml-1'>
						{!isInvitee && (
							<>
								<Menu.Item
									as='button'
									onClick={() => {
										handleTransfer(participantId, participantSub)
									}}
								>
									{({ active }) => (
										<div
											className={cx(
												'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer mt-1 rounded-sm',
												{
													'bg-dark-100': active,
												}
											)}
										>
											<Text className='text-xs'>Owner</Text>
											{participantSub === flick?.owner?.sub && (
												<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
													<BiCheck size={20} />
												</span>
											)}
										</div>
									)}
								</Menu.Item>
								<Menu.Item>
									{({ active }) => (
										<div
											className={cx(
												'flex items-center gap-x-4 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer py-1.5 rounded-sm',
												{
													'bg-dark-100': active,
												}
											)}
										>
											<Text textStyle='caption'>Contributor</Text>
											{participantSub !== flick?.owner?.sub && (
												<span className='absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none'>
													<BiCheck size={20} />
												</span>
											)}
										</div>
									)}
								</Menu.Item>
								<hr className='mx-2 my-1 border-t border-gray-500' />
							</>
						)}
						<Menu.Item
							as='button'
							onClick={() => {
								handleRemoval(participantSub)
							}}
						>
							{({ active }) => (
								<div
									className={cx(
										'flex items-center gap-x-4 py-1.5 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer rounded-sm',
										{
											'bg-dark-100': active,
											'mb-1': !isInvitee,
										}
									)}
								>
									<Text textStyle='caption'>Remove</Text>
								</div>
							)}
						</Menu.Item>
					</Menu.Items>
				</div>
			)}
		</Menu>
	)
}

const Invite = ({
	open,
	handleClose,
}: {
	open: boolean
	handleClose: () => void
}) => {
	const flick = useRecoilValue(flickAtom)
	const flickName = useRecoilValue(flickNameAtom)

	const setParticipants = useSetRecoilState(participantsAtom)

	const { user } = useUser()

	const [inviteLoading, setInviteLoading] = useState(false)
	const [isOwner, setIsOwner] = useState(false)
	const [invitee, setInvitee] = useState<Invitee>({
		name: '',
		role: Participant_Role_Enum_Enum.Viewer,
		email: '',
		sub: '',
	})

	const [search, setSearch] = useState<string>('')

	const { data: pendingInvites, refetch } = useGetPendingInvitesQuery({
		variables: {
			flickId: flick?.id,
		},
	})

	const [addMemberToFlickMutation] = useCollaborateWithUserMutation()

	const [inviteGuestMember] = useEmailInviteGuestUserMutation()

	const validateEmail = (email: string) =>
		String(email)
			.toLowerCase()
			.match(
				/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
			)

	const handleAddMember = async () => {
		try {
			setInviteLoading(true)
			// regex to check if input email
			if (validateEmail(search)) {
				await inviteGuestMember({
					variables: {
						email: search,
						flickId: flick?.id as string,
					},
				})
			} else {
				await addMemberToFlickMutation({
					variables: {
						flickId: flick?.id,
						collaborationType: CollaborationTypes.Invite,
						isNew: false,
						senderId: flick?.owner?.sub as string,
						receiverId: invitee.sub,
						contentType: ContentContainerTypes.Flick,
						message: `%${user?.displayName}% has invited you to collaborate on the flick ${flickName}`,
					},
				})
			}
			setSearch('')
			setInvitee(prev => ({ ...prev, email: '', name: '', sub: '' }))
			refetch()
			emitToast('User Invited', {
				type: 'success',
			})
		} catch (error) {
			emitToast('Error inviting user', {
				type: 'error',
			})
		} finally {
			setInviteLoading(false)
		}
	}

	const [getFlickParticipants, { data: participantsData }] =
		useGetFlickParticipantsLazyQuery({
			fetchPolicy: 'cache-and-network',
			variables: {
				flickId: flick?.id as string,
			},
		})

	useEffect(() => {
		if (!participantsData) return
		setIsOwner(flick?.owner?.sub === user?.uid)
		setParticipants(participantsData.Participant)
	}, [flick?.owner, participantsData, setParticipants, user?.uid])

	useEffect(() => {
		getFlickParticipants()
	}, [getFlickParticipants])

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
				className={cx(
					'fixed z-10 inset-0 w-2/5 m-auto overflow-y-scroll',
					customScroll
				)}
				style={{
					padding: '0',
					minHeight: '250px',
					maxHeight: '60vh',
					maxWidth: '600px',
				}}
				onClose={() => handleClose()}
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
					<Dialog.Panel className='flex flex-col min-h-32 w-full relative bg-white rounded-sm'>
						<Heading
							textStyle='smallTitle'
							className='px-5 py-3 text-gray-800 font-bold'
						>
							Invite
						</Heading>
						<hr className='border-t border-gray-300' />
						<div className='flex items-center my-4 px-5 w-full'>
							{invitee.sub ? (
								<div className='flex items-center w-full text-xs font-body gap-x-2 bg-gray-100 py-1.5 rounded-sm px-4 border justify-between'>
									<div className='flex items-center gap-x-2'>
										<Avatar
											className='w-8 h-8 rounded-full'
											name={invitee.name}
											alt={invitee.name}
											src={invitee.image ?? ''}
										/>
										{invitee.name}
									</div>
									<IoCloseOutline
										size={18}
										className='cursor-pointer'
										onClick={() => {
											setInvitee(prev => ({
												...prev,
												sub: '',
												name: '',
												email: '',
											}))
										}}
									/>
								</div>
							) : (
								<input
									placeholder='dumbledore@hogwarts.com'
									className='w-full border focus:border-green-600 py-2 px-2 bg-gray-100 rounded-sm font-body focus:outline-none text-size-xs flex-1'
								/>
							)}

							<Button
								className='col-span-1 ml-2'
								colorScheme='green'
								disabled={
									!validateEmail(search)
										? invitee.name.length === 0 || !isOwner
										: false
								}
								loading={inviteLoading}
								onClick={() => {
									handleAddMember()
								}}
							>
								Invite
							</Button>
						</div>
						<div
							className={cx(
								'flex flex-col px-5 pb-8 overflow-y-scroll h-full',
								customScroll
							)}
						>
							{participantsData?.Participant.map(participant => (
								<div
									className='grid items-center grid-cols-4'
									key={participant.id}
								>
									<div className='flex flex-row items-center col-span-3 my-1.5'>
										<Avatar
											className='w-7 h-7 rounded-full'
											name={participant.user.displayName ?? ''}
											alt={participant.user.displayName ?? ''}
											src={participant.user.picture ?? ''}
										/>
										<Text
											textStyle='caption'
											className='ml-2 font-body text-gray-800'
										>
											{participant.user.displayName}
										</Text>
									</div>
									<AccessControl
										isOwner={isOwner}
										participantSub={participant.userSub}
										participantId={participant.id}
										isInvitee={false}
										refetch={() => getFlickParticipants()}
									/>
								</div>
							))}

							{pendingInvites?.Invitations?.map(pendingInvitee => (
								<div
									className='grid items-center grid-cols-4'
									key={pendingInvitee.receiver.sub}
								>
									<div className='flex items-center text-size-xs font-body my-1 gap-x-2 text-gray-400 col-span-3'>
										<div className='h-7 w-7 rounded-full bg-gray-100 border border-gray-300' />
										{pendingInvitee.receiver.email ===
										pendingInvitee.receiver.sub
											? pendingInvitee.receiver.email
											: pendingInvitee.receiver.displayName}
									</div>
									<AccessControl
										isOwner={isOwner}
										participantSub={pendingInvitee.receiver.sub}
										participantId={pendingInvitee.receiver.sub}
										isInvitee
										refetch={() => refetch()}
									/>
								</div>
							))}
						</div>
					</Dialog.Panel>
				</Transition.Child>
			</Dialog>
		</Transition>
	)
}

export default Invite
