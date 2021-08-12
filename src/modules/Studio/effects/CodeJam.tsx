import React, { useEffect, useState } from 'react'
import { Group, Text } from 'react-konva'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import useCode from '../hooks/use-code'

const codeTokens = [
  { content: '# simple hello world example', color: '#608B4E', lineNumber: 0 },
  { content: 'greetings= ', color: '#D4D4D4', lineNumber: 1 },
  { content: ' "Hello World"', color: '#CE9178', lineNumber: 1 },
  { content: 'print', color: '#DCDCAA', lineNumber: 2 },
  { content: '(', color: '#D4D4D4', lineNumber: 2 },
  { content: '"Bot:"', color: '#CE9178', lineNumber: 2 },
  { content: ' greetings)', color: '#D4D4D4', lineNumber: 2 },
  { content: '# output', color: '#608B4E', lineNumber: 4 },
  { content: '# Bot:Hello World', color: '#608B4E', lineNumber: 5 },
  { content: '# Multiple print statements', color: '#608B4E', lineNumber: 7 },
  { content: 'greetings1 = ', color: '#D4D4D4', lineNumber: 8 },
  { content: ' "Hello World!"', color: '#CE9178', lineNumber: 8 },
  { content: 'greetings2 = ', color: '#D4D4D4', lineNumber: 9 },
  { content: ' "Nice to meet you."', color: '#CE9178', lineNumber: 9 },
  { content: 'print', color: '#DCDCAA', lineNumber: 10 },
  { content: '(', color: '#D4D4D4', lineNumber: 10 },
  { content: '"Bot:"', color: '#CE9178', lineNumber: 10 },
  { content: 'greetings1)', color: '#D4D4D4', lineNumber: 10 },
  { content: 'print', color: '#DCDCAA', lineNumber: 11 },
  { content: '(greetings2)', color: '#D4D4D4', lineNumber: 11 },
  { content: 'print', color: '#DCDCAA', lineNumber: 12 },
  { content: '(', color: '#D4D4D4', lineNumber: 12 },
  { content: '"Bot:"', color: '#CE9178', lineNumber: 12 },
  { content: 'greetings1, greetings2)', color: '#D4D4D4', lineNumber: 12 },
  { content: '#output', color: '#608B4E', lineNumber: 14 },
  { content: '# Bot: Hello World!', color: '#608B4E', lineNumber: 15 },
  { content: '# Nice to meet you.', color: '#608B4E', lineNumber: 16 },
  {
    content: '# Bot: Hello World! Nice to meet you.',
    color: '#608B4E',
    lineNumber: 17,
  },
]

const codeConfig = {
  fontSize: 20,
  fontFamily: "'Fira Mono'",
  width: 912,
  height: 513,
}

const CodeJam = () => {
  const { initUseCode, computedTokens } = useCode()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    initUseCode({
      tokens: codeTokens,
      canvasWidth: 1200,
      gutter: 10,
      fontFamily: codeConfig.fontFamily,
      fontSize: codeConfig.fontSize,
    })
  }, [])

  const controls = [
    <ControlButton
      key="nextToken"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      onClick={() => {
        setIndex((index) => index + 1)
      }}
    />,
    <ControlButton
      className="my-2"
      key="nextLine"
      icon={NextLineIcon}
      appearance="primary"
      onClick={() => {
        const current = computedTokens.current[index]
        const next =
          computedTokens.current.findIndex(
            (t) => t.lineNumber === current.lineNumber + 1
          ) - 1

        setIndex(next)
      }}
    />,
  ]

  const layerChildren = [
    <Group y={20} x={20} key="group">
      {computedTokens.current
        .filter((_, i) => i < index)
        .map((token) => (
          <Text
            fontSize={codeConfig.fontSize}
            fill={token.color}
            text={token.content}
            x={token.x}
            y={token.y}
            align="left"
          />
        ))}
    </Group>,
  ]

  return <Concourse layerChildren={layerChildren} controls={controls} />
  //   return { controls, layerChildren }
}

export default CodeJam

/**
 * TODO:
 * 1. Remove Hardcoded program text - (It should come from Inventory)
 */
