// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/no-unused-prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable react/jsx-props-no-spreading */
import { cx, css } from '@emotion/css'
import { Menu, Switch, Transition } from '@headlessui/react'
import '@vime/core/themes/default.css'
import {
	CaptionControl,
	Captions,
	ClickToPlay,
	ControlGroup,
	Controls,
	ControlSpacer,
	DblClickFullscreen,
	DefaultUi,
	FullscreenControl,
	PipControl,
	PlaybackControl,
	Player,
	Poster,
	Scrim,
	ScrubberControl,
	SettingsControl,
	TimeProgress,
	Ui,
	Video,
	VolumeControl,
} from '@vime/react'
import { sentenceCase } from 'change-case'
import { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'
import { BiExitFullscreen, BiFullscreen } from 'react-icons/bi'
import { FiCode } from 'react-icons/fi'
import { HiOutlineMenuAlt1, HiX } from 'react-icons/hi'
import { IoCloseOutline, IoCopyOutline } from 'react-icons/io5'
import CodeSandbox from './assets/CodeSandbox.svg'
import Replit from './assets/Replit.svg'
import StackBlitz from './assets/StackBlitz.svg'
import { Button } from './Button'
import CardFallback from './assets/card_fallback.png'

const horizontalCustomScrollBar = css`
	::-webkit-scrollbar {
		height: 0.45rem;
		padding: 0.5rem 0;
	}
	::-webkit-scrollbar-thumb {
		height: 0.45rem;
		background-color: #4d4d4d;
		border-radius: 1rem;
	}
	/* hover */
	::-webkit-scrollbar-thumb:hover {
		background-color: #9ca3af;
	}
`

const verticalCustomScrollBar = css`
	::-webkit-scrollbar {
		width: 0.45rem;
		padding: 0.5rem 0;
	}
	::-webkit-scrollbar-thumb {
		width: 0.45rem;
		background-color: #4d4d4d;
		border-radius: 1rem;
	}
	/* hover */
	::-webkit-scrollbar-thumb:hover {
		background-color: #9ca3af;
	}
`

export interface CTA {
	text: string
	url: string
	seconds: number
}

export interface BlockParticipant {
	__typename: string
	username?: string
	displayName?: string
	picture?: string
}

export interface BlockMeta {
	id: string
	playbackDuration: number
	thumbnail?: string
	title: string
	type: string
	code?: string
	participants: BlockParticipant[]
	interactionType?: string
	interactionUrl?: string
}

const getMenuWidth = (
	orientation: 'portrait' | 'landscape',
	windowWidth: number
) => {
	if (orientation === 'portrait') {
		if (windowWidth < 520) {
			return 'calc(100vw / 2)'
		}
		return 'calc(100vw / 3)'
	}
	if (windowWidth < 520) {
		return 'calc(100vw / 1.33)'
	}
	if (windowWidth < 768) {
		return 'calc(100vw / 2)'
	}
	if (windowWidth < 1120) {
		return 'calc(100vw / 3)'
	}
	return 'calc(100vw / 4.5)'
}

const HorizontalContainer = ({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cx(
			'flex items-start overflow-x-scroll overflow-y-hidden w-full gap-x-4',
			horizontalCustomScrollBar,
			className
		)}
		{...rest}
	/>
)

export interface IncredibleVideoPlayerProps {
	src: string
	ctas?: CTA[]
	track?: string
	muted?: boolean
	poster?: string
	heading?: string
	blocks?: BlockMeta[]
	autoplay?: boolean
	windowWidth?: number
	windowHeight?: number
	shouldHaveLogo?: boolean
	showTitle?: boolean
	orientation?: 'portrait' | 'landscape'
}

export const IncredibleVideoPlayer = ({
	src,
	ctas,
	track,
	muted,
	poster,
	blocks,
	heading,
	autoplay,
	orientation,
	windowWidth,
	shouldHaveLogo = true,
	showTitle = true,
}: IncredibleVideoPlayerProps) => {
	const [currentTime, setCurrentTime] = useState(0)
	const ctasTimes = ctas?.map(cta => Math.floor(cta.seconds))

	const player = useRef<HTMLVmPlayerElement>(null)
	const matchedCTATime = useRef<number | undefined>(0)
	const roundedCurrentTime = useRef<number | undefined>(
		currentTime ? Math.floor(currentTime) : undefined
	)

	const [currentCTA, setCurrentCTA] = useState<CTA>()

	const [interactionUrl, setInteractionUrl] = useState<string>()
	const [interactionId, setInteractionId] = useState<string>()

	const [interactionsEnabled, setInteractionsEnabled] = useState(true)

	const [isFullScreen, setIsFullScreen] = useState(false)

	const timeData = useMemo(
		() =>
			blocks?.map((block, index) => ({
				startTime: Number(block.playbackDuration.toFixed(2)),
				endTime:
					index === (blocks?.length ?? 0) - 1
						? player.current?.duration?.toFixed(2) || 0
						: Number((blocks?.[index + 1]?.playbackDuration || 0).toFixed(2)) -
						  0.1,
				block,
			})),
		[blocks]
	)

	const [currentlyPlayingBlockIndex, setCurrentlyPlayingBlockIndex] =
		useState<number>(0)

	useEffect(() => {
		const fixedCurrentTime = Number(currentTime.toFixed(2))

		const currentlyPlayingBlockIndex = timeData?.findIndex(
			time =>
				fixedCurrentTime >= time.startTime && fixedCurrentTime <= time.endTime
		)

		// console.log(currentlyPlayingBlockIndex, fixedCurrentTime);

		if (
			currentlyPlayingBlockIndex === undefined ||
			currentlyPlayingBlockIndex === -1
		)
			return

		setCurrentlyPlayingBlockIndex(currentlyPlayingBlockIndex)
		if (!interactionsEnabled) return

		const nextNonInteractionBlock = timeData?.find(
			(time, index) =>
				index > currentlyPlayingBlockIndex &&
				time.block.type === 'interactionBlock'
		)

		const nextInteractionBlockIndex = timeData?.findIndex(
			(time, index) =>
				index > currentlyPlayingBlockIndex &&
				time.block.type === 'interactionBlock'
		)

		if (!nextNonInteractionBlock) return
		if (
			nextInteractionBlockIndex === undefined ||
			nextInteractionBlockIndex === -1
		)
			return

		const nextInteractionBlock = timeData?.[nextInteractionBlockIndex]

		if (!nextInteractionBlock) return

		const lowerBound = Number(
			(nextNonInteractionBlock.startTime - 0.2).toFixed(2)
		)

		const upperBound = Number((nextInteractionBlock.startTime - 0.1).toFixed(2))

		if (fixedCurrentTime >= lowerBound && fixedCurrentTime <= upperBound) {
			player.current?.pause()
			setInteractionUrl(nextInteractionBlock.block.interactionUrl)
			setInteractionId(nextInteractionBlock.block.id)
		}
	}, [currentTime, currentlyPlayingBlockIndex, timeData, interactionsEnabled])

	useEffect(() => {
		if (currentTime) {
			roundedCurrentTime.current = Math.floor(currentTime)
		}
	}, [currentTime])

	useEffect(() => {
		if (!matchedCTATime.current) return
		const ctaWithCurrentTime = ctas?.find(
			cta => Math.floor(cta.seconds) === Math.floor(matchedCTATime.current || 0)
		)
		if (ctaWithCurrentTime) {
			setCurrentCTA(ctaWithCurrentTime)
		}
	}, [matchedCTATime.current])

	useEffect(() => {
		const isCurrentTimeAtCTA = ctasTimes?.includes(
			Math.floor(roundedCurrentTime.current || 0)
		)
		matchedCTATime.current = isCurrentTimeAtCTA
			? roundedCurrentTime.current
			: undefined
	}, [roundedCurrentTime.current])

	return (
		<div className={cx('h-auto w-full bg-[#18181B]')}>
			<Player
				playsinline
				ref={player}
				muted={muted}
				autoplay={autoplay}
				onVmCurrentTimeChange={e => setCurrentTime?.(e.detail)}
				aspectRatio={orientation === 'portrait' ? '9:16' : '16:9'}
			>
				{/* Provider component is placed here. */}
				<Video crossOrigin='' poster={poster}>
					{/* These are passed directly to the underlying HTML5 `<video>` element. */}
					{/* `data-src` is for Lazy loading, src can also be used  */}
					<source data-src={src} type='video/mp4' />
					<source data-src={src} type='video/webm' />
					{track && (
						<track
							default
							kind='subtitles'
							src={track}
							srcLang='en'
							label='English'
						/>
					)}
				</Video>
				<DefaultUi noControls />
				<Ui>
					<Poster />
					<Captions />
					<Scrim gradient='down' />
					<Scrim gradient='up' />
					<ClickToPlay />
					<DblClickFullscreen />

					<Controls pin={orientation === 'portrait' ? 'bottomLeft' : 'topLeft'}>
						<div className='flex items-center justify-between w-full'>
							<div className='flex items-center justify-start mr-auto text-white m-2'>
								<Menu as='div' className='relative inline-block text-left'>
									<Menu.Button className='flex items-center justify-center w-9 h-9 bg-gray-800 rounded-md cursor-pointer'>
										<HiOutlineMenuAlt1 size={21} />
									</Menu.Button>
									<Transition
										enter='transition ease-out duration-100'
										enterFrom='transform opacity-0 scale-95'
										enterTo='transform opacity-100 scale-100'
										leave='transition ease-in duration-75'
										leaveFrom='transform opacity-100 scale-100'
										leaveTo='transform opacity-0 scale-95'
									/>
									<Menu.Items
										className={cx(
											'absolute left-0 bg-[#18181B] rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-y-auto md:max-h-96 max-h-44',
											{
												'bottom-0 origin-bottom-left':
													orientation === 'portrait',
												'top-0 origin-top-left': orientation !== 'portrait',
											},
											verticalCustomScrollBar
										)}
										style={{
											width:
												orientation &&
												windowWidth &&
												getMenuWidth(orientation, windowWidth),
										}}
									>
										<div className='relative p-4'>
											<div className='flex items-center justify-start'>
												<Menu.Item as='button' className='cursor-pointer'>
													<HiOutlineMenuAlt1 size={18} />
												</Menu.Item>
												{showTitle && (
													<h2
														className={cx(
															'ml-4 font-main text-size-sm md:text-size-md',
															{
																'text-size-xs': orientation === 'portrait',
																'text-size-md': orientation !== 'portrait',
															}
														)}
													>
														{heading || 'Untitled'}
													</h2>
												)}
											</div>
											<Menu.Item
												as='button'
												className='absolute origin-top-right top-5 right-4'
											>
												<HiX size={20} />
											</Menu.Item>
											{blocks
												?.filter(b => b.type !== 'interactionBlock')
												.map(block => (
													<div className='pt-4 pl-1' key={block.id}>
														<div>
															<h3 className='flex items-center gap-x-2 text-sm md:text-base'>
																<span
																	className={cx(
																		'leading-6 line-clamp-1 text-dark-title',
																		{
																			'text-zinc-600':
																				blocks[currentlyPlayingBlockIndex]
																					.id !== block.id,
																		}
																	)}
																>
																	{block.title || sentenceCase(block.type)}
																</span>
																<img
																	src={block.participants[0].picture}
																	alt={block.participants[0].displayName}
																	className='object-cover w-4 h-4 rounded-full'
																/>
															</h3>
															{block.type === 'codeBlock' && (
																<Menu.Item>
																	<div className='flex items-center justify-between mt-2 text-dark-body-200'>
																		<div className='flex items-center justify-start'>
																			<FiCode className='mr-2' size={16} />
																			<p className='text-sm font-body'>
																				Code Snippet
																			</p>
																		</div>
																		<button
																			type='button'
																			className='p-1.5 rounded-md cursor-pointer bg-incredible-dark-400'
																			onClick={async () => {
																				try {
																					await navigator.clipboard.writeText(
																						atob(block.code || '')
																					)
																				} catch (error) {
																					// eslint-disable-next-line no-console
																					console.error(error)
																				}
																			}}
																		>
																			<IoCopyOutline size={14} />
																		</button>
																	</div>
																</Menu.Item>
															)}
														</div>
													</div>
												))}
										</div>
									</Menu.Items>
								</Menu>
								{showTitle && (
									<h2
										className={cx('ml-4 font-bold font-main', {
											'text-sm sm:text-lg': orientation === 'portrait',
											'text-sm sm:text-lg md:text-2xl':
												orientation !== 'portrait',
										})}
									>
										{heading || 'Untitled'}
									</h2>
								)}
							</div>
							{currentCTA && (
								<a
									href={currentCTA?.url}
									target='_blank'
									rel='noreferrer noopener'
									className='ml-auto'
								>
									<Button
										size={
											orientation === 'portrait' ||
											(windowWidth && windowWidth < 520)
												? 'small'
												: 'large'
										}
										className='animate-pulse'
									>
										<h2
											className={cx({
												'text-xs': orientation === 'portrait',
												'text-xs sm:text-sm md:text-lg':
													orientation !== 'portrait',
											})}
										>
											{currentCTA?.text}
										</h2>
									</Button>
								</a>
							)}
						</div>
					</Controls>
					{!interactionUrl && (
						<Controls
							fullWidth
							hideOnMouseLeave
							activeDuration={2000}
							pin={orientation === 'portrait' ? 'topLeft' : 'bottomLeft'}
						>
							<ControlGroup>
								<ScrubberControl />
							</ControlGroup>

							<ControlGroup space='top'>
								<PlaybackControl />
								<VolumeControl />
								{orientation !== 'portrait' &&
								windowWidth &&
								windowWidth > 720 ? (
									<TimeProgress separator='/' className='hidden md:flex' />
								) : null}
								<ControlSpacer />
								{shouldHaveLogo &&
								orientation !== 'portrait' &&
								windowWidth &&
								windowWidth > 720 ? (
									<a
										href='https://incredible.dev'
										target='_blank'
										rel='noreferrer noopener'
										className='mx-2 my-auto'
									>
										<img className='h-6' src='/logo.svg' alt='Incredible.dev' />
									</a>
								) : null}

								{blocks?.some(b => b.type === 'interactionBlock') && (
									<Switch.Group>
										<div className='flex items-center'>
											<Switch.Label className='mr-2 font-body font-normal text-size-xs text-gray-50'>
												Interactions
											</Switch.Label>
											<Switch
												checked={interactionsEnabled}
												onChange={() => {
													setInteractionsEnabled(!interactionsEnabled)
												}}
												className={`${
													interactionsEnabled ? 'bg-[#22C55E]' : 'bg-gray-200'
												}  relative inline-flex items-center h-5 rounded-xl w-8 transition-colors focus:outline-none disabled:cursor-not-allowed`}
											>
												<span
													className={`${
														interactionsEnabled
															? 'translate-x-4'
															: 'translate-x-1'
													} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`}
												/>
											</Switch>
										</div>
									</Switch.Group>
								)}
								<CaptionControl />
								<PipControl />
								<SettingsControl />
								<FullscreenControl />
							</ControlGroup>
						</Controls>
					)}
					{interactionUrl && (
						<Controls
							fullHeight
							fullWidth
							pin='topLeft'
							className='relative'
							style={{
								padding: '0px',
								marginTop: '-8px',
								marginLeft: '-16px',
								width: 'calc(100% + 24px)',
								height: 'calc(100% + 16px)',
							}}
						>
							<button
								type='button'
								onClick={() => {
									if (!player.current) return
									const currentInteractionIndex = blocks?.findIndex(
										b => b.id === interactionId
									)
									if (
										blocks &&
										currentInteractionIndex &&
										currentInteractionIndex > -1 &&
										currentInteractionIndex + 1 !== blocks.length &&
										blocks[currentInteractionIndex + 1] &&
										blocks[currentInteractionIndex + 1].type ===
											'interactionBlock'
									) {
										setInteractionUrl(
											blocks[currentInteractionIndex + 1].interactionUrl
										)
										setInteractionId(blocks[currentInteractionIndex + 1].id)
									} else {
										player.current.currentTime += 0.1
										setInteractionUrl(undefined)
										player.current.play()
									}
								}}
								className='absolute top-3 right-6 bg-black px-2 py-1.5 text-sm rounded-md text-white z-50 flex items-center gap-x-2 opacity-70 hover:opacity-100 transition-all'
							>
								<IoCloseOutline />
								Close
							</button>
							<button
								type='button'
								onClick={() => {
									if (!player.current) return
									if (player.current.isFullscreenActive) {
										player.current.exitFullscreen()
										setIsFullScreen(false)
									} else {
										player.current.enterFullscreen()
										setIsFullScreen(true)
									}
								}}
								className='absolute bottom-4 right-4 bg-black px-2 py-1.5 text-sm rounded-md text-white z-50 flex items-center gap-x-2 opacity-70 hover:opacity-100 transition-all'
							>
								{isFullScreen ? (
									<BiExitFullscreen className='h-5 w-5' />
								) : (
									<BiFullscreen className='h-5 w-5' />
								)}
							</button>
							<iframe
								src={interactionUrl}
								className='w-full h-full z-40'
								title='Interaction'
								allow='accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking;'
								sandbox='allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts'
							/>
						</Controls>
					)}
				</Ui>
			</Player>
			{orientation !== 'portrait' && (
				<HorizontalContainer className='py-4 px-4 m-0 text-white rounded-b-md bg-[#18181B]'>
					{blocks
						?.filter(b => {
							if (b.type === 'interactionBlock' && !interactionsEnabled)
								return false
							return true
						})
						?.map(
							({
								id,
								title,
								thumbnail,
								playbackDuration,
								type,
								interactionType,
								interactionUrl: iUrl,
							}: BlockMeta) => {
								// console.log(type);

								if (type === 'interactionBlock') {
									return (
										<button
											type='button'
											className='flex-shrink-0 aspect-1 w-16 md:w-[92px]'
											key={id}
											onClick={() => {
												player.current?.pause()
												setInteractionUrl(iUrl)
												setInteractionId(id)
											}}
										>
											<div
												className={cx(
													'border border-gray-600 rounded-md hover:border-green-600  w-full h-full p-[2px]',
													{
														'border-green-600':
															id === interactionId &&
															interactionUrl !== undefined,
													}
												)}
											>
												<div className='flex items-center justify-center rounded-sm w-full h-full flex-shrink-0 bg-zinc-700'>
													<div className='transform scale-[1.5] md:scale-[2] filter grayscale brightness-[0.6]'>
														{(() => {
															switch (interactionType) {
																case 'codesandbox':
																	return <CodeSandbox />
																case 'replit':
																	return <Replit />
																case 'stackblitz':
																	return <StackBlitz />
																default:
																	return null
															}
														})()}
													</div>
												</div>
											</div>
											<h4 className='p-1 text-size-xs font-body font-normal truncate pr-2 text-left'>
												{title || sentenceCase(type)}
											</h4>
										</button>
									)
								}

								return (
									<button
										type='button'
										key={id}
										className='flex flex-col justify-center flex-shrink-0 w-28 md:w-40'
										onClick={async () => {
											if (!player.current) return
											player.current.currentTime = playbackDuration
											if (player.current.paused) {
												player.current.play()
											}
											setInteractionUrl(undefined)
										}}
									>
										<div
											className={cx(
												'w-full h-full border border-gray-600 rounded-md hover:border-green-600 flex-shrink-0 p-[2px]',
												{
													'border-green-600':
														id === blocks[currentlyPlayingBlockIndex].id &&
														interactionUrl === undefined,
												}
											)}
										>
											<img
												className='h-full w-full rounded-sm flex-shrink-0'
												src={
													thumbnail
														? `${process.env.NEXT_PUBLIC_CDN_URL}${thumbnail}`
														: CardFallback.src
												}
												alt='block_image'
											/>
										</div>
										<h4 className='p-1 text-size-xs font-body font-normal truncate pr-4'>
											{title || sentenceCase(type)}
										</h4>
									</button>
								)
							}
						)}
				</HorizontalContainer>
			)}
		</div>
	)
}
