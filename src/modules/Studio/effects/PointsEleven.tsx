import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect, Circle } from 'react-konva'
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

const PointsEleven = () => {
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const { fragment, state, stream, picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [groupCoordinate, setGroupCoordinate] = useState<number>(0)

  const { initUsePoint, computedPoints, getNoOfLinesOfText } = usePoint()

  const [yCoordinate, setYCoordinate] = useState<number>(0)

  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const initialX = 32

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [pytorchLogo] = useImage(
    `${config.storage.baseUrl}pytorch.svg`,
    'anonymous'
  )
  const [pytorchBg] = useImage(
    `${config.storage.baseUrl}pytorch_bg.svg`,
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
    if (state === 'recording') {
      setActivePointIndex(0)
    }
  }, [state])

  const studioUserConfig: StudioUserConfig[] = [
    {
      x: 660,
      y: 140.5,
      width: 320,
      height: 240,
      clipTheme: 'rect',
      borderWidth: 16,
      borderColor: '#8B008B',
      studioUserClipConfig: {
        x: 60,
        y: 0,
        width: 200,
        height: 200,
        radius: 100,
      },
    },
  ]

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activePointIndex === points.length}
      onClick={() => {
        setActivePointIndex(activePointIndex + 1)
        setYCoordinate(yCoordinate + 30)
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
      image={pytorchBg}
      x={1}
      y={1}
      fill="#F5F6F7"
      width={CONFIG.width - 2}
      height={CONFIG.height - 2}
    />,
    <Rect
      x={37}
      y={56}
      width={704}
      height={396}
      fill="white"
      cornerRadius={8}
    />,
    <Text
      key="fragmentTitle"
      x={67}
      y={90}
      align="left"
      fontSize={40}
      fill="#374151"
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
            <Circle
              key="points"
              x={-76}
              radius={9}
              y={point.y + 8}
              stroke="#9CA3AF"
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
              fill="#374151"
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
    <Image image={pytorchLogo} x={30} y={CONFIG.height - 70} />,
    <Image image={incredibleLogo} x={820} y={CONFIG.height - 70} />,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioUserConfig}
    />
  )
}

export default PointsEleven
