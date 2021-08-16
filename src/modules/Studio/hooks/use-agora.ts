import { useEffect, useState } from 'react'
import { ClientConfig, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import { createClient, createMicrophoneAndCameraTracks } from 'agora-rtc-react'
import config from '../../../config'

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

export default function useAgora(channel: string) {
  const client = useClient()
  const [users, setUsers] = useState<RTCUser[]>([])

  const { ready, tracks } = useMicrophoneAndCameraTracks()
  useEffect(() => {
    ;(async () => {
      init()
    })()
  }, [])

  const init = async () => {
    try {
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType)
        if (mediaType === 'video') {
          const tracks = [
            user.audioTrack?.getMediaStreamTrack(),
            user.videoTrack?.getMediaStreamTrack(),
          ]
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
        }
      })
      client.on('user-left', (user) => {
        setUsers((prevUsers) => {
          return prevUsers.filter((User) => User.uid !== user.uid)
        })
      })

      client.on('user-unpublished', (user, type) => {
        if (type === 'audio') {
          user.audioTrack?.stop()
        }
        if (type === 'video') {
          setUsers((prevUsers) => {
            return prevUsers.filter((User) => User.uid !== user.uid)
          })
        }
      })
    } catch (error) {
      console.log(error)
      throw error
    }
  }

  const join = async (token: string, uid: string) => {
    if (!ready) throw new Error('Not ready')
    const abc = await client.join(appId, channel, token, uid)
    if (tracks) await client.publish(tracks)
  }

  const leave = async () => {
    await client.leave()
    tracks?.forEach((track) => track.stop())
  }

  return {
    ready,
    users,
    join,
    leave,
    tracks,
    stream:
      tracks && tracks?.length > 0
        ? new MediaStream([
            tracks?.[0].getMediaStreamTrack?.(),
            tracks?.[1].getMediaStreamTrack?.(),
          ])
        : undefined,
  }
}
