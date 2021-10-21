import AgoraRTC, {
  ICameraVideoTrack,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useEffect, useRef, useState } from 'react'
import { BackgroundFilter } from '@vectorly-io/ai-filters'

export type Device = {
  microphone: string
  camera: string
}

const useVectorly = (token: string) => {
  const [ready, setReady] = useState(false)

  const [tracks, setTracks] = useState<
    [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  >({} as any)

  const camera = useRef<ICameraVideoTrack>()
  const microphone = useRef<IMicrophoneAudioTrack>()
  const filter = useRef<BackgroundFilter>()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>()
  const [currentDevice, setCurrentDevice] = useState<Device>()
  const [effect, setEffect] = useState<string>()

  // eslint-disable-next-line consistent-return
  const updateCameraStream = async (deviceId?: string) => {
    if (!filter.current) {
      return console.warn('No Filter')
    }
    const filteredTrack = await filter.current?.getOutput()

    const filteredAgoraTrack = AgoraRTC.createCustomVideoTrack({
      mediaStreamTrack: filteredTrack.getVideoTracks()[0],
    })

    // @ts-ignore
    if (tracks) setTracks((tracks) => [tracks?.[0], filteredAgoraTrack])
    if (currentDevice && deviceId) {
      setCurrentDevice({ ...currentDevice, camera: deviceId })
    }
  }

  const updateMicrophone = async (deviceId: string) => {
    await tracks?.[0]?.setDevice(deviceId)
    if (currentDevice) {
      setCurrentDevice({ ...currentDevice, microphone: deviceId })
    }
  }

  const updateCamera = async (deviceId: string) => {
    if (!camera.current) {
      console.warn('No camera.')
      return
    }

    if (!filter.current) {
      console.warn('No filter.')
      return
    }

    await camera.current?.setDevice(deviceId)
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    const inputStream = new MediaStream([camera.current?._mediaStreamTrack])
    await filter?.current?.changeInput(inputStream)

    updateCameraStream(deviceId)
  }

  const updateBackground = async (value: string) => {
    if (!camera.current) {
      console.warn('No camera.')
      return
    }

    if (!filter.current) {
      console.warn('No filter.')
      return
    }

    if (value === 'none') {
      await filter?.current.disable()
    } else {
      await filter?.current.enable()
      await filter.current.changeBackground(value)
      setEffect(value)
      updateCameraStream()
    }
  }

  const updateDevices = async () => {
    const devices = await AgoraRTC.getDevices()
    setDevices(devices)
    return devices
  }

  useEffect(() => {
    ;(async () => {
      camera.current = await AgoraRTC.createCameraVideoTrack()
      microphone.current = await AgoraRTC.createMicrophoneAudioTrack()

      // @ts-ignore
      setTracks((tracks) => [microphone.current, camera.current])

      // @ts-ignore
      MediaDevices.ondevicechange = () => {
        updateDevices()
      }

      const devices = await updateDevices()

      const microphoneDevice = devices.find(
        (device: MediaDeviceInfo) => device.kind === 'audioinput'
      )
      const cameraDevice = devices.find(
        (device: MediaDeviceInfo) => device.kind === 'videoinput'
      )

      if (!microphoneDevice || !cameraDevice) {
        throw Error('Search for inputs went sour.')
      }

      setCurrentDevice({
        camera: cameraDevice?.deviceId,
        microphone: microphoneDevice?.deviceId,
      })

      await updateCamera(cameraDevice.deviceId)
      await updateMicrophone(microphoneDevice.deviceId)
      await updateBackground('none')

      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      const inputStream = new MediaStream([camera.current._mediaStreamTrack])

      filter.current = new BackgroundFilter(inputStream, {
        token,
        passthrough: true,
      })
    })()
  }, [])

  useEffect(() => {
    if (currentDevice?.microphone && currentDevice.camera) {
      setReady(true)
    }
  }, [currentDevice?.camera, currentDevice?.microphone])

  return {
    updateBackground,
    updateCamera,
    updateMicrophone,
    tracks,
    ready,
    devices,
    currentDevice,
    effect,
  }
}

export default useVectorly
