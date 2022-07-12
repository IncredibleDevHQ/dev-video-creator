import { createMicrophoneAndCameraTracks } from 'agora-rtc-react'
// import useMediaStream from 'src/utils/hooks/useMediaStream'

const MediaControls = () => {

	// const {
	// 	// camera,
	// 	// permissions,
	// 	devices,
	// 	// error,
	// 	// microphone,
	// 	ready,
	// 	setDevice,
	// 	// setError,
	// } = useMediaStream()

	// useEffect(() => {
	// 	const lsCamera = localStorage.getItem('preferred-camera')
	// 	const preferredCamera = lsCamera
	// 		? devices.videoDevices.find(({ id }) => lsCamera === id)
	// 		: null
	// 	setDevice('camera', preferredCamera || devices.videoDevices?.[0] || null)

	// 	const lsMicrophone = localStorage.getItem('preferred-microphone')
	// 	const preferredMicrophone = lsMicrophone
	// 		? devices.audioDevices.find(({ id }) => lsMicrophone === id)
	// 		: null
	// 	setDevice(
	// 		'microphone',
	// 		preferredMicrophone || devices.audioDevices?.[0] || null
	// 	)
	// }, [ready])

	// Gives the tracks of camera and microphone, given the camera and microphone device ids
	const { tracks, error } = createMicrophoneAndCameraTracks(
		{
			microphoneId: localStorage.getItem('preferred-microphone') || '',
		},
		{
			cameraId: localStorage.getItem('preferred-camera') || '',
			encoderConfig: {
				width: 960,
				height: 720,
				frameRate: 60,
				bitrateMax: 3000,
				bitrateMin: 2200,
			},
		}
	)()

  // const { stream, join, users, leave, userAudios, renewToken } = useAgora(
	// 	fragmentId,
	// 	{
	// 		onTokenWillExpire: async () => {
	// 			const { data } = await getRTCToken({
	// 				variables: { fragmentId, flickId },
	// 			})
	// 			if (data?.RTCToken?.token) {
	// 				renewToken(data.RTCToken.token)
	// 			}
	// 		},
	// 		onTokenDidExpire: async () => {
	// 			const { data } = await getRTCToken({
	// 				variables: { fragmentId, flickId },
	// 			})
	// 			if (data?.RTCToken?.token) {
	// 				const participantId = fragment?.configuration?.speakers?.find(
	// 					({ participant }: { participant: FlickParticipantsFragment }) =>
	// 						participant.userSub === sub
	// 				)?.participant.id
	// 				if (participantId) {
	// 					join(data?.RTCToken?.token, participantId as string, tracks)
	// 				} else {
	// 					leave()
	// 					clearRecordedBlocks()
	// 					emitToast({
	// 						title: 'Yikes. Something went wrong.',
	// 						type: 'error',
	// 						description:
	// 							'You do not belong to this studio!! Please ask the host to invite you again.',
	// 					})
	// 					history.goBack()
	// 				}
	// 			}
	// 		},
	// 	},
	// 	tracks
	// )

  console.log('MediaControls', tracks, error)
	return (
		<div className='bg-zinc-700/90 h-8 rounded-3xl text-cyan-50 px-4 py-1'>
			Media
		</div>
	)
}
export default MediaControls
