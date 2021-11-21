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
} from 'react-icons/fi'
import { BiReset } from 'react-icons/bi'
import { IoHandRightOutline } from 'react-icons/io5'
import { VscSearch, VscSearchStop } from 'react-icons/vsc'
import { useRecoilState, useRecoilValue } from 'recoil'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import { Avatar, Heading, NextTokenIcon, Tooltip } from '../../../components'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { PresenterNotes } from '.'
import { ConfigType } from '../../../utils/configTypes'
import {
  CodeJamControls,
  PointsControls,
  TriviaControls,
  VideoJamControls,
} from './Controls'

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
          'opacity-70 cursor-not-allowed': disabled,
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

const MissionControl = () => {
  const {
    fragment,
    constraints,
    showFinalTransition,
    upload,
    reset,
    state,
    mute,
    participants,
    updateParticipant,
    payload,
    updatePayload,
    participantId,
    controlsConfig,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [studio, setStudio] = useRecoilState(studioStore)
  const [isRaiseHandsTooltip, setRaiseHandsTooltip] = useState(false)
  const [participant, setParticipant] = useState<any>()
  const [participantsArray, setParticipantsArray] = useState<any[]>([])
  const [showNotes, setShowNotes] = useState(false)

  const [fragmentType, setFragmentType] = useState<ConfigType>()

  const togglePresenterNotes = (to: boolean) => {
    setShowNotes(to)
  }

  // for shortcut key
  window.addEventListener('keydown', (event) => {
    if (event.key === 'n') {
      setShowNotes(true)
    }
  })

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

  useEffect(() => {
    if (!controlsConfig) return
    setFragmentType(controlsConfig.type)
  }, [controlsConfig])

  return (
    <div className="bg-gray-100 py-2 px-4 rounded-md">
      <div className="flex flex-col items-center justify-between h-full">
        <div className="flex items-center flex-col">
          <ControlButton
            icon={FiClipboard}
            appearance="primary"
            onClick={() => togglePresenterNotes(true)}
          />
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
              if (canvas) setCanvas({ ...canvas, zoomed: !canvas.zoomed })
            }}
          />
          <hr className="bg-grey-darker h-px my-2" />
          <ControlButton
            key="nextObject"
            icon={NextTokenIcon}
            disabled={
              payload?.activeObjectIndex ===
              controlsConfig?.dataConfigLength - 1
            }
            className="my-2"
            appearance="primary"
            onClick={() => {
              updatePayload?.({
                activeObjectIndex: payload?.activeObjectIndex + 1,
              })
            }}
          />
          {(() => {
            switch (fragmentType) {
              case ConfigType.CODEJAM:
                return (
                  <CodeJamControls
                    position={controlsConfig.position}
                    computedTokens={controlsConfig.computedTokens}
                    fragmentState={controlsConfig.fragmentState}
                    isCodexFormat={controlsConfig.isCodexFormat}
                    noOfBlocks={controlsConfig.noOfBlocks}
                  />
                )
              case ConfigType.VIDEOJAM:
                return (
                  <VideoJamControls
                    playing={controlsConfig.playing}
                    videoElement={controlsConfig.videoElement}
                    fragmentState={controlsConfig.fragmentState}
                  />
                )
              case ConfigType.TRIVIA:
                return (
                  <TriviaControls
                    fragmentState={controlsConfig.fragmentState}
                  />
                )
              case ConfigType.POINTS:
                return (
                  <PointsControls
                    fragmentState={controlsConfig.fragmentState}
                    noOfPoints={controlsConfig.noOfPoints}
                  />
                )
              default: {
                return <></>
              }
            }
          })()}
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
            {(state === 'recording' ||
              payload?.status === Fragment_Status_Enum_Enum.Live) && (
              <ControlButton
                className="my-2"
                icon={FiStopCircle}
                appearance="danger"
                disabled={!studio.isHost}
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
                disabled={!studio.isHost}
                onClick={() => {
                  // startRecording()
                  setStudio({ ...studio, state: 'countDown' })
                  updatePayload?.({
                    status: Fragment_Status_Enum_Enum.CountDown,
                  })
                }}
              />
            )}
          </>
        </div>
      </div>
      {fragment && participantId && (
        <PresenterNotes
          open={showNotes}
          fragmentId={fragment.id}
          flickId={fragment.flickId}
          participantId={participantId}
          handleClose={() => togglePresenterNotes(false)}
        />
      )}
    </div>
  )
}

ControlButton.defaultProps = {
  disabled: false,
}

export default MissionControl