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

import { Dialog, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useEffect } from 'react'
import { InvitationStatusEnum, NotificationTypeEnum } from 'utils/src/enums'
import { Avatar, Button, emitToast, Heading, Text } from 'ui/src'
import trpc, { inferQueryOutput } from '../../server/trpc'

const CollaborationRespondModal = ({
	open,
	handleClose,
	notification,
}: {
	open: boolean
	handleClose: () => void
	notification: inferQueryOutput<'user.notifications'>['notifications'][number]
}) => {
	const { push } = useRouter()

	const {
		mutateAsync: acceptCollaboration,
		data,
		isLoading: loading,
	} = trpc.useMutation(['collab.respond'])

	const respond = async () => {
		try {
			const meta = JSON.parse(JSON.stringify(notification.meta))
			await acceptCollaboration({
				inviteId: JSON.parse(JSON.stringify(notification.meta))?.inviteId,
				nid: notification.id,
				status: InvitationStatusEnum.Accepted,
			})
			push(`/story/${meta?.flickId}`)
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
							<div className='flex flex-col items-center justify-center text-center'>
								<div className='flex gap-x-4'>
									<Avatar
										src={
											notification.User_Notifications_senderIdToUser.picture ??
											''
										}
										alt={
											notification.User_Notifications_senderIdToUser
												.displayName ?? ''
										}
										className='rounded-lg h-16'
										name={
											notification.User_Notifications_senderIdToUser
												.displayName ?? ''
										}
									/>
								</div>
								<Heading
									textStyle='mediumTitle'
									className='text-gray-100 mt-8 w-full'
								>
									Collaborate with{' '}
									{notification.User_Notifications_senderIdToUser.displayName}
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
								<div className='flex flex-col gap-y-4 mt-12 w-full items-center justify-center'>
									<Button
										size='large'
										className='max-w-none w-full'
										loading={loading}
										onClick={() => respond()}
									>
										{notification.type === NotificationTypeEnum.Invitation
											? 'I am in!'
											: 'Accept'}
									</Button>
									<Button
										appearance='none'
										className='max-w-none w-full text-dark-title hover:underline'
										size='large'
										onClick={() => handleClose()}
									>
										Later
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
