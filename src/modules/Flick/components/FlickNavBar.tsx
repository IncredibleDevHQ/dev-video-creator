import AgoraRTC from 'agora-rtc-sdk-ng'
import { createMicrophoneAudioTrack } from 'agora-rtc-react'
import React, { useEffect, useState } from 'react'
import { FiChevronLeft } from 'react-icons/fi'
import { IoPeopleOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Button, emitToast, Heading, Text } from '../../../components'
import { ASSETS } from '../../../constants'
import { useGetHuddleRtcTokenMutation } from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import useAudio from '../hooks/use-audio'
import { newFlickStore } from '../store/flickNew.store'
import ShareModal from './ShareModal'

const FlickHuddle = ({
  flickId,
  devices,
  deviceId,
}: {
  flickId: string
  deviceId?: string
  devices: MediaDeviceInfo[]
}) => {
  const user = useRecoilValue(userState)
  const useTrack = createMicrophoneAudioTrack(
    deviceId
      ? {
          microphoneId: deviceId,
        }
      : undefined
  )
  const { ready: trackReady, error: trackError, track } = useTrack()
  const [getHuddleToken, { data: rtcTokenData }] =
    useGetHuddleRtcTokenMutation()
  const {
    init,
    mute,
    join,
    users,
    leave,
    renewToken,
    ready: agoraReady,
  } = useAudio()

  useEffect(() => {
    if (!agoraReady || !user?.sub || !track) return
    ;(async () => {
      try {
        if (!user?.sub || !rtcTokenData?.HuddleRtcToken?.token) return
        await join(rtcTokenData.HuddleRtcToken.token, user.sub, track)
      } catch (error: any) {
        emitToast({
          type: 'error',
          title: 'Failed to initialize AgoraRTC',
          description: error?.message,
        })
      }
    })()
  }, [agoraReady, user?.sub, track, rtcTokenData?.HuddleRtcToken?.token])

  useEffect(() => {
    ;(async () => {
      try {
        if (!trackReady || !track) return
        await init(
          flickId,
          {
            onTokenWillExpire: async () => {
              const { data } = await getHuddleToken({
                variables: { flickId },
              })
              if (data?.HuddleRtcToken?.token) {
                renewToken(data?.HuddleRtcToken?.token)
              }
            },
            onTokenDidExpire: async () => {
              const { data } = await getHuddleToken({
                variables: { flickId },
              })
              if (data?.HuddleRtcToken?.token) {
                join(data?.HuddleRtcToken?.token, user?.sub as string, track)
              }
            },
          },
          track
        )
      } catch (error: any) {
        emitToast({
          type: 'error',
          title: 'Failed to initialize AgoraRTC',
          description: error?.message,
        })
      }
    })()
  }, [trackReady, track])

  if (trackError) return <div>{trackError.message}</div>

  return (
    <div>
      <button
        type="button"
        className="bg-blue-400 rounded-md text-white px-4 py-1"
        onClick={() => user?.sub && mute(user.sub)}
      >
        mute
      </button>
      <button
        type="button"
        className="bg-red-600 rounded-md text-white px-4 py-1"
        onClick={leave}
      >
        Leave
      </button>
    </div>
  )
}

const FlickNavBar = () => {
  const [{ flick }] = useRecoilState(newFlickStore)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [currentAudioDevice, setCurrentAudioDevice] =
    useState<MediaDeviceInfo>()

  const [inHuddle, setInHuddle] = useState(false)

  const joinHuddle = async () => {
    try {
      if (!flick?.id) return

      // NOTE - Get microphone devices
      const devices = await AgoraRTC.getMicrophones()

      // NOTE - Set audio devices
      setAudioDevices(devices)
      setCurrentAudioDevice(devices[0])
      setInHuddle(true)
    } catch (error: any) {
      emitToast({
        type: 'error',
        title: 'Error',
        description: error?.message || 'Error joining huddle',
      })
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between py-2 pl-3 pr-5 bg-dark-500">
      <div className="flex items-center">
        <a href="/dashboard">
          <div className="flex">
            <FiChevronLeft size={28} className="mr-2 text-grey-lighter" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-28" />
          </div>
        </a>
      </div>
      <Heading className="p-2 ml-12 font-bold text-base text-white">
        {flick?.name || ''}
      </Heading>
      <div className="flex justify-end items-center gap-x-2 px-2">
        {inHuddle ? (
          <FlickHuddle
            flickId={flick?.id}
            devices={audioDevices}
            deviceId={currentAudioDevice?.deviceId}
          />
        ) : (
          <Button
            appearance="primary"
            type="button"
            onClick={joinHuddle}
            size="small"
            className="mr-2"
          >
            <Text className="mr-2 text-sm">Join</Text>
            <div className="flex justify-end items-center">
              {flick?.participants.map((participant, index) => (
                <div
                  key={participant.id || index}
                  className="flex items-center"
                >
                  <img
                    src={participant.user.picture || ''}
                    alt={participant.user.displayName || ''}
                    className="w-6 h-6 rounded-full"
                  />
                </div>
              ))}
            </div>
          </Button>
        )}
        <Button
          appearance="gray"
          type="button"
          onClick={() => {
            setIsShareOpen(true)
          }}
          size="small"
          icon={IoPeopleOutline}
          iconSize={20}
          className="-mr-3"
        >
          Invite
        </Button>
      </div>
      {isShareOpen && (
        <ShareModal
          open={isShareOpen}
          handleClose={() => {
            setIsShareOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default FlickNavBar
