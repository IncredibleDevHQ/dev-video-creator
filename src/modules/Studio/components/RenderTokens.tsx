import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import TypingEffect from '../effects/TypingEffect'
import { ComputedToken } from '../hooks/use-code'

export type FragmentState = 'onlyUserMedia' | 'customLayout' | 'onlyFragment'
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
  fontSize,
}: {
  tokens: ComputedToken[]
  startIndex: number
  endIndex: number
  fontSize: number
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
    }, prevToken?.content?.length * 100)
  }, [renderState])

  return (
    <Group>
      {renderState.tokens.length > 0 &&
        renderState.tokens.map((token, index) => {
          // eslint-disable-next-line
          return <TypingEffect fontSize={fontSize} key={index} token={token} />
        })}
    </Group>
  )
}

export default RenderTokens

export const RenderHighlight = ({
  tokens,
  startLineNumber,
  endLineNumber,
  fontSize,
}: {
  tokens: ComputedToken[]
  startLineNumber: number
  endLineNumber: number
  fontSize: number
}) => {
  return (
    <>
      <Group>
        {tokens
          .filter(
            (token) =>
              token.lineNumber >= startLineNumber &&
              token.lineNumber <= endLineNumber
          )
          .map((token, index) => {
            return (
              <>
                <Text
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  fontSize={fontSize}
                  fill={token.color}
                  text={token.content}
                  x={token.x}
                  y={token.y}
                  align="left"
                />
              </>
            )
          })}
      </Group>
    </>
  )
}

export const RenderLines = ({
  tokens,
  lineNumbers,
  fontSize,
}: {
  tokens: ComputedToken[]
  lineNumbers: number[]
  fontSize: number
}) => {
  return (
    <>
      <Group>
        {tokens
          .filter((token) => lineNumbers.includes(token.lineNumber))
          .map((token, index) => {
            return (
              <>
                <Text
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  fontSize={fontSize}
                  fill={token.color}
                  text={token.content}
                  x={token.x}
                  y={token.y}
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
  fontSize,
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
  fontSize: number
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
                  fontSize={fontSize}
                  fill={token.color}
                  text={token.content}
                  x={token.x + groupCoordinates.x}
                  y={(fontSize + 5) * computedLineNumber + groupCoordinates.y}
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
          x={bgRectInfo.x + 50}
          y={bgRectInfo.y + bgRectInfo.height - bgRectInfo.height / 3 - 30}
          width={bgRectInfo.width - 100}
          height={bgRectInfo.height / 3}
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
            width={bgRectInfo.width - 100}
            height={bgRectInfo.height / 3}
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
            width={bgRectInfo.width - 100 - 32}
            height={bgRectInfo.height / 3 - 32}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </>
  )
}

export const getRenderedTokens = (
  tokens: ComputedToken[],
  position: Position,
  fontSize: number
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
          fontSize={fontSize}
          fill={token.color}
          text={token.content}
          x={token.x}
          y={token.y}
          align="left"
        />
      )
    })
}

// calculating the y coordinate inside this function because it is used in highlight lines and preview, and preview is viewed whatever the code animation is
// and as in type lines code animation we reset the y when y crosses the height of the screen and in preview that is not the case
export const getTokens = ({
  tokens,
  opacity,
  fontSize,
  font,
}: {
  tokens: ComputedToken[]
  opacity: number
  font?: string
  fontSize: number
}) => {
  let computedLineNumber = 0
  let lineNumber = 0

  return tokens.map((token, index) => {
    if (lineNumber !== token.lineNumber) {
      computedLineNumber += token.lineNumber - lineNumber
      lineNumber = token.lineNumber
    } else if (token.x === 0 && index !== 0) {
      computedLineNumber += 1
    }
    return (
      <Text
        // eslint-disable-next-line
        key={index}
        fontSize={fontSize}
        fill={token.color}
        text={token.content}
        x={token.x}
        y={(fontSize + 8) * computedLineNumber}
        opacity={opacity}
        align="left"
        fontFamily={font}
      />
    )
  })
}

// calculating the y coordinate inside this function because it is used in highlight lines and preview, and preview is viewed whatever the code animation is
// and as in type lines code animation we reset the y when y crosses the height of the screen and in preview that is not the case
export const getAllLineNumbers = (
  tokens: ComputedToken[],
  fontSize: number
) => {
  let computedLineNumber = 0
  let lineNumber = -1

  return tokens.map((token, index) => {
    if (lineNumber !== token.lineNumber) {
      computedLineNumber += token.lineNumber - lineNumber
      lineNumber = token.lineNumber
      return (
        <Text
          // eslint-disable-next-line
          key={index}
          fontSize={fontSize}
          fill="#6B7280"
          width={30}
          text={(lineNumber + 1).toString()}
          y={(fontSize + 8) * (computedLineNumber - 1)}
          align="right"
        />
      )
    }
    // condition to handle if a single line renders in 2 lines bcoz of text wrapping
    if (token.x === 0 && index !== 0) {
      computedLineNumber += 1
    }
    return <></>
  })
}

export const getSomeLineNumbers = ({
  tokens,
  lineNumbers,
  fontSize,
}: {
  tokens: ComputedToken[]
  lineNumbers: number[]
  fontSize: number
}) => {
  let lineNumber = -1
  return (
    <>
      <Group>
        {tokens
          .filter((token) => lineNumbers.includes(token.lineNumber))
          .map((token, index) => {
            if (lineNumber !== token.lineNumber) {
              lineNumber = token.lineNumber
              return (
                <>
                  <Text
                    // eslint-disable-next-line
                    key={index}
                    fontSize={fontSize}
                    fill="#6B7280"
                    width={30}
                    text={(lineNumber + 1).toString()}
                    y={token.y}
                    align="right"
                  />
                </>
              )
            }
            return <></>
          })}
      </Group>
    </>
  )
}
