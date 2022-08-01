/* eslint-disable react-hooks/exhaustive-deps */
import { Listbox } from '@headlessui/react'
import { createMicrophoneAndCameraTracks } from 'agora-rtc-react'
import React, { useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { FiCamera, FiMic } from 'react-icons/fi'
import { IoChevronDownOutline } from 'react-icons/io5'
import { useSetRecoilState } from 'recoil'
import {
	agoraActionsAtom,
	agoraUsersAtom,
	streamAtom,
} from 'src/stores/studio.store'
import useAgora from 'src/utils/hooks/useAgora'
import { emitToast } from 'ui/src'
import { useGetRtcTokenMutation } from 'utils/src/graphql/generated'

export type Device = {
	label: string
	id: string
}

const MediaControls = React.memo(
	({
		flickId,
		fragmentId,
		participantId,
	}: {
		flickId: string
		fragmentId: string
		participantId: string
	}) => {
		const [microphoneId, setMicrophoneId] = useState('')
		const [cameraId, setCameraId] = useState('')
		const [devices, setDevices] = useState<{
			audioDevices: Device[]
			videoDevices: Device[]
		}>({ audioDevices: [], videoDevices: [] })
		const setStream = useSetRecoilState(streamAtom)
		const setAgoraActions = useSetRecoilState(agoraActionsAtom)
		const setAgoraUsers = useSetRecoilState(agoraUsersAtom)

		const [getRTCToken] = useGetRtcTokenMutation({
			variables: { fragmentId, flickId },
		})
		const [rtcToken, setRtcToken] = useState<string | undefined>()

		// Gives the tracks of camera and microphone, given the camera and microphone device ids
		const useTrack = createMicrophoneAndCameraTracks(
			{
				microphoneId: microphoneId || '',
			},
			{
				cameraId: cameraId || '',
				encoderConfig: {
					width: 960,
					height: 720,
					frameRate: 60,
					bitrateMax: 3000,
					bitrateMin: 2200,
				},
			}
		)
		const { tracks, ready: trackReady } = useTrack()

		const {
			init,
			// currentUser,
			join,
			users,
			stream,
			leave,
			userAudios,
			renewToken,
			ready: agoraReady,
			setCameraDevice,
			setMicrophoneDevice,
		} = useAgora()

		useEffect(() => {
			;(async () => {
				const { data } = await getRTCToken()
				setRtcToken(data?.RTCToken?.token)
			})()
			return () => {
				setAgoraUsers(undefined)
				setStream(null)
			}
		}, [])

		useEffect(() => {
			;(async () => {
				const mediaDevices = (
					await navigator.mediaDevices.enumerateDevices()
				).reverse()
				const audioDevices: Device[] = mediaDevices
					.filter(device => device.kind === 'audioinput')
					.map(device => ({ id: device.deviceId, label: device.label }))
				const videoDevices: Device[] = mediaDevices
					.filter(device => device.kind === 'videoinput')
					.map(device => ({ id: device.deviceId, label: device.label }))
				setDevices({ videoDevices, audioDevices })
			})()
		}, [])

		useEffect(() => {
			if (!users) return
			setAgoraUsers(users)
		}, [users])

		useEffect(() => {
			if (!join || !leave || !renewToken) return
			setAgoraActions({ join, leave, renewToken })
		}, [join, leave, renewToken])

		useEffect(() => {
			if (!stream || !userAudios) return
			setStream({
				stream,
				audios: userAudios,
			})
		}, [stream, userAudios])

		useEffect(() => {
			if (
				devices.audioDevices.length === 0 ||
				devices.videoDevices.length === 0
			)
				return
			const preferredCamera = localStorage.getItem('preferred-camera')
			const preferredMicrophone = localStorage.getItem('preferred-microphone')
			setMicrophoneId(preferredMicrophone || devices.audioDevices?.[0].id || '')
			setCameraId(preferredCamera || devices.videoDevices?.[0].id || '')
		}, [devices.audioDevices, devices.videoDevices])

		useEffect(() => {
			setMicrophoneDevice(microphoneId)
			localStorage.setItem('preferred-microphone', microphoneId)
		}, [microphoneId])

		useEffect(() => {
			setCameraDevice(cameraId)
			localStorage.setItem('preferred-camera', cameraId)
		}, [cameraId])

		useEffect(() => {
			;(async () => {
				try {
					if (!trackReady || !tracks || !flickId || !participantId) return
					await init(
						fragmentId,
						{
							onTokenWillExpire: async () => {
								const { data } = await getRTCToken({
									variables: { fragmentId, flickId },
								})
								if (data?.RTCToken?.token) {
									renewToken(data?.RTCToken?.token)
								}
							},
							onTokenDidExpire: async () => {
								const { data } = await getRTCToken({
									variables: { flickId, fragmentId },
								})
								if (data?.RTCToken?.token) {
									join(data?.RTCToken?.token, participantId, tracks)
								}
							},
						},
						{ uid: participantId, tracks, hasAudio: true }
					)
				} catch (error: any) {
					tracks?.[0]?.stop()
					tracks?.[1]?.stop()
					await leave()
					emitToast('Failed to initialize AgoraRTC', {
						type: 'error',
					})
				}
			})()
		}, [trackReady, tracks, flickId, participantId, rtcToken])

		useEffect(() => {
			if (!agoraReady || !participantId || !tracks || !rtcToken) return
			;(async () => {
				try {
					if (!participantId || !rtcToken) {
						tracks?.[0].stop()
						tracks?.[1].stop()
						await leave()
						emitToast('Failed to get rtc token', {
							type: 'error',
						})
						return
					}
					await join(rtcToken, participantId, tracks)
				} catch (error: any) {
					tracks?.[0]?.stop()
					tracks?.[1]?.stop()
					await leave()
					emitToast(`Failed to join channel ${error}`, {
						type: 'error',
					})
				}
			})()
		}, [agoraReady, participantId, tracks, rtcToken])

		return (
			<div className='bg-dark-100 h-9 rounded-3xl text-cyan-50 py-1 flex flex-row gap-x-4 px-2'>
				<Listbox
					value={
						devices.audioDevices.find(d => d.id === microphoneId)?.id || ''
					}
					onChange={e => {
						setMicrophoneId(
							devices.audioDevices.find(d => d.id === e)?.id || microphoneId
						)
					}}
				>
					<div className='relative'>
						<Listbox.Button className='hover:bg-dark-200 px-px pl-1 py-1.5 rounded-sm flex items-center justify-center gap-x-1.5'>
							<FiMic className='cursor-pointer flex-shrink-0' size={14} />
							<IoChevronDownOutline size={16} color='FFF' />
						</Listbox.Button>
						<Listbox.Options className='bg-[#27272A]/90 border-[#52525B] backdrop-filter backdrop-blur-md mt-3 rounded-md absolute z-10 shadow-md right-0 py-2 px-2'>
							{devices.audioDevices.map(device => (
								<Listbox.Option
									className='flex items-center gap-x-4 py-2 px-3 hover:bg-[#27272A] rounded-sm bg-opacity-100 relative text-start font-body text-gray-100 cursor-pointer text-size-xs'
									key={device.id}
									value={device.id}
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

				{/* camera */}

				<Listbox
					value={devices.videoDevices.find(d => d.id === cameraId)?.id || ''}
					onChange={e => {
						setCameraId(
							devices.videoDevices.find(d => d.id === e)?.id || cameraId
						)
					}}
				>
					<div className='relative'>
						<Listbox.Button className='hover:bg-dark-200 px-px pl-1 py-1.5 rounded-sm flex items-center justify-center gap-x-1.5'>
							<FiCamera className='cursor-pointer flex-shrink-0' size={14} />
							<IoChevronDownOutline size={16} color='FFF' />
						</Listbox.Button>
						<Listbox.Options className='bg-[#27272A]/90 border-[#52525B] backdrop-filter backdrop-blur-md mt-3 rounded-md absolute z-10 shadow-md right-0 py-2 px-2'>
							{devices.videoDevices.map(device => (
								<Listbox.Option
									className='flex items-center gap-x-4 py-2 px-3 hover:bg-[#27272A] rounded-sm bg-opacity-100 relative text-start font-body text-gray-100 cursor-pointer text-size-xs'
									key={device.id}
									value={device.id}
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
		)
	}
)
export default MediaControls
