import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Text, Rect } from 'react-konva'
import { codeConfig } from '../effects/CodeJam'
import TypingEffect from '../effects/TypingEffect'
import { ComputedToken } from '../hooks/use-code'
import { CONFIG } from './Concourse'

export interface TokenRenderState {
  tokens: ComputedToken[]
  index: number
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
  bgColor,
  codeCanvasWidth,
  groupCoordinates,
  currentIndex,
}: {
  tokens: ComputedToken[]
  lineNumber: number
  bgColor: string
  codeCanvasWidth: number
  groupCoordinates: { x: number; y: number }
  currentIndex: number
}) => {
  return (
    <>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#000000"
        opacity={0.8}
      />
      <Group
        // offsetX={groupCoordinates.x}
        // offsetY={groupCoordinates.y}
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
          .filter((_, i) => i <= currentIndex)
          .filter((token) => {
            if (lineNumber === 0) return token.lineNumber === lineNumber
            return token.lineNumber === lineNumber - 1
          })
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
                  align="left"
                  width={codeCanvasWidth / 2}
                />
              </>
            )
          })}
      </Group>
    </>
  )
}
