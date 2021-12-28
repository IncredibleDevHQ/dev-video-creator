import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { ListBlockProps, ListItem } from '../../../Flick/editor/utils/utils'
import { BlockProperties } from '../../../../utils/configTypes'
import Concourse, { TitleSplashProps } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import { ComputedPoint } from '../../hooks/use-point'
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
  topLayerChildren,
  setTopLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  layerRef,
  shortsMode,
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: ListBlockProps
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const { fragment, state, updatePayload, payload, addMusic } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<ListItem[]>([])

  const { initUsePoint, getNoOfLinesOfText } = usePoint()

  // const [yCoordinate, setYCoordinate] = useState<number>(0)

  // ref to the object grp
  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const customLayoutRef = useRef<Konva.Group>(null)

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [computedPoints, setComputedPoints] = useState<ComputedPoint[]>([])

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const colorStops = [0, '#D1D5DB', 1, '#D1D5DB']

  useEffect(() => {
    if (!dataConfig) return
    updatePayload?.({
      activePointIndex: 0,
    })
    setActivePointIndex(0)
    setPoints([])
    setComputedPoints([])
    setObjectConfig(
      FragmentLayoutConfig({
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setPoints(dataConfig.listBlock.list || [])
    setTopLayerChildren([])
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    if (points.length === 0) return
    setTitleNumberOfLines(
      getNoOfLinesOfText({
        text: dataConfig.listBlock.title || fragment?.name || '',
        availableWidth: objectConfig.width - 80,
        fontSize: 40,
        fontFamily: 'Gilroy',
        fontStyle: 'normal 800',
      })
    )
    setComputedPoints(
      initUsePoint({
        points,
        availableWidth: objectConfig.width - 110,
        availableHeight: 220,
        gutter: 25,
        fontSize: 16,
        fontFamily: 'Gilroy',
      })
    )
  }, [objectConfig, points])

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
  }, [payload?.activePointIndex])

  useEffect(() => {
    addMusic('points')
  }, [activePointIndex])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren([
        <TrianglePathTransition isShorts={shortsMode} direction="right" />,
      ])
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
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
      addMusic()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.2,
        })
      }, 800)
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <Rect
        x={objectConfig.x}
        y={objectConfig.y}
        width={objectConfig.width}
        height={objectConfig.height}
        fill={viewConfig?.bgColor || '#1F2937'}
        cornerRadius={objectConfig.borderRadius}
        opacity={viewConfig?.bgOpacity || 1}
      />
      <Text
        key="fragmentTitle"
        x={objectConfig.x + 30}
        y={objectConfig.y + 32}
        align="left"
        fontSize={40}
        fill={viewConfig?.bgColor === '#ffffff' ? '#1F2937' : '#E5E7EB'}
        width={objectConfig.width - 80}
        lineHeight={1.15}
        text={dataConfig.listBlock.title || fragment?.name || ''}
        fontStyle="normal 800"
        fontFamily="Gilroy"
      />
      <Group
        x={objectConfig.x + 50}
        y={objectConfig.y + 25 + 50 * titleNumberOfLines}
        key="group4"
      >
        {!isPreview
          ? computedPoints
              .filter((_, i) => i < activePointIndex)
              .map((point) => (
                <>
                  <Circle
                    key="points"
                    x={-76}
                    radius={11}
                    y={point.y + 8}
                    fillLinearGradientColorStops={
                      viewConfig?.gradient?.values || colorStops
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
                    fill={
                      viewConfig?.bgColor === '#ffffff' ? '#4B5563' : '#F3F4F6'
                    }
                    // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                    // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                    width={objectConfig.width - 110}
                    text={point.text}
                    // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                    lineHeight={1.3}
                    fontFamily="Inter"
                    ref={(ref) =>
                      ref?.to({
                        x: 30,
                        duration: 0.3,
                      })
                    }
                  />
                </>
              ))
          : computedPoints.map((point) => (
              <>
                <Circle
                  key="points"
                  x={0}
                  radius={11}
                  y={point.y + 8}
                  fillLinearGradientColorStops={
                    viewConfig?.gradient?.values || colorStops
                  }
                  fillLinearGradientStartPoint={{ x: -11, y: -11 }}
                  fillLinearGradientEndPoint={{
                    x: 11,
                    y: 11,
                  }}
                />
                <Text
                  key={point.text}
                  x={30}
                  y={point.y}
                  align="left"
                  fontSize={16}
                  fill={
                    viewConfig?.bgColor === '#ffffff' ? '#4B5563' : '#F3F4F6'
                  }
                  // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                  // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                  width={objectConfig.width - 110}
                  text={point.text}
                  // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                  lineHeight={1.3}
                  fontFamily="Inter"
                />
              </>
            ))}
      </Group>
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layout: viewConfig?.layout || 'classic',
    fragment,
    fragmentState,
    isShorts: shortsMode || false,
    bgGradientId: viewConfig?.gradient?.id || 1,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
      isShorts={shortsMode}
    />
  )
}

export default PointsFragment
