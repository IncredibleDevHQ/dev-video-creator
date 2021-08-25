import React, { useEffect, useState } from 'react'
import { Text } from 'react-konva'
import { ComputedToken } from '../hooks/use-code'

const codeConfig = {
  fontSize: 20,
  fontFamily: "'Fira Mono'",
  width: 912,
  height: 513,
}

const TypingEffect = ({ token }: { token: ComputedToken }) => {
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
      key="token"
      fontSize={codeConfig.fontSize}
      fill={token.color}
      text={text}
      x={token.x}
      y={token.y}
      align="left"
    />
  )
}

export default TypingEffect
