/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react'
import { IconType } from 'react-icons'
import { IoArrowForwardOutline, IoPause, IoPlay } from 'react-icons/io5'
import { VscDebugRestart } from 'react-icons/vsc'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Timer } from '.'
import { ReactComponent as CustomLayout } from '../../../assets/CustomLayout.svg'
import { ReactComponent as OnlyUserMedia } from '../../../assets/OnlyUserMedia.svg'
import { ReactComponent as StartRecordIcon } from '../../../assets/StartRecord.svg'
import { ReactComponent as StopRecordIcon } from '../../../assets/StopRecord.svg'
import { Avatar, Heading } from '../../../components'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
} from '../../../generated/graphql'
import { useTimekeeper2 } from '../../../hooks'
import { logEvent } from '../../../utils/analytics'
import { PageEvent } from '../../../utils/analytics-types'
import {
  CodeAnimation,
  CodeBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { CodeBlockProps, ListBlock } from '../../Flick/editor/utils/utils'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'

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

const RecordingControlsBar = ({
  stageRef,
  stageHeight,
  shortsMode,
}: {
  stageRef: React.RefObject<Konva.Stage>
  stageHeight: number
  shortsMode: boolean
}) => {
  const {
    state,
    fragment,
    participants,
    payload,
    updatePayload,
    participantId,
    branding,
    controlsConfig,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [studio, setStudio] = useRecoilState(studioStore)
  const [isRaiseHandsTooltip, setRaiseHandsTooltip] = useState(false)
  const [participant, setParticipant] = useState<any>()
  const [participantsArray, setParticipantsArray] = useState<any[]>([])
  const { handleStart, handleReset, timer } = useTimekeeper2(0)

  const latestPayload = useRef<any>()

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
    latestPayload.current = payload
    if (payload?.status === Fragment_Status_Enum_Enum.Live && timer === 0) {
      handleStart()
    }
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      handleReset()
    }
  }, [payload])

  useEffect(() => {
    if (!fragment) return
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        performAction(
          fragment,
          latestPayload.current,
          updatePayload,
          branding,
          controlsConfig
        )
      }
    })
  }, [fragment])

  // useEffect(() => {
  //   if (timer === 0) return
  //   if (timer === 180) {
  //     handleReset()
  //     updatePayload?.({ ...payload, status: Fragment_Status_Enum_Enum.Ended })
  //   }
  // }, [timer])

  return (
    <div
      style={{
        top: `${
          (stageRef?.current?.y() || 0) + stageHeight + (shortsMode ? 0 : 25)
        }px`,
      }}
      className="flex gap-x-3 items-center justify-center absolute bottom-6"
    >
      {(state === 'recording' ||
        payload?.status === Fragment_Status_Enum_Enum.Live) && (
        <button
          type="button"
          onClick={() => {
            updatePayload?.({
              ...payload,
              status: Fragment_Status_Enum_Enum.Ended,
            })
            logEvent(PageEvent.StopRecording)
          }}
          className="flex gap-x-2 items-center justify-between bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm w-24"
        >
          <StopRecordIcon className="m-px w-5 h-5 flex-shrink-0 ml-1" />
          <Timer target={180} timer={timer} />
        </button>
      )}
      {state === 'ready' && (
        <button
          className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm"
          type="button"
          onClick={() => {
            setStudio({ ...studio, state: 'countDown' })
            updatePayload?.({
              status: Fragment_Status_Enum_Enum.CountDown,
            })
            // Segment tracking
            logEvent(PageEvent.StartRecording)
          }}
        >
          <StartRecordIcon className="m-px w-5 h-5" />
        </button>
      )}
      {/* {state !== 'preview' && state !== 'upload' && (
        <>
          <button
            type="button"
            onClick={async () => {
              updateParticipant?.({ audio: !constraints?.audio })
              await mute('audio')
            }}
          >
            {constraints?.audio ? (
              <IoMicOutline className="text-gray-600" size={24} />
            ) : (
              <IoMicOffOutline className="text-gray-600" size={24} />
            )}
          </button>
          <button
            type="button"
            onClick={async () => {
              updateParticipant?.({ video: !constraints?.video })
              await mute('video')
            }}
          >
            {constraints?.video ? (
              <IoVideocamOutline className="text-gray-600" size={24} />
            ) : (
              <IoVideocamOffOutline className="text-gray-600" size={24} />
            )}
          </button>
        </>
      )} */}

      {state !== 'preview' &&
        state !== 'upload' &&
        fragment?.editorState?.blocks[payload?.activeObjectIndex]?.type !==
          'introBlock' &&
        fragment?.editorState?.blocks[payload?.activeObjectIndex]?.type !==
          'outroBlock' && (
          <>
            {/* <div className="w-px bg-gray-200 h-full mx-1" /> */}
            {/* <button
              type="button"
              onClick={() => {
                if (canvas) setCanvas({ ...canvas, zoomed: !canvas.zoomed })
              }}
            >
              {canvas?.zoomed ? (
                <FiZoomIn className="text-gray-600" size={24} />
              ) : (
                <FiZoomOut className="text-gray-600" size={24} />
              )}
            </button> */}
            <button
              type="button"
              className="flex gap-x-2 items-center justify-between bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl rounded-sm ml-4"
              onClick={() => {
                if (payload?.fragmentState === 'onlyUserMedia') {
                  // updating the fragment state in the payload to customLayout state
                  updatePayload?.({
                    fragmentState: 'customLayout',
                  })
                } else {
                  // updating the fragment state in the payload to onlyUserMedia state
                  updatePayload?.({
                    fragmentState: 'onlyUserMedia',
                  })
                }
              }}
            >
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 ml-1 transition-all duration-200',
                  {
                    'bg-grey-500': payload?.fragmentState === 'onlyUserMedia',
                  }
                )}
              >
                <OnlyUserMedia className={cx('m-px w-5 h-4 ', {})} />
              </div>
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300',
                  {
                    'bg-grey-500': payload?.fragmentState === 'customLayout',
                  }
                )}
              >
                <CustomLayout className={cx('m-px w-5 h-4', {})} />
              </div>
            </button>
          </>
        )}
      {payload?.activeObjectIndex !==
        fragment?.editorState?.blocks.length - 1 && (
        <button
          className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100"
          type="button"
          disabled={
            payload?.activeObjectIndex ===
            fragment?.editorState?.blocks.length - 1
          }
          onClick={() => {
            if (fragment && payload)
              performAction(
                fragment,
                payload,
                updatePayload,
                branding,
                controlsConfig
              )
          }}
        >
          <IoArrowForwardOutline className="m-px w-5 h-5 p-px" />
        </button>
      )}
      {fragment?.editorState?.blocks[payload?.activeObjectIndex]?.type ===
        'videoBlock' && (
        <button
          className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100 ml-4"
          type="button"
          onClick={() => {
            const { playing, videoElement } = controlsConfig
            const next = !playing
            updatePayload?.({
              playing: next,
              currentTime: videoElement?.currentTime || 0,
            })
          }}
        >
          {controlsConfig?.playing ? (
            <IoPause className="m-px w-5 h-5 p-px" />
          ) : (
            <IoPlay className="m-px w-5 h-5 p-px" />
          )}
        </button>
      )}
      {state === 'ready' && (
        <button
          className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100"
          type="button"
          onClick={() => {
            updatePayload?.({
              activeObjectIndex: 0,
              activeIntroIndex: 0,
              fragmentState: 'customLayout',
            })
          }}
        >
          <VscDebugRestart className="m-px w-5 h-5 p-px" />
        </button>
      )}
      {/* {state === 'upload' && <div className="py-5" />} */}
      {/* {fragment?.participants.length !== 1 && (
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
          <button
            type="button"
            onClick={() => {
              updateParticipant?.({ raiseHands: !participant?.raiseHands })
            }}
          >
            <IoHandRightOutline className="text-gray-600 -mb-1.5" size={24} />
          </button>
        </Tooltip>
      )} */}
    </div>
  )
}

