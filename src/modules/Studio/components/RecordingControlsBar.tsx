/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { cx } from '@emotion/css'
import Konva from 'konva'
import React, {
  HTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import { ReactComponent as ThreeWaySwap } from '../../../assets/ThreeWaySwap.svg'
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
  IntroBlockView,
  ListBlockView,
  OutroBlockView,
  ViewConfig,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import {
  Block,
  CodeBlockProps,
  ListBlock,
  ListBlockProps,
} from '../../Flick/editor/utils/utils'
import { ComputedPoint } from '../hooks/use-point'
import { StudioProviderProps, studioStore } from '../stores'

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
  timeLimit,
  timeOver,
  stageRef,
  stageHeight,
  stageWidth,
  resetTimer,
  shortsMode,
  openTimerModal,
  currentBlock,
  addContinuousRecordedBlockIds,
}: {
  timeLimit?: number
  stageHeight: number
  stageWidth: number
  shortsMode: boolean
  openTimerModal: () => void
  resetTimer: boolean
  timeOver: () => void
  stageRef: React.RefObject<Konva.Stage>
  currentBlock: Block | undefined
  addContinuousRecordedBlockIds: (blockId: string, duration: number) => void
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
  const [studio, setStudio] = useRecoilState(studioStore)
  const [isRaiseHandsTooltip, setRaiseHandsTooltip] = useState(false)
  const [participant, setParticipant] = useState<any>()
  const [participantsArray, setParticipantsArray] = useState<any[]>([])

  const {
    handleStart: handleTimerStart,
    handleReset: handleTimerReset,
    timer,
  } = useTimekeeper2(0)

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
      handleTimerStart()
    }
    if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
      handleTimerReset()
    }
  }, [payload])

  useEffect(() => {
    if (!fragment) return
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        performAction(
          fragment,
          payload,
          updatePayload,
          branding,
          controlsConfig,
          'previous'
        )
      }
      if (event.key === 'ArrowRight') {
        let isBlockCompleted: boolean | undefined = false
        if (fragment && payload) {
          isBlockCompleted = performAction(
            fragment,
            payload,
            updatePayload,
            branding,
            controlsConfig,
            'next'
          )

          if (isBlockCompleted && state === 'recording') {
            // studio.stopRecording()
            updatePayload?.({
              ...payload,
              status: Fragment_Status_Enum_Enum.Ended,
            })
          }
        }
      }
    })
  }, [fragment])

  useEffect(() => {
    if (!timer || !timeLimit) return
    if (timer >= timeLimit * 60) {
      timeOver()
    }
  }, [timer])

  // useEffect(() => {
  //   if (timer === 0) return
  //   if (timer === 180) {
  //     handleReset()
  //     updatePayload?.({ ...payload, status: Fragment_Status_Enum_Enum.Ended })
  //   }
  // }, [timer])

  useEffect(() => {
    if (resetTimer) {
      handleTimerReset()
    }
  }, [resetTimer])

  const { isIntro, isOutro, isImage, isVideo, isCode, codeAnimation } =
    useMemo(() => {
      const blockType = fragment?.editorState?.blocks.filter(
        (b: any) => b.type !== 'interactionBlock'
      )[payload?.activeObjectIndex]?.type

      const codeBlockProps = fragment?.editorState?.blocks.filter(
        (b: any) => b.type !== 'interactionBlock'
      )[payload?.activeObjectIndex || 0] as CodeBlockProps
      const codeBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
        codeBlockProps?.id
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
        width: `${shortsMode ? stageWidth + 35 : stageWidth}px`,
      }}
      className="flex items-center justify-center absolute bottom-6 w-full"
    >
      {(state === 'recording' ||
        state === 'start-recording' ||
        payload?.status === Fragment_Status_Enum_Enum.Live) && (
        <button
          type="button"
          onClick={() => {
            // studio.stopRecording()
            updatePayload?.({
              ...payload,
              status: Fragment_Status_Enum_Enum.Ended,
            })

            logEvent(PageEvent.StopRecording)
          }}
          className={cx(
            'flex gap-x-2 items-center justify-between border backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm w-24 absolute min-w-max',
            {
              'left-0': shortsMode,
              'bg-grey-500 bg-opacity-50 border-gray-600': timeLimit
                ? timer < timeLimit * 60
                : true,
              'bg-error-10 text-error border-error': timeLimit
                ? timer >= timeLimit * 60
                : false,
            }
          )}
        >
          <StopRecordIcon className="m-px w-5 h-5 flex-shrink-0" />
          <Timer target={(timeLimit || 3) * 60} timer={timer} />
          {timeLimit && (
            <small className="text-xs flex-shrink-0 text-dark-title">
              Limit: {timeLimit}min{' '}
            </small>
          )}
        </button>
      )}
      {(state === 'ready' ||
        state === 'resumed' ||
        payload?.status === Fragment_Status_Enum_Enum.NotStarted ||
        payload?.status === Fragment_Status_Enum_Enum.Paused) && (
        <button
          className={cx(
            'bg-grey-500 bg-opacity-50 border border-gray-600 backdrop-filter backdrop-blur-2xl p-1.5 rounded-sm absolute flex items-center',
            {
              'left-0': shortsMode,
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
          <small
            className="text-xs text-dark-title hover:text-white ml-2"
            onClick={(e) => {
              e.stopPropagation()
              openTimerModal()
            }}
          >
            {timeLimit ? `Limit: ${timeLimit}min` : 'No Time Limit'}
          </small>
        </button>
      )}
      <div
        className={cx('flex items-center ml-auto', {
          'mr-8': !shortsMode,
        })}
      >
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
              className={cx(
                'flex gap-x-2 items-center justify-between border bg-grey-400 bg-opacity-50 backdrop-filter backdrop-blur-2xl border-gray-600 rounded-sm ml-4',
                {
                  'bg-grey-500 bg-opacity-100': !isIntro && !isOutro,
                  'cursor-not-allowed': isIntro || isOutro,
                }
              )}
              disabled={isIntro || isOutro}
              // onClick={() => {
              //   if (payload?.fragmentState === 'onlyUserMedia') {
              //     // updating the fragment state in the payload to customLayout state
              //     updatePayload?.({
              //       fragmentState: 'customLayout',
              //     })
              //   } else {
              //     // updating the fragment state in the payload to onlyUserMedia state
              //     updatePayload?.({
              //       fragmentState: 'onlyUserMedia',
              //     })
              //   }
              // }}
            >
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 ml-1 transition-all duration-200 filter',
                  {
                    'bg-transparent': isIntro || isOutro,
                    'bg-grey-900':
                      payload?.fragmentState === 'onlyUserMedia' &&
                      !isIntro &&
                      !isOutro,
                    'brightness-50': isIntro || isOutro,
                    'brightness-75':
                      (payload?.fragmentState === 'customLayout' ||
                        payload?.fragmentState === 'onlyFragment') &&
                      !isIntro &&
                      !isOutro,
                  }
                )}
                onClick={() =>
                  updatePayload?.({
                    fragmentState: 'onlyUserMedia',
                  })
                }
              >
                <OnlyUserMedia className={cx('m-px w-5 h-4 ', {})} />
              </div>
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
                  {
                    'bg-transparent': isIntro || isOutro,
                    'bg-grey-900':
                      payload?.fragmentState === 'customLayout' &&
                      !isIntro &&
                      !isOutro,
                    'brightness-50': isIntro || isOutro,
                    'brightness-75':
                      (payload?.fragmentState === 'onlyUserMedia' ||
                        payload?.fragmentState === 'onlyFragment') &&
                      !isIntro &&
                      !isOutro,
                  }
                )}
                onClick={() =>
                  updatePayload?.({
                    fragmentState: 'customLayout',
                  })
                }
              >
                <ThreeWaySwap className={cx('m-px w-5 h-4', {})} />
              </div>
              <div
                className={cx(
                  'bg-transparent py-1 px-1 rounded-sm my-1 mr-1 transition-all duration-300 filter',
                  {
                    'bg-transparent': isIntro || isOutro,
                    'bg-grey-900':
                      payload?.fragmentState === 'onlyFragment' &&
                      !isIntro &&
                      !isOutro,
                    'brightness-50': isIntro || isOutro,
                    'brightness-75':
                      (payload?.fragmentState === 'customLayout' ||
                        payload?.fragmentState === 'onlyUserMedia') &&
                      !isIntro &&
                      !isOutro,
                  }
                )}
                onClick={() =>
                  updatePayload?.({
                    fragmentState: 'onlyFragment',
                  })
                }
              >
                <CustomLayout className={cx('m-px w-5 h-4', {})} />
              </div>
            </button>
          </>
        )}

        <button
          className={cx(
            'bg-grey-400 border border-gray-600 backdrop-filter bg-opacity-50 backdrop-blur-2xl p-1.5 rounded-sm ml-4',
            {
              'bg-grey-500 bg-opacity-100 text-gray-100': !isBackDisabled(),
              'text-gray-500 cursor-not-allowed': isBackDisabled(),
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
            'bg-grey-500 border border-gray-600 backdrop-filter bg-opacity-100 backdrop-blur-2xl p-1.5 rounded-sm ml-2 text-gray-100',
            {
              'text-gray-500 cursor-not-allowed':
                payload?.activeObjectIndex ===
                  fragment?.editorState?.blocks.filter(
                    (b: any) => b.type !== 'interactionBlock'
                  ).length -
                    1 &&
                payload.activeOutroIndex ===
                  ((
                    fragment?.configuration?.blocks[
                      fragment?.editorState?.blocks.filter(
                        (b: any) => b.type !== 'interactionBlock'
                      )[payload?.activeObjectIndex].id
                    ].view as OutroBlockView
                  ).outro.order?.length || 0) -
                    1,
            }
          )}
          type="button"
          disabled={
            payload?.activeObjectIndex ===
              fragment?.editorState?.blocks.filter(
                (b: any) => b.type !== 'interactionBlock'
              ).length -
                1 &&
            payload.activeOutroIndex ===
              ((
                fragment?.configuration?.blocks[
                  fragment?.editorState?.blocks.filter(
                    (b: any) => b.type !== 'interactionBlock'
                  )[payload?.activeObjectIndex].id
                ].view as OutroBlockView
              ).outro.order?.length || 0) -
                1
          }
          onClick={() => {
            let isBlockCompleted: boolean | undefined = false
            if (fragment && payload) {
              isBlockCompleted = performAction(
                fragment,
                payload,
                updatePayload,
                branding,
                controlsConfig,
                'next'
              )
              if (
                isBlockCompleted &&
                (state === 'recording' ||
                  state === 'start-recording' ||
                  state === 'resumed' ||
                  state === 'ready')
              ) {
                console.log('Inside inside')
                if (!fragment.configuration.continuousRecording) {
                  if (state === 'recording' || state === 'start-recording')
                    // studio.stopRecording()
                    updatePayload?.({
                      ...payload,
                      status: Fragment_Status_Enum_Enum.Ended,
                    })
                } else {
                  // If continuous recording is enabled, we need to track block completions and add metadata
                  if (!currentBlock)
                    throw new Error('currentBlock is not defined')

                  addContinuousRecordedBlockIds(currentBlock.id, timer)

                  // After tracking metadata , update active object index
                  if (
                    payload?.activeObjectIndex <
                    fragment.configuration.selectedBlocks.length - 1
                  ) {
                    updatePayload?.({
                      activeObjectIndex: payload?.activeObjectIndex + 1,
                    })
                    isBlockCompleted = false
                  } else if (
                    state === 'recording' ||
                    state === 'start-recording'
                  ) {
                    // studio.stopRecording()
                    updatePayload?.({
                      ...payload,
                      status: Fragment_Status_Enum_Enum.Ended,
                    })
                  }
                }
              }
            }
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
): boolean | undefined => {
  let block: Block
  if (fragment.configuration.continuousRecording) {
    block = fragment.editorState?.blocks.filter(
      (item: Block) =>
        !!fragment.configuration?.selectedBlocks.find(
          (blk: any) => blk.blockId === item.id
        )
    )[payload?.activeObjectIndex]
  } else {
    block = fragment.editorState.blocks.filter(
      (b: any) => b.type !== 'interactionBlock'
    )[payload?.activeObjectIndex]
  }

  switch (block.type) {
    case 'introBlock':
      return handleIntroBlock(
        fragment,
        payload,
        updatePayload,
        branding,
        direction,
        block.id
      )
    // break
    case 'codeBlock':
      return handleCodeBlock(
        fragment,
        payload,
        updatePayload,
        controlsConfig,
        direction,
        block.id
      )
    // break
    case 'videoBlock':
      return handleVideoBlock(payload, updatePayload, direction)
    // break
    case 'imageBlock':
      return handleImageBlock(payload, updatePayload, direction)
    // break
    case 'listBlock':
      return handleListBlock(
        fragment,
        payload,
        updatePayload,
        controlsConfig,
        direction,
        block
      )
    // break
    case 'headingBlock':
      return handleImageBlock(payload, updatePayload, direction)
    // break
    case 'outroBlock':
      return handleOutroBlock(
        fragment,
        payload,
        updatePayload,
        branding,
        direction,
        block.id
      )
    default:
      return false
  }
}
const handleListBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous',
  block: Block
): boolean => {
  const listBlock = (block as ListBlockProps)?.listBlock as ListBlock
  const listBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    block.id
  ]?.view as ListBlockView
  const appearance = listBlockViewProps?.list?.appearance

  const computedPoints: ComputedPoint[] = controlsConfig?.computedPoints

  const noOfPoints = listBlock?.list?.length || 0

  if (direction === 'next') {
    if (payload?.activePointIndex === noOfPoints) {
      // updatePayload?.({
      //   activeObjectIndex: payload?.activeObjectIndex + 1,
      // })
      return true
      // eslint-disable-next-line no-else-return
    } else if (appearance === 'allAtOnce') {
      const index = computedPoints.findIndex(
        (point) =>
          point.startFromIndex >
          computedPoints[payload?.activePointIndex].startFromIndex
      )
      updatePayload?.({
        activePointIndex: index !== -1 ? index : computedPoints.length,
      })
      return false
    } else {
      updatePayload?.({
        activePointIndex: payload?.activePointIndex + 1 || 1,
      })
    }
  } else if (direction === 'previous') {
    updatePayload?.({
      activePointIndex: payload?.activePointIndex - 1,
    })
    return false
  }
  return false
}

const handleImageBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
): boolean => {
  if (direction === 'next') {
    // updatePayload?.({
    //   activeObjectIndex: payload?.activeObjectIndex + 1,
    // })
    return true
  }
  return false
}

const handleVideoBlock = (
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  direction: 'next' | 'previous'
): boolean => {
  if (direction === 'next') {
    // updatePayload?.({
    //   activeObjectIndex: payload?.activeObjectIndex + 1,
    // })
    return true
  }
  return false
}

const handleCodeBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  controlsConfig: any,
  direction: 'next' | 'previous',
  blockId: string
): boolean | undefined => {
  const codeBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    blockId
  ]?.view as CodeBlockView

  const noOfBlocks = codeBlockViewProps?.code.highlightSteps?.length
  const codeAnimation = codeBlockViewProps?.code.animation
  const { position, computedTokens } = controlsConfig

  if (direction === 'next') {
    switch (codeAnimation) {
      case CodeAnimation.HighlightLines: {
        if (noOfBlocks === undefined) return false
        if (
          payload?.activeBlockIndex === noOfBlocks &&
          !payload?.focusBlockCode
        ) {
          // updatePayload?.({
          //   activeObjectIndex: payload?.activeObjectIndex + 1,
          // })
          return true
          // eslint-disable-next-line no-else-return
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
        return false
        // break
      }
      // case CodeAnimation.InsertInBetween: {
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
          // updatePayload?.({
          //   activeObjectIndex: payload?.activeObjectIndex + 1,
          // })
          return true
          // eslint-disable-next-line no-else-return
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
        return false
        // break
      }
      default:
        break
    }
  } else if (direction === 'previous') {
    switch (codeAnimation) {
      case CodeAnimation.HighlightLines: {
        if (noOfBlocks === undefined) return false
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
    return false
  }
}

const handleIntroBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  direction: 'next' | 'previous',
  blockId: string
): boolean => {
  const introBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    blockId
  ]?.view as IntroBlockView

  if (direction === 'next') {
    if (
      payload?.activeIntroIndex ===
      (introBlockViewProps.intro?.order?.length || 0) - 1
    ) {
      // updatePayload?.({
      //   activeObjectIndex: payload?.activeObjectIndex + 1,
      // })
      return true
      // eslint-disable-next-line no-else-return
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
  return false
}

const handleOutroBlock = (
  fragment: StudioFragmentFragment,
  payload: any,
  updatePayload: ((value: any) => void) | undefined,
  branding: BrandingJSON | null | undefined,
  direction: 'next' | 'previous',
  blockId: string
): boolean => {
  const outroBlockViewProps = (fragment?.configuration as ViewConfig).blocks[
    blockId
  ]?.view as OutroBlockView

  if (direction === 'next') {
    if (
      payload?.activeOutroIndex ===
      (outroBlockViewProps.outro?.order?.length || 0) - 1
    ) {
      // updatePayload?.({
      //   activeObjectIndex: payload?.activeObjectIndex + 1,
      // })
      return true
      // eslint-disable-next-line no-else-return
    } else {
      updatePayload?.({
        activeOutroIndex: payload?.activeOutroIndex + 1,
      })
    }
  } else if (direction === 'previous') {
    if (payload?.activeOutroIndex === 0) {
      updatePayload?.({
        activeObjectIndex: payload?.activeObjectIndex - 1,
      })
    } else {
      updatePayload?.({
        activeOutroIndex: payload?.activeOutroIndex - 1,
      })
    }
  }

  return false
}

ControlButton.defaultProps = {
  disabled: false,
}

export default RecordingControlsBar
