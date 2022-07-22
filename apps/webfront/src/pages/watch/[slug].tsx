import { cx } from '@emotion/css'
import { format } from 'date-fns'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { BsShare } from 'react-icons/bs'
import { FaDiscord } from 'react-icons/fa'
import { IoHeartOutline } from 'react-icons/io5'
import SEO from 'src/components/core/SEO'
import Navbar from 'src/components/dashboard/Navbar'
import {
	ContentFragment,
	Content_Type_Enum_Enum,
	FlickFragment,
	SeriesFragment,
	useClapFlickMutation,
	useGetFlickClapsByUserQuery,
} from 'src/graphql/generated'
import { useUser } from 'src/utils/providers/auth'
import sdk from 'src/utils/sdk'
import {
	Avatar,
	Button,
	Container,
	emitToast,
	Heading,
	IconButton,
	IncredibleVideoPlayerProps,
	Text,
} from 'ui/src'
import { useDebounce } from 'use-debounce'

const IncredibleVideoPlayer = dynamic<IncredibleVideoPlayerProps>(
	() => import('ui/src').then(module => module.IncredibleVideoPlayer),
	{
		ssr: false,
	}
)

interface FlickContent {
	video?: ContentFragment | null
	blog?: ContentFragment | null
	verticalVideo?: ContentFragment[] | null
}

const ListItem = ({ exists, active, children, handleClick }: any) => (
	<button
		type='button'
		onClick={() => {
			if (exists) handleClick?.()
		}}
		className={cx(
			{
				'text-dark-title cursor-pointer bg-dark-300 md:bg-transparent py-1 rounded-sm md:py-0':
					exists && active,
				'text-dark-body-200 cursor-pointer': exists && !active,
				'text-gray-700 cursor-not-allowed': !exists,
			},
			'text-xs mb-2 flex flex-col items-start'
		)}
	>
		{children}
	</button>
)

