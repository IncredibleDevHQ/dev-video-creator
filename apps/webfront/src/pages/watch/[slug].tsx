import { cx } from '@emotion/css'
import { format } from 'date-fns'
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
import prisma from 'prisma-orm/prisma'
import { ContentTypeEnum, ParticipantRoleEnum } from 'utils/src/enums'
import requireAuth from 'src/utils/helpers/requireAuth'
import { useUser } from 'src/utils/providers/auth'
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
import trpc, { inferQueryOutput } from '../../server/trpc'

const IncredibleVideoPlayer = dynamic<IncredibleVideoPlayerProps>(
	() => import('ui/src').then(module => module.IncredibleVideoPlayer),
	{
		ssr: false,
	}
)

interface FlickContent {
	video?:
		| (Omit<inferQueryOutput<'story.byId'>['Content'][number], 'data'> & {
				data: any
		  })
		| null
	blog?:
		| (Omit<inferQueryOutput<'story.byId'>['Content'][number], 'data'> & {
				data: any
		  })
		| null
	verticalVideo?:
		| (Omit<inferQueryOutput<'story.byId'>['Content'][number], 'data'> & {
				data: any
		  })[]
		| null
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

type WatchProps = {
	flick: inferQueryOutput<'story.byId'>
	flickContent: FlickContent
	// series: inferQueryOutput<'story.byId'>['Flick_Series'][number]
}

const Watch = ({ flick, flickContent }: WatchProps) => {
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

	const { data: userClaps } = trpc.useQuery([
		'story.getClaps',
		{ id: flick.id },
	])

	const { mutateAsync: clapFlick } = trpc.useMutation('story.clap', {
		onError(error) {
			emitToast(`Something went wrong ${error}`, {
				type: 'error',
			})
		},
	})

	const handleClap = async (claps: number) => {
		if (!user?.sub) return
		await clapFlick({
			id: flick.id,
			count: claps,
		})
	}

	useEffect(() => {
		if (!user?.sub || !userFlickClaps) return
		handleClap(debouncedFlickClaps)
	}, [debouncedFlickClaps])

	useEffect(() => {
		setUserFlickClaps(userClaps?.count || 0)
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
				publishedAt={(
					flickContent.video?.published_at ||
					flickContent.verticalVideo?.[0].published_at ||
					flickContent.blog?.published_at ||
					flick.updatedAt
				).toISOString()}
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
											{flick.Flick_Series.length > 0 && (
												<Link
													passHref
													href={`/series/${flick.Flick_Series[0]?.Series?.name}--${flick.Flick_Series[0]?.seriesId}`}
												>
													<span>
														<Text
															textStyle='bodySmall'
															className='text-dark-title-200 hover:underline cursor-pointer'
														>
															Click to visit series{' '}
															{flick.Flick_Series[0]?.Series?.name}
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
										flick.Participants.some(p => p.userSub === user.sub) && (
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
												{/*
                        TODO: Add clap count
                        <Text className='text-center mr-1 md:mr-0'>
													{flick.totalClaps
														? parseInt(flick.totalClaps, 10) + userFlickClaps
														: userFlickClaps}
												</Text> */}
											</button>
											<CopyToClipboard
												text={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/watch/${flick.joinLink}`}
												onCopy={() => {
													emitToast('Copied url to clipboard', {
														type: 'success',
													})
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
												{flick.Participants?.sort(a => {
													// owner first
													if (a.role === ParticipantRoleEnum.Host) {
														return -1
													}
													return 1
												})?.map(participant => (
													<Link
														key={participant.id}
														href={`/${participant.User.username}`}
														passHref
													>
														<span>
															<Avatar
																src={participant.User.picture as string}
																alt={participant.User.displayName ?? ''}
																name={participant.User.displayName ?? ''}
																className='w-6 h-6 border-2 rounded-full border-green-600 cursor-pointer'
															/>
														</span>
													</Link>
												))}
											</div>
											<Text textStyle='caption' className='text-dark-title-200'>
												{format(
													new Date(
														flick.Content?.[0].published_at || flick.updatedAt
													),
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
														{/*
                            TODO: Add clap count
                            <Text className='text-center mr-1 md:mr-0'>
															{flick.totalClaps
																? parseInt(flick.totalClaps, 10) +
																  userFlickClaps
																: userFlickClaps}
														</Text> */}
													</button>
													<CopyToClipboard
														text={`${process.env.NEXT_PUBLIC_PUBLIC_URL}/watch/${flick.joinLink}`}
														onCopy={() => {
															emitToast('Copied url to clipboard', {
																type: 'success',
															})
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

export const getServerSideProps = requireAuth(true)(
	async ({ params, user }) => {
		const slug: string | undefined =
			typeof params?.slug === 'string' ? params.slug : params?.slug?.[0]

		if (!slug) {
			return { props: { flick: null, series: null, flickContent: null } }
		}
		const flick = await prisma.flick.findFirst({
			where: {
				joinLink: slug,
				Participants: {
					some: {
						userSub: user?.uid,
					},
				},
			},
			select: {
				name: true,
				description: true,
				joinLink: true,
				lobbyPicture: true,
				id: true,
				scope: true,
				md: true,
				dirty: true,
				ownerSub: true,
				updatedAt: true,
				thumbnail: true,
				status: true,
				deletedAt: true,
				producedLink: true,
				useBranding: true,
				brandingId: true,
				configuration: true,
				topicTags: true,
				Content: {
					select: {
						id: true,
						isPublic: true,
						seriesId: true,
						resource: true,
						preview: true,
						thumbnail: true,
						type: true,
						published_at: true,
						data: true,
					},
				},
				Flick_Series: {
					select: {
						seriesId: true,
						Series: {
							select: {
								name: true,
							},
						},
					},
				},
				Fragment: {
					select: {
						configuration: true,
						description: true,
						flickId: true,
						id: true,
						name: true,
						order: true,
						type: true,
						producedLink: true,
						producedShortsLink: true,
						editorState: true,
						editorValue: true,
						encodedEditorValue: true,
						thumbnailConfig: true,
						thumbnailObject: true,
						publishConfig: true,
						version: true,
						Blocks: {
							select: {
								id: true,
								objectUrl: true,
								recordingId: true,
								thumbnail: true,
								playbackDuration: true,
							},
						},
					},
				},
				Branding: {
					select: {
						id: true,
						name: true,
						branding: true,
					},
				},
				Theme: {
					select: {
						name: true,
						config: true,
					},
				},
				Participants: {
					select: {
						id: true,
						status: true,
						role: true,
						userSub: true,
						inviteStatus: true,
						User: {
							select: {
								displayName: true,
								picture: true,
								username: true,
								email: true,
								sub: true,
							},
						},
					},
				},
			},
		})
		// flick.topicTags =
		// 	flick?.topicTags && flick.topicTags.length > 0
		// 		? [...new Set(flick.topicTags.split(','))]
		// 		: []

		const flickContent: FlickContent | null = flick
			? {
					video:
						flick.Content.find(
							content => content.type === ContentTypeEnum.Video
						) || null,
					blog:
						flick.Content.find(
							content => content.type === ContentTypeEnum.Blog
						) || null,
					verticalVideo:
						flick.Content.filter(
							content => content.type === ContentTypeEnum.VerticalVideo
						) || null,
			  }
			: null

		if (flickContent?.verticalVideo)
			flickContent.verticalVideo = flickContent.verticalVideo.map(v => {
				// eslint-disable-next-line no-param-reassign
				if (v) v.data = v.data ? JSON.parse(JSON.stringify(v.data)) : v.data
				return v
			})

		if (flickContent?.video) {
			flickContent.video.data = JSON.parse(
				JSON.stringify(flickContent.video.data)
			)
		}

		if (flickContent?.blog) {
			flickContent.blog.data = JSON.parse(
				JSON.stringify(flickContent.blog.data)
			)
		}

		return {
			props: {
				flick,
				flickContent,
				series: flick?.Flick_Series?.[0] || null,
			} as WatchProps,
			notFound: !flick || !flickContent,
		}
	}
)

export default Watch
