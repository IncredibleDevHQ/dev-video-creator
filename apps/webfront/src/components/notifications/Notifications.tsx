import { css, cx } from '@emotion/css'
import { Popover, Transition } from '@headlessui/react'
import { formatDistance } from 'date-fns'
import { useRouter } from 'next/router'
import React, { Fragment, useEffect, useState } from 'react'
import { GoPrimitiveDot } from 'react-icons/go'
import {
	IoNotifications,
	IoNotificationsOutline,
	IoSyncOutline,
} from 'react-icons/io5'
import {
	MyNotificationFragment,
	Notification_Meta_Type_Enum_Enum,
	Notification_Type_Enum_Enum,
	useGetMyNotificationsLazyQuery,
	useMarkAllNotificationsAsReadMutation,
	useMarkNotificationAsReadMutation,
	useMyUnreadNotificationsCountSubscription,
} from 'src/graphql/generated'
import { Avatar, Button, Text } from 'ui/src'
import CollaborationRespondModal from './CollaborationResponseModal'

export const NotificationMessage = ({
	notification,
}: {
	notification: MyNotificationFragment
}) => {
	const { message } = notification
	const regex = /%(.*?)%/g
	return (
		<Text
			textStyle='caption'
			className='text-gray-400'
			dangerouslySetInnerHTML={{
				__html: message.replace(
					regex,
					'<span class="text-gray-100 font-main">$1</span>'
				),
			}}
		/>
	)
}

const NotificationsList = ({
	isNotificationsOpen,
	close,
	setIsCollaborateRespondModalOpen,
	setNotification,
}: {
	isNotificationsOpen: boolean
	close: () => void
	setIsCollaborateRespondModalOpen: (open: boolean) => void
	setNotification: (notification: MyNotificationFragment) => void
}) => {
	const [getNotifications, { data, error, loading }] =
		useGetMyNotificationsLazyQuery({
			fetchPolicy: 'cache-and-network',
		})

	const [markAsRead] = useMarkNotificationAsReadMutation()
	const [markAllAsRead] = useMarkAllNotificationsAsReadMutation()
	const { push } = useRouter()

	useEffect(
		() => () => {
			markAllAsRead()
		},
		[]
	)

	useEffect(() => {
		if (isNotificationsOpen) {
			getNotifications()
		}
	}, [isNotificationsOpen])

	return (
		<div
			className={cx(
				'flex flex-col bg-dark-200 rounded-md',
				css`
					min-width: 350px;
					max-width: 350px;
					max-height: 50vh;
				`
			)}
		>
			{error && (
				<div
					className={cx('flex flex-col items-center justify-center mt-2', {
						'mb-2': !data,
					})}
				>
					<Text className='text-dark-body-200'>
						Could not fetch notifications
					</Text>
					<Text className='underline text-dark-title'>Retry</Text>
				</div>
			)}
			{loading && (
				<div
					className={cx('flex justify-center mt-2', {
						'mb-2': !data,
					})}
				>
					<IoSyncOutline className='text-dark-title animate-spin' />
				</div>
			)}
			{data && data.Notifications.length === 0 && (
				<div className='flex items-center justify-center flex-1 my-12'>
					<Text className='italic text-gray-200'>
						You do not have any notifications
					</Text>
				</div>
			)}
			<div
				className={cx(
					'flex-1 overflow-scroll p-1.5',
					css`
						-ms-overflow-style: none;
						scrollbar-width: none;
						::-webkit-scrollbar {
							display: none;
						}
					`
				)}
			>
				{data &&
					data.Notifications.map(notification => (
						<div
							className='flex items-center hover:bg-dark-100 rounded-md'
							key={notification.id}
						>
							<button
								type='button'
								className='flex justify-start w-full p-3 cursor-pointer gap-x-4'
								onClick={() => {
									markAsRead({
										variables: {
											id: notification.id,
										},
									})
									setNotification(notification)
									close()
									if (notification.type === Notification_Type_Enum_Enum.Event) {
										switch (notification.metaType) {
											case Notification_Meta_Type_Enum_Enum.Follow:
												push(`/${notification.sender.username}`)
												break
											case Notification_Meta_Type_Enum_Enum.User:
												push(`/${notification.sender.username}`)
												break
											case Notification_Meta_Type_Enum_Enum.Flick:
												push(`/story/${notification.meta?.flickId}`)
												break
											case Notification_Meta_Type_Enum_Enum.Series:
												push(`/series/series--${notification.meta?.seriesId}`)
												break
											default:
												break
										}
									}
									if (
										notification.type ===
											Notification_Type_Enum_Enum.Invitation ||
										notification.type === Notification_Type_Enum_Enum.Request
									) {
										setIsCollaborateRespondModalOpen(true)
									}
								}}
							>
								<Avatar
									src={notification.sender.picture as string}
									className='h-8 rounded-full'
									name={notification?.sender.displayName ?? ''}
									alt={notification?.sender.displayName ?? ''}
								/>
								<div className='flex flex-col w-full text-left'>
									<NotificationMessage notification={notification} />
									<Text textStyle='bodySmall' className='mt-1 text-gray-400'>
										{formatDistance(
											new Date(notification.createdAt),
											new Date(),
											{
												addSuffix: true,
											}
										)}
									</Text>
								</div>
							</button>
							<GoPrimitiveDot
								className={cx('text-transparent mr-3', {
									'!text-green-600': !notification.isRead,
								})}
							/>
						</div>
					))}
			</div>
			{data && data.Notifications.length >= 15 && (
				<div className='flex items-center justify-center w-full py-2 border-t border-dark-100'>
					<Button colorScheme='dark' onClick={() => push('/notifications')}>
						See all
					</Button>
				</div>
			)}
		</div>
	)
}

const Notifications = () => {
	const [isCollaborateRespondModalOpen, setIsCollaborateRespondModalOpen] =
		useState(false)
	const [notification, setNotification] = useState<MyNotificationFragment>()

	const { data } = useMyUnreadNotificationsCountSubscription()

	return (
		<Popover>
			{({ open, close }) => (
				<>
					<Popover.Button
						as='button'
						className='relative cursor-pointer flex items-center'
					>
						{data && data.Notifications_aggregate.aggregate?.count !== 0 && (
							<GoPrimitiveDot
								className={cx(
									'text-red-500 absolute top-0 right-0 -mt-2 -mr-1.5 block'
								)}
								size={21}
							/>
						)}
						{open ? (
							<IoNotifications
								className='rounded-full text-gray-200'
								size={24}
							/>
						) : (
							<IoNotificationsOutline
								className='rounded-full text-gray-200'
								size={24}
							/>
						)}
						{notification && (
							<CollaborationRespondModal
								open={isCollaborateRespondModalOpen}
								notification={notification}
								handleClose={() => {
									setIsCollaborateRespondModalOpen(false)
								}}
							/>
						)}
					</Popover.Button>
					<Transition
						as={Fragment}
						enter='transition ease-out duration-100'
						enterFrom='transform opacity-0 scale-95'
						enterTo='transform opacity-100 scale-100'
						leave='transition ease-in duration-75'
						leaveFrom='transform opacity-100 scale-100'
						leaveTo='transform opacity-0 scale-95'
					>
						<Popover.Panel as='div' className='absolute right-[75px] mt-4'>
							<NotificationsList
								isNotificationsOpen={open}
								close={close}
								setIsCollaborateRespondModalOpen={
									setIsCollaborateRespondModalOpen
								}
								setNotification={setNotification}
							/>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	)
}

export default Notifications
