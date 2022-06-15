/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { Listbox } from '@headlessui/react'
import {
  useMyPresence,
  useOthers,
  useUpdateMyPresence,
} from '@liveblocks/react'
import { createMicrophoneAudioTrack } from 'agora-rtc-react'
import AgoraRTC from 'agora-rtc-sdk-ng'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { FiChevronLeft, FiMic, FiMicOff } from 'react-icons/fi'
import {
  IoChevronDownOutline,
  IoHeadsetOutline,
  IoPeopleOutline,
} from 'react-icons/io5'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Avatar, Button, emitToast, Heading } from '../../../components'
import config from '../../../config'
import { ASSETS } from '../../../constants'
import {
  FlickFragment,
  useGetHuddleRtcTokenMutation,
} from '../../../generated/graphql'
import { userState } from '../../../stores/user.store'
import { Presence, PresencePage } from '../Flick'
import useAudio from '../hooks/use-audio'
import { newFlickStore, View } from '../store/flickNew.store'
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
  const updateMyPresence = useUpdateMyPresence<Presence>()

  useEffect(() => {
    updateMyPresence({
      inHuddle: true,
    })
    return () => {
      updateMyPresence({
        inHuddle: false,
      })
    }
  }, [])

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
    currentUser,
    ready: agoraReady,
    setMicrophoneDevice,
  } = useAudio()

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    deviceId
  )
  useEffect(() => {
    if (selectedDeviceId) {
      setMicrophoneDevice(selectedDeviceId)
    }
  }, [selectedDeviceId])

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
          { uid: participantId, track, hasAudio: true }
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

  useEffect(() => {
    ;(async () => {
      if (trackError) {
        await leave()
        track?.close()
        setInHuddle(false)
        emitToast({
          title: 'Error',
          description: trackError.message,
          type: 'error',
        })
      }
    })()
  }, [trackError])

  if (trackError)
    return (
      <div className="text-red-500 text-xs">
        {trackError?.message || 'Error joining'}
      </div>
    )

  if (!agoraReady || !trackReady)
    return (
      <div
        style={{
          backgroundColor: '#4ADE8033',
        }}
        className="flex gap-x-2 items-center border-4 border-brand-10 rounded-full cursor-pointer"
      >
        <div className="border-2 border-brand rounded-full p-1.5 bg-dark-500 text-gray-600">
          <IoHeadsetOutline size={16} />
        </div>
        <span className="text-gray-200 text-xs mr-2">Connecting...</span>
      </div>
    )

  return (
    <div className="border border-incredible-green-600 rounded-full flex justify-end items-center p-1">
      <div
        className="flex items-center justify-center bg-incredible-green-600 cursor-pointer rounded-full h-7 w-7 text-white"
        onClick={async () => {
          track?.close()
          await leave()
          setInHuddle(false)
        }}
      >
        <IoHeadsetOutline size={16} />
      </div>
      <div className="group rounded-sm hover:bg-dark-200 flex items-center cursor-pointer ml-3 mr-1 gap-x-1">
        <div
          className="text-white flex items-center hover:bg-dark-100 rounded-l-sm justify-center px-1 py-1.5"
          onClick={mute}
        >
          {currentUser?.hasAudio ? (
            <FiMic className="cursor-pointer flex-shrink-0" size={14} />
          ) : (
            <FiMicOff className="cursor-pointer flex-shrink-0" size={14} />
          )}
        </div>
        <Listbox
          value={
            devices.find((d) => d.deviceId === selectedDeviceId)?.deviceId || ''
          }
          onChange={setSelectedDeviceId}
        >
          <div className="relative">
            <Listbox.Button className="hover:bg-dark-100 px-px py-1.5 rounded-r-sm flex items-center justify-center">
              <IoChevronDownOutline size={16} color="FFF" />
            </Listbox.Button>
            <Listbox.Options
              style={{
                border: '0.5px solid #52525B',
              }}
              className="bg-grey-500 bg-opacity-90 backdrop-filter backdrop-blur-md mt-3 rounded-md absolute w-72 z-10 shadow-md left-0 -ml-32 py-2 px-2"
            >
              {devices.map((device) => (
                <Listbox.Option
                  className="flex items-center gap-x-4 py-2 px-3 hover:bg-grey-500 rounded-sm bg-opacity-100 relative text-left font-body text-gray-100 cursor-pointer text-sm"
                  key={device.deviceId}
                  value={device.deviceId}
                >
                  {({ selected }) => (
                    <>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                          <BiCheck size={20} />
                        </span>
                      )}
                      <span className="truncate pl-6">{device.label}</span>
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>
      {[currentUser, ...users].map((user) => {
        const participant = flick.participants.find((p) => p.id === user.uid)
        return participant ? (
          <div
            key={user.uid}
            className={cx('relative rounded-full border', {
              'border-transparent': !user.audioTrack?.isPlaying,
              'border-brand': user.audioTrack?.isPlaying,
            })}
          >
            <Avatar
              src={
                participant.user.picture ||
                `${config.storage.baseUrl}/idev-logo.svg`
              }
              alt={participant.user.displayName || ''}
              name={participant.user.displayName || ''}
              className="rounded-full w-7 h-7 ml-2"
            />
            {user.hasAudio ? null : (
              <div
                style={{
                  bottom: '-2px',
                  right: '-2px',
                }}
                className="p-1 bg-dark-500 rounded-full absolute"
              >
                <FiMicOff className="text-white" size={10} />
              </div>
            )}
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
  const others = useOthers()
  const [myPresence, updateMyPresence] = useMyPresence<Presence>()

  const { view } = useRecoilValue(newFlickStore)

  useEffect(() => {
    if (view === View.Notebook) {
      updateMyPresence({
        page: PresencePage.Notebook,
      })
    } else {
      updateMyPresence({
        page: PresencePage.Preview,
      })
    }
  }, [view])

  const someoneInHuddle = useMemo(() => {
    let inHuddle = false
    others.map(({ presence }) => {
      if (presence) {
        const otherPresence = presence as Presence
        if (otherPresence && !inHuddle) {
          inHuddle = otherPresence.inHuddle
        }
      }
      return null
    })
    return inHuddle
  }, [others])

  const peopleInHuddle = useMemo(() => {
    const people: Presence[] = []
    others?.map(({ presence }) => {
      if (presence) {
        const otherPresence = presence as Presence
        if (otherPresence.inHuddle) people.push(otherPresence)
      }
      return null
    })
    if (myPresence.inHuddle) people.push(myPresence)
    return people
  }, [others, myPresence])

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between py-2 pl-3 pr-5 bg-dark-500 h-14">
      <div className="flex items-center">
        <a href="/dashboard">
          <div className="flex">
            <FiChevronLeft size={28} className="mr-2 text-grey-lighter" />
            <img src={ASSETS.ICONS.StudioLogo} alt="" className="w-28" />
          </div>
        </a>
      </div>
      <Heading className="font-bold text-base text-white absolute my-auto mx-auto left-0 right-0 w-96 truncate text-center">
        {flick?.name || ''}
      </Heading>
      <div className="flex items-center gap-x-5 px-2">
        {inHuddle && participantId && flick?.participants ? (
          <FlickHuddle
            flick={flick}
            devices={audioDevices}
            setInHuddle={setInHuddle}
            participantId={participantId}
            deviceId={currentAudioDevice?.deviceId}
          />
        ) : someoneInHuddle ? (
          <div className="border border-incredible-green-600 rounded-full flex justify-end items-center p-1">
            <div
              className="px-2 flex items-center bg-incredible-green-600 cursor-pointer rounded-full h-7 text-white mr-2"
              onClick={joinHuddle}
            >
              <IoHeadsetOutline size={16} />
              <span className="text-xs">Join</span>
            </div>
            {peopleInHuddle?.map((otherPresence) => {
              return (
                <Avatar
                  src={otherPresence.user.picture}
                  name={otherPresence.user.name}
                  className="h-7 w-7 rounded-full"
                  alt={otherPresence.user.name}
                />
              )
            })}
          </div>
        ) : (
          <div
            onClick={joinHuddle}
            style={{
              backgroundColor: '#4ADE8033',
            }}
            className="border-4 border-brand-10 rounded-full cursor-pointer"
          >
            <div className="border-2 border-brand rounded-full p-1.5 bg-dark-500 text-gray-600">
              <IoHeadsetOutline size={16} />
            </div>
          </div>
        )}
        {peopleInHuddle.length !== others.count + 1 && (
          <div className="flex items-center gap-x-2">
            {myPresence.user && !myPresence.inHuddle && (
              <Avatar
                src={myPresence.user.picture}
                name={myPresence.user.name}
                alt={myPresence.user.name}
                className="h-7 w-7 rounded-full"
              />
            )}
            {others?.map(({ presence }) => {
              if (presence) {
                const otherPresence = presence as Presence
                return otherPresence.inHuddle ? null : (
                  <Avatar
                    src={otherPresence.user.picture}
                    name={otherPresence.user.name}
                    className="h-7 w-7 rounded-full"
                    alt={otherPresence.user.name}
                  />
                )
              }
              return null
            })}
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
