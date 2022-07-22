/* eslint-disable react/destructuring-assignment */
import { css, cx } from '@emotion/css'
import { Dialog, Menu } from '@headlessui/react'
import debounce from 'lodash/debounce'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { IoChevronDown } from 'react-icons/io5'
import { MdOutlineStarOutline, MdShare, MdStar } from 'react-icons/md'
import slugify from 'slugify'
import SEO from 'src/components/core/SEO'
import CreateFlickModal from 'src/components/dashboard/CreateFlickModal'
import Navbar from 'src/components/dashboard/Navbar'
import AddExistingFlickModal from 'src/components/series/AddExistingFlickModal'
import Collaborators from 'src/components/series/Collaborators'
import FlickCard from 'src/components/series/FlickCard'
import SeriesActionButton from 'src/components/series/SeriesActionButton'
import {
	Content_Type_Enum_Enum,
	SeriesFragment,
	SeriesFragmentFragment,
	SeriesParticipantFragment,
	SubscribeSeriesMutationVariables,
	useCheckFollowByIdsLazyQuery,
	useDeleteSeriesSubscriptionMutation,
	useGetSeriesLazyQuery,
	useHasSeriesStarredQuery,
	useHasSeriesSubscribedQuery,
	useStarSeriesMutation,
	useSubscribeSeriesMutation,
	useUnstarSeriesMutation,
} from 'src/graphql/generated'
import { useUser } from 'src/utils/providers/auth'
import sdk from 'src/utils/sdk'
import { Button, emitToast, Heading } from 'ui/src'
import { validateEmail } from 'utils/src'

// Import component dynamically, with SSR disabled
// Usage reference : https://github.com/wwayne/react-tooltip/issues/675#issuecomment-824897435
const ReactTooltip = dynamic(() => import('react-tooltip'), {
	ssr: false,
})

const SeriesModal = ({
	series,
	handleSubscribe,
	loading,
	open,
	onClose,
}: {
	open: boolean
	onClose: () => void
	series: SeriesFragment
	handleSubscribe: (props: SubscribeSeriesMutationVariables) => void
	loading?: boolean
}) => {
	const [email, setEmail] = useState('')

	useEffect(() => {
		if (!open) setEmail('')
	}, [open])

	return (
		<Dialog open={open} onClose={onClose}>
			<div
				className='flex flex-col items-center justify-center m-4 text-dark-title bg-dark-200'
				style={{ maxWidth: 400 }}
			>
				<p className='font-light'>
					Subscribe to {series.name} and get notified whenever a flick is
					published.
				</p>
				<div className='flex w-full mt-4'>
					<input
						type='text'
						className='flex-grow p-2 mr-2 border border-transparent rounded-md focus:outline-none bg-dark-400'
						placeholder='Email address'
						value={email}
						onChange={event => setEmail(event.target.value)}
					/>
					<Button
						loading={loading}
						onClick={() =>
							handleSubscribe({ emailId: email, seriesId: series.id })
						}
						disabled={!validateEmail(email)}
					>
						{loading ? 'Submitting...' : 'Subscribe'}
					</Button>
				</div>
			</div>
		</Dialog>
	)
}

