import debounce from 'lodash/debounce'
import Link from 'next/link'
import ReactTooltip from 'react-tooltip'
import { cx } from '@emotion/css'
import {
	FollowMutationVariables,
	SeriesParticipantFragment,
	useFollowMutation,
	useUnfollowMutation,
} from 'src/graphql/generated'
import { useUser } from 'src/utils/providers/auth'
import { Avatar, Button, emitToast } from 'ui/src'

const Collaborators = ({
	seriesTags,
	seriesParticipants,
	setSeriesParticipants,
}: {
	seriesParticipants: (SeriesParticipantFragment & { following?: boolean })[]
	setSeriesParticipants: (
		participants: (SeriesParticipantFragment & { following?: boolean })[]
	) => void
	seriesTags: string[]
}) => {
	const { uid: sub } = useUser().user ?? {}

	const [follow] = useFollowMutation()
	const [unfollow] = useUnfollowMutation()

	const handleUserFollow = async ({
		targetId,
		followerId,
		isFollowing,
		participantId,
	}: FollowMutationVariables & {
		isFollowing: boolean
		participantId: string
	}) => {
		const participants = [...seriesParticipants]
		const participantIndex = participants.findIndex(p => p.id === participantId)
		if (participantIndex === -1) return

		if (isFollowing) {
			const { data, errors } = await unfollow({
				variables: {
					followerId,
					targetId,
				},
			})
			if (data?.UnfollowUser?.success) {
				participants.splice(participantIndex, 1, {
					...participants[participantIndex],
					following: false,
				})
			}
			if (errors)
				emitToast('Something went wrong', {
					type: 'error',
				})
		} else {
			const { data, errors } = await follow({
				variables: {
					targetId,
					followerId,
				},
			})
			if (data) {
				emitToast(
					`Now following ${participants[participantIndex].user.displayName}`,
					{
						type: 'success',
					}
				)
				participants.splice(participantIndex, 1, {
					...participants[participantIndex],
					following: true,
				})
			}
			if (errors)
				emitToast('Something went wrong', {
					type: 'error',
				})
		}
		setSeriesParticipants(participants)
	}

	const handleUserFollowDebounced = debounce(handleUserFollow, 500)

	return (
		<div className='flex flex-col items-start justify-start w-full mb-6 pb-4 md:pt-0 md:mt-0 px-1 md:px-0 border-b border-dark-100 md:border-transparent'>
			<h2 className='flex items-center mb-4 font-semibold text-dark-title font-main'>
				Collaborators{' '}
				<span className='ml-2 bg-dark-400 text-size-sm px-2 py-1.5 rounded-sm'>
					{seriesParticipants.length}
				</span>
			</h2>

			<div className='flex -space-x-1 md:hidden'>
				{seriesParticipants?.map((participant, index) => {
					const getRing = (i: number) => {
						if (i === 0) return 'border-green-500'
						if (i === 1) return 'border-purple-400'
						if (i === 2) return 'border-blue-400'
						if (i === 3) return 'border-indigo-500'
						return 'border-yellow-400'
					}

					return (
						<Link href={`/${participant.user.username}`} passHref>
							<a href={`/${participant.user.username}`}>
								<Avatar
									src={participant.user.picture ?? ''}
									alt={participant.user.displayName ?? ''}
									className={cx(
										'h-8 w-8 rounded-full border-2 cursor-pointer',
										getRing(index)
									)}
									name={participant.user.displayName ?? ''}
								/>
							</a>
						</Link>
					)
				})}
			</div>
			<div className='hidden md:flex flex-col gap-y-2.5'>
				{seriesParticipants?.map((participant, index) => {
					const getRing = (i: number) => {
						if (i === 0) return 'border-green-500'
						if (i === 1) return 'border-purple-400'
						if (i === 2) return 'border-blue-400'
						if (i === 3) return 'border-indigo-500'
						return 'border-yellow-400'
					}

					return (
						<div className='flex items-center w-full'>
							<div
								className={cx(
									'mr-2 overflow-hidden border-2 flex-shrink-0 w-8 h-8 rounded-full',
									getRing(index)
								)}
								data-tip
								data-place='left'
								data-effect='solid'
								data-for={participant.id}
								data-event='click mouseenter focus'
								data-event-off='blur mouseleave'
							>
								<Avatar
									src={participant.user.picture ?? ''}
									alt={participant.user.displayName ?? ''}
									className='cursor-pointer'
									name={participant.user.displayName ?? ''}
								/>
							</div>
							<Link href={`/${participant.user.username}`} passHref>
								<h6 className='text-size-sm cursor-pointer w-full'>
									{participant.user.displayName}
								</h6>
							</Link>
							<ReactTooltip
								id={participant.id}
								type='dark'
								globalEventOff='click'
								delayShow={500}
								delayHide={500}
								clickable
							>
								<div className='flex flex-col items-start rounded-md'>
									<Link href={`/${participant.user.username}`} passHref>
										<div className='flex items-center justify-between cursor-pointer'>
											<div
												className={cx(
													'mr-2 overflow-hidden border-2 flex-shrink-0 w-8 h-8 rounded-full',
													getRing(index)
												)}
											>
												<Avatar
													src={participant.user.picture ?? ''}
													alt={participant.user.displayName ?? ''}
													className='cursor-pointer'
													name={participant.user.displayName ?? ''}
												/>
											</div>
											<div>
												<p className='text-size-xs'>
													{participant.user.displayName}
												</p>
												<p className='text-size-xxs text-dark-title-200'>
													{`@${participant.user.username}`}
												</p>
											</div>
										</div>
									</Link>

									<Button
										className={cx('mt-3 max-w-none w-full', {
											'border border-dark-100 hover:bg-dark-100/30 active:scale-95':
												participant.following,
										})}
										appearance={participant.following ? 'none' : 'solid'}
										onClick={() =>
											handleUserFollowDebounced({
												followerId: sub as string,
												targetId: participant.user.sub,
												isFollowing: participant.following ?? false,
												participantId: participant.id,
											})
										}
									>
										{participant.following ? 'Following' : 'Follow'}
									</Button>
								</div>
							</ReactTooltip>
						</div>
					)
				})}
			</div>
			{seriesTags.length > 0 && (
				<>
					<hr className='w-full my-4 border-dark-200' />
					<h2 className='mb-4 text-lg font-semibold text-dark-title font-main'>
						Tags{' '}
						<span className='ml-2 bg-dark-400 text-xs px-2 py-[2px] rounded-sm'>
							{seriesTags.length}
						</span>
					</h2>
					<div className='flex flex-wrap items-center justify-start'>
						{seriesTags.map(tag => (
							<span
								key={tag}
								className='px-2 py-1 mr-2 text-xs rounded-sm bg-dark-100 font-main'
							>
								{tag}
							</span>
						))}
					</div>
				</>
			)}
		</div>
	)
}

export default Collaborators
