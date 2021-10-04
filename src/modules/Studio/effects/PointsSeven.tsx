import React, { useEffect, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import usePoint from '../hooks/use-point'
import config from '../../../config'

const PointsSeven = () => {
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const {
    fragment,
    state,
    stream,
    picture,
    constraints,
    updatePayload,
    payload,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [, setGroupCoordinate] = useState<number>(0)

  const { initUsePoint, computedPoints, getNoOfLinesOfText } = usePoint()

  const [yCoordinate, setYCoordinate] = useState<number>(0)

  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const initialX = 32

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible-black.svg`,
    'anonymous'
  )
  const [nextJSLogo] = useImage(
    `${config.storage.baseUrl}nextJSLogo.svg`,
    'anonymous'
  )
  const [nextJSBg] = useImage(
    `${config.storage.baseUrl}nextJS_bg.svg`,
    'anonymous'
  )

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
    setPoints(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'text[]'
      )?.value
    )
    if (!fragment.name) return
    setTitleNumberOfLines(
      getNoOfLinesOfText({
        text: fragment.name,
        availableWidth: 500,
        fontSize: 40,
        fontFamily: 'Poppins',
        stageWidth: 640,
      })
    )
  }, [fragment?.configuration.properties])

  useEffect(() => {
    const startingCoordinate = initUsePoint({
      points,
      availableWidth: 392,
      availableHeight: 220,
      gutter: 12,
      fontSize: 16,
    })
    setGroupCoordinate(
      startingCoordinate > initialX ? startingCoordinate : initialX
    )
  }, [points])

  useEffect(() => {
    return () => {
      setPoints([])
      setGroupCoordinate(0)
    }
  }, [])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        activePoint: 0,
        activeYCoordinate: 0,
      })
    }
    if (state === 'recording') {
      setActivePointIndex(0)
    }
  }, [state])

  useEffect(() => {
    setActivePointIndex(payload?.activePoint)
    setYCoordinate(payload?.activeYCoordinate)
  }, [payload])

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 705,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 0,
            },
          },
          {
            x: 705,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 0,
            },
          },
        ]

      default:
        return [
          {
            x: 565,
            y: 58,
            width: 520,
            height: 390,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 150,
              y: 0,
              width: 220,
              height: 390,
              radius: 0,
            },
          },
        ]
    }
  })()

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activePointIndex === points?.length}
      onClick={() => {
        setActivePointIndex(activePointIndex + 1)
        setYCoordinate(yCoordinate + 30)
        updatePayload?.({
          activePoint: activePointIndex + 1,
          activeYCoordinate: yCoordinate + 30,
        })
      }}
    />,
  ]

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
      width={640}
      height={390}
      fill="white"
      stroke="#111111"
      strokeWidth={2}
    />,
    <Text
      key="fragmentTitle"
      x={67}
      y={90}
      align="left"
      fontSize={40}
      fill="##111111"
      width={520}
      lineHeight={1.15}
      text={fragment?.name as string}
      fontStyle="normal 700"
      fontFamily="Poppins"
    />,
    <Group x={87} y={110 + 50 * titleNumberOfLines} key="group4">
      {computedPoints.current
        .filter((_, i) => i < activePointIndex)
        .map((point, j) => (
          <>
            <Rect
              key="points"
              x={-76}
              y={point.y}
              stroke="#111111"
              width={14}
              height={14}
              strokeWidth={2}
              ref={(ref) =>
                ref?.to({
                  x: 0,
                  duration: 0.3,
                })
              }
            />
            <Text
              key={point.text}
              x={-64}
              y={point.y}
              align="left"
              fontSize={16}
              fill="#111111"
              width={460}
              height={64}
              text={point.text}
              lineHeight={1.1}
              fontStyle="normal"
              fontFamily="Poppins"
              ref={(ref) =>
                ref?.to({
                  x: 30,
                  duration: 0.3,
                })
              }
            />
          </>
        ))}
    </Group>,
    <Image image={incredibleLogo} x={30} y={CONFIG.height - 75} />,
    <Image image={nextJSLogo} x={840} y={CONFIG.height - 68} />,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
    />
  )
}

export default PointsSeven
