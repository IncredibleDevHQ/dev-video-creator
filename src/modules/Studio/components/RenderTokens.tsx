import React from 'react'
import { useEffect, useState } from 'react'
import { Group } from 'react-konva'
import { codeConfig } from '../effects/CodeJam'
import TypingEffect from '../effects/TypingEffect'
import { ComputedToken } from '../hooks/use-code'

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
