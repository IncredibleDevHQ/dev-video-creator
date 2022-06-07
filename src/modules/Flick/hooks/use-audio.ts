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
  const [channel, setChannel] = useState<string>()

  const [audioTrack, setAudioTrack] = useState<IMicrophoneAudioTrack>()

  useEffect(() => {
    console.log('useAudio users:', users)
  }, [users])

  const init = async (
    channel: string,
    {
      onTokenWillExpire,
      onTokenDidExpire,
    }: { onTokenWillExpire: () => void; onTokenDidExpire: () => void },
    track: IMicrophoneAudioTrack
  ) => {
    try {
      setReady(false)
      setChannel(channel)
      setAudioTrack(track)

      client.on('user-published', async (user, mediaType) => {
        console.log('user-published', user, mediaType)
        await client.subscribe(user, mediaType)
        const tracks: MediaStreamTrack[] = []
        if (user.audioTrack) tracks.push(user.audioTrack?.getMediaStreamTrack())
        if (mediaType === 'audio') {
          user.audioTrack?.play()
          setUsers((prevUsers) => {
            if (prevUsers.find((element) => element.uid === user.uid)) {
              console.log('landing in [] condition')
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
    if (changedDevice.state === 'ACTIVE') {
      await audioTrack?.setDevice(changedDevice.device.deviceId)
      // Switch to an existing device when the current device is unplugged.
    } else if (changedDevice.device.label === audioTrack?.getTrackLabel()) {
      const oldMicrophones = await AgoraRTC.getMicrophones()
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await audioTrack?.setDevice(oldMicrophones?.[0]?.deviceId)
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
      console.log('came here', { channel, uid, token, mediaTracks, appId })
      await client.join(appId, channel, token, uid)
      if (mediaTracks) await client.publish(mediaTracks)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  const mute = async (uid: string) => {
    try {
      if (!ready) return
      const tempUsers = [...users]
      const currentUserIndex = tempUsers.findIndex((user) => user.uid === uid)
      if (currentUserIndex === -1) return
      tempUsers.splice(currentUserIndex, 1, {
        ...tempUsers[currentUserIndex],
        hasAudio: !tempUsers[currentUserIndex].hasAudio,
      })
      if (audioTrack)
        audioTrack.setEnabled(!tempUsers[currentUserIndex].hasAudio)
      else throw new Error('No audio track')
      setUsers(tempUsers)
    } catch (error) {
      console.error(error)
    }
  }

  const leave = async () => {
    try {
      if (!ready) return
      audioTrack?.stop()
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
  }
}

export default useAudio