const Series = (
	props: InferGetServerSidePropsType<typeof getServerSideProps>
) => {
	const [seriesModal, setSeriesModal] = useState(false)

	const [series, setSeries] = useState<
		InferGetServerSidePropsType<typeof getServerSideProps> & {
			isStarred?: boolean
			isSubscribed?: boolean
		}
	>(props)
	const [seriesTags, setSeriesTags] = useState<string[]>([])

	const url = `${process.env.NEXT_PUBLIC_PUBLIC_URL}/series/${slugify(
		props.series.name
	)}--${props.series.id}`

	const [createNewFlickOpen, setCreateNewFlickOpen] = useState(false)
	const [addExistingOpen, seAddExistingOpen] = useState(false)

	const { query, push, replace } = useRouter()

	const { user } = useUser()

	const { data: isStarred } = useHasSeriesStarredQuery({
		variables: {
			seriesId: props.series.id,
			sub: user?.uid as string,
		},
	})
	const { data: isSubscribed } = useHasSeriesSubscribedQuery({
		variables: {
			seriesId: props.series.id,
			sub: user?.uid as string,
		},
	})

	const [checkFollow] = useCheckFollowByIdsLazyQuery()

	const [refetchSeries, { data: seriesData, error: seriesError }] =
		useGetSeriesLazyQuery({
			fetchPolicy: 'network-only',
		})

	useEffect(() => {
		if (!seriesError) return
		emitToast('Could not fetch updated series', {
			type: 'error',
		})
	}, [seriesError])

	useEffect(() => {
		if (!seriesData?.Series_by_pk) return
		setSeries({ ...series, series: seriesData.Series_by_pk })
	}, [seriesData])

	const [subscribe, { loading: subscribeLoading }] =
		useSubscribeSeriesMutation()

	const [removeSubscription] = useDeleteSeriesSubscriptionMutation()

	const [star] = useStarSeriesMutation()

	const [unstarSeries] = useUnstarSeriesMutation()

	const [seriesParticipants, setSeriesParticipants] = useState<
		(SeriesParticipantFragment & { following?: boolean })[]
	>([])

	useEffect(() => {
		if (query.new) {
			setCreateNewFlickOpen(true)
		}
	}, [query])

	useEffect(() => {
		if (!isStarred) return
		setSeries({ ...series, isStarred: isStarred?.Series_Stars?.length > 0 })
	}, [isStarred])

	useEffect(() => {
		if (!isSubscribed) return
		setSeries({
			...series,
			isSubscribed: isSubscribed?.Subscription?.length > 0,
		})
	}, [isSubscribed])

	useEffect(() => {
		if (!series?.series?.Flick_Series) return
		;(async () => {
			let collaborators: (SeriesParticipantFragment & {
				following: boolean
			})[] = []
			const tags: string[] = []

			series?.series?.Flick_Series?.forEach(flick => {
				flick?.flick?.topicTags?.forEach((tag: string) => {
					tags.push(tag)
				})
				flick?.flick?.participants?.forEach(participant => {
					collaborators.push({ ...participant, following: false })
				})
			})

			collaborators = collaborators.filter((collaborator, index) => {
				const i = collaborators.findIndex(
					c => c.user.sub === collaborator.user.sub
				)
				return index === i
			})

			if (user?.uid) {
				const { data: followingParticipantsSubs } = await checkFollow({
					variables: {
						followerId: user.uid,
						targetId: collaborators.map(collaborator => collaborator.user.sub),
					},
				})

				followingParticipantsSubs?.Follow?.forEach(sub => {
					const collaboratorIndex = collaborators.findIndex(
						c => c.user.sub === sub.targetId
					)
					if (collaboratorIndex !== -1)
						collaborators[collaboratorIndex].following = true
				})
			}

			if (tags.length > 0) setSeriesTags([...new Set(tags)])
			setSeriesParticipants(collaborators)
		})()
	}, [series?.series, user?.uid])

	const handleStar = async () => {
		if (!user?.uid) return
		if (series?.isStarred) {
			setSeries({ ...series, stars: series.stars - 1, isStarred: false })
			const { errors } = await unstarSeries({
				variables: {
					seriesId: series.series.id,
					sub: user.uid,
				},
			})
			if (errors) {
				setSeries({ ...series, stars: series.stars + 1, isStarred: true })
				emitToast('Something went wrong', {
					type: 'error',
				})
			}
		} else {
			setSeries({ ...series, stars: series.stars + 1, isStarred: true })
			const { data, errors } = await star({
				variables: { seriesId: props.series.id },
			})
			if (data?.StarSeries?.success)
				emitToast('Series starred successfully', {
					type: 'success',
				})
			if (errors) {
				setSeries({ ...series, stars: series.stars - 1, isStarred: false })
				emitToast('Something went wrong', {
					type: 'error',
				})
			}
		}
	}

	const debouncedHandleStar = debounce(handleStar, 500)

	const handleSubscribe = async ({
		seriesId,
		emailId,
	}: SubscribeSeriesMutationVariables) => {
		if (series?.isSubscribed) {
			setSeries({
				...series,
				subscriptions: (series?.subscriptions ?? 1) - 1,
				isSubscribed: false,
			})
			const { errors } = await removeSubscription({
				variables: {
					seriesId: series.series.id,
					sub: user?.uid as string,
				},
			})
			if (errors) {
				setSeries({
					...series,
					subscriptions: (series?.subscriptions ?? 1) + 1,
					isSubscribed: true,
				})
				emitToast('Something went wrong', {
					type: 'error',
				})
			}
		} else {
			setSeries({
				...series,
				subscriptions: (series?.subscriptions ?? 1) + 1,
				isSubscribed: true,
			})
			const { data, errors } = await subscribe({
				variables: { emailId, seriesId },
			})
			if (data?.AddSeriesSubscriber?.success) {
				if (data.AddSeriesSubscriber.alreadyExists) {
					emitToast('Already subscribed', {
						type: 'error',
					})
					setSeries({
						...series,
						subscriptions: (series?.subscriptions ?? 1) - 1,
						isSubscribed: true,
					})
				} else
					emitToast('Subscribed successfully!', {
						type: 'success',
					})
			}
			if (errors) {
				setSeries({
					...series,
					subscriptions: (series?.subscriptions ?? 1) - 1,
					isSubscribed: false,
				})
				emitToast('Something went wrong', {
					type: 'error',
				})
			}
		}
		setSeriesModal(false)
	}

	const debouncedHandleSubscribe = debounce(handleSubscribe, 500)

	if (!series || !series.series) return null

	return (
		<>
			<SEO
				description={
					series?.series?.description ||
					'Come, explore the world of some Incredible series!'
				}
				title={series?.series?.name}
				keywords={series?.series?.name.split(' ')}
				type='video'
				twitter_card='summary_large_image'
				url={url}
				image={
					series?.series.picture
						? `${process.env.NEXT_PUBLIC_CDN_URL}/${series?.series.picture}`
						: `${process.env.NEXT_PUBLIC_PUBLIC_URL}/cover.png`
				}
			/>
			<div className='relative flex flex-col items-center h-screen overflow-y-hidden bg-dark-500'>
				<Navbar />
				<section className='flex flex-col items-start w-full px-5 py-5 bg-dark-400'>
					<div className='flex flex-col md:flex-row items-start gap-y-4 md:items-center justify-between w-full'>
						<Heading
							textStyle='mediumTitle'
							className='flex text-xl text-dark-title gap-x-2'
						>
							<Link href={`/${series?.series.owner?.username}`} passHref>
								<div className='cursor-pointer text-dark-title-200 hover:text-dark-title font-body'>
									{series?.series.owner?.displayName}
								</div>
							</Link>
							<span className='text-dark-title-200'> / </span>
							<span className='font-main'>{series?.series.name}</span>
						</Heading>
						<div className='flex items-center justify-end'>
							{/* TODO: subscribe */}
							<SeriesActionButton
								icon={
									series?.isStarred ? (
										<MdStar size={20} />
									) : (
										<MdOutlineStarOutline size={20} />
									)
								}
								number={series?.stars}
								onClick={() => {
									if (user?.uid) debouncedHandleStar()
									else
										push(
											`/login?redirect=${encodeURIComponent(
												window.location.href
											)}`
										)
								}}
							>
								{series?.isStarred ? 'Unstar' : 'Star'}
							</SeriesActionButton>
							<CopyToClipboard
								text={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/series/${series.series.name}--${series?.series.id}`}
								onCopy={() => {
									emitToast('Copied url to clipboard', {
										type: 'success',
									})
								}}
							>
								<SeriesActionButton
									icon={<MdShare size={18} />}
									className='ml-4 text-dark-title'
								>
									Copy Link
								</SeriesActionButton>
							</CopyToClipboard>
							{user?.uid === series?.series.owner.sub && (
								<>
									<div className='h-8 ml-4 border border-dark-300' />
									<Menu as='div' className='relative'>
										<Menu.Button
											as='button'
											className='flex items-center px-3 py-2 md:py-3 ml-4 rounded-sm text-dark-title gap-x-2 bg-dark-100 text-size-xs md:text-size-sm'
										>
											Add Story
											<IoChevronDown />
										</Menu.Button>
										<Menu.Items
											as='div'
											className='absolute top-12 right-0 z-10 flex flex-col justify-start text-sm rounded-md bg-dark-200 text-dark-title font-main w-40 p-1.5'
										>
											<Menu.Item
												as='button'
												className='w-full px-4 py-2.5 cursor-pointer hover:bg-dark-100 text-start text-size-sm rounded-sm'
												onClick={() => {
													setCreateNewFlickOpen(true)
												}}
											>
												New Story
											</Menu.Item>
											<Menu.Item
												as='button'
												className='w-full px-4 py-2.5 cursor-pointer hover:bg-dark-100 text-start text-size-sm rounded-sm'
												onClick={() => {
													seAddExistingOpen(true)
												}}
											>
												Existing Story
											</Menu.Item>
										</Menu.Items>
									</Menu>
								</>
							)}
						</div>
					</div>
					{addExistingOpen && (
						<AddExistingFlickModal
							open={addExistingOpen}
							handleClose={async (refetch?: boolean) => {
								seAddExistingOpen(false)
								if (refetch) {
									await refetchSeries({
										variables: {
											id: series?.series.id,
										},
									})
								}
							}}
							series={series?.series}
						/>
					)}
					{createNewFlickOpen && (
						<CreateFlickModal
							open={createNewFlickOpen}
							seriesId={series?.series.id}
							handleClose={async (refetch?: boolean) => {
								setCreateNewFlickOpen(false)
								if (query.new) {
									// remove query from url
									replace(
										`/series/${series.series?.name}--${series?.series.id}`,
										undefined,
										{
											shallow: true,
										}
									)
								}
								if (refetch) {
									await refetchSeries({
										variables: {
											id: series?.series.id,
										},
									})
								}
							}}
						/>
					)}
				</section>
				<div
					className={cx(
						'px-5 md:px-0 md:container items-center flex-1 overflow-y-scroll text-gray-100 justify-center w-full relative',
						css`
							-ms-overflow-style: none;
							scrollbar-width: none;
							::-webkit-scrollbar {
								display: none;
							}
						`
					)}
				>
					<div
						className={cx(
							'grid h-full grid-cols-12 py-6 overflow-y-auto',
							css`
								-ms-overflow-style: none;
								scrollbar-width: none;
								::-webkit-scrollbar {
									display: none;
								}
							`
						)}
					>
						<div className={cx('col-span-12 md:col-span-8 order-1 md:order-0')}>
							<div className='flex flex-col w-full gap-y-6 md:gap-y-12 '>
								{series?.series.Flick_Series.filter(f => {
									let isParticipant = false
									series.series.Flick_Series.forEach(seriesFlick => {
										seriesFlick.flick?.participants?.forEach(p => {
											if (p.user?.sub === user?.uid) {
												isParticipant = true
											}
										})
									})
									if (
										!isParticipant &&
										!f.flick?.contents?.find(
											c => c?.type === Content_Type_Enum_Enum.Video
										)?.published_at
									) {
										return false
									}
									return true
								})
									.sort(
										// sort on published at
										(a, b) => {
											const diff =
												new Date(
													a.flick?.contents?.find(
														c => c?.type === Content_Type_Enum_Enum.Video
													)?.published_at || 0
												).getTime() -
												new Date(
													b.flick?.contents?.find(
														c => c?.type === Content_Type_Enum_Enum.Video
													)?.published_at || 0
												).getTime()
											if (
												a.flick?.contents?.find(
													c => c?.type === Content_Type_Enum_Enum.Video
												)?.published_at &&
												b.flick?.contents?.find(
													c => c?.type === Content_Type_Enum_Enum.Video
												)?.published_at
											)
												return diff
											return -diff
										}
									)
									.map(flick => (
										<FlickCard key={flick.flick?.id} flick={flick} />
									))}
							</div>
						</div>
						<div className='order-1 col-span-1 hidden md:block' />
						<div className='col-span-12 order-0 md:order-2 md:absolute md:left-[1180px] top-4'>
							{seriesParticipants.length > 0 && (
								<Collaborators
									seriesTags={seriesTags}
									seriesParticipants={seriesParticipants}
									setSeriesParticipants={setSeriesParticipants}
								/>
							)}
						</div>
					</div>
				</div>

				{series?.series && (
					<SeriesModal
						handleSubscribe={debouncedHandleSubscribe}
						onClose={() => {
							setSeriesModal(false)
						}}
						open={seriesModal}
						series={series.series}
						loading={subscribeLoading}
					/>
				)}
			</div>
			<ReactTooltip backgroundColor='#202020' effect='solid' place='bottom' />
		</>
	)
}

export const getServerSideProps: GetServerSideProps<{
	series: SeriesFragmentFragment
	subscriptions: number
	stars: number
}> = async context => {
	const id = (context.params?.series as string).split('--').pop()
	const { data } = await sdk.GetSeries({ id })
	const { data: seriesSubscription } = await sdk.GetSeriesSubscription({
		seriesId: id,
	})
	const { data: seriesStars } = await sdk.GetSeriesStars({ seriesId: id })

	const series = data?.Series_by_pk

	if (!series) {
		return {
			notFound: true,
		}
	}

	return {
		props: {
			series,
			subscriptions:
				seriesSubscription?.Subscription_aggregate?.aggregate?.count || 0,
			stars: seriesStars?.Series_Stars_aggregate?.aggregate?.count || 0,
		},
	}
}

export default Series
