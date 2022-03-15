/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useMemo, useState } from 'react'
import { IconType } from 'react-icons'
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoPause,
  IoPlay,
} from 'react-icons/io5'
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
  ListBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import {
  CodeBlockProps,
  ListBlock,
  ListBlockProps,
} from '../../Flick/editor/utils/utils'
import { ComputedPoint } from '../hooks/use-point'
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
  stageWidth,
  shortsMode,
}: {
  stageRef: React.RefObject<Konva.Stage>
  stageHeight: number
  stageWidth: number
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
    if (payload?.status === Fragment_Status_Enum_Enum.Live && timer === 0) {
      handleStart()
    }
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      handleReset()
    }
  }, [payload])

  // useEffect(() => {
  //   if (timer === 0) return
  //   if (timer === 180) {
  //     handleReset()
  //     updatePayload?.({ ...payload, status: Fragment_Status_Enum_Enum.Ended })
  //   }
  // }, [timer])

  const { isIntro, isOutro, isImage, isVideo, isCode, codeAnimation } =
    useMemo(() => {
      const blockType =
        fragment?.editorState?.blocks[payload?.activeObjectIndex]?.type

      const codeBlockProps = fragment?.editorState?.blocks[
        payload?.activeObjectIndex || 0
      ] as CodeBlockProps
      const codeBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
        codeBlockProps.id
      ]?.view as CodeBlockView

      const codeAnimation = codeBlockViewProps?.code?.animation
      return {
        isIntro: blockType === 'introBlock',
        isOutro: blockType === 'outroBlock',
        isImage: blockType === 'imageBlock',
        isVideo: blockType === 'videoBlock',
        isCode: blockType === 'codeBlock',
        codeAnimation,
      }
    }, [payload?.activeObjectIndex])

  const isBackDisabled = () => {
    return (
      (payload?.activeObjectIndex === 0 && payload?.activeIntroIndex === 0) ||
      payload?.activePointIndex === 0 ||
      isVideo ||
      isImage ||
      (codeAnimation === CodeAnimation.HighlightLines &&
        payload?.activeBlockIndex === 0 &&
        payload?.focusBlockCode === false) ||
      (codeAnimation === CodeAnimation.TypeLines &&
        payload?.currentIndex === 0) ||
      isOutro
    )
  }

  return (
    <div
      style={{
        top: `${
          (stageRef?.current?.y() || 0) + stageHeight + (shortsMode ? 0 : 25)
        }px`,
        width: `${stageWidth}px`,
      }}
      className="flex items-center justify-center absolute bottom-6 w-full"
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
          className={cx(
            'flex gap-x-2 items-center justify-between bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm w-24 absolute',
            {
              'left-0 ml-8': shortsMode,
            }
          )}
        >
          <StopRecordIcon className="m-px w-5 h-5 flex-shrink-0 ml-1" />
          <Timer target={180} timer={timer} />
        </button>
      )}
      {state === 'ready' && (
        <button
          className={cx(
            'bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm absolute',
            {
              'left-0 ml-8': shortsMode,
            }
          )}
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
      <div className="flex items-center ml-auto mr-8">
        {isVideo && (
          <button
            className="bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm text-gray-100"
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
        {state !== 'preview' && state !== 'upload' && (
          <>
            <button
              type="button"
              style={{
                background: 'rgba(39, 39, 42, 0.05);',
              }}
              className={cx(
                'flex gap-x-2 items-center justify-between bg-grey-500 bg-opacity-0 border border-gray-600 backdrop-filter backdrop-blur-2xl rounded-sm ml-4',
                {
                  'bg-opacity-50': !isIntro && !isOutro,
                }
              )}
              disabled={isIntro || isOutro}
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
                  'bg-transparent py-1 px-1 rounded-sm my-1 ml-1 transition-all duration-200 filter',
                  {
                    'bg-transparent': isIntro || isOutro,
                    'bg-grey-500':
                      payload?.fragmentState === 'onlyUserMedia' &&
                      !isIntro &&
                      !isOutro,
                    'brightness-65': isIntro || isOutro,
                    'brightness-75':
                      payload?.fragmentState === 'customLayout' &&
                      !isIntro &&
                      !isOutro,
                  }
                )}
              >
                <OnlyUserMedia className={cx('m-px w-5 h-4 ', {})} />
              </div>
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
                  {
                    'bg-transparent': isIntro || isOutro,
                    'bg-grey-500':
                      payload?.fragmentState === 'customLayout' &&
                      !isIntro &&
                      !isOutro,
                    'brightness-65': isIntro || isOutro,
                    'brightness-75':
                      payload?.fragmentState === 'onlyUserMedia' &&
                      !isIntro &&
                      !isOutro,
                  }
                )}
              >
                <CustomLayout className={cx('m-px w-5 h-4', {})} />
              </div>
            </button>
          </>
        )}

        <button
          className={cx(
            'bg-grey-500 border border-gray-600 backdrop-filter bg-opacity-5 backdrop-blur-2xl p-1.5 rounded-sm ml-4',
            {
              'bg-opacity-50 text-gray-100': !isBackDisabled(),
              // (payload?.activeObjectIndex !== 0 ||
              //   payload?.activeIntroIndex !== 0) &&
              // payload?.activePointIndex !== 0 &&
              // !isVideo &&
              // !isImage &&
              // !isOutro,
              'text-gray-400': isBackDisabled(),
            }
          )}
          type="button"
          disabled={isBackDisabled()}
          onClick={() => {
            if (fragment && payload)
              performAction(
                fragment,
                payload,
                updatePayload,
                branding,
                controlsConfig,
                'previous'
              )
          }}
        >
          <IoArrowBackOutline
            style={{
              margin: '3px',
            }}
            className="w-4 h-4 p-px"
          />
        </button>

        <button
          className={cx(
            'bg-grey-500 border border-gray-600 backdrop-filter bg-opacity-5 backdrop-blur-2xl p-1.5 rounded-sm ml-2',
            {
              'bg-opacity-50 text-gray-100':
                payload?.activeObjectIndex !==
                fragment?.editorState?.blocks.length - 1,
              'text-gray-400':
                payload?.activeObjectIndex ===
                fragment?.editorState?.blocks.length - 1,
            }
          )}
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
                controlsConfig,
                'next'
              )
          }}
        >
          <IoArrowForwardOutline
            style={{
              margin: '3px',
            }}
            className="w-4 h-4 p-px"
          />
        </button>
      </div>
      {/* {state === 'ready' && (
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
      )} */}
    </div>
  )
}

