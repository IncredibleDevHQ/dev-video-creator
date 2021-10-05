import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Text, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import FocusCodeIcon from '../../../components/FocusCodeIcon'
import { codeConfig } from '../effects/CodeJam'
import TypingEffect from '../effects/TypingEffect'
import { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'
import { ControlButton } from './MissionControl'

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

export const controls = (
  setFocusCode: React.Dispatch<React.SetStateAction<boolean>>,
  position: Position,
  computedTokens: ComputedToken[]
) => {
  const { payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  return state === 'recording'
    ? [
        <ControlButton
          key="nextToken"
          icon={NextTokenIcon}
          className="my-2"
          appearance="primary"
          onClick={() => {
            setFocusCode(false)
            if (position.currentIndex < computedTokens.length)
              updatePayload?.({
                currentIndex: position.currentIndex + 1,
                prevIndex: position.currentIndex,
                isFocus: payload?.isFocus,
              })
          }}
        />,
        <ControlButton
          className="my-2"
          key="nextLine"
          icon={NextLineIcon}
          appearance="primary"
          onClick={() => {
            setFocusCode(false)
            const current = computedTokens[position.currentIndex]
            let next = computedTokens.findIndex(
              (t) => t.lineNumber > current.lineNumber
            )
            if (next === -1) next = computedTokens.length
            updatePayload?.({
              prevIndex: position.currentIndex,
              currentIndex: next,
              isFocus: payload?.isFocus,
            })
          }}
        />,
        <ControlButton
          className="my-2"
          key="focus"
          icon={FocusCodeIcon}
          appearance="primary"
          onClick={() => {
            setFocusCode(true)
            updatePayload?.({
              prevIndex: payload?.prevIndex,
              currentIndex: payload?.currentIndex,
              isFocus: true,
            })
          }}
        />,
      ]
    : [<></>]
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
