import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Group, Circle, Text, Rect, Image } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { API } from '../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../generated/graphql'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import RenderTokens, {
  controls,
  getRenderedTokens,
  RenderFocus,
} from '../components/RenderTokens'
import useCode from '../hooks/use-code'
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

const CodeJamFive = () => {
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
  const [focusCode, setFocusCode] = useState<boolean>(false)

  const [wtfjsLogo] = useImage(
    `${config.storage.baseUrl}WTFJS.svg`,
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
      canvasWidth: 585,
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
    setFocusCode(payload?.isFocus)
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
        isFocus: false,
      })
    }
  }, [state])

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 728.5,
            y: 0,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
            studioUserClipConfig: {
              x: 7.5,
              y: 0,
              width: 225,
              height: 180,
              radius: 0,
            },
          },
          {
            x: 728.5,
            y: 205,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
            studioUserClipConfig: {
              x: 7.5,
              y: 0,
              width: 225,
              height: 180,
              radius: 0,
            },
          },
        ]
      case 3:
        return [
          {
            x: 752,
            y: 0,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
          {
            x: 752,
            y: 140,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
          {
            x: 752,
            y: 280,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
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
            x: 586,
            y: 0,
            width: 528,
            height: 396,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#ffffff',
            studioUserClipConfig: {
              x: 154,
              y: 0,
              width: 220,
              height: 396,
              radius: 0,
            },
          },
        ]
    }
  })()

  const layerChildren = [
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#1F2937"
    />,
    <Rect
      x={0}
      y={0}
      width={704}
      height={396}
      fill="#202026"
      stroke="#ffffff"
      strokeWidth={3}
    />,
    <Group x={15} y={15} key="circleGroup">
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
          width: 704,
          height: 396,
          radius: 0,
        }}
      />
    ),
    <Image image={wtfjsLogo} x={60} y={CONFIG.height - 80} />,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(setFocusCode, position, computedTokens.current)}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
    />
  )
}

export default CodeJamFive
