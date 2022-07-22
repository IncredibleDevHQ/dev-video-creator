/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/jsx-props-no-spreading */
import { css, cx } from '@emotion/css'
import {
	differenceInMonths,
	format,
	formatDistance,
	intervalToDuration,
} from 'date-fns'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FiUser } from 'react-icons/fi'
import {
	PublicSeriesFlickFragment,
	SeriesFlickFragment,
	SeriesFragmentFragment,
	SeriesParticipantFragment,
	useCheckFollowQuery,
	useFollowMutation,
	UserFragment,
	useUnfollowMutation,
} from 'src/graphql/generated'

import Link from 'next/link'
import SEO from 'src/components/core/SEO'
import Navbar from 'src/components/dashboard/Navbar'
import { useUser } from 'src/utils/providers/auth'
import sdk from 'src/utils/sdk'
import { Avatar, Button, Heading, Text } from 'ui/src'
import CreateFlickModal from 'src/components/dashboard/CreateFlickModal'
import CollaborateModal from 'src/components/profile/CollaborateModal'

const FlickCard = ({
	flick,
	isOwner,
}: {
	flick: Partial<PublicSeriesFlickFragment> &
		Partial<SeriesFlickFragment['flick']>
	isOwner?: boolean
}) => {
	const duration = flick.duration
		? intervalToDuration({ start: 0, end: flick.duration * 1000 })
		: undefined

	const getThumbnail = (() => {
		if (flick.contents && flick.contents.length > 0) {
			const contentWithThumbnail = flick.contents?.find(
				content => !!content.thumbnail
			)
			if (contentWithThumbnail?.thumbnail) {
				return `${process.env.NEXT_PUBLIC_CDN_URL}${contentWithThumbnail.thumbnail}`
			}
			return '/card_fallback.png'
		}
		if (flick.thumbnail) {
			return `${process.env.NEXT_PUBLIC_CDN_URL}${flick.thumbnail}`
		}
		return '/card_fallback.png'
	})()

	return (
		<Link passHref href={`/watch/${flick.joinLink}`}>
			<div className='cursor-pointer bg-dark-500 rounded-md overflow-hidden'>
				<div className='relative'>
					<div className='aspect-w-5 aspect-h-3'>
						<img
							src={getThumbnail}
							alt={flick.name}
							className='object-cover w-full h-full'
						/>
					</div>
					{!isOwner && (
						<span className='bg-yellow-600 bg-opacity-10 text-yellow-600 flex items-center justify-center px-2 py-1 rounded-sm absolute top-2 right-2 text-size-xs font-main font-semibold backdrop-blur-3xl'>
							<FiUser size={12} className='mr-1' />
							Collaborator
						</span>
					)}
					{duration && (
						<span className='absolute p-1 px-2 text-xs tracking-wide rounded-md shadow-sm bottom-3 right-3 bg-dark-200'>
							{duration.minutes}:{duration.seconds}
						</span>
					)}
				</div>
				<div className='p-4'>
					<Heading textStyle='smallTitle' className='text-start'>
						{flick.name}
					</Heading>
					<div className='flex justify-between items-center mt-2'>
						<time className='flex justify-end text-size-xs font-normal text-dark-title-200 font-body'>
							{differenceInMonths(
								new Date(),
								new Date(flick.contents?.[0].published_at)
							) < 1
								? formatDistance(
										new Date(flick.contents?.[0].published_at),
										new Date(),
										{
											addSuffix: true,
										}
								  )
								: format(
										new Date(flick.contents?.[0].published_at),
										'do MMM yyyy'
								  )}
						</time>
						<div className='flex justify-end'>
							{flick.participants?.slice(0, 5).map(participant => (
								<Link href={`/${participant.user.username}`}>
									<div
										key={participant.id}
										className={cx(
											'border-2 w-7 h-7 rounded-full overflow-hidden -ml-2 border-dark-300'
										)}
										data-tip={
											participant.id === flick.ownerId ? 'Host' : 'Collaborator'
										}
										data-effect='solid'
										data-place='bottom'
									>
										<Avatar
											src={participant.user.picture ?? ''}
											alt={participant.user.displayName ?? ''}
											className='cursor-pointer'
											name={participant.user.displayName ?? ''}
										/>
									</div>
								</Link>
							))}
							{flick.participants && flick.participants.length > 5 && (
								<div className='flex items-center justify-center -ml-2 rounded-full bg-dark-200 w-7 h-7'>
									<span className='text-size-xxs text-dark-title'>
										+{flick.participants.length - 5}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</Link>
	)
}

const Flicks = ({
	flicks,
	user,
}: {
	flicks: PublicSeriesFlickFragment[]
	user: UserFragment
}) => (
	<div className='my-6'>
		<div className='grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6'>
			{flicks.map(flick => (
				<FlickCard
					key={flick.id}
					flick={flick}
					isOwner={flick?.owner?.userSub === user?.sub}
				/>
			))}
		</div>
	</div>
)

const centerXCSS = css`
	left: 50%;
	transform: translateX(-50%);
`

const SeriesCard = ({ series }: { series: SeriesFragmentFragment }) => {
	const getThumbnails = useCallback(
		() =>
			series?.Flick_Series?.filter(
				({ flick }) => !!flick?.contents.find(({ thumbnail }) => !!thumbnail)
			)
				.sort(
					(a, b) =>
						new Date(b.flick?.contents[0].published_at).getTime() -
						new Date(a.flick?.contents[0].published_at).getTime()
				)
				.map(({ flick }) => {
					if (flick?.contents?.[0]?.thumbnail)
						return flick.contents[0].thumbnail
					return ''
				}),
		[series]
	)

	const thumbnails = getThumbnails()

	const imageRef = useRef<HTMLImageElement>(null)
	const divRef = useRef<HTMLDivElement>(null)

	const [mainImageWidth, setMainImageWidth] = useState(0)

	useEffect(() => {
		setMainImageWidth(
			imageRef.current?.getBoundingClientRect().width ||
				divRef.current?.clientWidth ||
				0
		)
	}, [
		imageRef.current?.getBoundingClientRect().width,
		divRef.current?.clientWidth,
	])

	return (
		<Link passHref href={`/series/${series.id}`}>
			<div className='cursor-pointer bg-dark-500 rounded-md'>
				<div className='aspect-w-6 aspect-h-4 relative'>
					<div className='flex items-center justify-center absolute overflow-hidden w-full h-full px-4'>
						{thumbnails?.[2] ? (
							<img
								src={`${process.env.NEXT_PUBLIC_CDN_URL}${thumbnails?.[2]}`}
								alt={series.name}
								style={{
									width: mainImageWidth / 1.35,
								}}
								className={cx(
									'object-cover w-auto h-full absolute top-3 rounded-md border border-dark-400',
									centerXCSS
								)}
							/>
						) : (
							<div
								style={{
									width: mainImageWidth / 1.35,
								}}
								className={cx(
									'object-cover w-2/5 h-full absolute top-3 rounded-md bg-dark-200 border border-dark-400',
									centerXCSS
								)}
							/>
						)}
						{thumbnails?.[1] ? (
							<img
								src={`${process.env.NEXT_PUBLIC_CDN_URL}${thumbnails?.[1]}`}
								alt={series.name}
								style={{
									width: mainImageWidth / 1.12,
								}}
								className={cx(
									'object-cover w-auto h-full absolute top-7 rounded-md border border-dark-400',
									centerXCSS
								)}
							/>
						) : (
							<div
								style={{
									width: mainImageWidth / 1.12,
								}}
								className={cx(
									'object-cover w-3/5 h-full absolute top-7 rounded-md bg-dark-200 border border-dark-400',
									centerXCSS
								)}
							/>
						)}
						<div className='aspect-w-16 aspect-h-9 w-full mt-auto'>
							{thumbnails?.[0] ? (
								<img
									ref={imageRef}
									src={`${process.env.NEXT_PUBLIC_CDN_URL}${thumbnails?.[0]}`}
									alt={series.name}
									className={cx(
										'object-cover w-full h-full rounded-md border border-dark-400',
										centerXCSS
									)}
								/>
							) : (
								<div
									ref={divRef}
									className={cx(
										'object-cover w-full h-full rounded-md bg-dark-200 border border-dark-400',
										centerXCSS
									)}
								/>
							)}
						</div>
					</div>
				</div>
				<div className='p-4'>
					<Heading textStyle='smallTitle' className='text-start'>
						{series.name}
					</Heading>
					<div className='flex justify-between items-center mt-2'>
						<time className='flex justify-end text-size-xs font-normal text-dark-title-200 font-body'>
							{differenceInMonths(new Date(), new Date(series.createdAt)) < 1
								? formatDistance(new Date(series.createdAt), new Date(), {
										addSuffix: true,
								  })
								: format(new Date(series.createdAt), 'do MMM yyyy')}
						</time>
						<div className='flex justify-end'>
							{(() => {
								let collaborators: SeriesParticipantFragment[] = []
								series?.Flick_Series?.forEach(flick => {
									flick?.flick?.participants?.forEach(participant => {
										collaborators.push({ ...participant })
									})
								})
								collaborators = [
									...new Map(
										collaborators.map(collaborator => [
											collaborator.user.sub,
											collaborator,
										])
									).values(),
								]

								return (
									<>
										{collaborators
											.slice(0, 5)
											.filter((v, i, a) => a.indexOf(v) === i)
											.map(participant => (
												<Link href={`/${participant.user.username}`}>
													<div
														key={participant.id}
														className={cx(
															'border-2 w-7 h-7 rounded-full overflow-hidden -ml-2 border-dark-300'
														)}
														data-tip={
															participant.id === series.owner.sub
																? 'Host'
																: 'Collaborator'
														}
														data-effect='solid'
														data-place='bottom'
													>
														<Avatar
															src={participant.user.picture ?? ''}
															alt={participant.user.displayName ?? ''}
															className='cursor-pointer'
															name={participant.user.displayName ?? ''}
														/>
													</div>
												</Link>
											))}
										{collaborators.length > 5 && (
											<div className='flex items-center justify-center -ml-2 rounded-full bg-dark-200 w-7 h-7'>
												<span className='text-size-xxs text-dark-title'>
													+{collaborators.length - 5}
												</span>
											</div>
										)}
									</>
								)
							})()}
						</div>
					</div>
				</div>
			</div>
		</Link>
	)
}

const Series = ({ series }: { series: SeriesFragmentFragment[] }) => {
	const filteredSeries = useCallback(
		() =>
			series.filter(
				({ Flick_Series }) =>
					!!Flick_Series.find(({ flick }) => (flick?.contents.length ?? -1) > 0)
			),
		[series]
	)

	return (
		<div className='my-6'>
			<div className='grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6'>
				{filteredSeries().map(singleSeries => (
					<SeriesCard key={singleSeries.id} series={singleSeries} />
				))}
			</div>
		</div>
	)
}

const ProfileCard = ({
	user,
	setOpenCollaborateModal,
}: {
	user: UserFragment
	setOpenCollaborateModal: (val: boolean) => void
}) => {
	const { user: loggedInUser } = useUser()
	const [isFollowing, setIsFollowing] = useState(false)
	const router = useRouter()

	const [follow, { data: performFollowData, loading }] = useFollowMutation({
		variables: {
			followerId: loggedInUser?.uid as string,
			targetId: user.sub,
		},
	})

	const [unfollow, { data: performUnfollowData, loading: unfollowLoading }] =
		useUnfollowMutation({
			variables: {
				followerId: loggedInUser?.uid as string,
				targetId: user.sub,
			},
		})

	const { data } = useCheckFollowQuery({
		variables: {
			followerId: loggedInUser?.uid as string,
			targetId: user.sub,
		},
	})

	useEffect(() => {
		if (!performFollowData) return
		setIsFollowing(true)
	}, [performFollowData])

	useEffect(() => {
		if (!data) return
		if (data.Follow.length > 0) setIsFollowing(true)
	}, [data])

	useEffect(() => {
		if (!performUnfollowData) return
		setIsFollowing(false)
	}, [performUnfollowData])

	const getUserPicture = () => {
		if (user.picture?.includes('googleusercontent')) {
			const userPic = user.picture.split('=')
			return userPic.join('')
		}
		return user.picture ?? ''
	}

	return (
		<div className=' bg-dark-400 w-full rounded-lg p-2 md:px-0 md:py-6 text-white'>
			<div className='flex flex-col md:flex-row justify-between items-start md:items-center'>
				<div className='flex justify-start items-center'>
					<Avatar
						src={getUserPicture()}
						alt={user.displayName ?? ''}
						className='w-24 h-24 md:w-32 md:h-32 rounded-full object-cover'
						name={user.displayName ?? ''}
					/>
					<div className='ml-6'>
						<Heading as='h1' textStyle='heading' className='font-bold mt-6'>
							{user.displayName}
						</Heading>
						<Text textStyle='body' className='text-dark-title'>
							@{user.username}
						</Text>
					</div>
				</div>
				{user.sub !== loggedInUser?.uid && (
					<div className='mt-4 md:mt-0 flex justify-start md:justify-end items-start md:items-center gap-x-2'>
						{!isFollowing ? (
							<Button
								colorScheme='dark'
								size='large'
								loading={loading}
								onClick={() => {
									if (!loggedInUser) {
										router.push(
											`/login?redirect='${encodeURIComponent(
												window.location.href
											)}`
										)
									} else {
										follow()
									}
								}}
							>
								Follow
							</Button>
						) : (
							<Button
								appearance='none'
								size='large'
								className='border border-dark-100 !px-4 !py-2.5'
								loading={unfollowLoading}
								onClick={() => {
									unfollow()
								}}
							>
								Following
							</Button>
						)}
						<Button
							size='large'
							onClick={() => {
								if (!loggedInUser) {
									router.push(
										`/login?redirect='${encodeURIComponent(
											window.location.href
										)}`
									)
								} else {
									setOpenCollaborateModal(true)
								}
							}}
						>
							Collaborate
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}

const EmptyProfile = ({
	user,
	type,
	setIsCreateFlickOpen,
	setOpenCollaborateModal,
}: {
	user: UserFragment
	type: 'stories' | 'series'
	setIsCreateFlickOpen: (val: boolean) => void
	setOpenCollaborateModal: (val: boolean) => void
}) => {
	const { user: authUser } = useUser()
	const router = useRouter()

	return (
		<div className='flex flex-col items-center justify-center flex-1 w-full my-32 ml-auto mr-4'>
			<div className='flex'>
				<div className='h-32 w-32 bg-[#2E2F3466] rounded-full z-0' />
				<div className='z-20 w-32 h-32 -ml-32 rounded-full backdrop-filter backdrop-blur-xl' />
				<div className='z-10 w-24 h-24 -ml-10 rounded-full bg-dark-title-200' />
			</div>
			<Heading textStyle='mediumTitle' className='mt-8 text-gray-50'>
				{authUser?.uid === user.sub
					? `You dont have any ${type} yet!`
					: `${user.displayName} doesn't have any ${type} yet!`}
			</Heading>
			<Text textStyle='body' className='mt-2 text-gray-300'>
				{authUser?.uid === user.sub ? (
					<span className='flex flex-col items-center'>
						<span>Create a story or a series of stories to</span>
						<span>view them here.</span>
					</span>
				) : (
					<span className='flex flex-col items-center'>
						<span>
							Collaborate with them on a story or series now to be their
						</span>
						<span>first collaborator!</span>
					</span>
				)}
			</Text>
			<Button
				size='large'
				className='mt-4'
				onClick={() => {
					if (!authUser) {
						router.push(
							`/login?redirect='${encodeURIComponent(window.location.href)}`
						)
					} else if (authUser?.uid === user.sub) {
						setIsCreateFlickOpen(true)
					} else {
						setOpenCollaborateModal(true)
					}
				}}
			>
				{authUser?.uid === user.sub ? 'Create Story' : 'Collaborate'}
			</Button>
		</div>
	)
}

enum ViewType {
	story = 'Story',
	series = 'Series',
}

const Views = ({
	user,
	series,
	flicks,
	setIsCreateFlickOpen,
	setOpenCollaborateModal,
}: InferGetServerSidePropsType<typeof getServerSideProps> & {
	setIsCreateFlickOpen: (val: boolean) => void
	setOpenCollaborateModal: (val: boolean) => void
}) => {
	const [viewType, setViewType] = useState<ViewType>(ViewType.story)

	const isFlickEmpty = (() => flicks.length === 0)()

	const isSeriesEmpty = (() => {
		let flickCount = 0
		series.forEach(s => {
			flickCount += s.Flick_Series.length
		})
		return flickCount === 0
	})()

	return (
		<div className='px-2 md:px-0 mt-6 md:mt-12 relative flex flex-col flex-1 text-gray-100'>
			<div className='flex items-center justify-start'>
				{Object.keys(ViewType).map(key => (
					<button
						type='button'
						key={key}
						className={cx(
							'mr-4 border-b-2 pb-0.5 font-semibold cursor-pointer ',
							{
								// @ts-ignore
								'border-green-600 text-white': viewType === ViewType[key],
								'border-transparent text-dark-title-200 hover:text-white':
									// @ts-ignore

									viewType !== ViewType[key],
							}
						)}
						// @ts-ignore

						onClick={() => setViewType(ViewType[key])}
					>
						{/*  @ts-ignore */}
						<Text textStyle='standardLink'>{ViewType[key]}</Text>
					</button>
				))}
			</div>
			{viewType === ViewType.story &&
				(isFlickEmpty ? (
					<EmptyProfile
						user={user}
						type='stories'
						setIsCreateFlickOpen={setIsCreateFlickOpen}
						setOpenCollaborateModal={setOpenCollaborateModal}
					/>
				) : (
					<Flicks flicks={flicks} user={user} />
				))}
			{viewType === ViewType.series &&
				(isSeriesEmpty ? (
					<EmptyProfile
						user={user}
						type='series'
						setIsCreateFlickOpen={setIsCreateFlickOpen}
						setOpenCollaborateModal={setOpenCollaborateModal}
					/>
				) : (
					<Series series={series} />
				))}
		</div>
	)
}

const Profile = (
	props: InferGetServerSidePropsType<typeof getServerSideProps>
) => {
	const { user } = props

	const [isCreateFlickOpen, setIsCreateFlickOpen] = useState(false)
	const [openCollaborateModal, setOpenCollaborateModal] = useState(false)

	return (
		<>
			<SEO
				description={user.profile?.about || `Profile for ${user.displayName}`}
				title={`${user.displayName} | Incredible`}
				keywords={
					user.displayName
						? [...user.displayName.split(' '), user.username]
						: [user.username]
				}
				type='profile'
				twitter_card='summary_large_image'
				url={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/${user.username}`}
			/>
			<Navbar />

			<section className='relative flex flex-col min-h-screen overflow-y-hidden bg-dark-500 items-center'>
				<div className='flex flex-col w-full px-3.5 md:w-[1200px] items-center'>
					<div className='w-full md:container xs:p-2 sm:p-6 md:p-10 xs:rounded-sm sm:rounded-md md:rounded-lg bg-dark-400 mt-8 md:mt-24'>
						<ProfileCard
							user={user}
							setOpenCollaborateModal={setOpenCollaborateModal}
						/>
						<Views
							{...props}
							setIsCreateFlickOpen={setIsCreateFlickOpen}
							setOpenCollaborateModal={setOpenCollaborateModal}
						/>
					</div>
				</div>
			</section>

			{openCollaborateModal && (
				<CollaborateModal
					open={openCollaborateModal}
					handleClose={() => {
						setOpenCollaborateModal(false)
					}}
					user={user}
				/>
			)}

			{isCreateFlickOpen && (
				<CreateFlickModal
					open={isCreateFlickOpen}
					handleClose={() => setIsCreateFlickOpen(false)}
				/>
			)}
		</>
	)
}

export const getServerSideProps: GetServerSideProps<{
	user: UserFragment
	series: SeriesFragmentFragment[]
	flicks: PublicSeriesFlickFragment[]
}> = async context => {
	const username = context.params?.username as string
	const { data } = await sdk.UserProfile({ username })

	if (!data || !data.User?.[0]) {
		return {
			notFound: true,
		}
	}

	return {
		props: {
			user: data.User[0],
			series: data.User[0].series,
			flicks: data.Flick.filter(flick => flick.contents.length > 0),
		},
	}
}

export default Profile
