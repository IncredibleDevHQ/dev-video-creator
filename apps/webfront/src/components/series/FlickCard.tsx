/* eslint-disable @next/next/no-img-element */
import { cx } from '@emotion/css'
import { format, intervalToDuration } from 'date-fns'
import Link from 'next/link'
import { IoPlayOutline, IoSparklesOutline } from 'react-icons/io5'
import {
	Content_Type_Enum_Enum,
	SeriesFlickFragment,
} from 'src/graphql/generated'
import { Avatar } from 'ui/src'

const FlickCard = ({ flick }: { flick: SeriesFlickFragment }) => {
	const duration = flick.flick?.duration
		? intervalToDuration({ start: 0, end: flick.flick.duration * 1000 })
		: undefined

	const hasFlick = !!flick.flick?.contents.find(
		c => c.type === Content_Type_Enum_Enum.Video
	)

	const hasHighlights = !!flick.flick?.contents.find(
		c => c.type === Content_Type_Enum_Enum.VerticalVideo
	)

	return (
		<Link href={`/watch/${flick.flick?.joinLink}`}>
			<div className='flex flex-col relative items-stretch p-4 border rounded-md cursor-pointer md:flex-row group gap-x-6 border-dark-200 hover:border-green-600'>
				<div className='relative flex flex-col justify-center md:w-2/5'>
					<div className='relative aspect-w-5 aspect-h-3'>
						<div>
							<img
								className='object-cover w-full h-full transition-colors border-transparent rounded-md'
								src={
									flick.flick?.contents?.find(
										f => f.type === Content_Type_Enum_Enum.Video
									)?.thumbnail
										? `${process.env.NEXT_PUBLIC_CDN_URL}${
												flick.flick?.contents?.find(
													f => f.type === Content_Type_Enum_Enum.Video
												)?.thumbnail
										  }`
										: '/card_fallback.png'
								}
								alt={flick.flick?.name}
							/>
							{duration && (
								<div className='absolute z-10 p-1 text-xs tracking-wide rounded-md shadow-sm bottom-3 right-3 bg-dark-200'>
									{duration.minutes}:{duration.seconds}
								</div>
							)}
						</div>
					</div>
				</div>
				<div className='flex flex-col flex-1 mt-4 md:mt-0 space-between'>
					<div className='flex flex-col flex-1 space-between'>
						<h2 className='mb-2 text-base font-main'>{flick.flick?.name}</h2>
						{flick.flick?.description && (
							<p className='mb-2 text-dark-title-200 text-size-xs md:text-size-sm line-clamp-2 md:line-clamp-3 w-full'>
								{flick.flick.description}
							</p>
						)}
						<div className='flex items-center justify-start text-size-xxs gap-x-2 text-dark-title-200'>
							{hasFlick && (
								<span className='flex items-center rounded-sm py-1 px-1.5 gap-x-2 bg-green-600/10 text-green-600'>
									<IoPlayOutline /> Video
								</span>
							)}
							{hasHighlights && (
								<span className='flex items-center rounded-sm py-1 px-1.5 gap-x-2 bg-[#7C3AED]/10 text-[#7C3AED]'>
									<IoSparklesOutline /> Highlight
								</span>
							)}
						</div>
					</div>

					<div className='relative flex h-8 mt-4'>
						{flick.flick?.participants.map((participant, index) => {
							const getRing = (i: number) => {
								if (i === 0) return 'border-green-500'
								if (i === 1) return 'border-purple-400'
								if (i === 2) return 'border-blue-400'
								if (i === 3) return 'border-indigo-500'
								return 'border-yellow-400'
							}

							return (
								<Link href={`/${participant.user.username}`}>
									<div
										key={participant.id}
										className={cx(
											'bottom-0 overflow-hidden border-2 w-6 h-6 md:w-8 md:h-8 rounded-full',
											{
												'-ml-2': index > 0,
											},
											getRing(index % 3)
										)}
										data-tip={
											participant.id === flick.flick?.ownerId
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
							)
						})}
					</div>
					{flick.flick?.contents?.find(
						c => c.type === Content_Type_Enum_Enum.Video
					)?.published_at ? (
						<time className='mt-1 text-size-xs md:text-size-sm text-dark-title-200'>
							{format(
								new Date(
									flick.flick.contents.find(
										c => c.type === Content_Type_Enum_Enum.Video
									)?.published_at
								),
								'do MMMM yyyy'
							)}
						</time>
					) : (
						<p className='mt-1 text-size-xs md:text-size-sm text-dark-title-200'>
							Unpublished
						</p>
					)}
				</div>
			</div>
		</Link>
	)
}

export default FlickCard