const performAction = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous' = 'next'
) => {
  const block = fragment.editorState.blocks[payload?.activeObjectIndex]
  switch (block.type) {
    case 'introBlock':
      handleIntroBlock(payload, updatePayload, branding, direction)
      break
    case 'codeBlock':
      handleCodeBlock(
        fragment,
        payload,
        updatePayload,
        controlsConfig,
        direction
      )
      break
    case 'videoBlock':
      handleVideoBlock(payload, updatePayload, direction)
      break
    case 'imageBlock':
      handleImageBlock(payload, updatePayload, direction)
      break
    case 'listBlock':
      handleListBlock(
        fragment,
        payload,
        updatePayload,
        controlsConfig,
        direction
      )
      break
    default:
      break
  }
}
const handleListBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous'
) => {
  const listBlockProps = fragment?.editorState?.blocks[
    payload?.activeObjectIndex || 0
  ] as ListBlockProps
  const listBlock = listBlockProps?.listBlock as ListBlock
  const listBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    listBlockProps.id
  ]?.view as ListBlockView
  const appearance = listBlockViewProps?.list?.appearance

  const computedPoints: ComputedPoint[] = controlsConfig?.computedPoints

  const noOfPoints = listBlock?.list?.length || 0

  if (direction === 'next') {
    if (payload?.activePointIndex === noOfPoints) {
      updatePayload?.({
        activeObjectIndex: payload?.activeObjectIndex + 1,
      })
    } else if (appearance === 'allAtOnce') {
      const index = computedPoints.findIndex(
        (point) =>
          point.startFromIndex >
          computedPoints[payload?.activePointIndex].startFromIndex
      )
      updatePayload?.({
        activePointIndex: index !== -1 ? index : computedPoints.length,
      })
    } else {
      updatePayload?.({
        activePointIndex: payload?.activePointIndex + 1 || 1,
      })
    }
  } else if (direction === 'previous') {
    updatePayload?.({
      activePointIndex: payload?.activePointIndex - 1,
    })
  }
}

const handleImageBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    updatePayload?.({
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  }
}

const handleVideoBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    updatePayload?.({
      activeObjectIndex: payload?.activeObjectIndex + 1,
    })
  }
}

const handleCodeBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous'
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

  if (direction === 'next') {
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
      // case CodeAnimation.InsertInBetween: {
      //   console.log('Hello')
      //   if (noOfBlocks === undefined) return
      //   if (payload?.activeBlockIndex === noOfBlocks) {
      //     updatePayload?.({
      //       activeObjectIndex: payload?.activeObjectIndex + 1,
      //     })
      //   } else {
      //     updatePayload?.({
      //       activeBlockIndex: payload?.activeBlockIndex + 1,
      //     })
      //   }
      //   break
      // }
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
  } else if (direction === 'previous') {
    switch (codeAnimation) {
      case CodeAnimation.HighlightLines: {
        if (noOfBlocks === undefined) return
        if (payload?.activeBlockIndex === 1) {
          updatePayload?.({
            activeBlockIndex: payload?.activeBlockIndex - 1,
            focusBlockCode: false,
          })
        } else {
          updatePayload?.({
            activeBlockIndex: payload?.activeBlockIndex - 1,
            focusBlockCode: true,
          })
        }
        break
      }
      case CodeAnimation.TypeLines: {
        const current = computedTokens[position.currentIndex - 1]
        let next = [...computedTokens]
          .reverse()
          .findIndex((t: any) => t.lineNumber < current.lineNumber)
        if (next === -1) next = computedTokens.length
        updatePayload?.({
          prevIndex: computedTokens.length - next - 1,
          currentIndex: computedTokens.length - next,
          isFocus: false,
        })
        break
      }
      default:
        break
    }
  }
}

const handleIntroBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  direction: 'next' | 'previous'
) => {
  if (direction === 'next') {
    if (
      payload?.activeIntroIndex ===
      (branding && branding?.introVideoUrl ? 2 : 1)
    ) {
      updatePayload?.({
        activeObjectIndex: payload?.activeObjectIndex + 1,
      })
    } else {
      updatePayload?.({
        activeIntroIndex: payload?.activeIntroIndex + 1,
      })
    }
  } else if (direction === 'previous') {
    if (payload?.activeIntroIndex === 0) {
      updatePayload?.({
        activeObjectIndex: payload?.activeObjectIndex - 1,
      })
    } else {
      updatePayload?.({
        activeIntroIndex: payload?.activeIntroIndex - 1,
      })
    }
  }
}

ControlButton.defaultProps = {
  disabled: false,
}

export default RecordingControlsBar
