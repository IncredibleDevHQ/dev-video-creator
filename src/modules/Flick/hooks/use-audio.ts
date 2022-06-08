import { createClient } from 'agora-rtc-react'
import AgoraRTC, {
  ClientConfig,
  IAgoraRTCRemoteUser,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useEffect, useState } from 'react'
import config from '../../../config'

export interface RTCUser extends IAgoraRTCRemoteUser {
  audioStream?: MediaStream
}

export interface LocalAgoraUser {
  uid: string
  hasAudio: boolean
  audioStream?: MediaStream
  audioTrack: IMicrophoneAudioTrack | null
}

const audioConfig: ClientConfig = {
  mode: 'rtc',
  codec: 'h264',
}

const { appId } = config.agora

const useClient = createClient(audioConfig)

const useAudio = () => {
  const client = useClient()
  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<RTCUser[]>([])
  const [currentUser, setCurrentUser] = useState<LocalAgoraUser>({
    uid: '',
    hasAudio: true,
    audioTrack: null,
  })
  const [channel, setChannel] = useState<string>()

  useEffect(() => {
    console.log({ currentUser })
  }, [currentUser])

  const init = async (
    channel: string,
    {
      onTokenWillExpire,
      onTokenDidExpire,
    }: { onTokenWillExpire: () => void; onTokenDidExpire: () => void },
    {
      uid,
      track,
    }: {
      uid: string
      track: IMicrophoneAudioTrack
    }
  ) => {
    try {
      setReady(false)
      setChannel(channel)
      setCurrentUser({
        uid,
        hasAudio: true,
        audioTrack: track,
      })

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType)
        const tracks: MediaStreamTrack[] = []
        if (user.audioTrack) tracks.push(user.audioTrack?.getMediaStreamTrack())
        if (mediaType === 'audio') {
          user.audioTrack?.play()
          setUsers((prevUsers) => {
            if (prevUsers.find((element) => element.uid === user.uid)) {
              return [...prevUsers]
            }
            return [
              ...prevUsers,
              {
                ...user,
                muted: false,
                mediaStream:
                  tracks && tracks.length > 0
                    ? new MediaStream(tracks.filter((track) => !!track))
                    : undefined,
              },
            ]
          })
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
      setReady(true)
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  AgoraRTC.onMicrophoneChanged = async (changedDevice) => {
    if (!currentUser) return
    if (changedDevice.state === 'ACTIVE') {
      await currentUser.audioTrack?.setDevice(changedDevice.device.deviceId)
      // Switch to an existing device when the current device is unplugged.
    } else if (
      changedDevice.device.label === currentUser.audioTrack?.getTrackLabel()
    ) {
      const oldMicrophones = await AgoraRTC.getMicrophones()
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await currentUser.audioTrack?.setDevice(oldMicrophones?.[0]?.deviceId)
    }
  }

  const renewToken = async (token: string) => {
    client.renewToken(token)
  }

  const join = async (
    token: string,
    uid: string,
    mediaTracks: IMicrophoneAudioTrack | null
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

  const mute = async () => {
    try {
      if (!ready) return
      await currentUser?.audioTrack?.setMuted(!currentUser.hasAudio)
      // currentUser?.audioTrack.setEnabled(false)
      setCurrentUser((prev) => ({
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
      currentUser?.audioTrack?.stop()
      users.forEach((user) => {
        user.audioTrack?.stop()
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
  }
}

export default useAudio
