/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { useEffect, useMemo, useRef } from 'react'
import { IoPause, IoPlay } from 'react-icons/io5'
import { ReactComponent as CustomLayout } from '../../assets/CustomLayout.svg'
import { ReactComponent as OnlyUserMedia } from '../../assets/OnlyUserMedia.svg'
import { ReactComponent as StartRecordIcon } from '../../assets/StartRecord.svg'
import { ReactComponent as StopRecordIcon } from '../../assets/StopRecord.svg'
import { ReactComponent as ThreeWaySwap } from '../../assets/ThreeWaySwap.svg'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
} from '../../generated/graphql'
import { useTimekeeper2 } from '../../hooks'
import { logEvent } from '../../utils/analytics'
import { PageEvent } from '../../utils/analytics-types'
import { CodeBlockView, ViewConfig } from '../../utils/configTypes'
import { CodeBlockProps } from '../Flick/editor/utils/utils'
import { Timer } from '../Studio/components'
import { StudioState } from '../Studio/stores'

const RecordingControlsBar = ({
  fragment,
  state,
  payload,
  timeLimit,
  stageRef,
  stageHeight,
  stageWidth,
  resetTimer,
  shortsMode,
  controlsConfig,
  timeOver,
  openTimerModal,
  stopRecording,
  setState,
  updatePayload,
}: {
  state: StudioState
  fragment: StudioFragmentFragment
  payload: any
  timeLimit?: number
  stageHeight: number
  stageWidth: number
  shortsMode: boolean
  resetTimer: boolean
  stageRef: React.RefObject<Konva.Stage>
  controlsConfig: any
  timeOver: () => void
  openTimerModal: () => void
  stopRecording: () => void
  setState: (state: StudioState) => void
  updatePayload: (value: any) => void
}) => {
  const {
    handleStart: handleTimerStart,
    handleReset: handleTimerReset,
    timer,
  } = useTimekeeper2(0)

  const latestPayload = useRef<any>()

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
    if (!timer || !timeLimit) return
    if (timer >= timeLimit * 60) {
      timeOver()
    }
  }, [timer])

  useEffect(() => {
    if (resetTimer) {
      handleTimerReset()
    }
  }, [resetTimer])

  const { isIntro, isOutro } = useMemo(() => {
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
            stopRecording()
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
            setState('countDown')
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
      </div>
    </div>
  )
}

export default RecordingControlsBar
