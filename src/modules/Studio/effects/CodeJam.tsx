import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Group, Circle, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import FocusCodeIcon from '../../../components/FocusCodeIcon'
import { API } from '../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../generated/graphql'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import RenderTokens, { RenderFocus } from '../components/RenderTokens'
import useCode, { ComputedToken } from '../hooks/use-code'
import { StudioProviderProps, studioStore } from '../stores'

export const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}

const CodeJam = () => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const { initUseCode, computedTokens } = useCode()
  const [getTokenisedCode, { data }] = useGetTokenisedCodeLazyQuery()
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })
  const [focusCode, setFocusCode] = useState<boolean>(false)

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const gistURL = fragment.configuration.properties.find(
      (property: any) => property.key === 'gistUrl'
    )?.value

    // setConfig of titleSpalsh
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
      canvasWidth: 800,
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
    setFocusCode(false)
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
      })
    }
  }, [state])

  const controls =
    state === 'recording'
      ? [
          <ControlButton
            key="nextToken"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
            onClick={() => {
              setFocusCode(false)
              if (position.currentIndex < computedTokens.current.length)
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
              setFocusCode(false)
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
          <ControlButton
            className="my-2"
            key="focus"
            icon={FocusCodeIcon}
            appearance="primary"
            onClick={() => {
              setFocusCode(true)
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
    payload?.status === Fragment_Status_Enum_Enum.Live && (
      <Group x={20} y={30} key="group">
        {getRenderedTokens(computedTokens.current, position)}
        {computedTokens.current.length > 0 && (
          <RenderTokens
            key={position.prevIndex}
            tokens={computedTokens.current}
            startIndex={position.prevIndex}
            endIndex={position.currentIndex}
          />
        )}
      </Group>
    ),
    focusCode && (
      <RenderFocus
        tokens={computedTokens.current}
        lineNumber={computedTokens.current[position.prevIndex]?.lineNumber}
        currentIndex={position.currentIndex}
        groupCoordinates={{ x: 20, y: 30 }}
        bgRectInfo={{
          x: 0,
          y: 0,
          width: CONFIG.width,
          height: CONFIG.height,
          radius: 0,
        }}
      />
    ),
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

export default CodeJam
