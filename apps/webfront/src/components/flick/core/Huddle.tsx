/* eslint-disable react-hooks/exhaustive-deps */
import { cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import { createMicrophoneAudioTrack } from 'agora-rtc-react'
import { useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { FiMic, FiMicOff } from 'react-icons/fi'
import { IoHeadsetOutline, IoChevronDownOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { useGetHuddleRtcTokenMutation } from 'src/graphql/generated'
import { flickAtom, participantsAtom } from 'src/stores/flick.store'
import useAudio from 'src/utils/hooks/useAudio'
import { useUpdateMyPresence } from 'src/utils/liveblocks.config'
import { emitToast, Avatar } from 'ui/src'

const Huddle = ({
	devices,
	deviceId,
	setInHuddle,
	participantId,
}: {
	deviceId?: string
	participantId: string
	devices: MediaDeviceInfo[]
	setInHuddle: (inHuddle: boolean) => void
}) => {
	const flickId = useRecoilValue(flickAtom)?.id
	const participants = useRecoilValue(participantsAtom)
	const updateMyPresence = useUpdateMyPresence()

	useEffect(() => {
		updateMyPresence({
			inHuddle: true,
		})
		return () => {
			updateMyPresence({
				inHuddle: false,
			})
		}
	}, [])

	const [rtcToken, setRtcToken] = useState<string>()
	const useTrack = createMicrophoneAudioTrack(
		deviceId
			? {
					microphoneId: deviceId,
			  }
			: undefined
	)
	const { ready: trackReady, error: trackError, track } = useTrack()
	const [getHuddleToken] = useGetHuddleRtcTokenMutation()
	const {
		init,
		mute,
		join,
		users,
		leave,
		renewToken,
		currentUser,
		ready: agoraReady,
		setMicrophoneDevice,
	} = useAudio()

	const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
		deviceId
	)
	useEffect(() => {
		if (selectedDeviceId) {
			setMicrophoneDevice(selectedDeviceId)
		}
	}, [selectedDeviceId])

	useEffect(() => {
		if (!agoraReady || !participantId || !track || !rtcToken) return
		;(async () => {
			try {
				if (!participantId || !rtcToken) {
					track?.stop()
					await leave()
					setInHuddle(false)
					emitToast('Failed to get huddle token', {
						type: 'error',
					})
					return
				}
				await join(rtcToken, participantId, track)
			} catch (error: any) {
				track?.stop()
				await leave()
				setInHuddle(false)
				emitToast(`Failed to initialize AgoraRTC ${error?.message}`, {
					type: 'error',
				})
			}
		})()
	}, [agoraReady, participantId, track, rtcToken])

	useEffect(() => {
		;(async () => {
			try {
				if (!trackReady || !track || !flickId || !participantId) return
				const { data } = await getHuddleToken({
					variables: {
						flickId,
					},
				})
				if (data?.HuddleRtcToken?.token) {
					setRtcToken(data.HuddleRtcToken.token)
				}
				await init(
					flickId,
					{
						onTokenWillExpire: async () => {
							const { data: huddleTokenData } = await getHuddleToken({
								variables: { flickId },
							})
							if (huddleTokenData?.HuddleRtcToken?.token) {
								renewToken(huddleTokenData?.HuddleRtcToken?.token)
							}
						},
						onTokenDidExpire: async () => {
							const { data: huddleTokenData } = await getHuddleToken({
								variables: { flickId },
							})
							if (huddleTokenData?.HuddleRtcToken?.token) {
								join(
									huddleTokenData?.HuddleRtcToken?.token,
									participantId,
									track
								)
							}
						},
					},
					{ uid: participantId, track, hasAudio: true }
				)
			} catch (error: any) {
				track?.stop()
				await leave()
				setInHuddle(false)
				emitToast(`Failed to initialize AgoraRTC ${error?.message}`, {
					type: 'error',
				})
			}
		})()
	}, [trackReady, track, flickId, participantId])

	useEffect(() => {
		;(async () => {
			if (trackError) {
				await leave()
				track?.close()
				setInHuddle(false)
				emitToast(trackError.message, {
					type: 'error',
				})
			}
		})()
	}, [trackError])

	if (trackError)
		return (
			<div className='text-red-500 text-xs'>
				{trackError?.message || 'Error joining'}
			</div>
		)

	if (!agoraReady || !trackReady)
		return (
			<div
				style={{
					backgroundColor: '#4ADE8033',
				}}
				className='flex gap-x-2 items-center border-4 border-green-600/10 rounded-full cursor-pointer'
			>
				<div className='border-2 border-green-600 rounded-full p-1 bg-dark-500 text-gray-600'>
					<IoHeadsetOutline size={14} />
				</div>
				<span className='text-gray-200 text-size-xxs mr-2'>Connecting...</span>
			</div>
		)

	return (
		<div className='border border-green-600 rounded-full flex justify-end items-center p-[3px]'>
			<button
				type='button'
				className='flex items-center justify-center bg-green-600 cursor-pointer rounded-full h-7 w-7 text-white'
				onClick={async () => {
					track?.close()
					await leave()
					setInHuddle(false)
				}}
			>
				<IoHeadsetOutline size={14} />
			</button>
			<div className='group rounded-sm hover:bg-dark-200 flex items-center cursor-pointer ml-3 mr-1 gap-x-1'>
				<button
					type='button'
					className='text-white flex items-center hover:bg-dark-100 rounded-l-sm justify-center px-1 py-1.5'
					onClick={mute}
				>
					{currentUser?.hasAudio ? (
						<FiMic className='cursor-pointer flex-shrink-0' size={14} />
					) : (
						<FiMicOff className='cursor-pointer flex-shrink-0' size={14} />
					)}
				</button>
				<Listbox
					value={
						devices.find(d => d.deviceId === selectedDeviceId)?.deviceId || ''
					}
					onChange={setSelectedDeviceId}
				>
					<div className='relative'>
						<Listbox.Button className='hover:bg-dark-100 px-px py-1.5 rounded-r-sm flex items-center justify-center'>
							<IoChevronDownOutline size={14} color='FFF' />
						</Listbox.Button>
						<Listbox.Options
							style={{
								border: '0.5px solid #52525B',
							}}
							className='bg-[#27272A]/90 backdrop-filter backdrop-blur-md mt-3 rounded-md absolute w-72 z-10 shadow-md left-0 -ml-32 py-2 px-2'
						>
							{devices.map(device => (
								<Listbox.Option
									className='flex items-center gap-x-4 py-2 px-3 hover:bg-[#27272A] rounded-sm bg-opacity-100 relative text-left font-body text-gray-100 cursor-pointer text-size-xs'
									key={device.deviceId}
									value={device.deviceId}
								>
									{({ selected }) => (
										<>
											{selected && (
												<span className='absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none'>
													<BiCheck size={20} />
												</span>
											)}
											<span className='truncate pl-6'>{device.label}</span>
										</>
									)}
								</Listbox.Option>
							))}
						</Listbox.Options>
					</div>
				</Listbox>
			</div>
			{[currentUser, ...users].map(user => {
				const participant = participants.find(p => p.id === user.uid)
				return participant ? (
					<div
						key={user.uid}
						className={cx('relative rounded-full border', {
							'border-transparent': !user.audioTrack?.isPlaying,
							'border-green-600': user.audioTrack?.isPlaying,
						})}
					>
						<Avatar
							src={participant.user.picture as string}
							alt={participant.user.displayName || ''}
							name={participant.user.displayName || ''}
							className='rounded-full w-7 h-7 ml-2'
						/>
						{user.hasAudio ? null : (
							<div
								style={{
									bottom: '-2px',
									right: '-2px',
								}}
								className='p-1 bg-dark-500 rounded-full absolute'
							>
								<FiMicOff className='text-white' size={10} />
							</div>
						)}
					</div>
				) : null
			})}
		</div>
	)
}

export default Huddle
