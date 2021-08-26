import React, { useEffect, useState } from 'react'
import { Text } from 'react-konva'
import { ComputedToken } from '../hooks/use-code'

const TypingEffect = ({
  token,
  config,
}: {
  token: ComputedToken
  config: any
}) => {
  const [text, setText] = useState('')
  useEffect(() => {
    const chars = [...token.content]
    chars.forEach((char, index) => {
      setTimeout(() => {
        setText((text) => text + char)
      }, 100 * index)
    })
  }, [])
  return (
    <Text
      key={`(${token.x},${token.y})`}
      fontSize={config.fontSize}
      fill={token.color}
      text={text}
      x={token.x}
      y={token.y}
      align="left"
    />
  )
}

export default TypingEffect
