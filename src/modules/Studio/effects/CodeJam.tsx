import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import { API } from '../../../constants'
import { useGetTokenisedCodeLazyQuery } from '../../../generated/graphql'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import useCode from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'

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
  const { fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { initUseCode, computedTokens } = useCode()
  const [getTokenisedCode, { data, error, loading }] =
    useGetTokenisedCodeLazyQuery()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const gistURL = fragment.configuration.properties.find(
      (property: any) => property.key === 'gistUrl'
    ).value
    if (!gistURL) throw new Error('Missing gist URL')
    ;(async () => {
      try {
        const { data } = await axios.get(
          `${API.GITHUB.BASE_URL}gists/${(gistURL as string).split('/').pop()}`
        )
        const file = data.files[Object.keys(data.files)[0]]
        getTokenisedCode({
          variables: {
            code: file.content,
            language: (file.language as string).toLowerCase(),
          },
        })
      } catch (e) {
        console.error(e)
        throw e
      }
    })()
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!data?.TokenisedCode) return
    initUseCode({
      tokens: data.TokenisedCode.data || codeTokens,
      canvasWidth: 1200,
      gutter: 10,
      fontFamily: codeConfig.fontFamily,
      fontSize: codeConfig.fontSize,
    })
  }, [data])

  useEffect(() => {
    setIndex(payload?.index || 0)
  }, [payload?.index])

  const controls = [
    <ControlButton
      key="nextToken"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      onClick={() => {
        updatePayload?.({ index: index + 1 })
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
