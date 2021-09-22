/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { cx } from '@emotion/css'
import React, { HTMLAttributes, useEffect, useState } from 'react'
import { IconType } from 'react-icons'
import {
  FiMic,
  FiVideo,
  FiCheckCircle,
  FiStopCircle,
  FiXCircle,
  FiCircle,
  FiClipboard,
  FiMicOff,
  FiVideoOff,
  FiSettings,
} from 'react-icons/fi'
import { BiReset } from 'react-icons/bi'
import { IoHandRightOutline } from 'react-icons/io5'
import { VscSearch, VscSearchStop } from 'react-icons/vsc'
import { useRecoilState, useRecoilValue } from 'recoil'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import { Avatar, Heading, Tooltip } from '../../../components'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import SwitchMediaDevices from './SwitchMediaDevices'

export const ControlButton = ({
  appearance,
  className,
  icon: I,
  disabled,
  ...rest
}: {
  appearance: 'primary' | 'danger' | 'success'
  icon: IconType
  disabled?: boolean
} & HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        'p-2 rounded-full flex items-center justify-center',
        {
          'bg-brand-10 text-brand': appearance === 'primary',
          'bg-error-10 text-error': appearance === 'danger',
          'bg-success-10 text-success': appearance === 'success',
        },
        className
      )}
      {...rest}
    >
      <I
        color={(() => {
          switch (appearance) {
            case 'danger':
              return '#EF2D56'
            case 'primary':
              return '#5156EA'
            case 'success':
              return '#137547'
            default:
              return 'transparent'
          }
        })()}
      />
    </button>
  )
}

const RaiseHandsMenu = ({ participants }: { participants: any[] }) => {
  return (
    <div className="flex flex-col shadow-2xl p-1 rounded-md bg-background">
      {participants.map(({ name, id, picture, email }, index) => (
        <div
          className="flex justify-start items-center w-full mb-2 last:mb-0"
          key={id || index}
        >
          <Avatar
            className="w-6 h-6 rounded-full"
            src={picture}
            alt={name}
            email={email}
          />
          <Heading fontSize="small" className="ml-1">
            {name}
          </Heading>
        </div>
      ))}
    </div>
  )
}

const MissionControl = ({ controls }: { controls: JSX.Element[] }) => {
  const {
    constraints,
    startRecording,
    stopRecording,
    showFinalTransition,
    upload,
    reset,
    state,
    mute,
    participants,
    updateParticipant,
    updatePayload,
    cameraDevices,
    microphoneDevices,
    participantId,
    payload,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)

  const [isRaiseHandsTooltip, setRaiseHandsTooltip] = useState(false)
  const [participant, setParticipant] = useState<any>()
  const [participantsArray, setParticipantsArray] = useState<any[]>([])
  const [openSwitchMediaDevicesModal, setOpenSwitchMediaDevicesModal] =
    useState(false)

  useEffect(() => {
    if (!participants) return
    const arr = []
    for (const i in participants) {
      arr.push({
        id: participants[i].id,
        name: participants[i].displayName,
        email: participants[i].email,
        picture: participants[i].picture,
        raiseHands: participants[i].raiseHands,
        audio: participants[i].audio,
        video: participants[i].video,
      })
    }
    setParticipantsArray(arr)
  }, [participants])

  useEffect(() => {
    if (participants && participantId) {
      setParticipant(participants[participantId])
    }
  }, [participants, participantId])

  useEffect(() => {
    if (!participantsArray) return
    setRaiseHandsTooltip(participantsArray.some((p) => p.raiseHands))
  }, [participantsArray])

  return (
    <div className="bg-gray-100 py-2 px-4 rounded-md">
      <div className="flex flex-col items-center justify-between h-full">
        <div className="flex items-center flex-col">
          <ControlButton
            icon={FiSettings}
            className="my-2"
            appearance="primary"
            onClick={async () => {
              setOpenSwitchMediaDevicesModal(true)
            }}
          />
          <ControlButton icon={FiClipboard} appearance="primary" />
          <ControlButton
            icon={BiReset}
            className="my-2"
            appearance="primary"
            onClick={canvas?.resetCanvas}
          />
          <ControlButton
            icon={canvas?.zoomed ? VscSearchStop : VscSearch}
            className="my-2"
            appearance={canvas?.zoomed ? 'danger' : 'primary'}
            onClick={() => {
              console.log(canvas)
              if (canvas) setCanvas({ ...canvas, zoomed: !canvas.zoomed })
            }}
          />
          <hr className="bg-grey-darker h-px my-2" />

          {controls}
        </div>
        <div>
          <Tooltip
            isOpen={isRaiseHandsTooltip}
            setIsOpen={setRaiseHandsTooltip}
            content={
              <RaiseHandsMenu
                participants={participantsArray.filter((p) => p.raiseHands)}
              />
            }
            placement="left-end"
            hideOnOutsideClick={false}
          >
            <ControlButton
              icon={
                participant?.raiseHands
                  ? IoHandRightOutline
                  : IoHandRightOutline
              }
              className="my-2"
              appearance={!participant?.raiseHands ? 'primary' : 'danger'}
              onClick={() => {
                updateParticipant?.({ raiseHands: !participant?.raiseHands })
              }}
            />
          </Tooltip>
          <ControlButton
            icon={constraints?.audio ? FiMic : FiMicOff}
            className="my-2"
            appearance={constraints?.audio ? 'primary' : 'danger'}
            onClick={async () => {
              updateParticipant?.({ audio: !constraints?.audio })
              await mute('audio')
            }}
          />
          <ControlButton
            icon={constraints?.video ? FiVideo : FiVideoOff}
            className="my-2"
            appearance={constraints?.video ? 'primary' : 'danger'}
            onClick={async () => {
              updateParticipant?.({ video: !constraints?.video })
              await mute('video')
            }}
          />

          <hr className="bg-grey-darker h-px my-2" />

          <>
            {state === 'recording' && (
              <ControlButton
                className="my-2"
                icon={FiStopCircle}
                appearance="danger"
                onClick={() => {
                  showFinalTransition()
                }}
              />
            )}

            {state === 'preview' && (
              <>
                <ControlButton
                  className="my-2"
                  icon={FiXCircle}
                  appearance="danger"
                  onClick={() => {
                    reset()
                    updatePayload?.({
                      status: Fragment_Status_Enum_Enum.NotStarted,
                    })
                  }}
                />
                <ControlButton
                  className="my-2"
                  icon={FiCheckCircle}
                  appearance="success"
                  onClick={() => {
                    upload()
                    updatePayload?.({
                      status: Fragment_Status_Enum_Enum.Completed,
                    })
                  }}
                />
              </>
            )}

            {state === 'ready' && (
              <ControlButton
                className="my-2"
                icon={FiCircle}
                appearance="primary"
                onClick={() => {
                  startRecording()
                  updatePayload?.({ status: Fragment_Status_Enum_Enum.Live })
                }}
              />
            )}
          </>
        </div>
      </div>
      <SwitchMediaDevices
        cameraDevices={cameraDevices}
        open={openSwitchMediaDevicesModal}
        audioDevices={microphoneDevices}
        handleClose={async () => {
          updateParticipant?.({ video: !constraints?.video })
          await mute('video')
          setOpenSwitchMediaDevicesModal(false)
        }}
      />
    </div>
  )
}

ControlButton.defaultProps = {
  disabled: false,
}

export default MissionControl
