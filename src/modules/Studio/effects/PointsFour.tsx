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

const PointsFour = () => {
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
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 70,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 705,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 10,
              y: 0,
              width: 220,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 275,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]

      default:
        return [
          {
            x: 565,
            y: 68,
            width: 520,
            height: 390,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 150,
              y: 0,
              width: 220,
              height: 390,
              radius: 8,
            },
            backgroundRectX: 705,
            backgroundRectY: 58,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
    }
  })()

  const windowOpsImages = <Image image={windowOps} x={860} y={25} />

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
      y={58}
      width={640}
      height={390}
      fill="#FF5D01"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
    />,
    <Rect
      x={37}
      y={68}
      width={640}
      height={390}
      fill="#ffffff"
      cornerRadius={8}
      stroke="#1F2937"
      strokeWidth={3}
    />,
    <Text
      key="fragmentTitle"
      x={67}
      y={90}
      align="left"
      fontSize={40}
      fill="#1F2937"
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
            <Circle
              key="points"
              x={-76}
              radius={11}
              y={point.y + 8}
              fillLinearGradientColorStops={[
                0,
                '#140D1F',
                0.41,
                '#361367',
                1,
                '#6E1DDB',
              ]}
              fillLinearGradientStartPoint={{ x: -11, y: -11 }}
              fillLinearGradientEndPoint={{
                x: 11,
                y: 11,
              }}
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
              width={460}
              height={64}
              text={point.text}
              lineHeight={1.1}
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
    { ...windowOpsImages },
    <Image image={astroLogo} x={30} y={CONFIG.height - 60} />,
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

export default PointsFour
