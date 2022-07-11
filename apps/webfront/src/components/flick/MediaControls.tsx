const MediaControls = () =>
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

	 (
		<div className='bg-zinc-700/90 h-8 rounded-3xl text-cyan-50 px-4 py-1'>
			Media
		</div>
	)


export default MediaControls
