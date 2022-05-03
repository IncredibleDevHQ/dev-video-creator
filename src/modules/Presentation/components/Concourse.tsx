import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import { Group } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../generated/graphql'
import useEdit, { ClipConfig } from '../hooks/use-edit'
import { canvasStore, presentationStore } from '../stores'
import { PresentationProviderProps } from '../stores/presentation.store'
import {
  BlockProperties,
  GradientConfig,
  TopLayerChildren,
} from '../utils/configTypes'
import { FragmentLayoutConfig } from '../utils/FragmentLayoutConfig'
import { Block } from '../utils/utils'
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
  isShorts?: boolean
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
  theme,
}: {
  topLayerChildrenState: TopLayerChildren
  setTopLayerChildren: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
  isShorts: boolean
  theme: ThemeFragment
}) => {
  switch (topLayerChildrenState) {
    case 'transition left': {
      return (
        <TransitionProvider
          theme={theme}
          isShorts={isShorts || false}
          direction="left"
          setTopLayerChildren={setTopLayerChildren}
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
        />
      )
    }
    default:
      return <></>
  }
}

const Concourse = ({
  layerChildren,
  viewConfig,
  stageRef,
  isShorts,
  blockType,
}: ConcourseProps) => {
  const { theme } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [isZooming, setZooming] = useState(false)

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
      if (pointer) {
        groupRef.current.to({
          x: -pointer.x,
          y: -pointer.y,
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

  useEffect(() => {
    setCanvas({ zoomed: false, resetCanvas })
  }, [])

  return (
    <Group>
      <Group
        clipFunc={
          blockType === 'introBlock' || blockType === 'outroBlock'
            ? undefined
            : (ctx: any) => {
                clipRect(
                  ctx,
                  FragmentLayoutConfig({
                    theme,
                    layout: viewConfig?.layout || 'classic',
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
    </Group>
  )
}

export default Concourse
