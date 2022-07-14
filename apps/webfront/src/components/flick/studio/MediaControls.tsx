/* eslint-disable react-hooks/exhaustive-deps */
import { Listbox } from '@headlessui/react'
import { createMicrophoneAndCameraTracks } from 'agora-rtc-react'
import React, { useEffect, useRef, useState } from 'react'
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
		const rtcTokenRef = useRef<string | undefined>()

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
				rtcTokenRef.current = data?.RTCToken?.token
			})()
			return () => {
				setAgoraUsers([])
				setStream(null)
			}
		}, [])

    // on unmount it stops the tracks and releases the media resources
		useEffect(
			() => () => {
				if (!leave || !stream) return
				stream.getTracks().forEach(track => {
					track.stop()
				})
				leave()
			},
			[leave, stream]
		)

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
			setMicrophoneDevice(
				preferredMicrophone || devices.audioDevices?.[0].id || ''
			)
			setCameraDevice(preferredCamera || devices.videoDevices?.[0].id || '')
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
		}, [trackReady, tracks, flickId, participantId, rtcTokenRef.current])

		useEffect(() => {
			if (!agoraReady || !participantId || !tracks || !rtcTokenRef.current)
				return
			;(async () => {
				try {
					if (!participantId || !rtcTokenRef.current) {
						tracks?.[0].stop()
						tracks?.[1].stop()
						await leave()
						emitToast('Failed to get rtc token', {
							type: 'error',
						})
						return
					}
					await join(rtcTokenRef.current, participantId, tracks)
				} catch (error: any) {
					tracks?.[0]?.stop()
					tracks?.[1]?.stop()
					await leave()
					emitToast('Failed to initialize AgoraRTC', {
						type: 'error',
					})
				}
			})()
		}, [agoraReady, participantId, tracks])

		return (
			<div className='bg-zinc-700/90 h-8 rounded-3xl text-cyan-50 px-4 py-1 flex flex-row '>
				<div className='group rounded-sm hover:bg-dark-200 flex items-center cursor-pointer ml-3 mr-1 gap-x-1'>
					<div className='text-white flex items-center hover:bg-dark-100 rounded-l-sm justify-center px-1 py-1.5'>
						<FiMic className='cursor-pointer flex-shrink-0' size={14} />
					</div>
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
							<Listbox.Button className='hover:bg-dark-100 px-px py-1.5 rounded-r-sm flex items-center justify-center'>
								<IoChevronDownOutline size={16} color='FFF' />
							</Listbox.Button>
							<Listbox.Options
								style={{
									border: '0.5px solid #52525B',
								}}
								className='bg-grey-500 bg-opacity-90 backdrop-filter backdrop-blur-md mt-3 rounded-md absolute w-72 z-10 shadow-md left-0 -ml-32 py-2 px-2'
							>
								{devices.audioDevices.map(device => (
									<Listbox.Option
										className='flex items-center gap-x-4 py-2 px-3 hover:bg-grey-500 rounded-sm bg-opacity-100 relative text-left font-body text-gray-100 cursor-pointer text-sm'
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

				{/* camera */}
				<div className='group rounded-sm hover:bg-dark-200 flex items-center cursor-pointer ml-3 mr-1 gap-x-1'>
					<div className='text-white flex items-center hover:bg-dark-100 rounded-l-sm justify-center px-1 py-1.5'>
						<FiCamera className='cursor-pointer flex-shrink-0' size={14} />
					</div>
					<Listbox
						value={devices.videoDevices.find(d => d.id === cameraId)?.id || ''}
						onChange={e => {
							setCameraId(
								devices.videoDevices.find(d => d.id === e)?.id || cameraId
							)
						}}
					>
						<div className='relative'>
							<Listbox.Button className='hover:bg-dark-100 px-px py-1.5 rounded-r-sm flex items-center justify-center'>
								<IoChevronDownOutline size={16} color='FFF' />
							</Listbox.Button>
							<Listbox.Options
								style={{
									border: '0.5px solid #52525B',
								}}
								className='bg-grey-500 bg-opacity-90 backdrop-filter backdrop-blur-md mt-3 rounded-md absolute w-72 z-10 shadow-md left-0 -ml-32 py-2 px-2'
							>
								{devices.videoDevices.map(device => (
									<Listbox.Option
										className='flex items-center gap-x-4 py-2 px-3 hover:bg-grey-500 rounded-sm bg-opacity-100 relative text-left font-body text-gray-100 cursor-pointer text-sm'
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
			</div>
		)
	}
)
export default MediaControls
