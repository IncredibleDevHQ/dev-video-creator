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

import { cx } from '@emotion/css'
import { formatDistance } from 'date-fns'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { GoPrimitiveDot } from 'react-icons/go'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import Container from 'src/components/core/Container'
import Navbar from 'src/components/dashboard/Navbar'
import NotificationMessage from 'src/components/notifications/NotificationMessage'
import { NotificationMetaTypeEnum, NotificationTypeEnum } from 'utils/src/enums'
import requireAuth from 'src/utils/helpers/requireAuth'
import { Avatar, Button, Heading, Text } from 'ui/src'
import trpc, { inferQueryOutput } from '../../server/trpc'
import CollaborationRespondModal from '../../components/notifications/CollaborationResponseModal'

const Notifications = () => {
	const { push } = useRouter()

	const [allData, setAllData] =
		useState<inferQueryOutput<'user.notifications'>['notifications']>()

	const {
		data,
		isLoading: loading,
		error,
		fetchNextPage,
		refetch,
	} = trpc.useInfiniteQuery(['user.notifications', { limit: 25 }], {
		getNextPageParam: lastPage => lastPage.nextCursor,
	})

	const { mutateAsync: markAsRead } = trpc.useMutation([
		'user.readNotification',
	])
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [notification, setNotification] =
		useState<inferQueryOutput<'user.notifications'>['notifications'][number]>()

	useEffect(() => {
		if (!data) return
		const pageNumber = Number((data.pages.length / 25).toFixed(0))
		setAllData(data.pages[pageNumber > 0 ? pageNumber - 1 : 0].notifications)
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
							if (loading) return
							fetchNextPage()
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
												id: notificationData.id,
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
