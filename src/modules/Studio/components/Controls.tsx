import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { IconType } from 'react-icons'
import { FiPause, FiPlay, FiTarget } from 'react-icons/fi'
import { IoChevronForwardOutline, IoListOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { Text } from '../../../components'
import { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'
import { FragmentState, Position } from './RenderTokens'

export const ControlButton = ({
  className,
  icon: I,
  disabled,
  text,
  ...rest
}: {
  icon: IconType
  disabled?: boolean
  text: string
} & HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        'w-1/2 p-1.5 flex items-center justify-start gap-x-2 border border-gray-300 rounded-md',
        {
          'opacity-70 cursor-not-allowed': disabled,
        },
        className
      )}
      {...rest}
    >
      <I className="text-gray-400" size={16} />
      <Text className="text-gray-600 font-semibold text-sm">{text}</Text>
    </button>
  )
}

export const CodeJamControls = ({
  position,
  computedTokens,
  fragmentState,
  isCodexFormat,
  noOfBlocks,
}: {
  position: Position
  computedTokens: ComputedToken[]
  fragmentState?: FragmentState
  isCodexFormat?: boolean
  noOfBlocks?: number
}) => {
  const { payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording')
    if (isCodexFormat && noOfBlocks) {
      return (
        <>
          <ControlButton
            key="nextBlock"
            icon={IoChevronForwardOutline}
            text="Next Block"
            className="my-2"
            disabled={
              payload?.activeBlockIndex === noOfBlocks - 1 &&
              !payload?.focusBlockCode
            }
            onClick={() => {
              if (payload?.focusBlockCode) {
                updatePayload?.({
                  focusBlockCode: false,
                })
              } else if (payload?.activeBlockIndex < noOfBlocks - 1)
                updatePayload?.({
                  activeBlockIndex: payload?.activeBlockIndex + 1,
                  focusBlockCode: true,
                })
            }}
          />
        </>
      )
    } else
      return (
        <>
          <ControlButton
            key="nextToken"
            icon={IoChevronForwardOutline}
            text="Next Token"
            className="my-1"
            disabled={payload?.prevIndex === computedTokens?.length - 1}
            onClick={() => {
              if (position.currentIndex < computedTokens.length)
                updatePayload?.({
                  currentIndex: position.currentIndex + 1,
                  prevIndex: position.currentIndex,
                  isFocus: false,
                })
            }}
          />
          <ControlButton
            className="my-1"
            key="nextLine"
            icon={IoChevronForwardOutline}
            text="Next Line"
            disabled={payload?.prevIndex === computedTokens?.length - 1}
            onClick={() => {
              const current = computedTokens[position.currentIndex]
              let next = computedTokens.findIndex(
                (t) => t.lineNumber > current.lineNumber
              )
              if (next === -1) next = computedTokens.length
              updatePayload?.({
                prevIndex: position.currentIndex,
                currentIndex: next,
                isFocus: false,
              })
            }}
          />
          <ControlButton
            className="my-2"
            key="focus"
            icon={FiTarget}
            text="Focus line"
            onClick={() => {
              updatePayload?.({
                prevIndex: payload?.prevIndex,
                currentIndex: payload?.currentIndex,
                isFocus: true,
              })
            }}
          />
        </>
      )
  return <></>
}

export const VideoJamControls = ({
  playing,
  videoElement,
  fragmentState,
}: {
  playing: boolean
  videoElement: HTMLVideoElement | undefined
  fragmentState?: FragmentState
}) => {
  const { updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording' || state === 'ready')
    return (
      <>
        <ControlButton
          key="control"
          icon={playing ? FiPause : FiPlay}
          text={playing ? 'Pause' : 'Play'}
          className="my-1"
          onClick={() => {
            const next = !playing
            updatePayload?.({
              playing: next,
              currentTime: videoElement?.currentTime,
            })
          }}
        />
      </>
    )

  return <></>
}

export const TriviaControls = ({
  fragmentState,
}: {
  fragmentState: FragmentState
}) => {
  const { state, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording' || state === 'ready')
    return (
      <> </>
      // <ControlButton
      //   key="nextQuestion"
      //   icon={NextTokenIcon}
      //   className="my-2"
      //   appearance="primary"
      //   disabled={activeQuestionIndex === questions.length - 1}
      //   onClick={() => {
      //     updatePayload?.({ activeQuestion: activeQuestionIndex + 1 })
      //   }}
      // />,
    )
  return <></>
}

export const PointsControls = ({
  fragmentState,
  noOfPoints,
}: {
  fragmentState: FragmentState
  noOfPoints: number
}) => {
  const { state, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording' || state === 'ready')
    return (
      <>
        <ControlButton
          key="nextPoint"
          icon={IoListOutline}
          className="my-1"
          text="Next Point"
          disabled={payload?.activePointIndex === noOfPoints}
          onClick={() => {
            updatePayload?.({
              activePointIndex: payload?.activePointIndex + 1 || 1,
            })
          }}
        />
      </>
    )
  return <></>
}
