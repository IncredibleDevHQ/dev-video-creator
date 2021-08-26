import { useEffect, useState } from 'react'
import { ClientConfig, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import { createClient, createMicrophoneAndCameraTracks } from 'agora-rtc-react'
import { useRecoilState } from 'recoil'
import config from '../../../config'
import { studioStore } from '../stores'

const videoConfig: ClientConfig = {
  mode: 'rtc',
  codec: 'vp8',
}

const { appId } = config.agora

const useClient = createClient(videoConfig)
const useMicrophoneAndCameraTracks = createMicrophoneAndCameraTracks()

export interface RTCUser extends IAgoraRTCRemoteUser {
  mediaStream?: MediaStream
}

export default function useAgora(
  channel: string,
  {
    onTokenWillExpire,
    onTokenDidExpire,
  }: { onTokenWillExpire: () => void; onTokenDidExpire: () => void }
) {
  const client = useClient()
  const [users, setUsers] = useState<RTCUser[]>([])
  const [stream, setStream] = useState<MediaStream>()
  const [studio, setStudio] = useRecoilState(studioStore)
  const [userAudios, setUserAudios] = useState<MediaStream[]>([])

  const { ready, tracks } = useMicrophoneAndCameraTracks()
  useEffect(() => {
    ;(async () => {
      init()
    })()
  }, [])

  useEffect(() => {
    setStream(
      tracks && tracks?.length > 0
        ? new MediaStream([
            tracks?.[0].getMediaStreamTrack?.(),
            tracks?.[1].getMediaStreamTrack?.(),
          ])
        : undefined
    )
  }, [tracks])

  const init = async () => {
    try {
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType)
        const tracks: MediaStreamTrack[] = []
        if (user.audioTrack) tracks.push(user.audioTrack?.getMediaStreamTrack())
        if (user.videoTrack) tracks.push(user.videoTrack?.getMediaStreamTrack())

        if (mediaType === 'video') {
          setUsers((prevUsers) => {
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

      client.on('user-left', (user) => {
        setUsers((prevUsers) => {
          return prevUsers.filter((User) => User.uid !== user.uid)
        })
      })
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  const renewToken = async (token: string) => {
    client.renewToken(token)
  }

  const join = async (token: string, uid: string) => {
    try {
      if (!ready) throw new Error('Not ready')
      await client.join(appId, channel, token, uid)
      if (tracks) await client.publish(tracks)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  const mute = async (type: 'audio' | 'video') => {
    const { constraints } = studio
    console.log({ constraints })
    if (type === 'audio') {
      const newValue = !constraints?.audio
      console.log('newValue', newValue)
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
    ready,
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