const performAction = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  controlsConfig: any
) => {
  const block = fragment.editorState.blocks[payload.activeObjectIndex]
  switch (block.type) {
    case 'introBlock':
      handleIntroBlock(payload, updatePayload, branding)
      break
    case 'codeBlock':
      handleCodeBlock(fragment, payload, updatePayload, controlsConfig)
      break
    case 'videoBlock':
      handleVideoBlock(payload, updatePayload)
      break
    case 'imageBlock':
      handleImageBlock(payload, updatePayload)
      break
    case 'listBlock':
      handleListBlock(fragment, payload, updatePayload)
      break
    default:
      break
  }
}
const handleListBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined
) => {
  const listBlockProps = fragment?.editorState?.blocks[
    payload?.activeObjectIndex || 0
  ]?.listBlock as ListBlock

  const noOfPoints = listBlockProps?.list?.length || 0

  if (payload?.activePointIndex === noOfPoints) {
    updatePayload?.({
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  } else {
    updatePayload?.({
      activePointIndex: payload?.activePointIndex + 1 || 1,
    })
  }
}

const handleImageBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined
) => {
  updatePayload?.({
    activeObjectIndex: payload?.activeObjectIndex + 1,
  })
}

const handleVideoBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined
) => {
  updatePayload?.({
    activeObjectIndex: payload?.activeObjectIndex + 1,
  })
}

const handleCodeBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  controlsConfig: any
) => {
  const codeBlockProps = fragment?.editorState?.blocks[
    payload?.activeObjectIndex || 0
  ] as CodeBlockProps
  const codeBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    codeBlockProps.id
  ].view as CodeBlockView
  const noOfBlocks = codeBlockViewProps.code.highlightSteps?.length
  const codeAnimation = codeBlockViewProps.code.animation
  const { position, computedTokens } = controlsConfig

  switch (codeAnimation) {
    case CodeAnimation.HighlightLines: {
      if (noOfBlocks === undefined) return
      if (
        payload?.activeBlockIndex === noOfBlocks &&
        !payload?.focusBlockCode
      ) {
        updatePayload?.({
          activeObjectIndex: payload?.activeObjectIndex + 1,
        })
      } else if (payload?.focusBlockCode) {
        updatePayload?.({
          focusBlockCode: false,
        })
      } else if (payload?.activeBlockIndex < noOfBlocks) {
        updatePayload?.({
          activeBlockIndex: payload?.activeBlockIndex + 1,
          focusBlockCode: true,
        })
      }
      break
    }
    case CodeAnimation.TypeLines: {
      if (payload?.currentIndex === computedTokens?.length) {
        updatePayload?.({
          activeObjectIndex: payload?.activeObjectIndex + 1,
        })
      } else {
        const current = computedTokens[position.currentIndex]
        let next = computedTokens.findIndex(
          (t: any) => t.lineNumber > current.lineNumber
        )
        if (next === -1) next = computedTokens.length
        updatePayload?.({
          prevIndex: position.currentIndex,
          currentIndex: next,
          isFocus: false,
        })
      }
      break
    }
    default:
      break
  }
}

const handleIntroBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined
) => {
  if (
    payload?.activeIntroIndex === (branding && branding?.introVideoUrl ? 2 : 1)
  ) {
    updatePayload?.({
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  } else {
    updatePayload?.({
      activeIntroIndex: payload?.activeIntroIndex + 1,
    })
  }
}

ControlButton.defaultProps = {
  disabled: false,
}

export default RecordingControlsBar
