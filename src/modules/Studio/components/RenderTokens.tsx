import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import FocusCodeIcon from '../../../components/FocusCodeIcon'
import SwapIcon from '../../../components/SwapIcon'
import { codeConfig } from '../effects/CodeJamTemplates/CodeJam'
import TypingEffect from '../effects/TypingEffect'
import { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'
import { ControlButton } from './MissionControl'

export type FragmentState = 'onlyUserMedia' | 'onlyFragment' | 'both'
export interface TokenRenderState {
  tokens: ComputedToken[]
  index: number
}

export interface Position {
  prevIndex: number
  currentIndex: number
}

const RenderTokens = ({
  tokens,
  startIndex,
  endIndex,
}: {
  tokens: ComputedToken[]
  startIndex: number
  endIndex: number
}) => {
  const tokenSegment = tokens.slice(startIndex, endIndex)

  const [renderState, setRenderState] = useState<TokenRenderState>({
    index: startIndex,
    tokens: [tokens[startIndex]],
  })

  useEffect(() => {
    if (renderState.index === endIndex - 1) return
    const newToken = tokenSegment[renderState.index - startIndex + 1]
    const prevToken = tokenSegment[renderState.index - startIndex]
    setTimeout(() => {
      setRenderState((prev) => ({
        index: prev.index + 1,
        tokens: [...prev.tokens, newToken],
      }))
    }, prevToken.content.length * 100)
  }, [renderState])

  return (
    <Group>
      {renderState.tokens.length > 0 &&
        renderState.tokens.map((token, index) => {
          // eslint-disable-next-line
          return <TypingEffect config={codeConfig} key={index} token={token} />
        })}
    </Group>
  )
}

export default RenderTokens

export const RenderFocus = ({
  tokens,
  lineNumber,
  groupCoordinates,
  currentIndex,
  bgRectInfo,
}: {
  tokens: ComputedToken[]
  lineNumber: number
  groupCoordinates: { x: number; y: number }
  currentIndex: number
  bgRectInfo: {
    x: number
    y: number
    width: number
    height: number
    radius: number
  }
}) => {
  return (
    <>
      <Rect
        x={bgRectInfo.x}
        y={bgRectInfo.y}
        width={bgRectInfo.width}
        height={bgRectInfo.height}
        fill="#000000"
        opacity={0.8}
        cornerRadius={bgRectInfo.radius}
      />
      <Group
        ref={(ref) => {
          ref?.to({
            scaleX: 1.2,
            scaleY: 1.2,
            easing: Konva.Easings.EaseInOut,
            duration: 0.25,
          })
        }}
      >
        {tokens
          .filter((_, i) => i < currentIndex)
          .filter((token) => token.lineNumber === lineNumber)
          .map((token, index) => {
            return (
              <>
                <Text
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  fontSize={codeConfig.fontSize}
                  fill={token.color}
                  text={token.content}
                  x={token.x + groupCoordinates.x}
                  y={token.y + groupCoordinates.y}
                  offsetY={(token.y + groupCoordinates.y) / 6}
                  align="left"
                />
              </>
            )
          })}
      </Group>
    </>
  )
}

export const RenderMultipleLineFocus = ({
  tokens,
  startLineNumber,
  endLineNumber,
  explanation,
  groupCoordinates,
  bgRectInfo,
  opacity,
  isShort,
}: {
  tokens: ComputedToken[]
  startLineNumber: number
  endLineNumber: number
  explanation: string
  groupCoordinates: { x: number; y: number }
  bgRectInfo: {
    x: number
    y: number
    width: number
    height: number
    radius: number
  }
  opacity: number
  isShort?: boolean
}) => {
  let computedLineNumber = 0
  let lineNumber = startLineNumber
  return (
    <>
      <Rect
        x={bgRectInfo.x}
        y={bgRectInfo.y}
        width={bgRectInfo.width}
        height={bgRectInfo.height}
        fill="#000000"
        opacity={0}
        cornerRadius={bgRectInfo.radius}
        ref={(ref) => {
          ref?.to({
            opacity: opacity || 0.8,
            duration: 0.25,
          })
        }}
      />
      <Group
        ref={(ref) => {
          ref?.to({
            scaleX: 1.2,
            scaleY: 1.2,
            easing: Konva.Easings.EaseInOut,
            duration: 0.25,
          })
        }}
      >
        {tokens
          .filter(
            (token) =>
              token.lineNumber >= startLineNumber &&
              token.lineNumber <= endLineNumber
          )
          .map((token, index) => {
            if (lineNumber !== token.lineNumber) {
              computedLineNumber += token.lineNumber - lineNumber
              lineNumber = token.lineNumber
            } else if (token.x === 0 && index !== 0) {
              computedLineNumber += 1
            }
            return (
              <>
                <Text
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  fontSize={codeConfig.fontSize}
                  fill={token.color}
                  text={token.content}
                  x={token.x + groupCoordinates.x}
                  y={
                    (codeConfig.fontSize + 5) * computedLineNumber +
                    groupCoordinates.y
                  }
                  // offsetY={
                  //   ((codeConfig.fontSize + 5) * computedLineNumber +
                  //     groupCoordinates.y) /
                  //   6
                  // }
                  align="left"
                />
              </>
            )
          })}
      </Group>
      {isShort ? (
        <Group
          x={38}
          y={460}
          width={330}
          height={120}
          ref={(ref) => {
            if (explanation !== '')
              ref?.to({
                opacity: 1,
                duration: 0.25,
              })
          }}
          opacity={0}
        >
          <Rect
            x={0}
            y={0}
            width={330}
            height={120}
            fill="#ffffff"
            cornerRadius={8}
            opacity={0.2}
          />
          <Text
            x={12}
            y={12}
            key="codeExplanation"
            fontSize={16}
            fill="#F3F4F6"
            text={explanation}
            width={306}
            height={96}
            align="center"
            lineHeight={1.2}
            verticalAlign="middle"
          />
        </Group>
      ) : (
        <Group
          x={130}
          y={300}
          width={700}
          height={150}
          ref={(ref) => {
            if (explanation !== '')
              ref?.to({
                opacity: 1,
                duration: 0.25,
              })
          }}
          opacity={0}
        >
          <Rect
            x={0}
            y={0}
            width={700}
            height={150}
            fill="#ffffff"
            cornerRadius={8}
            opacity={0.2}
          />
          <Text
            x={16}
            y={16}
            key="codeExplanation"
            fontSize={20}
            fill="#F3F4F6"
            text={explanation}
            lineHeight={1.2}
            width={668}
            height={118}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </>
  )
}

export const controls = (
  setFocusCode: React.Dispatch<React.SetStateAction<boolean>>,
  position: Position,
  computedTokens: ComputedToken[],
  fragmentState?: FragmentState,
  setFragmentState?: React.Dispatch<React.SetStateAction<FragmentState>>,
  isBlockRender?: boolean,
  noOfBlocks?: number
) => {
  const { payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording')
    if (isBlockRender && noOfBlocks)
      return [
        <ControlButton
          key="swap"
          icon={SwapIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            if (!setFragmentState) return
            if (fragmentState === 'onlyUserMedia') {
              // setFragmentState('onlyFragment')
              // updating the fragment state in the payload to onlyFragment state
              updatePayload?.({
                prevIndex: payload?.prevIndex,
                currentIndex: payload?.currentIndex,
                isFocus: payload?.isFocus,
                fragmentState: 'onlyFragment',
              })
            } else {
              // setFragmentState('onlyUserMedia')
              // updating the fragment state in the payload to onlyUserMedia state
              updatePayload?.({
                prevIndex: payload?.prevIndex,
                currentIndex: payload?.currentIndex,
                isFocus: payload?.isFocus,
                fragmentState: 'onlyUserMedia',
              })
            }
          }}
        />,
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
        />,
      ]
    else
      return [
        <ControlButton
          key="swap"
          icon={SwapIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            if (!setFragmentState) return
            if (fragmentState === 'onlyUserMedia') {
              // setFragmentState('onlyFragment')
              // updating the fragment state in the payload to onlyFragment state
              updatePayload?.({
                prevIndex: payload?.prevIndex,
                currentIndex: payload?.currentIndex,
                isFocus: payload?.isFocus,
                fragmentState: 'onlyFragment',
              })
            } else {
              // setFragmentState('onlyUserMedia')
              // updating the fragment state in the payload to onlyUserMedia state
              updatePayload?.({
                prevIndex: payload?.prevIndex,
                currentIndex: payload?.currentIndex,
                isFocus: payload?.isFocus,
                fragmentState: 'onlyUserMedia',
              })
            }
          }}
        />,
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
        />,
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
        />,
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
        />,
      ]
  if (state === 'ready')
    return [
      <ControlButton
        key="swap"
        icon={SwapIcon}
        className="my-2"
        appearance="primary"
        onClick={() => {
          if (!setFragmentState) return
          if (fragmentState === 'onlyUserMedia') {
            // setFragmentState('onlyFragment')
            // updating the fragment state in the payload to onlyFragment state
            updatePayload?.({
              prevIndex: payload?.prevIndex,
              currentIndex: payload?.currentIndex,
              isFocus: payload?.isFocus,
              fragmentState: 'onlyFragment',
            })
          } else {
            // setFragmentState('onlyUserMedia')
            // updating the fragment state in the payload to onlyUserMedia state
            updatePayload?.({
              prevIndex: payload?.prevIndex,
              currentIndex: payload?.currentIndex,
              isFocus: payload?.isFocus,
              fragmentState: 'onlyUserMedia',
            })
          }
        }}
      />,
    ]
  return [<></>]
}

export const getRenderedTokens = (
  tokens: ComputedToken[],
  position: Position
) => {
  const startFromIndex = Math.max(
    ...tokens
      .filter((_, i) => i <= position.prevIndex)
      .map((token) => token.startFromIndex)
  )

  return tokens
    .filter((_, i) => i < position.prevIndex && i >= startFromIndex)
    .map((token, index) => {
      return (
        <Text
          // eslint-disable-next-line
          key={index}
          fontSize={codeConfig.fontSize}
          fill={token.color}
          text={token.content}
          x={token.x}
          y={token.y}
          align="left"
        />
      )
    })
}

export const getTokens = (
  tokens: ComputedToken[],
  startLineNumber: number | undefined,
  isShorts?: boolean
) => {
  let computedLineNumber = 0
  let lineNumber = startLineNumber || 0
  let noOfLines = 0

  if (isShorts) noOfLines = 29
  else noOfLines = 20

  return tokens
    .filter(
      (token, i) =>
        token.lineNumber >= (startLineNumber || 0) &&
        token.lineNumber < (startLineNumber || 0) + noOfLines
    )
    .map((token, index) => {
      if (lineNumber !== token.lineNumber) {
        computedLineNumber += token.lineNumber - lineNumber
        lineNumber = token.lineNumber
      } else if (token.x === 0 && index !== 0) {
        computedLineNumber += 1
      }
      if (computedLineNumber < noOfLines)
        return (
          <Text
            // eslint-disable-next-line
            key={index}
            fontSize={codeConfig.fontSize}
            fill={token.color}
            text={token.content}
            x={token.x}
            y={(codeConfig.fontSize + 5) * computedLineNumber}
            align="left"
          />
        )
      return <></>
    })
}
