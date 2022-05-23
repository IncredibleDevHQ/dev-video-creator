import { useEffect, useState } from 'react'
import AgoraRTC, {
  ClientConfig,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { createClient } from 'agora-rtc-react'
import { useRecoilState } from 'recoil'
import config from '../../../config'
import { studioStore } from '../stores'
import { RTCUser } from './use-video'

export type Device = {
  microphone: string
  camera: string
}

const videoConfig: ClientConfig = {
  mode: 'rtc',
  codec: 'vp8',
}

const { appId } = config.agora

const useClient = createClient(videoConfig)

export default function useAgoraOld(
  channel: string,
  {
    onTokenWillExpire,
    onTokenDidExpire,
  }: { onTokenWillExpire: () => void; onTokenDidExpire: () => void },
  tracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
) {
  const client = useClient()
  const [users, setUsers] = useState<RTCUser[]>([])
  const [stream, setStream] = useState<MediaStream>()
  const [studio, setStudio] = useRecoilState(studioStore)
  const [userAudios, setUserAudios] = useState<MediaStream[]>([])
  // const [cameraDevice, setCameraDevice] = useState<string>()
  // const [microphoneDevice, setMicrophoneDevice] = useState<string>()

  useEffect(() => {
    ;(async () => {
      init()
    })()
  }, [])

  useEffect(() => {
    if (!tracks) return
    setStream(
      new MediaStream([
        tracks[0].getMediaStreamTrack(),
        tracks[1].getMediaStreamTrack(),
      ])
    )
  }, [
    tracks,
    tracks?.[0].enabled,
    tracks?.[1].enabled,
    studio.constraints?.audio,
    studio.constraints?.video,
  ])

  const init = async () => {
    try {
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType)
        const tracks: MediaStreamTrack[] = []
        if (user.audioTrack) tracks.push(user.audioTrack?.getMediaStreamTrack())
        if (user.videoTrack) tracks.push(user.videoTrack?.getMediaStreamTrack())
        if (mediaType === 'video') {
          setUsers((prevUsers) => {
            if (prevUsers.find((element) => element.uid === user.uid))
              return [...prevUsers]
            return [
              ...prevUsers,
              {
                ...user,
                mediaStream:
                  tracks && tracks.length > 0
                    ? // @ts-ignore
                      new MediaStream(tracks.filter((track) => !!track))
                    : undefined,
              },
            ]
          })
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play()
          setUserAudios((prev) => [
            ...prev,
            new MediaStream([
              user.audioTrack?.getMediaStreamTrack() as MediaStreamTrack,
            ]),
          ])
        }
      })
      client.on('user-left', (user) => {
        setUsers((prevUsers) => {
          return prevUsers.filter((User) => User.uid !== user.uid)
        })
      })

      client.on('token-privilege-will-expire', () => {
        onTokenWillExpire()
      })

      client.on('token-privilege-did-expire', () => {
        onTokenDidExpire()
      })

      // client.on('user-left', (user) => {
      //   setUsers((prevUsers) => {
      //     return prevUsers.filter((User) => User.uid !== user.uid)
      //   })
      // })
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  // AgoraRTC.onCameraChanged = async (changedDevice) => {
  //   if (changedDevice.state === 'ACTIVE') {
  //     await tracks?.[1].setDevice(changedDevice.device.deviceId)
  //     // Switch to an existing device when the current device is unplugged.
  //   } else if (changedDevice.device.label === tracks?.[0].getTrackLabel()) {
  //     const oldCameras = await AgoraRTC.getCameras()
  //     await tracks?.[1].setDevice(oldCameras?.[0]?.deviceId)
  //   }
  // }

  AgoraRTC.onMicrophoneChanged = async (changedDevice) => {
    if (changedDevice.state === 'ACTIVE') {
      await tracks?.[0].setDevice(changedDevice.device.deviceId)
      // Switch to an existing device when the current device is unplugged.
    } else if (changedDevice.device.label === tracks?.[0].getTrackLabel()) {
      const oldMicrophones = await AgoraRTC.getMicrophones()
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await tracks?.[0].setDevice(oldMicrophones?.[0]?.deviceId)
    }
  }

  const renewToken = async (token: string) => {
    client.renewToken(token)
  }

  const join = async (
    token: string,
    uid: string,
    mediaTracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  ) => {
    try {
      await client.join(appId, channel, token, uid)
      if (mediaTracks) await client.publish(mediaTracks)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  const mute = async (type: 'audio' | 'video') => {
    const { constraints } = studio
    if (type === 'audio') {
      const newValue = !constraints?.audio
      await tracks?.[0].setEnabled(newValue)
      setStudio((studio) => {
        return {
          ...studio,
          constraints: {
            ...studio.constraints,
            audio: newValue,
          },
        }
      })
    } else if (type === 'video') {
      const newValue = !constraints?.video
      await tracks?.[1].setEnabled(newValue)
      setStudio((studio) => {
        return {
          ...studio,
          constraints: {
            ...studio.constraints,
            video: newValue,
          },
        }
      })
    }
  }

  const leave = async () => {
    try {
      tracks?.forEach((track) => track.stop())
      await client.leave()
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  return {
    users,
    join,
    leave,
    mute,
    tracks,
    stream,
    userAudios,
    renewToken,
  }
}
