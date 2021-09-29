import React, { useEffect, useState } from 'react'
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

const PointsFive = () => {
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const { fragment, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [, setGroupCoordinate] = useState<number>(0)

  const { initUsePoint, computedPoints, getNoOfLinesOfText } = usePoint()

  const [yCoordinate, setYCoordinate] = useState<number>(0)

  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const initialX = 32

  const [wtfjsLogo] = useImage(
    `${config.storage.baseUrl}WTFJS.svg`,
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
        availableWidth: 550,
        fontSize: 40,
        fontFamily: 'Poppins',
        stageWidth: 704,
      })
    )
  }, [fragment?.configuration.properties])

  useEffect(() => {
    const startingCoordinate = initUsePoint({
      points,
      availableWidth: 550,
      availableHeight: 220,
      gutter: 20,
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
            borderWidth: 6,
            borderColor: '#ffffff',
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
            borderWidth: 6,
            borderColor: '#ffffff',
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
      fill="#1F2937"
    />,
    <Rect x={0} y={0} width={704} height={396} fill="#ffffff" />,
    <Text
      key="fragmentTitle"
      x={30}
      y={32}
      align="left"
      fontSize={40}
      fill="#1F2937"
      width={630}
      lineHeight={1.15}
      text={fragment?.name as string}
      fontStyle="normal 700"
      fontFamily="Poppins"
    />,
    <Group x={50} y={60 + 50 * titleNumberOfLines} key="group4">
      {computedPoints.current
        .filter((_, i) => i < activePointIndex)
        .map((point, j) => (
          <>
            <Circle
              key="points"
              x={-76}
              radius={9}
              y={point.y + 8}
              stroke="#1F2937"
              strokeWidth={3}
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
              fill="#1F2937"
              width={550}
              height={64}
              text={point.text}
              lineHeight={1.1}
              fontStyle="normal 600"
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
    <Image image={wtfjsLogo} x={60} y={CONFIG.height - 80} />,
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

export default PointsFive
