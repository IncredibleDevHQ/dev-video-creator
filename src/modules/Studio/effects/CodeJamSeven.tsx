import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Group, Circle, Text, Rect, Image } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { NextLineIcon, NextTokenIcon } from '../../../components'
import config from '../../../config'
import { API } from '../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../generated/graphql'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import RenderTokens from '../components/RenderTokens'
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

const CodeJamSeven = () => {
  const { fragment, payload, updatePayload, state, isHost } =
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

  const [nextJSLogo] = useImage(
    `${config.storage.baseUrl}nextJSLogo.svg`,
    'anonymous'
  )
  const [nextJSBg] = useImage(
    `${config.storage.baseUrl}nextJS_bg.svg`,
    'anonymous'
  )

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
      canvasWidth: 700,
      canvasHeight: 360,
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
    isHost && state === 'recording'
      ? [
          <ControlButton
            key="nextToken"
            icon={NextTokenIcon}
            className="my-2"
            appearance="primary"
            onClick={() => {
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

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 735,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 0,
            },
          },
          {
            x: 735,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 0,
            },
          },
        ]
      case 3:
        return [
          {
            x: 775,
            y: 58.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
        ]
      default:
        return [
          {
            x: 695,
            y: 120.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 0,
            },
          },
        ]
    }
  })()

  const layerChildren = [
    <Rect
      strokeWidth={1}
      x={0}
      y={0}
      fill="#F5F6F7"
      width={CONFIG.width}
      height={CONFIG.height}
      stroke="#111111"
    />,
    <Image
      image={nextJSBg}
      x={1}
      y={1}
      fill="#F5F6F7"
      width={CONFIG.width - 2}
      height={CONFIG.height - 2}
    />,
    <Rect
      x={37}
      y={58}
      width={704}
      height={396}
      fill="#202026"
      strokeWidth={2}
      stroke="#111111"
      cornerRadius={8}
    />,
    <Group x={52} y={73} key="circleGroup">
      <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
      <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
      <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
    </Group>,
    payload?.status === Fragment_Status_Enum_Enum.Live && (
      <Group x={57} y={88} key="group">
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
    <Image image={nextJSLogo} x={30} y={CONFIG.height - 50} />,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
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

export default CodeJamSeven
