/* eslint-disable no-nested-ternary */
import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Rect, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  BlockProperties,
  Layout,
  ListAppearance,
  ListBlockView,
  ListBlockViewProps,
  ListOrientation,
  ListViewStyle,
} from '../../../../utils/configTypes'
import { ListBlockProps, ListItem } from '../../../Flick/editor/utils/utils'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import { ComputedPoint } from '../../hooks/use-point'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { getPointsConfig, PointsConfig } from '../../utils/PointsConfig'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

// returns total no of points to be rendered
// for a particular layout in horizontal orientation
export const getNoOfPointsBasedOnLayout = (layout: Layout) => {
  switch (layout) {
    case 'classic':
      return 3
    case 'float-full-left':
    case 'float-full-right':
    case 'float-half-right':
    case 'padded-bottom-right-tile':
    case 'padded-bottom-right-circle':
    case 'bottom-right-tile':
    case 'bottom-right-circle':
      return 2
    case 'padded-split':
    case 'split':
    case 'full':
      return 1
    default:
      return 3
  }
}

const PointsFragment = ({
  viewConfig,
  dataConfig,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: ListBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const { fragment, state, updatePayload, payload, addMusic, branding, theme } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<ListItem[]>([])

  const { initUsePoint, getNoOfLinesOfText, getPositionForReplaceMode } =
    usePoint()

  // ref to the object grp
  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const customLayoutRef = useRef<Konva.Group>(null)

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
      surfaceColor: '',
    })

  const [viewStyle, setViewStyle] = useState<ListViewStyle>('bullet')
  const [appearance, setAppearance] = useState<ListAppearance>('stack')
  const [orientation, setOrientation] = useState<ListOrientation>('vertical')
  // used for the replace mode
  const [titleY, setTitleY] = useState<number>(0)

  const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
    bulletWidth: 64,
    bulletHeight: 64,
    bulletFontSize: 32,
    paddingBtwBulletText: 26,
    textFontSize: 16,
    noOfPoints: 3,
    noForSpacing: 4,
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
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setPoints(dataConfig.listBlock.list || [])
    const listBlockViewProps: ListBlockViewProps = (
      viewConfig?.view as ListBlockView
    )?.list
    if (listBlockViewProps?.viewStyle)
      setViewStyle(listBlockViewProps?.viewStyle)
    if (listBlockViewProps?.appearance)
      setAppearance(listBlockViewProps?.appearance)
    if (listBlockViewProps?.orientation)
      setOrientation(listBlockViewProps?.orientation)
  }, [dataConfig, shortsMode, viewConfig, theme])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        computedPoints,
      },
    })
  }, [computedPoints])

  useEffect(() => {
    if (points.length === 0) return
    const noOflinesOfTitle = getNoOfLinesOfText({
      text: dataConfig.listBlock.title || fragment?.name || '',
      availableWidth: objectRenderConfig.availableWidth - 80,
      fontSize: 40,
      fontFamily: branding?.font?.heading?.family || 'Gilroy',
      fontStyle: 'normal 800',
    })
    setTitleNumberOfLines(noOflinesOfTitle)
    setComputedPoints(
      initUsePoint({
        points,
        availableWidth: objectRenderConfig.availableWidth - 110,
        availableHeight:
          objectRenderConfig.availableHeight - 32 - 50 * noOflinesOfTitle,
        gutter: 25,
        fontSize: 16,
        fontFamily: branding?.font?.body?.family || 'Inter',
        orientation,
        layout: viewConfig?.layout || 'classic',
      })
    )
    if (orientation === 'horizontal') {
      setPointsConfig(
        getPointsConfig({ layout: viewConfig?.layout || 'classic' })
      )
    }
  }, [viewConfig, points, objectRenderConfig, orientation])

  useEffect(() => {
    if (computedPoints.length === 0) return
    if (!dataConfig) return
    setTitleY(
      getPositionForReplaceMode({
        title: dataConfig.listBlock.title || fragment?.name || '',
        titleFontSize: 40,
        titleFontFamily: branding?.font?.heading?.family || 'Gilroy',
        titleFontStyle: 'normal 800',
        points: computedPoints,
        availableWidth: objectRenderConfig.availableWidth - 110,
        availableHeight: objectRenderConfig.availableHeight - 16,
        fontSize: 24,
        fontFamily: branding?.font?.body?.family || 'Inter',
      })
    )
  }, [computedPoints, dataConfig])

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
    if (activePointIndex === 0) return
    addMusic({ type: 'points', volume: 0.4 })
  }, [activePointIndex])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 0,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }
    }
  }, [payload?.fragmentState])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary
            ? branding?.colors?.primary
            : objectRenderConfig.surfaceColor
        }
      />
      <Text
        key="fragmentTitle"
        x={objectRenderConfig.startX + 30}
        y={
          appearance !== 'replace'
            ? objectRenderConfig.startY + 32
            : objectRenderConfig.startY + titleY + 8
        }
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
        fontFamily={branding?.font?.heading?.family || 'Gilroy'}
      />
      {orientation === 'vertical' ? (
        <Group
          x={objectRenderConfig.startX + 50}
          y={
            appearance !== 'replace'
              ? objectRenderConfig.startY + 32 + 50 * titleNumberOfLines
              : objectRenderConfig.startY +
                titleY +
                8 +
                40 * titleNumberOfLines +
                20
          }
          key="verticalGroup"
        >
          {!isPreview
            ? {
                stack: computedPoints
                  .filter(
                    (_, i) =>
                      i < activePointIndex &&
                      i >= computedPoints[activePointIndex - 1]?.startFromIndex
                  )
                  .map((point) => (
                    <>
                      {
                        {
                          bullet: (
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
                                  x: 0 + (41 * (point?.level - 1) || 0),
                                  duration: 0.3,
                                })
                              }
                            />
                          ),
                          number: (
                            <Text
                              key="points"
                              x={-76}
                              y={point.y}
                              fill={
                                branding?.colors?.text
                                  ? branding?.colors?.text
                                  : objectRenderConfig.pointsBulletColor
                              }
                              ref={(ref) =>
                                ref?.to({
                                  x: 0 + (41 * (point?.level - 1) || 0),
                                  duration: 0.3,
                                })
                              }
                              text={point.pointNumber.toString()}
                              fontSize={16}
                              fontFamily={
                                branding?.font?.body?.family || 'Inter'
                              }
                            />
                          ),
                          none: <></>,
                        }[viewStyle]
                      }
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
                        width={
                          viewStyle !== 'none'
                            ? objectRenderConfig.availableWidth -
                              110 -
                              (41 * (point?.level - 1) || 0)
                            : objectRenderConfig.availableWidth - 110
                        }
                        text={point.text}
                        lineHeight={1.3}
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                        ref={(ref) =>
                          ref?.to({
                            x:
                              viewStyle !== 'none'
                                ? 30 + (41 * (point?.level - 1) || 0)
                                : 0,
                            duration: 0.3,
                          })
                        }
                      />
                    </>
                  )),
                replace: computedPoints
                  .filter((_, i) => i === activePointIndex - 1)
                  .map((point) => (
                    <>
                      <Group>
                        <Text
                          key={point.text}
                          // x={0 + (41 * (point?.level - 1) || 0)}
                          x={-10}
                          align="left"
                          fontSize={24}
                          fill={
                            branding?.colors?.text
                              ? branding?.colors?.text
                              : objectRenderConfig.textColor
                          }
                          // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                          // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                          width={
                            objectRenderConfig.availableWidth -
                            110 -
                            (41 * (point?.level - 1) || 0)
                          }
                          text={point.text}
                          // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                          lineHeight={1.3}
                          fontFamily={branding?.font?.body?.family || 'Inter'}
                          height={
                            objectRenderConfig.availableHeight - 32 - titleY
                          }
                          // verticalAlign="middle"
                        />
                      </Group>
                    </>
                  )),
                allAtOnce: computedPoints
                  .filter(
                    (_, i) =>
                      i < activePointIndex &&
                      i >= computedPoints[activePointIndex - 1]?.startFromIndex
                  )
                  .map((point) => (
                    <>
                      {
                        {
                          bullet: (
                            <Circle
                              key="points"
                              x={0 + (41 * (point?.level - 1) || 0)}
                              radius={11}
                              y={point.y + 8}
                              fill={
                                branding?.colors?.text
                                  ? branding?.colors?.text
                                  : objectRenderConfig.pointsBulletColor
                              }
                            />
                          ),
                          number: (
                            <Text
                              key="points"
                              x={0 + (41 * (point?.level - 1) || 0)}
                              y={point.y}
                              fill={
                                branding?.colors?.text
                                  ? branding?.colors?.text
                                  : objectRenderConfig.pointsBulletColor
                              }
                              text={point.pointNumber.toString()}
                              fontSize={20}
                              fontStyle="normal 600"
                              fontFamily={
                                branding?.font?.body?.family || 'Inter'
                              }
                            />
                          ),
                          none: <></>,
                        }[viewStyle]
                      }
                      <Text
                        key={point.text}
                        x={
                          viewStyle !== 'none'
                            ? 30 + (41 * (point?.level - 1) || 0)
                            : 0
                        }
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
                        width={
                          viewStyle !== 'none'
                            ? objectRenderConfig.availableWidth -
                              110 -
                              (41 * (point?.level - 1) || 0)
                            : objectRenderConfig.availableWidth - 110
                        }
                        text={point.text}
                        // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                        lineHeight={1.3}
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                      />
                    </>
                  )),
              }[appearance]
            : appearance !== 'replace'
            ? computedPoints
                .filter((point) => point.startFromIndex === 0)
                .map((point) => (
                  <>
                    {
                      {
                        bullet: (
                          <Circle
                            key="points"
                            x={0 + (41 * (point?.level - 1) || 0)}
                            radius={11}
                            y={point.y + 8}
                            fill={
                              branding?.colors?.text
                                ? branding?.colors?.text
                                : objectRenderConfig.pointsBulletColor
                            }
                          />
                        ),
                        number: (
                          <Text
                            key="points"
                            x={0 + (41 * (point?.level - 1) || 0)}
                            y={point.y}
                            fill={
                              branding?.colors?.text
                                ? branding?.colors?.text
                                : objectRenderConfig.textColor
                            }
                            text={point.pointNumber.toString()}
                            fontSize={20}
                            // fontStyle="normal 600"
                            fontFamily={branding?.font?.body?.family || 'Inter'}
                          />
                        ),
                        none: <></>,
                      }[viewStyle]
                    }
                    <Text
                      key={point.text}
                      x={
                        viewStyle !== 'none'
                          ? 30 + (41 * (point?.level - 1) || 0)
                          : 0
                      }
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
                      width={
                        viewStyle !== 'none'
                          ? objectRenderConfig.availableWidth -
                            110 -
                            (41 * (point?.level - 1) || 0)
                          : objectRenderConfig.availableWidth - 110
                      }
                      text={point.text}
                      // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                      lineHeight={1.3}
                      fontFamily={branding?.font?.body?.family || 'Inter'}
                    />
                  </>
                ))
            : computedPoints
                .filter((_, i) => i === 0)
                .map((point) => (
                  <>
                    <Group>
                      <Text
                        key={point.text}
                        // x={0 + (41 * (point?.level - 1) || 0)}
                        x={-10}
                        align="left"
                        fontSize={24}
                        fill={
                          branding?.colors?.text
                            ? branding?.colors?.text
                            : objectRenderConfig.textColor
                        }
                        // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                        // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                        width={
                          objectRenderConfig.availableWidth -
                          110 -
                          (41 * (point?.level - 1) || 0)
                        }
                        text={point.text}
                        // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                        lineHeight={1.3}
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                        height={
                          objectRenderConfig.availableHeight - 32 - titleY
                        }
                        // verticalAlign="middle"
                      />
                    </Group>
                  </>
                ))}
        </Group>
      ) : (
        <Group
          x={objectRenderConfig.startX}
          y={
            appearance !== 'replace' || isPreview
              ? objectRenderConfig.startY + 50 * titleNumberOfLines
              : titleY + 50 * titleNumberOfLines + 20
          }
          key="horizontalGroup"
        >
          {!isPreview
            ? {
                stack: computedPoints
                  .filter(
                    (_, i) =>
                      i < activePointIndex &&
                      i >= computedPoints[activePointIndex - 1]?.startFromIndex
                  )
                  .map((point, index) => (
                    <Group
                      x={
                        (objectRenderConfig.availableWidth -
                          248 * pointsConfig.noOfPoints) /
                          pointsConfig.noForSpacing +
                        (248 +
                          (objectRenderConfig.availableWidth -
                            248 * pointsConfig.noOfPoints) /
                            pointsConfig.noForSpacing) *
                          index
                      }
                      y={point.y}
                    >
                      <Group x={(248 - pointsConfig.bulletWidth) / 2}>
                        <Rect
                          width={pointsConfig.bulletWidth}
                          height={pointsConfig.bulletHeight}
                          fill="white"
                          cornerRadius={objectRenderConfig.borderRadius}
                        />
                        <Text
                          text={point.pointNumber.toString()}
                          fontSize={pointsConfig.bulletFontSize}
                          fill="black"
                          fontFamily={branding?.font?.body?.family || 'Inter'}
                          width={pointsConfig.bulletWidth}
                          height={pointsConfig.bulletHeight}
                          align="center"
                          verticalAlign="middle"
                        />
                      </Group>
                      <Rect
                        y={
                          pointsConfig.bulletHeight +
                          pointsConfig.paddingBtwBulletText
                        }
                        width={248}
                        height={(point.height || 0) + 20}
                        stroke="white"
                        cornerRadius={objectRenderConfig.borderRadius}
                      />
                      <Text
                        key={point.text}
                        x={10}
                        y={
                          pointsConfig.bulletHeight +
                          pointsConfig.paddingBtwBulletText +
                          10
                        }
                        fontSize={pointsConfig.textFontSize}
                        fill={
                          branding?.colors?.text
                            ? branding?.colors?.text
                            : objectRenderConfig.textColor
                        }
                        // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                        // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                        width={228}
                        height={point.height}
                        verticalAlign="middle"
                        align="center"
                        text={point.text}
                        // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                        lineHeight={1.3}
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                      />
                    </Group>
                  )),
                replace: <></>,
                allAtOnce: computedPoints
                  .filter(
                    (_, i) =>
                      i < activePointIndex &&
                      i >= computedPoints[activePointIndex - 1]?.startFromIndex
                  )
                  .map((point, index) => (
                    <Group
                      x={
                        (objectRenderConfig.availableWidth -
                          248 * pointsConfig.noOfPoints) /
                          pointsConfig.noForSpacing +
                        (248 +
                          (objectRenderConfig.availableWidth -
                            248 * pointsConfig.noOfPoints) /
                            pointsConfig.noForSpacing) *
                          index
                      }
                      y={point.y}
                    >
                      <Group x={(248 - pointsConfig.bulletWidth) / 2}>
                        <Rect
                          width={pointsConfig.bulletWidth}
                          height={pointsConfig.bulletHeight}
                          fill="white"
                          cornerRadius={objectRenderConfig.borderRadius}
                        />
                        <Text
                          text={point.pointNumber.toString()}
                          fontSize={pointsConfig.bulletFontSize}
                          fill="black"
                          fontFamily={branding?.font?.body?.family || 'Inter'}
                          width={pointsConfig.bulletWidth}
                          height={pointsConfig.bulletHeight}
                          align="center"
                          verticalAlign="middle"
                        />
                      </Group>
                      <Rect
                        y={
                          pointsConfig.bulletHeight +
                          pointsConfig.paddingBtwBulletText
                        }
                        width={248}
                        height={(point.height || 0) + 20}
                        stroke="white"
                        cornerRadius={objectRenderConfig.borderRadius}
                      />
                      <Text
                        key={point.text}
                        x={10}
                        y={
                          pointsConfig.bulletHeight +
                          pointsConfig.paddingBtwBulletText +
                          10
                        }
                        fontSize={pointsConfig.textFontSize}
                        fill={
                          branding?.colors?.text
                            ? branding?.colors?.text
                            : objectRenderConfig.textColor
                        }
                        // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                        // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                        width={228}
                        height={point.height}
                        verticalAlign="middle"
                        align="center"
                        text={point.text}
                        // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                        lineHeight={1.3}
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                      />
                    </Group>
                  )),
              }[appearance]
            : computedPoints
                .filter(
                  (_, i) =>
                    i <
                    getNoOfPointsBasedOnLayout(viewConfig?.layout || 'classic')
                )
                .map((point, index) => (
                  <Group
                    x={
                      (objectRenderConfig.availableWidth -
                        248 * pointsConfig.noOfPoints) /
                        pointsConfig.noForSpacing +
                      (248 +
                        (objectRenderConfig.availableWidth -
                          248 * pointsConfig.noOfPoints) /
                          pointsConfig.noForSpacing) *
                        index
                    }
                    y={point.y}
                  >
                    <Group x={(248 - pointsConfig.bulletWidth) / 2}>
                      <Rect
                        width={pointsConfig.bulletWidth}
                        height={pointsConfig.bulletHeight}
                        fill="white"
                        cornerRadius={objectRenderConfig.borderRadius}
                      />
                      <Text
                        text={point.pointNumber.toString()}
                        fontSize={pointsConfig.bulletFontSize}
                        fill="black"
                        fontFamily={branding?.font?.body?.family || 'Inter'}
                        width={pointsConfig.bulletWidth}
                        height={pointsConfig.bulletHeight}
                        align="center"
                        verticalAlign="middle"
                      />
                    </Group>
                    <Rect
                      y={
                        pointsConfig.bulletHeight +
                        pointsConfig.paddingBtwBulletText
                      }
                      width={248}
                      height={(point.height || 0) + 32}
                      stroke="white"
                      strokeWidth={1}
                      cornerRadius={objectRenderConfig.borderRadius}
                    />
                    <Text
                      key={point.text}
                      x={16}
                      y={
                        pointsConfig.bulletHeight +
                        pointsConfig.paddingBtwBulletText +
                        16
                      }
                      fontSize={pointsConfig.textFontSize}
                      fill={
                        branding?.colors?.text
                          ? branding?.colors?.text
                          : objectRenderConfig.textColor
                      }
                      // why subtracting 110 is that this group starts at x: 50 and this text starts at x: 30,
                      // so we need to subtract 110 to get the correct x, to give 30 padding in the end too
                      width={216}
                      height={point.height}
                      verticalAlign="middle"
                      align="center"
                      text={point.text}
                      // text="Run and test using one command and so on a thats all hd huusd j idhc dsi"
                      lineHeight={1.3}
                      fontFamily={branding?.font?.body?.family || 'Inter'}
                    />
                  </Group>
                ))}
        </Group>
      )}
    </Group>,
  ]

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      studioUserConfig={studioUserConfig}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default PointsFragment
