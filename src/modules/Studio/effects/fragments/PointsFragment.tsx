import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import {
  BlockProperties,
  TopLayerChildren,
} from '../../../../utils/configTypes'
import { ListBlockProps, ListItem } from '../../../Flick/editor/utils/utils'
import Concourse, { TitleSplashProps } from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import { ComputedPoint } from '../../hooks/use-point'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

const PointsFragment = ({
  viewConfig,
  dataConfig,
  topLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: ListBlockProps
  topLayerChildren: {
    id: string
    state: TopLayerChildren
  }
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const { fragment, state, updatePayload, payload, addMusic, branding } =
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

  const [objectRenderConfig, setObjectRenderConfig] =
    useState<ObjectRenderConfig>({
      startX: 0,
      startY: 0,
      availableWidth: 0,
      availableHeight: 0,
      textColor: '',
    })

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
  }, [dataConfig, shortsMode, viewConfig])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme: 'glassy', layoutConfig: objectConfig })
    )
  }, [objectConfig])

  useEffect(() => {
    if (points.length === 0) return
    setTitleNumberOfLines(
      getNoOfLinesOfText({
        text: dataConfig.listBlock.title || fragment?.name || '',
        availableWidth: objectRenderConfig.availableWidth - 80,
        fontSize: 40,
        fontFamily: 'Gilroy',
        fontStyle: 'normal 800',
      })
    )
    setComputedPoints(
      initUsePoint({
        points,
        availableWidth: objectRenderConfig.availableWidth - 110,
        availableHeight: 220,
        gutter: 25,
        fontSize: 16,
        fontFamily: 'Gilroy',
      })
    )
  }, [points, objectRenderConfig])

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
      <FragmentBackground
        theme="glassy"
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary ? branding?.colors?.primary : '#151D2C'
        }
      />
      <Text
        key="fragmentTitle"
        x={objectRenderConfig.startX + 30}
        y={objectRenderConfig.startY + 32}
        align="left"
        fontSize={40}
        fill={
          branding?.colors?.text
            ? branding?.colors?.text
            : objectRenderConfig.textColor
        }
        width={objectRenderConfig.availableWidth - 80}
        lineHeight={1.15}
        text={dataConfig.listBlock.title || fragment?.name || ''}
        fontStyle="normal 800"
        fontFamily="Gilroy"
      />
      <Group
        x={objectRenderConfig.startX + 50}
        y={objectRenderConfig.startY + 25 + 50 * titleNumberOfLines}
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
                    fill={
                      branding?.colors?.text
                        ? branding?.colors?.text
                        : objectRenderConfig.pointsBulletColor
                    }
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
                      branding?.colors?.text
                        ? branding?.colors?.text
                        : objectRenderConfig.textColor
                    }
                    // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                    // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                    width={objectRenderConfig.availableWidth - 110}
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
                  fill={
                    branding?.colors?.text
                      ? branding?.colors?.text
                      : objectRenderConfig.pointsBulletColor
                  }
                />
                <Text
                  key={point.text}
                  x={30}
                  y={point.y}
                  align="left"
                  fontSize={16}
                  fill={
                    branding?.colors?.text
                      ? branding?.colors?.text
                      : objectRenderConfig.textColor
                  }
                  // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                  // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                  width={objectRenderConfig.availableWidth - 110}
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
    theme: 'glassy',
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default PointsFragment
