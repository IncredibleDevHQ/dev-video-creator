import { Dialog, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useEffect } from 'react'
import {
	MyNotificationFragment,
	Notification_Type_Enum_Enum,
	useAcceptCollaborationMutation,
} from 'src/graphql/generated'
import { Avatar, Button, emitToast, Heading, Text } from 'ui/src'

const CollaborationRespondModal = ({
	open,
	handleClose,
	notification,
}: {
	open: boolean
	handleClose: () => void
	notification: MyNotificationFragment
}) => {
	const { push } = useRouter()

	const [acceptCollaboration, { data, loading }] =
		useAcceptCollaborationMutation({
			variables: {
				inviteId: notification.meta.inviteId,
				notificationId: notification.id,
			},
		})

	const respond = async () => {
		try {
			await acceptCollaboration()
			push(`/story/${notification.meta?.flickId}`)
		} catch (e) {
			emitToast('Failed to accept collaboration', { type: 'error' })
		}
	}

	useEffect(() => {
		if (!data) return
		emitToast('Collaboration accepted', { type: 'success' })
		handleClose()
	}, [data])

	return (
		<Transition appear show={open} as={Fragment}>
			<Dialog
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
						<Dialog.Panel className='flex rounded-md flex-col w-[30%] overflow-hidden bg-dark-100 p-8'>
							<div className='flex flex-col items-center justify-center'>
								<div className='flex gap-x-4'>
									<Avatar
										src={notification.sender.picture ?? ''}
										alt={notification.sender.displayName ?? ''}
										className='rounded-lg h-16'
										name={notification.sender.displayName ?? ''}
									/>
								</div>
								<Heading
									textStyle='mediumTitle'
									className='text-gray-100 mt-8 w-full'
								>
									Collaborate with {notification.sender.displayName}
								</Heading>
								<Text
									textStyle='body'
									className='text-gray-400 mt-4'
									dangerouslySetInnerHTML={{
										__html: notification.message.replace(
											/%(.*?)%/g,
											'<span class="text-gray-100 font-main">$1</span>'
										),
									}}
								/>
								<div className='flex gap-x-4 mt-12 w-full items-center justify-center'>
									<Button
										appearance='none'
										className='max-w-none w-full text-dark-title hover:underline'
										size='large'
										onClick={() => handleClose()}
									>
										Later
									</Button>
									<Button
										size='large'
										className='max-w-none w-full'
										loading={loading}
										onClick={() => respond()}
									>
										{notification.type ===
										Notification_Type_Enum_Enum.Invitation
											? 'I am in!'
											: 'Accept'}
									</Button>
								</div>
							</div>
						</Dialog.Panel>
					</div>
				</Transition.Child>
			</Dialog>
		</Transition>
	)
}

export default CollaborationRespondModal