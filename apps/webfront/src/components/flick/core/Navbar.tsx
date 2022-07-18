/* eslint-disable no-nested-ternary */
import AgoraRTC from 'agora-rtc-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	IoChevronBackOutline,
	IoHeadsetOutline,
	IoPeopleOutline,
} from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import {
	flickAtom,
	flickNameAtom,
	participantsAtom,
	View,
	viewAtom,
} from 'src/stores/flick.store'
import {
	Presence,
	PresencePage,
	useMyPresence,
	useOthers,
} from 'src/utils/liveblocks.config'
import { useUser } from 'src/utils/providers/auth'
import StudioLogo from 'svg/StudioLogo.svg'
import { Avatar, Button, emitToast, Heading } from 'ui/src'
import Huddle from './Huddle'
import Invite from './Invite'

const Navbar = () => {
	const flickId = useRecoilValue(flickAtom)?.id
	const flickName = useRecoilValue(flickNameAtom)
	const { user } = useUser()
	const participants = useRecoilValue(participantsAtom)
	const [inviteOpen, setInviteOpen] = useState(false)

	const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
	const [currentAudioDevice, setCurrentAudioDevice] =
		useState<MediaDeviceInfo>()

	const [inHuddle, setInHuddle] = useState(false)

	const participant = useCallback(
		() => participants?.find(p => p.userSub === user?.uid),
		[participants, user?.uid]
	)

	const participantId = participant()?.id

	const joinHuddle = async () => {
		try {
			if (!flickId) return

			// NOTE - Get microphone devices
			const devices = await AgoraRTC.getMicrophones()

			// NOTE - Set audio devices
			setAudioDevices(devices)
			setCurrentAudioDevice(devices[0])
			setInHuddle(true)
		} catch (error: any) {
			emitToast(error?.message || 'Error joining huddle', {
				type: 'error',
			})
		}
	}
	const others = useOthers()
	const [myPresence, updateMyPresence] = useMyPresence()

	const view = useRecoilValue(viewAtom)

	useEffect(() => {
		if (view === View.Notebook) {
			updateMyPresence({
				page: PresencePage.Notebook,
			})
		} else {
			updateMyPresence({
				page: PresencePage.Preview,
			})
		}
	}, [updateMyPresence, view])

	const someoneInHuddle = useMemo(() => {
		let isInHuddle = false
		others.map(({ presence }) => {
			if (presence) {
				if (presence && !isInHuddle) {
					isInHuddle = presence.inHuddle
				}
			}
			return null
		})
		return isInHuddle
	}, [others])

	const peopleInHuddle = useMemo(() => {
		const people: Presence[] = []
		others?.map(({ presence }) => {
			if (presence) {
				if (presence.inHuddle) people.push(presence)
			}
			return null
		})
		if (myPresence.inHuddle) people.push(myPresence)
		return people
	}, [others, myPresence])

	return (
		<div className='relative flex h-12 w-full flex-row items-center justify-between bg-gray-900 px-5'>
			<Link href='/dashboard' passHref>
				<div className='flex items-center gap-x-1 cursor-pointer -ml-1.5'>
					<IoChevronBackOutline className='text-gray-400 h-4 w-4' />
					<StudioLogo />
				</div>
			</Link>
			<Heading
				as='h1'
				textStyle='smallTitle'
				className='text-dark-title absolute left-0 right-0 mx-auto w-96 text-center truncate'
			>
				{flickName}
			</Heading>
			<div className='flex items-center gap-x-4'>
				{inHuddle && participantId && participants ? (
					<Huddle
						devices={audioDevices}
						setInHuddle={setInHuddle}
						participantId={participantId}
						deviceId={currentAudioDevice?.deviceId}
					/>
				) : someoneInHuddle ? (
					<div className='border border-green-600 rounded-full flex justify-end items-center p-1'>
						<button
							type='button'
							className='px-2 flex items-center bg-green-600 cursor-pointer rounded-full h-7 text-white mr-2 gap-x-1'
							onClick={joinHuddle}
						>
							<IoHeadsetOutline size={14} />
							<span className='text-size-xxs'>Join</span>
						</button>
						{peopleInHuddle?.map(otherPresence => (
							<Avatar
								className='h-7 w-7 rounded-full'
								src={otherPresence.user.picture}
								name={otherPresence.user.name}
								alt={otherPresence.user.name}
							/>
						))}
					</div>
				) : (
					<button
						type='button'
						onClick={joinHuddle}
						style={{
							backgroundColor: '#4ADE8033',
						}}
						className='border-4 border-green-600/10 rounded-full cursor-pointer'
					>
						<div className='border-2 border-green-600 rounded-full p-1 bg-dark-500 text-gray-600'>
							<IoHeadsetOutline size={14} />
						</div>
					</button>
				)}
				{peopleInHuddle.length !== others.count + 1 && (
					<div className='flex items-center gap-x-2'>
						{myPresence.user && !myPresence.inHuddle && (
							<Avatar
								src={myPresence.user.picture}
								name={myPresence.user.name}
								alt={myPresence.user.name}
								className='h-7 w-7 rounded-full'
							/>
						)}
						{others?.map(({ presence }) => {
							if (presence) {
								const otherPresence = presence as Presence
								return otherPresence.inHuddle ? null : (
									<Avatar
										src={otherPresence.user.picture}
										name={otherPresence.user.name}
										className='h-7 w-7 rounded-full'
										alt={otherPresence.user.name}
									/>
								)
							}
							return null
						})}
					</div>
				)}
				<Button
					leftIcon={<IoPeopleOutline className='h-4 w-4' />}
					colorScheme='dark'
					onClick={() => setInviteOpen(true)}
				>
					Invite
				</Button>
			</div>
			{inviteOpen && (
				<Invite
					open={inviteOpen}
					handleClose={() => {
						setInviteOpen(false)
					}}
				/>
			)}
		</div>
	)
}

export default Navbar
