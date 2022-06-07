/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import AgoraRTC from 'agora-rtc-sdk-ng'
import { createMicrophoneAudioTrack } from 'agora-rtc-react'
import React, { useCallback, useEffect, useState } from 'react'
import { FiChevronLeft } from 'react-icons/fi'
import { IoHeadsetOutline, IoPeopleOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Button, emitToast, Heading } from '../../../components'
import { ASSETS } from '../../../constants'
import {
  FlickFragment,
  useGetHuddleRtcTokenMutation,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import useAudio from '../hooks/use-audio'
import { newFlickStore } from '../store/flickNew.store'
import ShareModal from './ShareModal'

const FlickHuddle = ({
  flick,
  devices,
  deviceId,
  setInHuddle,
  participantId,
}: {
  flick: FlickFragment
  deviceId?: string
  participantId: string
  devices: MediaDeviceInfo[]
  setInHuddle: (inHuddle: boolean) => void
}) => {
  const [rtcToken, setRtcToken] = useState<string>()
  const useTrack = createMicrophoneAudioTrack(
    deviceId
      ? {
          microphoneId: deviceId,
        }
      : undefined
  )
  const { ready: trackReady, error: trackError, track } = useTrack()
  const [getHuddleToken] = useGetHuddleRtcTokenMutation()
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
    if (!agoraReady || !participantId || !track || !rtcToken) return
    ;(async () => {
      try {
        if (!participantId || !rtcToken) {
          track?.stop()
          await leave()
          setInHuddle(false)
          emitToast({
            type: 'error',
            title: 'Error',
            description: 'Failed to get huddle token',
          })
          return
        }
        await join(rtcToken, participantId, track)
      } catch (error: any) {
        track?.stop()
        await leave()
        setInHuddle(false)
        emitToast({
          type: 'error',
          title: 'Failed to initialize AgoraRTC',
          description: error?.message,
        })
      }
    })()
  }, [agoraReady, participantId, track, rtcToken])

  useEffect(() => {
    ;(async () => {
      try {
        if (!trackReady || !track || !flick.id || !participantId) return
        const { data } = await getHuddleToken({
          variables: {
            flickId: flick.id,
          },
        })
        if (data?.HuddleRtcToken?.token) {
          setRtcToken(data.HuddleRtcToken.token)
        }
        await init(
          flick.id,
          {
            onTokenWillExpire: async () => {
              const { data } = await getHuddleToken({
                variables: { flickId: flick.id },
              })
              if (data?.HuddleRtcToken?.token) {
                renewToken(data?.HuddleRtcToken?.token)
              }
            },
            onTokenDidExpire: async () => {
              const { data } = await getHuddleToken({
                variables: { flickId: flick.id },
              })
              if (data?.HuddleRtcToken?.token) {
                join(data?.HuddleRtcToken?.token, participantId, track)
              }
            },
          },
          track
        )
      } catch (error: any) {
        track?.stop()
        await leave()
        setInHuddle(false)
        emitToast({
          type: 'error',
          title: 'Failed to initialize AgoraRTC',
          description: error?.message,
        })
      }
    })()
  }, [trackReady, track, flick, participantId])

  if (trackError) return <div>{trackError.message}</div>

  return (
    <div className="border border-brand rounded-full flex justify-end items-center p-2">
      <div
        className="bg-brand hover:bg-error cursor-pointer rounded-full p-2 text-white mr-2"
        onClick={() => {
          track?.stop()
          leave()
          setInHuddle(false)
        }}
      >
        <IoHeadsetOutline size={16} />
      </div>
      {users.map((user) => {
        const participant = flick.participants.find((p) => p.id === user.uid)
        return participant ? (
          <div key={user.uid}>
            <img
              src={participant.user.picture || ''}
              alt={participant.user.displayName || ''}
              className="rounded-full w-8 h-8 mr-2"
            />
          </div>
        ) : null
      })}
    </div>
  )
}

const FlickNavBar = () => {
  const user = useRecoilValue(userState)
  const [{ flick }] = useRecoilState(newFlickStore)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [currentAudioDevice, setCurrentAudioDevice] =
    useState<MediaDeviceInfo>()

  const [inHuddle, setInHuddle] = useState(false)

  const participant = useCallback(() => {
    return flick?.participants?.find(
      (participant) => participant.userSub === user?.sub
    )
  }, [user])

  const participantId = participant()?.id

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
        {inHuddle && participantId && flick?.participants ? (
          <FlickHuddle
            flick={flick}
            devices={audioDevices}
            setInHuddle={setInHuddle}
            participantId={participantId}
            deviceId={currentAudioDevice?.deviceId}
          />
        ) : (
          <div
            onClick={joinHuddle}
            className="mr-2 border-4 border-brand-10 rounded-full cursor-pointer"
          >
            <div className="border border-brand rounded-full p-2 text-gray-600">
              <IoHeadsetOutline size={16} />
            </div>
          </div>
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
