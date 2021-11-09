import React from 'react'
import { FiPause, FiPlay } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import FocusCodeIcon from '../../../components/FocusCodeIcon'
import SwapIcon from '../../../components/SwapIcon'
import { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'
import { ControlButton } from './MissionControl'
import { FragmentState, Position } from './RenderTokens'

export const CodeJamControls = ({
  position,
  computedTokens,
  fragmentState,
  isBlockRender,
  noOfBlocks,
  isShorts,
  setIsShorts,
}: {
  position: Position
  computedTokens: ComputedToken[]
  fragmentState?: FragmentState
  isBlockRender?: boolean
  noOfBlocks?: number
  isShorts?: boolean
  setIsShorts?: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording')
    if (isBlockRender && noOfBlocks) {
      return (
        <>
          <ControlButton
            key="swap"
            icon={SwapIcon}
            className="my-2"
            appearance="primary"
            onClick={() => {
              if (fragmentState === 'onlyUserMedia') {
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
          />
          <ControlButton
            key="nextBlock"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
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
            key="swap"
            icon={SwapIcon}
            className="my-2"
            appearance="primary"
            onClick={() => {
              if (fragmentState === 'onlyUserMedia') {
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
          />
          <ControlButton
            key="nextToken"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
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
            className="my-2"
            key="nextLine"
            icon={NextLineIcon}
            appearance="primary"
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
            icon={FocusCodeIcon}
            appearance="primary"
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
  if (state === 'ready')
    return (
      <>
        {/* // <ControlButton
      //   className="my-2"
      //   key="focus"
      //   icon={isShorts ? LandscapeRectangle : PortraitRectangle}
      //   appearance="primary"
      //   onClick={() => {
      //     if (!setIsShorts) return
      //     if (isShorts) setIsShorts(false)
      //     else setIsShorts(true)
      //   }}
      // />, */}
        <ControlButton
          key="swap"
          icon={SwapIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            if (fragmentState === 'onlyUserMedia') {
              // setFragmentState('customLayout')
              // updating the fragment state in the payload to customLayout state
              updatePayload?.({
                fragmentState: 'customLayout',
              })
            } else {
              // setFragmentState('onlyUserMedia')
              // updating the fragment state in the payload to onlyUserMedia state
              updatePayload?.({
                fragmentState: 'onlyUserMedia',
              })
            }
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
          key="swap"
          icon={SwapIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            if (fragmentState === 'onlyUserMedia') {
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
        />
        <ControlButton
          key="control"
          icon={playing ? FiPause : FiPlay}
          className="my-2"
          appearance={playing ? 'danger' : 'primary'}
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
      <ControlButton
        key="swap"
        icon={SwapIcon}
        className="my-2"
        appearance="primary"
        onClick={() => {
          if (fragmentState === 'onlyUserMedia') {
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
      />
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
          key="swap"
          icon={SwapIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            if (fragmentState === 'onlyUserMedia') {
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
        />
        <ControlButton
          key="nextPoint"
          icon={NextTokenIcon}
          className="my-2"
          appearance="primary"
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