const Watch = ({
	flick,
	flickContent,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
	const { push, asPath } = useRouter()

	const { user } = useUser()

	const [userFlickClaps, setUserFlickClaps] = useState<number>(0)
	const [debouncedFlickClaps] = useDebounce(userFlickClaps, 1000)

	const [tab, setTab] = useState<'blog' | 'flick' | 'short'>('flick')
	useEffect(() => {
		if (!flickContent?.video) {
			setTab('short')
		}
	}, [])

	const { data: userClaps } = useGetFlickClapsByUserQuery({
		variables: { flickId: flick.id, sub: user?.uid as string },
	})

	const [clapFlick] = useClapFlickMutation()

	const handleClap = async (claps: number) => {
		if (!user?.sub) return
		const { errors } = await clapFlick({
			variables: { flickId: flick.id, claps },
		})
		if (errors) emitToast('Something went wrong')
	}

	useEffect(() => {
		if (!user?.sub || !userFlickClaps) return
		handleClap(debouncedFlickClaps)
	}, [debouncedFlickClaps])

	useEffect(() => {
		setUserFlickClaps(
			userClaps?.Flick?.[0]?.claps_aggregate?.aggregate?.count || 0
		)
	}, [userClaps])

	const playerContainer = useRef<HTMLDivElement>(null)

	return (
		<>
			<SEO
				type='video'
				title={flick.name}
				generateVideoLDJSON
				description={flick.description ?? ''}
				url={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/${asPath}`}
				keywords={flick.name.split(' ')}
				twitter_card='player'
				contentUrl={`${process.env.NEXT_PUBLIC_EMBED_PLAYER_BASE_URL}/${flickContent?.video?.id}`}
				image={
					flickContent?.video?.thumbnail
						? `${process.env.NEXT_PUBLIC_CDN_URL}/${flickContent?.video?.thumbnail}`
						: `${process.env.NEXT_PUBLIC_PUBLIC_URL}/cover.png`
				}
				publishedAt={flick.publishedAt || flick.updatedAt}
			/>
			<Navbar />

			<div className='relative flex flex-col items-center flex-1 min-h-screen bg-dark-500'>
				<div className='flex justify-center w-full md:container'>
					<div className='w-full grid grid-cols-12 text-dark-title'>
						<Container className='col-span-12 md:col-span-2'>
							<div className='flex flex-col md:items-start'>
								<div className='mb-2 mr-2 md:mb-6 md:mr-0'>
									<div className='flex md:flex-col items-center md:items-start'>
										<div className='flex flex-col'>
											<Heading textStyle='mediumTitle'>{flick.name}</Heading>
											{flick.series.length > 0 && (
												<Link
													passHref
													href={`/series/${flick.series[0]?.series?.name}--${flick.series[0]?.series?.id}`}
												>
													<span>
														<Text
															textStyle='bodySmall'
															className='text-dark-title-200 hover:underline cursor-pointer'
														>
															Click to visit series{' '}
															{flick.series[0]?.series?.name}
														</Text>
													</span>
												</Link>
											)}
										</div>
									</div>
									{flickContent?.video?.data?.discordCTA?.url && (
										<Link
											href={flickContent?.video?.data?.discordCTA?.url || '#'}
											passHref
										>
											<Button colorScheme='dark' className='my-3'>
												<FaDiscord className='text-[#5865F2]' size={18} />
												{flickContent?.video?.data?.discordCTA?.text ||
													'Join discord'}
											</Button>
										</Link>
									)}
								</div>
								<div className='flex md:flex-col items-center md:items-start gap-y-1'>
									{flickContent?.video && (
										<ul className='text-sm'>
											<ListItem
												handleClick={() => {
													setTab('flick')
												}}
												exists
												active={tab === 'flick'}
											>
												<Heading
													textStyle='smallTitle'
													className={cx(
														'md:border-l-2 border-transparent px-2',
														{
															'!border-green-600': tab === 'flick',
														}
													)}
												>
													Story
												</Heading>
											</ListItem>
										</ul>
									)}
									{flickContent?.verticalVideo &&
										flickContent?.verticalVideo.length > 0 && (
											<ul className='text-sm'>
												<ListItem
													handleClick={() => {
														setTab('short')
													}}
													exists
													active={tab === 'short'}
												>
													<Heading
														textStyle='smallTitle'
														className={cx(
															'md:border-l-2 border-transparent px-2',
															{
																'!border-green-600': tab === 'short',
															}
														)}
													>
														Highlights
													</Heading>
												</ListItem>
											</ul>
										)}

									{user?.uid &&
										flick.participants.some(p => p.user.sub === user.sub) && (
											<a
												href={`/story/${flick.id}`}
												style={{
													color: '#9ca3af',
												}}
												className='text-size-xs hidden md:block hover:underline'
											>
												Edit in studio
											</a>
										)}
								</div>
							</div>
						</Container>
						<Container className='flex flex-col self-center justify-center flex-1 w-full h-full col-span-12 md:col-span-8'>
							{tab === 'flick' && flickContent?.video?.resource && (
								<>
									<div
										className='relative w-full h-full flex flex-col md:flex-row justify-center items-start md:items-center'
										ref={playerContainer}
									>
										<IncredibleVideoPlayer
											src={`${process.env.NEXT_PUBLIC_CDN_URL}${flickContent?.video.resource}`}
											shouldHaveLogo={false}
											showTitle={false}
											orientation='landscape'
											ctas={flickContent.video?.data?.ctas}
											blocks={flickContent.video?.data?.blocks}
											heading={flickContent.video?.data?.title}
											poster={`${process.env.NEXT_PUBLIC_CDN_URL}${flickContent.video?.thumbnail}`}
											windowWidth={playerContainer.current?.clientWidth}
										/>
										<div className='md:absolute mt-4 md:mt-0 bottom-0 left-full flex md:flex-col items-center gap-x-2 justify-end md:ml-4'>
											<button
												type='button'
												className='md:mb-2 rounded-sm bg-dark-100 md:py-1.5 px-[9px] flex md:flex-col items-center md:justify-center gap-x-2 group'
												onClick={() => {
													if (!user?.uid) {
														push('/login')
														return
													}
													setUserFlickClaps(
														userFlickClaps < 10
															? userFlickClaps + 1
															: userFlickClaps
													)
												}}
											>
												<IoHeartOutline
													size={24}
													className='my-2 md:my-1 group-hover:text-green-600 group-hover:animate-ping group-hover:animate-bounce group-hover:animate-pulse p-1 md:p-0'
												/>
												<Text className='text-center mr-1 md:mr-0'>
													{flick.totalClaps
														? parseInt(flick.totalClaps, 10) + userFlickClaps
														: userFlickClaps}
												</Text>
											</button>
											<CopyToClipboard
												text={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/watch/${flick.joinLink}`}
												onCopy={() => {
													emitToast('Copied url to clipboard')
												}}
											>
												<IconButton
													colorScheme='dark'
													size='large'
													icon={<BsShare />}
												/>
											</CopyToClipboard>
										</div>
									</div>
									<div className='mt-6'>
										<Heading as='h1'>{flick.name}</Heading>
										<div className='flex items-center mt-2 gap-x-4'>
											<div className='flex items-center -space-x-1.5'>
												{flick.participants
													?.sort(a => {
														// owner first
														if (a.id === flick.ownerId) {
															return -1
														}
														return 1
													})
													?.map(participant => (
														<Link
															key={participant.id}
															href={`/${participant.user.username}`}
															passHref
														>
															<span>
																<Avatar
																	src={participant.user.picture as string}
																	alt={participant.user.displayName ?? ''}
																	name={participant.user.displayName ?? ''}
																	className='w-6 h-6 border-2 rounded-full border-green-600 cursor-pointer'
																/>
															</span>
														</Link>
													))}
											</div>
											<Text textStyle='caption' className='text-dark-title-200'>
												{format(
													new Date(flick.publishedAt || flick.updatedAt),
													'do MMMM yyyy'
												)}
											</Text>
										</div>
										<Text className='mt-4 text-dark-title-200'>
											{flick.description}
										</Text>
									</div>
								</>
							)}
							{tab === 'short' &&
								flickContent?.verticalVideo &&
								flickContent?.verticalVideo.length > 0 && (
									<div className='flex flex-col items-center gap-y-6'>
										{flickContent?.verticalVideo.map(video => (
											<div
												ref={playerContainer}
												className='relative w-full md:w-1/2 md:px-4 h-full flex flex-col md:flex-row justify-center items-start md:items-center'
												key={video.id}
											>
												<IncredibleVideoPlayer
													src={`${process.env.NEXT_PUBLIC_CDN_URL}${video.resource}`}
													shouldHaveLogo={false}
													showTitle={false}
													orientation='portrait'
													ctas={video?.data?.ctas}
													blocks={video?.data?.blocks}
													heading={video?.data?.title}
													poster={`${process.env.NEXT_PUBLIC_CDN_URL}${video?.thumbnail}`}
													windowWidth={playerContainer.current?.clientWidth}
												/>
												<div className='md:absolute mt-2 md:mt-0 bottom-1 left-full flex md:flex-col items-center gap-x-2 justify-end md:ml-2'>
													<button
														type='button'
														className='md:mb-2 rounded-sm bg-dark-100 md:py-1.5 px-[9px] flex md:flex-col items-center md:justify-center gap-x-2 group'
														onClick={() => {
															if (!user?.uid) {
																push('/login')
																return
															}
															setUserFlickClaps(
																userFlickClaps < 10
																	? userFlickClaps + 1
																	: userFlickClaps
															)
														}}
													>
														<IoHeartOutline
															size={24}
															className='my-1 group-hover:text-green-600 group-hover:animate-ping group-hover:animate-bounce group-hover:animate-pulse p-1 md:p-0'
														/>
														<Text className='text-center mr-1 md:mr-0'>
															{flick.totalClaps
																? parseInt(flick.totalClaps, 10) +
																  userFlickClaps
																: userFlickClaps}
														</Text>
													</button>
													<CopyToClipboard
														text={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/watch/${flick.joinLink}`}
														onCopy={() => {
															emitToast('Copied url to clipboard')
														}}
													>
														<IconButton
															colorScheme='dark'
															size='large'
															icon={<BsShare />}
														/>
													</CopyToClipboard>
												</div>
											</div>
										))}
									</div>
								)}
						</Container>
						<Container className='col-span-2' />
					</div>
				</div>
			</div>
		</>
	)
}

export const getServerSideProps: GetServerSideProps<{
	flick: FlickFragment
	series: SeriesFragment
	flickContent?: FlickContent | null
}> = async context => {
	const slug = context.params?.slug

	const { data } = await sdk.GetFlick({ joinLink: slug as string })

	const flick = data?.Flick?.[0]

	flick.topicTags = [...new Set(flick.topicTags)]

	const flickContent: FlickContent | null = flick
		? {
				video:
					flick.contents.find(
						content => content.type === Content_Type_Enum_Enum.Video
					) || null,
				blog:
					flick.contents.find(
						content => content.type === Content_Type_Enum_Enum.Blog
					) || null,
				verticalVideo:
					flick.contents.filter(
						content => content.type === Content_Type_Enum_Enum.VerticalVideo
					) || null,
		  }
		: null

	return {
		props: {
			flick,
			flickContent,
			series: flick?.series?.[0]?.series || null,
		},
		notFound: !flick || !flickContent,
	}
}

export default Watch
