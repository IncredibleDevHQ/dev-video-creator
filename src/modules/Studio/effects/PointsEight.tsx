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

const PointsEight = () => {
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const { fragment, state, updatePayload, payload } =
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

  const [elasticLogo] = useImage(
    `${config.storage.baseUrl}elastic-logo.png`,
    'anonymous'
  )
  const [whiteCircle] = useImage(
    `${config.storage.baseUrl}circle.png`,
    'anonymous'
  )
  const [pinkCircle] = useImage(
    `${config.storage.baseUrl}pink2.png`,
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
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
            },
          },
          {
            x: 705,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
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
            borderWidth: 8,
            borderColor: '#D1D5DB',
            studioUserClipConfig: {
              x: 150,
              y: 0,
              width: 220,
              height: 390,
              radius: 8,
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
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#ffffff"
      // fillLinearGradientColorStops={[0, '#60D0ED', 1, '#536FA8']}
      // fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      // fillLinearGradientEndPoint={{ x: CONFIG.width, y: CONFIG.height }}
    />,
    <Circle x={82} y={10} radius={55} fill="#7DE2D1" />,
    <Circle x={70} y={CONFIG.height - 70} radius={100} fill="#7DE2D1" />,
    <Circle x={640} y={20} radius={10} fill="#0077CC" />,
    <Circle x={270} y={CONFIG.height - 70} radius={10} fill="#0077CC" />,
    <Image image={pinkCircle} x={790} y={400} />,
    <Image image={whiteCircle} x={615} y={245} />,
    <Rect
      x={37}
      y={58}
      width={640}
      height={390}
      fill="white"
      stroke="#D1D5DB"
      cornerRadius={8}
      strokeWidth={4}
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
            <Circle
              key="points"
              x={-76}
              radius={7}
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
    <Image image={elasticLogo} x={30} y={CONFIG.height - 60} />,
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

export default PointsEight
