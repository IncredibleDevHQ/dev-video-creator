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

const PointsTen = () => {
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

  const [tsLogo] = useImage(`${config.storage.baseUrl}tslogo.svg`, 'anonymous')

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
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
      x: 695,
      y: 120.5,
      width: 320,
      height: 240,
      clipTheme: 'rect',
      borderWidth: 8,
      studioUserClipConfig: {
        x: 80,
        y: 0,
        width: 160,
        height: 240,
        radius: 8,
      },
      borderColor: '#235A97',
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
      fill="#3178C6"
    />,
    <Rect
      x={37}
      y={58}
      width={704}
      height={396}
      fill="#00273F"
      stroke="#235A97"
      strokeWidth={4}
      cornerRadius={8}
    />,
    <Text
      key="fragmentTitle"
      x={67}
      y={90}
      align="left"
      fontSize={40}
      fill="#ffffff"
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
              stroke="#ffffff"
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
              fill="#ffffff"
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
    <Image image={incredibleLogo} x={25} y={CONFIG.height - 60} />,
    <Image image={tsLogo} x={820} y={CONFIG.height - 60} />,
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

export default PointsTen
