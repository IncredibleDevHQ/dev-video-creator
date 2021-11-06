import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import {
  ConfigType,
  LayoutConfig,
  PointsConfig,
} from '../../../../utils/configTypes'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import { usePoint } from '../../hooks'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import Concourse, { CONFIG, TitleSplashProps } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'

const PointsFragment = ({
  viewConfig,
  dataConfig,
  dataConfigLength,
  topLayerChildren,
  setTopLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  layerRef,
}: {
  viewConfig: LayoutConfig
  dataConfig: PointsConfig
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, state, updatePayload, payload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<{ level?: number; text: string }[]>([])

  const { initUsePoint, computedPoints, getNoOfLinesOfText } = usePoint()

  // const [yCoordinate, setYCoordinate] = useState<number>(0)

  // ref to the object grp
  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const customLayoutRef = useRef<Konva.Group>(null)

  const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({ layoutNumber: viewConfig.layoutNumber })
    )
    setPoints(dataConfig.value)
  }, [dataConfig, viewConfig])

  useEffect(() => {
    setTitleNumberOfLines(
      getNoOfLinesOfText({
        text: dataConfig.title,
        availableWidth: objectConfig.width - 120,
        fontSize: 40,
        fontFamily: 'Poppins',
        stageWidth: objectConfig.width,
      })
    )
    initUsePoint({
      points,
      availableWidth: objectConfig.width - 150,
      availableHeight: 220,
      gutter: 20,
      fontSize: 16,
    })
  }, [objectConfig, points])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        fragmentState,
        noOfPoints: points.length,
        type: ConfigType.POINTS,
        dataConfigLength,
      },
    })
  }, [points, fragmentState])

  useEffect(() => {
    return () => {
      setPoints([])
    }
  }, [])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        activePointIndex: 0,
      })
    }
    if (state === 'recording') {
      updatePayload?.({
        activePointIndex: 0,
      })
      setTopLayerChildren([])
    }
  }, [state])

  useEffect(() => {
    setActivePointIndex(payload?.activePointIndex)
    setFragmentState(payload?.fragmentState)
  }, [payload])

  useEffect(() => {
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {viewConfig.background.type === 'color' ? (
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fillLinearGradientColorStops={viewConfig.background.gradient?.values}
          fillLinearGradientStartPoint={
            viewConfig.background.gradient?.startIndex
          }
          fillLinearGradientEndPoint={viewConfig.background.gradient?.endIndex}
        />
      ) : (
        <Image
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          image={bgImage}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill="#ffffff"
        cornerRadius={objectConfig.borderRadius}
      />
      <Text
        key="fragmentTitle"
        x={objectConfig.x + 30}
        y={objectConfig.y + 32}
        align="left"
        fontSize={40}
        fill="#1F2937"
        width={objectConfig.width - 140}
        lineHeight={1.15}
        text={dataConfig.title}
        fontStyle="normal 700"
        fontFamily="Poppins"
      />
      <Group
        x={objectConfig.x + 50}
        y={objectConfig.y + 50 + 50 * titleNumberOfLines}
        key="group4"
      >
        {computedPoints.current
          .filter((_, i) => i < activePointIndex)
          .map((point) => (
            <>
              <Circle
                key="points"
                x={-76}
                radius={11}
                y={point.y + 8}
                fillLinearGradientColorStops={
                  viewConfig.background.gradient?.values
                }
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
                width={objectConfig.width - 180}
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
      </Group>
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layoutNumber: viewConfig.layoutNumber,
    fragment,
    fragmentState,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default PointsFragment
