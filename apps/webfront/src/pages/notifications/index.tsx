import { cx } from '@emotion/css'
import { formatDistance } from 'date-fns'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { GoPrimitiveDot } from 'react-icons/go'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import Container from 'src/components/core/Container'
import Navbar from 'src/components/dashboard/Navbar'
import NotificationMessage from 'src/components/notifications/NotificationMessage'

import { useMarkNotificationAsReadMutation } from 'src/graphql/generated'
import { NotificationMetaTypeEnum, NotificationTypeEnum } from 'src/utils/enums'
import requireAuth from 'src/utils/helpers/requireAuth'
import trpc, { inferQueryOutput } from 'server/trpc'
import { Avatar, Button, Heading, Text } from 'ui/src'
import {} from 'utils/src/graphql/generated'
import CollaborationRespondModal from '../../components/notifications/CollaborationResponseModal'

const Notifications = () => {
	const { push } = useRouter()
	const [offset, setOffset] = useState(0)

	const [allData, setAllData] =
		useState<inferQueryOutput<'user.notifications'>>()
	const {
		data,
		isLoading: loading,
		error,
		refetch,
	} = trpc.useQuery(['user.notifications', { limit: 15, offset }])

	const [markAsRead] = useMarkNotificationAsReadMutation()
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [notification, setNotification] =
		useState<inferQueryOutput<'user.notifications'>[number]>()

	useEffect(() => {
		if (!data) return
		setAllData(data)
	}, [data])

	return (
		<Container title='Incredible | Notifications'>
			<div className='flex flex-col items-center w-screen h-screen bg-dark-500 overflow-hidden'>
				<Navbar className='fixed bg-dark-500' />
				<div
					className={cx('w-full flex justify-center flex-1 overflow-y-scroll')}
					onScroll={e => {
						if (
							e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
							e.currentTarget.clientHeight
						) {
							// fetchMore({
							// 	variables: {
							// 		offset: offset + 25,
							// 	},
							// 	updateQuery: (prev, { fetchMoreResult }) => {
							// 		if (!fetchMoreResult) return prev
							// 		return {
							// 			...prev,
							// 			Notifications: [
							// 				...prev.Notifications,
							// 				...fetchMoreResult.Notifications,
							// 			],
							// 		}
							// 	},
							// })
							setOffset(offset + 25)
						}
					}}
				>
					<div className='flex flex-col flex-1 pt-16 max-w-[550px]'>
						<Heading
							textStyle='heading'
							className='p-4 mb-14 font-main text-gray-100'
						>
							Notifications
						</Heading>

						{loading && !data && (
							<SkeletonTheme color='#202020' highlightColor='#444'>
								<div className='flex-1 flex flex-col gap-8'>
									{[...Array(10).keys()].map(() => (
										<Skeleton height={60} />
									))}
								</div>
							</SkeletonTheme>
						)}
						{error && (
							<div className='flex flex-col flex-1 justify-center items-center gap-y-3 -mt-28'>
								<Text className='text-base text-gray-300'>
									Something went wrong. Please try again.
								</Text>
								<Button onClick={() => refetch()}>Retry</Button>
							</div>
						)}
						{allData &&
							allData.map(notificationData => (
								<div
									className='flex items-center rounded-md hover:bg-dark-400'
									key={notificationData.id}
								>
									<button
										type='button'
										className='flex justify-start w-full p-4 cursor-pointer gap-x-4'
										onClick={() => {
											markAsRead({
												variables: {
													id: notificationData.id,
												},
											})
											setNotification(notificationData)

											if (
												notificationData.type === NotificationTypeEnum.Event
											) {
												const meta = JSON.parse(
													JSON.stringify(notificationData.meta)
												)
												switch (notificationData.metaType) {
													case NotificationMetaTypeEnum.Follow:
														push(
															`/${notificationData.User_Notifications_senderIdToUser.username}`
														)
														break
													case NotificationMetaTypeEnum.User:
														push(
															`/${notificationData.User_Notifications_senderIdToUser.username}`
														)
														break
													case NotificationMetaTypeEnum.Flick:
														push(`/story/${meta?.flickId}`)
														break
													case NotificationMetaTypeEnum.Series:
														push(`/series/series--${meta?.seriesId}`)
														break
													default:
														break
												}
											}
											if (
												notificationData.type ===
													NotificationTypeEnum.Invitation ||
												notificationData.type === NotificationTypeEnum.Request
											) {
												setIsModalOpen(true)
											}
										}}
									>
										<Avatar
											src={
												notificationData.User_Notifications_senderIdToUser
													.picture as string
											}
											className='h-8 rounded-full'
											name={
												notificationData?.User_Notifications_senderIdToUser
													.displayName ?? ''
											}
											alt={
												notificationData?.User_Notifications_senderIdToUser
													.displayName ?? ''
											}
										/>
										<div className='flex flex-col w-full text-left'>
											<NotificationMessage notification={notificationData} />
											<Text
												textStyle='bodySmall'
												className='mt-1 text-gray-400'
											>
												{formatDistance(
													new Date(notificationData.createdAt),
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
											'!text-green-600': !notificationData.isRead,
										})}
									/>
								</div>
							))}
					</div>
				</div>
				{notification && (
					<CollaborationRespondModal
						open={isModalOpen}
						notification={notification}
						handleClose={() => {
							setIsModalOpen(false)
						}}
					/>
				)}
			</div>
		</Container>
	)
}

export const getServerSideProps = requireAuth()(async () => ({
	props: {},
}))

export default Notifications
