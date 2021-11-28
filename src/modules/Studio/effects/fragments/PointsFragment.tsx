import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Rect, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  ListBlockProps,
  ListItem,
} from '../../../../components/TextEditor/utils'
import { ConfigType } from '../../../../utils/configTypes'
import { BlockProperties } from '../../../../utils/configTypes2'
import Concourse, {
  CONFIG,
  SHORTS_CONFIG,
  TitleSplashProps,
} from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { TrianglePathTransition } from '../FragmentTransitions'

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
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: ListBlockProps
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  shortsMode: boolean
}) => {
  const { fragment, state, updatePayload, payload, addTransitionAudio } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<ListItem[]>([])

  const { initUsePoint, computedPoints, getNoOfLinesOfText } = usePoint()

  // const [yCoordinate, setYCoordinate] = useState<number>(0)

  // ref to the object grp
  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const customLayoutRef = useRef<Konva.Group>(null)

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const colorStops = [0, '#D1D5DB', 1, '#D1D5DB']

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  useEffect(() => {
    if (!dataConfig) return
    setObjectConfig(
      FragmentLayoutConfig({
        layout: viewConfig.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setPoints(dataConfig.listBlock.list || [])
    setTopLayerChildren([])
  }, [dataConfig, shortsMode])

  useEffect(() => {
    setTitleNumberOfLines(
      getNoOfLinesOfText({
        text: dataConfig.listBlock.title || fragment?.name || '',
        availableWidth: objectConfig.width - 60,
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
  }, [state, points, fragmentState])

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
  }, [payload])

  useEffect(() => {
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="right" />,
      ])
      addTransitionAudio()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef.current?.to({
          opacity: 1,
          duration: 0.2,
        })
      }, 800)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="left" />,
      ])
      addTransitionAudio()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef.current?.to({
          opacity: 0,
          duration: 0.2,
        })
      }, 800)
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {/* {viewConfig.background.type === 'color' ? ( */}
      <Rect
        x={0}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height}
        fillLinearGradientColorStops={viewConfig.gradient?.values}
        fillLinearGradientStartPoint={viewConfig.gradient?.startIndex}
        fillLinearGradientEndPoint={viewConfig.gradient?.endIndex}
      />
      {/* ) : (
        <Image
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          image={bgImage}
        />
      )} */}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill="#1F2937"
        cornerRadius={objectConfig.borderRadius}
      />
      <Text
        key="fragmentTitle"
        x={objectConfig.x + 30}
        y={objectConfig.y + 32}
        align="left"
        fontSize={40}
        fill="#E5E7EB"
        width={objectConfig.width - 80}
        lineHeight={1.15}
        text={dataConfig.listBlock.title || fragment?.name || ''}
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
                  viewConfig.gradient?.values || colorStops
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
                fill="#F3F4F6"
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
    layout: viewConfig.layout || 'classic',
    fragment,
    fragmentState,
    isShorts: shortsMode || false,
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
