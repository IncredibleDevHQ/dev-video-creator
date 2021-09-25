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

const PointsTwo = () => {
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

  const [openSaucedLogo] = useImage(
    `${config.storage.baseUrl}open-sauce-logo.svg`,
    'anonymous'
  )

  const [openSaucedBg] = useImage(
    `${config.storage.baseUrl}opensauce-bg.svg`,
    'anonymous'
  )

  const [bulletPizza] = useImage(
    `${config.storage.baseUrl}pizza-bullet.svg`,
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
        availableWidth: 520,
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
      gutter: 14,
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
      x: 565,
      y: 58,
      width: 520,
      height: 390,
      clipTheme: 'rect',
      borderWidth: 8,
      studioUserClipConfig: {
        x: 150,
        y: 0,
        width: 220,
        height: 390,
        radius: 8,
      },
      backgroundRectX: 705,
      backgroundRectY: 48,
      backgroundRectColor: '#E0A764',
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
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#ffffff"
    />,
    <Image
      image={openSaucedBg}
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
    />,
    <Rect
      x={27}
      y={48}
      width={640}
      height={390}
      fill="#E0A764"
      cornerRadius={8}
    />,
    <Rect
      x={37}
      y={58}
      width={640}
      height={390}
      fill="#FAEACE"
      cornerRadius={8}
    />,
    <Text
      key="fragmentTitle"
      x={67}
      y={90}
      align="left"
      fontSize={40}
      fill="#D95C41"
      width={500}
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
            <Image
              key={`points${point.text}`}
              x={-76}
              y={point.y - 4}
              image={bulletPizza}
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
              fill="#000000"
              width={460}
              height={64}
              text={point.text}
              lineHeight={1.1}
              fontStyle="normal 400"
              fontFamily="Poppins"
              ref={(ref) =>
                ref?.to({
                  x: 42,
                  duration: 0.3,
                })
              }
            />
          </>
        ))}
    </Group>,
    <Image image={openSaucedLogo} x={30} y={CONFIG.height - 60} />,
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

export default PointsTwo
