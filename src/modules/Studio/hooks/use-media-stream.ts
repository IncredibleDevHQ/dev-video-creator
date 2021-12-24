import { useCallback, useEffect, useState } from 'react'

export type Device = {
  label: string
  id: string
}

type MediaStreamErrorName =
  | 'AbortError'
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'TypeError'
  | 'UnknownError'
  | 'SecurityError'
  | 'PermissionDeniedError'
  | 'NoDeviceAvailableError'

export class MediaStreamError extends Error {
  name: MediaStreamErrorName

  constructor(name: MediaStreamErrorName) {
    super(name)
    this.name = name
  }
}

export interface UseMediaStream {
  microphone: Device | null
  camera: Device | null
  devices: {
    audioDevices: Device[]
    videoDevices: Device[]
  }
  setDevice: (type: 'microphone' | 'camera', device: Device) => void
  ready: boolean
  error: {
    camera: MediaStreamError | null
    microphone: MediaStreamError | null
  }
  permissions: {
    camera: PermissionState | null
    microphone: PermissionState | null
  }
  setError: React.Dispatch<
    React.SetStateAction<{
      camera: MediaStreamError | null
      microphone: MediaStreamError | null
    }>
  >
}

const useMediaStream = () => {
  const [microphone, setMicrophone] = useState<Device | null>(null)
  const [camera, setCamera] = useState<Device | null>(null)
  const [permissions, setPermissions] = useState<{
    camera: PermissionState | null
    microphone: PermissionState | null
  }>({ camera: null, microphone: null })

  const [ready, setReady] = useState(false)

  const [error, setError] = useState<{
    camera: MediaStreamError | null
    microphone: MediaStreamError | null
  }>({ camera: null, microphone: null })

  const [devices, setDevices] = useState<{
    audioDevices: Device[]
    videoDevices: Device[]
  }>({ audioDevices: [], videoDevices: [] })

  useEffect(() => {
    const init = async () => {
      await getDevices()
      setReady(true)
    }

    init()
  }, [])

  const getDevices = useCallback(async () => {
    // @ts-ignore
    navigator.permissions.query({ name: 'camera' }).then((result) => {
      setPermissions((permissions) => ({
        ...permissions,
        camera: result.state,
      }))
    })

    // @ts-ignore
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
      setPermissions((permissions) => ({
        ...permissions,
        microphone: result.state,
      }))
    })

    try {
      await navigator.mediaDevices.getUserMedia({ video: true })
      setPermissions((permissions) => ({
        ...permissions,
        camera: 'granted',
      }))
      setError((err) => ({ ...err, camera: null }))
    } catch (e) {
      const error = e as unknown as MediaStreamError
      if (error.name === 'NotAllowedError') {
        setPermissions((permissions) => ({
          ...permissions,
          camera: 'denied',
        }))
      }

      setError((err) => ({ ...err, camera: error }))
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setPermissions((permissions) => ({
        ...permissions,
        microphone: 'granted',
      }))
      setError((err) => ({ ...err, microphone: null }))
    } catch (e) {
      const error = e as unknown as MediaStreamError
      if (error.name === 'NotAllowedError') {
        setPermissions((permissions) => ({
          ...permissions,
          microphone: 'denied',
        }))
      }

      setError((err) => ({ ...err, microphone: error }))
    }

    const devices = (await navigator.mediaDevices.enumerateDevices()).reverse()
    const audioDevices: Device[] = devices
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({ id: device.deviceId, label: device.label }))
    const videoDevices: Device[] = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({ id: device.deviceId, label: device.label }))

    setDevices({ videoDevices, audioDevices })
  }, [])

  const setDevice = (type: 'microphone' | 'camera', device: Device) => {
    if (type === 'microphone') {
      setMicrophone(device)
    } else {
      setCamera(device)
    }
  }

  return {
    microphone,
    camera,
    devices,
    setDevice,
    ready,
    error,
    permissions,
    setError,
  } as UseMediaStream
}

export default useMediaStream
