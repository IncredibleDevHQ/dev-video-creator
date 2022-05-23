import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import { Group, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  Fragment_Status_Enum_Enum,
  ThemeFragment,
} from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import {
  BlockProperties,
  GradientConfig,
  TopLayerChildren,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { Block } from '../../Flick/editor/utils/utils'
import useEdit, { ClipConfig } from '../hooks/use-edit'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import { FragmentLayoutConfig } from '../utils/FragmentLayoutConfig'
import LowerThridProvider from './LowerThirdProvider'
import PreviewUser from './PreviewUser'
import { FragmentState } from './RenderTokens'
import StudioUser from './StudioUser'
import TransitionProvider from './TransitionProvider'

export interface StudioUserConfig {
  x: number
  y: number
  width: number
  height: number
  clipTheme?: string
  studioUserClipConfig?: ClipConfig
  borderColor?: string | CanvasGradient
  borderWidth?: number
  backgroundRectX?: number
  backgroundRectY?: number
  backgroundRectWidth?: number
  backgroundRectHeight?: number
  backgroundRectColor?: string
  backgroundRectOpacity?: number
  backgroundRectBorderRadius?: number
  backgroundRectBorderColor?: string
  backgroundRectBorderWidth?: number
  themeName?: string
}

export interface TitleSplashProps {
  enable: boolean
  title?: string
  titleSplashConfig?: GradientConfig
}

interface ConcourseProps {
  layerChildren: any[]
  viewConfig?: BlockProperties
  stageRef?: React.RefObject<Konva.Stage>
  studioUserConfig?: StudioUserConfig[]
  disableUserMedia?: boolean
  isShorts?: boolean
  fragmentState?: FragmentState
  blockType: Block['type']
}

export const CONFIG = {
  width: 960,
  height: 540,
}

export const SHORTS_CONFIG = {
  width: 396,
  height: 704,
}

export const GetTopLayerChildren = ({
  topLayerChildrenState,
  setTopLayerChildren,
  isShorts,
  status,
  theme,
  branding,
  performFinishAction,
}: {
  topLayerChildrenState: TopLayerChildren
  setTopLayerChildren: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
  isShorts: boolean
  status: Fragment_Status_Enum_Enum
  theme: ThemeFragment
  branding?: BrandingJSON | null
  performFinishAction: () => void
}) => {
  if (status === Fragment_Status_Enum_Enum.Ended) return <></>
  switch (topLayerChildrenState) {
    case 'lowerThird': {
      return (
        <LowerThridProvider
          theme={theme}
          isShorts={isShorts || false}
          setTopLayerChildren={setTopLayerChildren}
        />
      )
    }
    case 'transition left': {
      return (
        <TransitionProvider
          theme={theme}
          isShorts={isShorts || false}
          direction="left"
          setTopLayerChildren={setTopLayerChildren}
          brandingJSON={branding}
        />
      )
    }
    case 'transition right': {
      return (
        <TransitionProvider
          theme={theme}
          isShorts={isShorts || false}
          direction="right"
          setTopLayerChildren={setTopLayerChildren}
          brandingJSON={branding}
        />
      )
    }
    case 'transition moveIn': {
      return (
        <TransitionProvider
          theme={theme}
          isShorts={isShorts || false}
          direction="moveIn"
          setTopLayerChildren={setTopLayerChildren}
          performFinishAction={performFinishAction}
          brandingJSON={branding}
        />
      )
    }
    case 'transition moveAway': {
      return (
        <TransitionProvider
          theme={theme}
          isShorts={isShorts || false}
          direction="moveAway"
          setTopLayerChildren={setTopLayerChildren}
          brandingJSON={branding}
        />
      )
    }
    case '':
      return <></>
    default:
      return <></>
  }
}

const Concourse = ({
  layerChildren,
  viewConfig,
  stageRef,
  studioUserConfig,
  disableUserMedia,
  isShorts,
  fragmentState,
  blockType,
}: ConcourseProps) => {
  const {
    fragment,
    state,
    stream,
    participants,
    payload,
    users,
    stopRecording,
    theme,
    config,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [isZooming, setZooming] = useState(false)

  const { sub, picture } = (useRecoilValue(userState) as User) || {}

  const groupRef = createRef<Konva.Group>()
  const { clipRect } = useEdit()

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!isShorts) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [isShorts])

  const defaultStudioUserConfig: StudioUserConfig = {
    x: 780,
    y: 400,
    width: 0,
    height: 0,
  }

  const userStudioImageGap = 170
  const zoomLevel = 2

  useEffect(() => {
    if (!canvas) return
    if (!canvas.zoomed) onMouseLeave()
  }, [canvas?.zoomed])

  // const handleZoom = (e: KonvaEventObject<WheelEvent>) => {
  //   e.evt.preventDefault()
  //   if (!stageRef.current) return
  //   const oldScale = stageRef.current.scaleX()
  //   const pointer = stageRef.current.getPointerPosition()

  //   if (!pointer || !oldScale) return

  //   const mousePointTo = {
  //     x: (pointer.x - stageRef.current.x()) / oldScale,
  //     y: (pointer.y - stageRef.current.y()) / oldScale,
  //   }

  //   const scaleBy = 1.01
  //   let newScale = 1
  //   if (e.evt.deltaY > 0) {
  //     newScale = oldScale / scaleBy > 1 ? oldScale / scaleBy : 1
  //   } else {
  //     newScale = oldScale * scaleBy > 4 ? 4 : oldScale * scaleBy
  //   }

  //   stageRef.current.scale({ x: newScale, y: newScale })

  //   const newPos = {
  //     x: pointer.x - mousePointTo.x * newScale,
  //     y: pointer.y - mousePointTo.y * newScale,
  //   }

  //   stageRef.current.position(newPos)
  // }

  const onLayerClick = () => {
    if (!groupRef.current) return
    const tZooming = isZooming
    if (tZooming) {
      groupRef.current.to({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
      })
    } else {
      const pointer = stageRef?.current?.getPointerPosition()
      const scaleRatio =
        document.getElementsByClassName('konvajs-content')[0].clientWidth /
        stageConfig.width
      if (pointer) {
        groupRef.current.to({
          x: (pointer.x - pointer.x * zoomLevel) / scaleRatio,
          y: (pointer.y - pointer.y * zoomLevel) / scaleRatio,
          scaleX: zoomLevel,
          scaleY: zoomLevel,
          duration: 0.5,
        })
      }
    }
    setZooming(!isZooming)
  }

  // const onMouseMove = () => {
  //   if (!groupRef.current || !canvas?.zoomed) return
  //   const tZooming = isZooming
  //   if (tZooming) {
  //     const pointer = stageRef?.current?.getPointerPosition()
  //     if (pointer)
  //       groupRef.current.to({
  //         x: -pointer.x,
  //         y: -pointer.y,
  //         // scaleX: 1,
  //         // scaleY: 1,
  //         duration: 0.1,
  //       })
  //   }
  // }

  const onMouseLeave = () => {
    if (!groupRef.current) return
    groupRef.current.to({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.5,
    })
    setZooming(false)
  }

  const resetCanvas = () => {
    if (!stageRef?.current) return
    stageRef.current.position({ x: 0, y: 0 })
    stageRef.current.scale({ x: 1, y: 1 })
    onMouseLeave()
  }

  const performFinishAction = () => {
    if (state === 'recording') {
      stopRecording()
    }
  }

  useEffect(() => {
    setCanvas({ zoomed: false, resetCanvas })
  }, [])

  console.log('test Concourse', users)

  return (
    <>
      {(viewConfig?.layout === 'full-left' ||
        viewConfig?.layout === 'full-right') &&
      !disableUserMedia &&
      payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
      payload?.status !== Fragment_Status_Enum_Enum.Ended &&
      users ? (
        <>
          <StudioUser
            stream={stream}
            studioUserConfig={
              (studioUserConfig && studioUserConfig[0]) ||
              defaultStudioUserConfig
            }
            picture={picture as string}
            type="local"
            uid={sub as string}
          />
          {users.map((user, index) => (
            <StudioUser
              key={user.uid as string}
              uid={user.uid as string}
              type="remote"
              stream={user.mediaStream as MediaStream}
              picture={participants?.[user.uid]?.picture || ''}
              studioUserConfig={
                (studioUserConfig && studioUserConfig[index + 1]) || {
                  x:
                    defaultStudioUserConfig.x -
                    (index + 1) * userStudioImageGap,
                  y: defaultStudioUserConfig.y,
                  width: defaultStudioUserConfig.width,
                  height: defaultStudioUserConfig.height,
                }
              }
            />
          ))}
        </>
      ) : (
        (viewConfig?.layout === 'full-left' ||
          viewConfig?.layout === 'full-right') &&
        !disableUserMedia &&
        payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
        payload?.status !== Fragment_Status_Enum_Enum.Ended &&
        fragment &&
        [...(fragment.configuration?.speakers || fragment.participants)]?.map(
          (_: any, index: number) => {
            return (
              <PreviewUser
                studioUserConfig={
                  (studioUserConfig && studioUserConfig[index]) || {
                    x:
                      defaultStudioUserConfig.x -
                      (index + 1) * userStudioImageGap,
                    y: defaultStudioUserConfig.y,
                    width: defaultStudioUserConfig.width,
                    height: defaultStudioUserConfig.height,
                  }
                }
              />
            )
          }
        )
      )}
      <Group>
        {(() => {
          if (payload?.status === Fragment_Status_Enum_Enum.CountDown) {
            return (
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#000000"
                cornerRadius={8}
              />
            )
          }
          if (payload?.status === Fragment_Status_Enum_Enum.Ended) {
            performFinishAction()
          }
          return (
            <Group
              clipFunc={
                blockType === 'introBlock' || blockType === 'outroBlock'
                  ? undefined
                  : (ctx: any) => {
                      clipRect(
                        ctx,
                        FragmentLayoutConfig({
                          theme,
                          layout:
                            fragmentState === 'onlyFragment'
                              ? 'classic'
                              : viewConfig?.layout || 'classic',
                          isShorts: isShorts || false,
                        })
                      )
                    }
              }
            >
              <Group
                ref={groupRef}
                onClick={onLayerClick}
                onMouseLeave={onMouseLeave}
                // onMouseMove={onMouseMove}
              >
                {layerChildren}
              </Group>
            </Group>
          )
        })()}
      </Group>
      {viewConfig?.layout !== 'full-left' &&
      viewConfig?.layout !== 'full-right' &&
      !disableUserMedia &&
      payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
      payload?.status !== Fragment_Status_Enum_Enum.Ended &&
      users ? (
        <>
          <StudioUser
            stream={stream}
            studioUserConfig={
              (studioUserConfig && studioUserConfig[0]) ||
              defaultStudioUserConfig
            }
            picture={picture as string}
            type="local"
            uid={sub as string}
          />
          {users.map((user, index) => (
            <StudioUser
              key={user.uid as string}
              uid={user.uid as string}
              type="remote"
              stream={user.mediaStream as MediaStream}
              picture={participants?.[user.uid]?.picture || ''}
              studioUserConfig={
                (studioUserConfig && studioUserConfig[index + 1]) || {
                  x:
                    defaultStudioUserConfig.x -
                    (index + 1) * userStudioImageGap,
                  y: defaultStudioUserConfig.y,
                  width: defaultStudioUserConfig.width,
                  height: defaultStudioUserConfig.height,
                }
              }
            />
          ))}
        </>
      ) : (
        viewConfig?.layout !== 'full-left' &&
        viewConfig?.layout !== 'full-right' &&
        !disableUserMedia &&
        payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
        payload?.status !== Fragment_Status_Enum_Enum.Ended &&
        [
          ...(config?.speakers ||
            fragment?.configuration?.speakers ||
            fragment?.participants ||
            []),
        ]?.map((_: any, index: number) => {
          return (
            <PreviewUser
              studioUserConfig={
                (studioUserConfig && studioUserConfig[index]) || {
                  x:
                    defaultStudioUserConfig.x -
                    (index + 1) * userStudioImageGap,
                  y: defaultStudioUserConfig.y,
                  width: defaultStudioUserConfig.width,
                  height: defaultStudioUserConfig.height,
                }
              }
            />
          )
        })
      )}
    </>
  )
}

export default Concourse
