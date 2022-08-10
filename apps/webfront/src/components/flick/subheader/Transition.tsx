import { css, cx } from '@emotion/css'
import { Popover, Transition as TransitionAnim } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { IoCheckmark } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { transitionAtom, TransitionConfig } from 'src/stores/studio.store'
import { useEnv } from 'utils/src'
import TransitionIcon from 'svg/TransitionIcon.svg'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
} from 'src/utils/liveblocks.config'
import { flickAtom } from 'src/stores/flick.store'
import trpc, { inferQueryOutput } from '../../../server/trpc'

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

const TransitionCard = ({
	transition,
	active,
	tab,
	transitionConfig,
	updateTransitions,
}: {
	transition: inferQueryOutput<'story.getTransitions'>[number]
	active: boolean
	tab: 'block' | 'swap'
	transitionConfig: TransitionConfig | undefined
	updateTransitions: (config: TransitionConfig) => void
}) => {
	const {
		storage: { cdn: baseUrl },
	} = useEnv()

	const tc = JSON.parse(JSON.stringify(transition.config))

	const imageSrc = tc.thumbnail ? baseUrl + tc.thumbnail : ''

	const gifSrc = tc.gif ? baseUrl + tc.gif : ''

	const [src, setSrc] = useState<string>(imageSrc)

	return (
		<button
			type='button'
			key={transition.name}
			className='relative flex items-center justify-center py-4 group'
			onMouseEnter={() => {
				setSrc(gifSrc)
			}}
			onMouseLeave={() => {
				setSrc(imageSrc)
			}}
			onClick={() => {
				if (tab === 'block') {
					updateTransitions({
						...transitionConfig,
						blockTransition: transition,
					})
				} else {
					updateTransitions({
						...transitionConfig,
						swapTransition: transition,
					})
				}
			}}
		>
			<div
				className='object-cover w-64 border-2 border-gray-600 rounded-md shadow-md hover:border-brand h-36 relative'
				style={{
					backgroundImage: `url(${src})`,
					backgroundSize: '256px 144px',
				}}
			>
				{active && (
					<IoCheckmark
						size={24}
						className='absolute p-1 font-bold rounded-md top-2 right-2 text-brand bg-green-600'
					/>
				)}
			</div>
		</button>
	)
}

const Transition = () => {
	const [tab] = useState<'block' | 'swap'>('swap')

	const { data } = trpc.useQuery([
		'story.getTransitions',
		{
			limit: 25,
			offset: 0,
		},
	])
	const flickId = useRecoilValue(flickAtom)?.id
	const [transitionConfig, setTransitionConfig] = useRecoilState(transitionAtom)

	const broadcast = useBroadcastEvent()
	const { mutateAsync: updateConfig } = trpc.useMutation([
		'story.updateTransition',
	])

	const updateTransitions = (config: TransitionConfig) => {
		setTransitionConfig(config)
		updateConfig({
			id: flickId as string,
			config: {
				transitions: config,
			},
		})
		broadcast({
			type: RoomEventTypes.TransitionChanged,
			payload: config,
		})
	}

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.TransitionChanged) {
			setTransitionConfig(event.payload)
		}
	})

	return (
		<Popover>
			{({ open }) => (
				<>
					<Popover.Button
						className={cx(
							'text-gray-100 flex items-center gap-x-2 text-size-xs hover:bg-white/10 px-2 py-2 rounded-sm transform active:scale-95 transition-all font-main font-semibold',
							{
								'bg-white/10': open,
							}
						)}
					>
						<TransitionIcon />
						Transition
					</Popover.Button>
					<TransitionAnim
						as={Fragment}
						enter='transition ease-out duration-200'
						enterFrom='opacity-0 -translate-y-10'
						enterTo='opacity-100 translate-y-1'
						leave='transition ease-in duration-150'
						leaveFrom='opacity-100 translate-y-0'
						leaveTo='opacity-0 -translate-y-10'
					>
						<Popover.Panel className='absolute z-10 right-0 mt-1.5' as='div'>
							<div
								className={cx(
									'text-white rounded-md p-4 max-h-screen mx-4',
									css`
										background-color: #27272a;
										width: 70vw;
									`
								)}
							>
								{/* <div className='flex items-center text-size-xs gap-x-4'>
								<button
									className={cx({
										'text-dark-title': tab !== 'block',
									})}
									type='button'
									onClick={() => {
										setTab('block')
									}}
								>
									Block transitions
								</button>
								<button
									className={cx({
										'text-dark-title': tab !== 'swap',
									})}
									type='button'
									onClick={() => {
										setTab('swap')
									}}
								>
									Swap transitions
								</button>
							</div> */}
								<div
									className={cx(
										'flex gap-x-4 z-50 overflow-x-scroll',
										horizontalCustomScrollBar
									)}
								>
									{data?.map(transition => (
										<TransitionCard
											tab={tab}
											key={transition.name}
											active={
												tab === 'block'
													? transitionConfig?.blockTransition?.name ===
													  transition.name
													: transitionConfig?.swapTransition?.name ===
													  transition.name
											}
											transition={transition}
											transitionConfig={transitionConfig}
											updateTransitions={config => updateTransitions(config)}
										/>
									))}
								</div>
							</div>
						</Popover.Panel>
					</TransitionAnim>
				</>
			)}
		</Popover>
	)
}

export default Transition
