import { createClient } from 'agora-rtc-react'
import AgoraRTC, {
	ClientConfig,
	IAgoraRTCRemoteUser,
	ICameraVideoTrack,
	IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useEffect, useState } from 'react'
import { useEnv } from 'utils/src'

export interface RTCUser extends IAgoraRTCRemoteUser {
	audioStream?: MediaStream
	videoStream?: MediaStream
}

export interface LocalAgoraUser {
	uid: string
	hasAudio: boolean
	stream?: MediaStream
	tracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null
}

const audioConfig: ClientConfig = {
	mode: 'rtc',
	codec: 'h264',
}

const useClient = createClient(audioConfig)

const useAgora = () => {
	const { appId } = useEnv().agora

	const client = useClient()
	const [ready, setReady] = useState(false)
	const [users, setUsers] = useState<RTCUser[]>([])
	const [currentUser, setCurrentUser] = useState<LocalAgoraUser>({
		uid: '',
		hasAudio: true,
		tracks: null,
	})
	const [channel, setChannel] = useState<string>()

	const [userAudios, setUserAudios] = useState<MediaStream[]>([])

	useEffect(() => {
		console.log({ currentUser })
	}, [currentUser])

	const init = async (
		agoraChannel: string,
		{
			onTokenWillExpire,
			onTokenDidExpire,
		}: { onTokenWillExpire: () => void; onTokenDidExpire: () => void },
		{
			uid,
			tracks,
			hasAudio,
		}: {
			uid: string
			tracks: [IMicrophoneAudioTrack, ICameraVideoTrack]
			hasAudio: boolean
		}
	) => {
		try {
			setReady(false)
			setChannel(agoraChannel)
			setCurrentUser({
				uid,
				hasAudio,
				tracks,
			})

			client.on('user-published', async (user, mediaType) => {
				await client.subscribe(user, mediaType)
				const remoteTracks: MediaStreamTrack[] = []
				if (user.audioTrack)
					remoteTracks.push(user.audioTrack?.getMediaStreamTrack())
				if (user.videoTrack)
					remoteTracks.push(user.videoTrack?.getMediaStreamTrack())
				if (mediaType === 'video') {
					setUsers(prevUsers => {
						if (prevUsers.find(element => element.uid === user.uid))
							return [...prevUsers]
						return [
							...prevUsers,
							{
								...user,
								mediaStream:
									tracks && tracks.length > 0
										? // @ts-ignore
										  new MediaStream(tracks.filter(track => !!track))
										: undefined,
							},
						]
					})
				}
				if (mediaType === 'audio') {
					user.audioTrack?.play()
					setUserAudios(prev => [
						...prev,
						new MediaStream([
							user.audioTrack?.getMediaStreamTrack() as MediaStreamTrack,
						]),
					])
				}
			})

			client.on('user-left', user => {
				setUsers(prevUsers => prevUsers.filter(User => User.uid !== user.uid))
			})

			client.on('user-info-updated', (user, msg) => {
				setUsers(prevUsers =>
					prevUsers.map(User => {
						if (User.uid === user) {
							return {
								...User,
								hasAudio: msg !== 'mute-audio',
							}
						}
						return User
					})
				)
			})

			client.on('token-privilege-will-expire', () => {
				onTokenWillExpire()
			})

			client.on('token-privilege-did-expire', () => {
				onTokenDidExpire()
			})
			setReady(true)
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	AgoraRTC.onMicrophoneChanged = async changedDevice => {
		if (!currentUser) return
		if (changedDevice.state === 'ACTIVE') {
			await currentUser.tracks?.[0]?.setDevice(changedDevice.device.deviceId)
			// Switch to an existing device when the current device is unplugged.
		} else if (
			changedDevice.device.label === currentUser.tracks?.[0]?.getTrackLabel()
		) {
			const oldMicrophones = await AgoraRTC.getMicrophones()
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			await currentUser.tracks[0]?.setDevice(oldMicrophones?.[0]?.deviceId)
		}
	}

	AgoraRTC.onCameraChanged = async changedDevice => {
		if (changedDevice.state === 'ACTIVE') {
			await currentUser.tracks?.[1].setDevice(changedDevice.device.deviceId)
			// Switch to an existing device when the current device is unplugged.
		} else if (
			changedDevice.device.label === currentUser.tracks?.[0].getTrackLabel()
		) {
			const oldCameras = await AgoraRTC.getCameras()
			await currentUser.tracks?.[1].setDevice(oldCameras?.[0]?.deviceId)
		}
	}

	const renewToken = async (token: string) => {
		client.renewToken(token)
	}

	const join = async (
		token: string,
		uid: string,
		mediaTracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null
	) => {
		try {
			if (!channel || !ready) return
			await client.join(appId, channel, token, uid)
			if (mediaTracks) await client.publish(mediaTracks)
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	const setMicrophoneDevice = async (deviceId: string) => {
		if (!currentUser) return
		await currentUser.tracks?.[0]?.setDevice(deviceId)
	}

	const setCameraDevice = async (deviceId: string) => {
		if (!currentUser) return
		await currentUser.tracks?.[1]?.setDevice(deviceId)
	}

	const mute = async () => {
		try {
			if (!ready) return
			await currentUser?.tracks?.[0]?.setEnabled(!currentUser.hasAudio)
			// currentUser?.audioTrack.setEnabled(false)
			setCurrentUser(prev => ({
				...prev,
				hasAudio: !prev.hasAudio,
			}))
		} catch (error) {
			console.error(error)
		}
	}

	const leave = async () => {
		try {
			if (!ready) return
			currentUser?.tracks?.[0]?.stop()
			currentUser?.tracks?.[1]?.stop()
			users.forEach(user => {
				user.audioTrack?.stop()
				user?.videoTrack?.stop()
			})
			await client.leave()
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	return {
		init,
		ready,
		users,
		join,
		mute,
		leave,
		renewToken,
		currentUser,
		setMicrophoneDevice,
		setCameraDevice,
		userAudios,
	}
}

export default useAgora
