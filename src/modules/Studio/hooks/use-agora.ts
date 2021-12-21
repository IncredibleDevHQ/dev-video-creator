import AgoraRTC, {
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useEffect, useRef, useState } from 'react'
import _ from 'lodash/fp'

export type Device = {
  microphone: string
  camera: string
}
export interface RTCUser extends IAgoraRTCRemoteUser {
  mediaStream?: MediaStream
}

const useAgora = () => {
  const [ready, setReady] = useState(false)

  const [tracks, setTracks] = useState<
    [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  >({} as any)

  const tracksRef = useRef<[IMicrophoneAudioTrack, ILocalVideoTrack]>({} as any)

  const camera = useRef<ICameraVideoTrack>()
  const microphone = useRef<IMicrophoneAudioTrack>()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>()
  const [currentDevice, setCurrentDevice] = useState<Device>()

  useEffect(() => {
    if (!tracks) return
    tracksRef.current = tracks
  }, [tracks])

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

    await camera.current?.setDevice(deviceId)
    if (tracks) {
      setTracks((tracks) => [
        tracks?.[0] as IMicrophoneAudioTrack,
        camera.current as ICameraVideoTrack,
      ])
    }
    if (currentDevice && deviceId) {
      setCurrentDevice({ ...currentDevice, camera: deviceId })
    }
  }

  const updateDevices = async () => {
    const devices = await AgoraRTC.getDevices()
    setDevices(_.reverse(devices))
    return _.reverse(devices)
  }

  useEffect(() => {
    ;(async () => {
      camera.current = await AgoraRTC.createCameraVideoTrack()
      microphone.current = await AgoraRTC.createMicrophoneAudioTrack()

      // @ts-ignore
      setTracks((tracks) => [microphone.current, camera.current])
      // tracksRef.current = [microphone.current, camera.current]

      // @ts-ignore
      MediaDevices.ondevicechange = async () => {
        await updateDevices()
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
    })()

    return () => {
      if (!tracksRef.current || _.isEmpty(tracksRef.current)) return
      tracksRef.current?.forEach((track) => {
        track.close()
      })
      if (!camera.current || !microphone.current) return
      camera.current.close()
      microphone.current.close()
    }
  }, [])

  useEffect(() => {
    if (currentDevice?.microphone && currentDevice?.camera) {
      setReady(true)
    }
  }, [currentDevice?.camera, currentDevice?.microphone])

  return {
    ready,
    tracks,
    devices,
    updateCamera,
    currentDevice,
    updateMicrophone,
  }
}

export default useAgora
