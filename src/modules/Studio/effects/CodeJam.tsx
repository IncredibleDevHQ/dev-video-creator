import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Group, Circle, Text, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import { API } from '../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../generated/graphql'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import useCode, { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'
import { titleSplash } from './effects'
import TypingEffect from './TypingEffect'

const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}
interface TokenRenderState {
  tokens: ComputedToken[]
  index: number
}

const CodeJam = () => {
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(true)
  const { fragment, payload, updatePayload, state, isHost } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const { initUseCode, computedTokens } = useCode()
  const [getTokenisedCode, { data, error, loading }] =
    useGetTokenisedCodeLazyQuery()
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  useEffect(() => {
    console.log('TypingEffect', TypingEffect)
  }, [TypingEffect])

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const gistURL = fragment.configuration.properties.find(
      (property: any) => property.key === 'gistUrl'
    )?.value

    //setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })

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
      tokens: data.TokenisedCode.data,
      canvasWidth: 900,
      canvasHeight: 460,
      gutter: 5,
      fontSize: codeConfig.fontSize,
    })
  }, [data])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex || 0,
      currentIndex: payload?.currentIndex || 1,
    })
  }, [payload])

  console.log('isHost', isHost, state)
  const controls =
    isHost && state === 'recording'
      ? [
          <ControlButton
            key="nextToken"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
            onClick={() => {
              updatePayload?.({
                currentIndex: position.currentIndex + 1,
                prevIndex: position.currentIndex,
              })
            }}
          />,
          <ControlButton
            className="my-2"
            key="nextLine"
            icon={NextLineIcon}
            appearance="primary"
            onClick={() => {
              const current = computedTokens.current[position.currentIndex]
              let next = computedTokens.current.findIndex(
                (t) => t.lineNumber > current.lineNumber
              )
              if (next === -1) next = computedTokens.current.length
              updatePayload?.({
                prevIndex: position.currentIndex,
                currentIndex: next,
              })
            }}
          />,
        ]
      : [<></>]

  const layerChildren = [
    <Group y={15} x={15} key="circleGroup">
      <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
      <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
      <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
    </Group>,
    <Group y={30} x={20} key="group">
      {getRenderedTokens(computedTokens.current, position)}
      {computedTokens.current.length > 0 && (
        <RenderTokens
          key={position.prevIndex}
          tokens={computedTokens.current}
          startIndex={position.prevIndex}
          endIndex={position.currentIndex}
        />
      )}
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls}
      titleSpalshData={titleSpalshData}
    />
  )

}

const getRenderedTokens = (tokens: ComputedToken[], position: Position) => {
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

export default CodeJam

/**
 * TODO:
 * 1. Remove Hardcoded program text - (It should come from Inventory)
 */
