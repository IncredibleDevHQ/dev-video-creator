import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import { Group, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import {
  CircleCenterShrink,
  MultiCircleCenterGrow,
} from '../effects/FragmentTransitions'
import { ClipConfig } from '../hooks/use-edit'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import PreviewUser from './PreviewUser'
import StudioUser from './StudioUser'
import TitleSplash from './TitleSplash'

export interface StudioUserConfig {
  x: number
  y: number
  width: number
  height: number
  clipTheme?: string
  borderColor?: string
  borderWidth?: number
  studioUserClipConfig?: ClipConfig
  backgroundRectX?: number
  backgroundRectY?: number
  backgroundRectColor?: string
  backgroundRectBorderColor?: string
  backgroundRectBorderWidth?: number
}

export interface TitleSplashProps {
  enable: boolean
  title?: string
  bgRectColor?: string[]
  stripRectColor?: string[]
  textColor?: string[]
}

interface ConcourseProps {
  layerChildren: any[]
  stageRef?: React.RefObject<Konva.Stage>
  layerRef?: React.RefObject<Konva.Layer>
  titleSplashData?: TitleSplashProps
  studioUserConfig?: StudioUserConfig[]
  disableUserMedia?: boolean
  topLayerChildren?: any[]
  isShorts?: boolean
}

export const CONFIG = {
  width: 960,
  height: 540,
}

export const SHORTS_CONFIG = {
  width: 396,
  height: 704,
}

const Concourse = ({
  layerChildren,
  stageRef,
  layerRef,
  titleSplashData,
  studioUserConfig,
  disableUserMedia,
  topLayerChildren,
  isShorts,
}: ConcourseProps) => {
  const {
    fragment,
    state,
    stream,
    participants,
    payload,
    users,
    stopRecording,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(false)
  const [isZooming, setZooming] = useState(false)

  const { sub, picture } = (useRecoilValue(userState) as User) || {}

  const groupRef = createRef<Konva.Group>()

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
    width: 160,
    height: 120,
  }

  const initialPos = { x: 780, y: 400 }
  const userStudioImageGap = 170
  const zoomLevel = 2
  Konva.pixelRatio = 2

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
    if (!groupRef.current || !canvas?.zoomed) return
    const tZooming = isZooming
    if (tZooming) {
      groupRef.current.x(0)
      groupRef.current.y(0)
      groupRef.current.scale({ x: 1, y: 1 })
    } else {
      const pointer = stageRef?.current?.getPointerPosition()
      if (pointer) {
        groupRef.current.x(-pointer.x)
        groupRef.current.y(-pointer.y)
      }
      groupRef.current.scale({ x: zoomLevel, y: zoomLevel })
    }
    setZooming(!isZooming)
  }

  const onMouseLeave = () => {
    if (!groupRef.current) return
    groupRef.current.x(0)
    groupRef.current.y(0)
    groupRef.current.scale({ x: 1, y: 1 })
    setZooming(false)
  }

  const resetCanvas = () => {
    if (!stageRef?.current) return
    stageRef.current.position({ x: 0, y: 0 })
    stageRef.current.scale({ x: 1, y: 1 })
    onMouseLeave()
  }

  const performFinishAction = () => {
    stopRecording()
  }

  useEffect(() => {
    setCanvas({ zoomed: false, resetCanvas })
  }, [])

  useEffect(() => {
    if (titleSplashData?.enable) {
      if (payload?.status === Fragment_Status_Enum_Enum.Live) {
        setIsTitleSplash(true)
      } else {
        setIsTitleSplash(false)
      }
    } else {
      setIsTitleSplash(false)
    }
  }, [titleSplashData, state, payload?.status])

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height}
        fill="#000000"
        // cornerRadius={8}
      />
      <Group ref={groupRef} onClick={onLayerClick} onMouseLeave={onMouseLeave}>
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
          if (payload?.status === Fragment_Status_Enum_Enum.Live) {
            // layerRef?.current?.destroyChildren()
            if (titleSplashData?.enable && isTitleSplash) {
              return !isShorts ? (
                <>
                  <TitleSplash
                    titleSplashData={titleSplashData}
                    setIsTitleSplash={setIsTitleSplash}
                    stageConfig={stageConfig}
                    isShorts={isShorts}
                  />
                  <CircleCenterShrink color="#000000" />
                </>
              ) : (
                <>
                  <TitleSplash
                    titleSplashData={titleSplashData}
                    setIsTitleSplash={setIsTitleSplash}
                    stageConfig={stageConfig}
                    isShorts={isShorts}
                  />
                </>
              )
            }
          }
          if (payload?.status === Fragment_Status_Enum_Enum.Ended)
            return (
              <MultiCircleCenterGrow
                performFinishAction={performFinishAction}
              />
            )
          return layerChildren
        })()}
      </Group>
      {!disableUserMedia &&
      !isTitleSplash &&
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
        fragment &&
        fragment.participants.map((_, index: number) => (
          <PreviewUser
            studioUserConfig={
              (studioUserConfig && studioUserConfig[index]) || {
                x: defaultStudioUserConfig.x - (index + 1) * userStudioImageGap,
                y: defaultStudioUserConfig.y,
                width: defaultStudioUserConfig.width,
                height: defaultStudioUserConfig.height,
              }
            }
          />
        ))
      )}
      <Group>{topLayerChildren}</Group>
    </>
  )
}

export default Concourse
