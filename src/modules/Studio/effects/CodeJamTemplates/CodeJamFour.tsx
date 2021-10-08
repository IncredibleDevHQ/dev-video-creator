import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import { API } from '../../../../constants'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../../generated/graphql'
import { Concourse } from '../../components'
import { CONFIG, StudioUserConfig } from '../../components/Concourse'
import RenderTokens, {
  controls,
  getRenderedTokens,
  RenderFocus,
} from '../../components/RenderTokens'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'

export const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}

const CodeJamFour = () => {
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

  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  const [windowOps] = useImage(
    `${config.storage.baseUrl}window-ops.svg`,
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
            x: 755,
            y: 80,
            width: 200,
            height: 150,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 160,
              height: 150,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 70,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 755,
            y: 305,
            width: 200,
            height: 150,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 160,
              height: 150,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 295,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 48.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 188.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 328.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
      default:
        return [
          {
            x: 695,
            y: 140.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 130.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
    }
  })()

  const windowOpsImages = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return (
          <>
            <Image image={windowOps} x={860} y={35} />
            <Image image={windowOps} x={860} y={260} />
          </>
        )
      case 3:
        return <></>
      default:
        return <Image image={windowOps} x={860} y={95} />
    }
  })()

  const layerChildren = [
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fillLinearGradientColorStops={[
        0,
        '#140D1F',
        0.41,
        '#361367',
        1,
        '#6E1DDB',
      ]}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{
        x: CONFIG.width,
        y: CONFIG.height,
      }}
    />,
    <Image image={astroPlanet} x={-10} y={0} />,
    <Rect
      x={27}
      y={48}
      width={704}
      height={396}
      fill="#FF5D01"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
    />,
    <Rect
      x={37}
      y={58}
      width={704}
      height={396}
      fill="#202026"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
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
    focusCode && (
      <RenderFocus
        tokens={computedTokens.current}
        lineNumber={computedTokens.current[position.prevIndex]?.lineNumber}
        currentIndex={position.currentIndex}
        groupCoordinates={{ x: 47, y: 88 }}
        bgRectInfo={{
          x: 37,
          y: 58,
          width: 704,
          height: 396,
          radius: 8,
        }}
      />
    ),
    { ...windowOpsImages },
    <Image image={astroLogo} x={30} y={CONFIG.height - 60} />,
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

export default CodeJamFour
