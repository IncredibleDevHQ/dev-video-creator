import { cx } from '@emotion/css'
import { Popover } from '@headlessui/react'
import { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { IoPersonCircleOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockIdAtom,
	flickAtom,
	flickNameAtom,
	participantsAtom,
	previewPositionAtom,
} from 'src/stores/flick.store'
import useUpdatePayload from 'src/utils/hooks/useUpdatePayload'
import {
	RoomEventTypes,
	useBroadcastEvent,
	useEventListener,
	useMap,
	useRoom,
} from 'src/utils/liveblocks.config'
import trpc, { inferQueryOutput } from 'server/trpc'
import { Avatar, Text } from 'ui/src'
import { useDebouncedCallback } from 'use-debounce'
import { IntroBlockView } from 'utils/src'

const EditorHeader = () => {
	const flickId = useRecoilValue(flickAtom)?.id
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const participants = useRecoilValue(participantsAtom)

	const [flickName, setFlickName] = useRecoilState(flickNameAtom)
	const updateFlickMutation = trpc.useMutation(['story.update'])
	const broadcast = useBroadcastEvent()

	const blocks = useRecoilValue(astAtom)?.blocks
	const config = useMap('viewConfig')?.get(activeFragmentId as string)
	const viewConfig = config?.toObject()

	const { updatePayload } = useUpdatePayload({
		blockId: blocks?.[0]?.id as string,
		shouldUpdateLiveblocks: false,
	})

	const setCurrentBlockId = useSetRecoilState(currentBlockIdAtom)
	const setPreviewPosition = useSetRecoilState(previewPositionAtom)

	const debounceUpdateFlickName = useDebouncedCallback(
		value =>
			updateFlickMutation.mutateAsync({
				name: value,
				id: flickId,
			}),
		1000
	)

	const updateFlickName = async (newName: string) => {
		setFlickName(newName)
		broadcast({
			type: RoomEventTypes.FlickNameChanged,
			payload: newName,
		})
		debounceUpdateFlickName(newName)
	}

	useEventListener(({ event }) => {
		if (event.type === RoomEventTypes.FlickNameChanged) {
			setFlickName(event.payload)
		}
	})

	const handleFocus = (
		e:
			| React.MouseEvent<HTMLInputElement, MouseEvent>
			| React.FocusEvent<HTMLInputElement, Element>
	) => {
		setCurrentBlockId(blocks?.[0]?.id ?? null)
		setPreviewPosition(e.currentTarget.offsetTop - 48)
		if (!blocks) return
		const introBlock = blocks[0]
		const introBlockView = viewConfig?.blocks?.get(introBlock.id as string)
			?.view as IntroBlockView
		updatePayload?.({
			activeIntroIndex: introBlockView?.intro?.order?.findIndex(
				o => o.state === 'titleSplash'
			),
		})
	}

	/* Speakers */

	const [speakers, setSpeakers] = useState<
		inferQueryOutput<'story.byId'>['Participants']
	>([])
	const room = useRoom()
	useEffect(() => {
		setSpeakers(viewConfig?.speakers ?? [])
	}, [viewConfig?.speakers])
	useEffect(() => {
		let unsubscribe: any
		if (config && !unsubscribe) {
			unsubscribe = room.subscribe(
				config,
				() => {
					setSpeakers(config.get('speakers'))
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [config, room])

	const addSpeaker = (
		speaker: inferQueryOutput<'story.byId'>['Participants'][number]
	) => {
		if (!config) return
		config.set('speakers', [...(viewConfig?.speakers ?? []), speaker])
	}

	const deleteSpeaker = (
		speaker: inferQueryOutput<'story.byId'>['Participants'][number]
	) => {
		if (!config) return
		config.set(
			'speakers',
			viewConfig?.speakers?.filter(
				(s: { user: { sub: string } }) => s.user.sub !== speaker.User.sub
			) ?? []
		)
	}

	return (
		<div className='border-b pb-4 mb-6 -ml-px'>
			<input
				onMouseDown={handleFocus}
				onFocus={handleFocus}
				maxLength={50}
				onChange={e => {
					updateFlickName(e.target.value)
				}}
				placeholder='Add a title'
				className='w-full text-[2.35em] font-extrabold text-gray-800 resize-none font-main focus:outline-none placeholder-gray-300 bg-white'
				value={flickName ?? ''}
			/>
			<div className='flex items-center justify-start mt-2'>
				{speakers &&
					speakers.length > 0 &&
					speakers.map(s => (
						<div
							className='flex items-center px-2 py-1 mr-2 border border-gray-300 rounded-md font-body flex-shrink-0'
							key={s.User.sub}
						>
							<Avatar
								src={s.User.picture as string}
								name={s.User.displayName as string}
								alt={s.User.displayName as string}
								className='w-5 h-5 rounded-full'
							/>
							<Text textStyle='caption' className='ml-1.5 mr-2 text-gray-600'>
								{s.User.displayName}
							</Text>
							<FiX
								className='cursor-pointer'
								onClick={() => deleteSpeaker(s)}
							/>
						</div>
					))}
				<Popover className='relative w-full'>
					{speakers.length !== participants.length && (
						<Popover.Button
							type='button'
							className='flex items-center py-1 px-2 text-gray-400 text-size-xs rounded-sm border-2 border-transparent transition-all bg-gray-100 hover:bg-gray-200 hover:text-gray-500 gap-x-2 font-body'
						>
							<IoPersonCircleOutline size={18} /> Add speaker
						</Popover.Button>
					)}
					<Popover.Panel className='absolute z-10' as='div'>
						<div className='flex flex-col bg-white rounded-lg shadow-2xl font-body p-1'>
							{participants
								.filter(
									(p: { id: string }) => !speakers?.some(s => s.id === p.id)
								)
								.map(
									(
										participant: inferQueryOutput<'story.byId'>['Participants'][number]
									) => (
										<div
											role='button'
											tabIndex={0}
											onKeyDown={() => null}
											className={cx(
												'flex items-center px-4 transition-colors hover:bg-gray-100 gap-x-2 py-1 rounded-sm'
											)}
											key={participant.id}
											onClick={() => {
												if (participant) {
													addSpeaker(participant)
												}
											}}
										>
											<Avatar
												src={participant.User.picture as string}
												alt={participant.User.displayName as string}
												name={participant.User.displayName as string}
												className='w-6 h-6 rounded-full'
											/>
											<Text textStyle='caption'>
												{participant.User.displayName}
											</Text>
										</div>
									)
								)}
						</div>
					</Popover.Panel>
				</Popover>
			</div>
		</div>
	)
}

export default EditorHeader
