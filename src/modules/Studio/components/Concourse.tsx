import { cx } from '@emotion/css'
import Konva from 'konva'
import { KonvaEventObject } from 'konva/lib/Node'
import React, { createRef, useEffect, useState } from 'react'
import { Group, Layer, Rect, Stage, Text } from 'react-konva'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import {
  CircleCenterShrink,
  MultiCircleCenterGrow,
} from '../effects/FragmentTransitions'
import { ClipConfig } from '../hooks/use-edit'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import MissionControl from './MissionControl'
import StudioUser from './StudioUser'

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

interface ConcourseProps {
  controls: JSX.Element[]
  layerChildren: any[]
  titleSpalshData?: { enable: boolean; title?: string }
  studioUserConfig?: StudioUserConfig[]
  disableUserMedia?: boolean
  topLayerChildren?: any[]
}

export const CONFIG = {
  width: 960,
  height: 540,
}

const Concourse = ({
  controls,
  layerChildren,
  titleSpalshData,
  studioUserConfig,
  disableUserMedia,
  topLayerChildren,
}: ConcourseProps) => {
  const {
    state,
    stream,
    participants,
    payload,
    getBlobs,
    users,
    stopRecording,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(false)
  const [isZooming, setZooming] = useState(false)

  const { sub, picture } = (useRecoilValue(userState) as User) || {}

  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const groupRef = createRef<Konva.Group>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

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

  const handleZoom = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    if (!stageRef.current) return
    const oldScale = stageRef.current.scaleX()
    const pointer = stageRef.current.getPointerPosition()

    if (!pointer || !oldScale) return

    const mousePointTo = {
      x: (pointer.x - stageRef.current.x()) / oldScale,
      y: (pointer.y - stageRef.current.y()) / oldScale,
    }

    const scaleBy = 1.01
    let newScale = 1
    if (e.evt.deltaY > 0) {
      newScale = oldScale / scaleBy > 1 ? oldScale / scaleBy : 1
    } else {
      newScale = oldScale * scaleBy > 4 ? 4 : oldScale * scaleBy
    }

    stageRef.current.scale({ x: newScale, y: newScale })

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    stageRef.current.position(newPos)
  }

  const onLayerClick = () => {
    if (!stageRef.current || !groupRef.current || !canvas?.zoomed) return
    const tZooming = isZooming
    if (tZooming) {
      groupRef.current.x(0)
      groupRef.current.y(0)
      groupRef.current.scale({ x: 1, y: 1 })
    } else {
      const pointer = stageRef.current.getPointerPosition()
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
    if (!stageRef.current) return
    stageRef.current.position({ x: 0, y: 0 })
    stageRef.current.scale({ x: 1, y: 1 })
    onMouseLeave()
  }
  const TitleSplash = () => {
    return (
      <>
        <Group
          x={0}
          y={0}
          name="titleSplash"
          draggable
          width={CONFIG.width}
          height={CONFIG.height}
          ref={(ref) =>
            ref?.to({
              duration: 3,
              onFinish: () => {
                setIsTitleSplash(false)
              },
            })
          }
        >
          <Rect fill="#1F2937" width={CONFIG.width} height={CONFIG.height} />
          <Rect
            fillLinearGradientColorStops={[0, '#4ADE80', 1, '#16A34A']}
            fillLinearGradientStartPoint={{ x: 0, y: CONFIG.height / 2 - 120 }}
            fillLinearGradientEndPoint={{
              x: CONFIG.width,
              y: CONFIG.height / 2 + 120,
            }}
            y={CONFIG.height / 2 - 120}
            width={CONFIG.width}
            height={240}
          />
          <Text
            x={0}
            y={540 / 2 - 30}
            width={960}
            height={80}
            text={titleSpalshData && titleSpalshData.title}
            fill="#ffffff"
            textTransform="capitalize"
            fontStyle="normal 700"
            fontFamily="Poppins"
            fontSize={60}
            align="center"
          />
        </Group>
      </>
    )
  }

  const performFinishAction = () => {
    stopRecording()
  }

  useEffect(() => {
    setCanvas({ zoomed: false, resetCanvas })
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    titleSpalshData?.enable &&
      (payload?.status === Fragment_Status_Enum_Enum.Live
        ? setIsTitleSplash(true)
        : setIsTitleSplash(false))
  }, [titleSpalshData, state, payload?.status])

  return (
    <div className="flex-1 mt-4 justify-between items-stretch flex">
      <div className="bg-gray-100 flex-1 rounded-md p-4 flex justify-center items-center mr-8">
        {state === 'ready' || state === 'recording' || state === 'countDown' ? (
          <Stage
            ref={stageRef}
            height={CONFIG.height}
            width={CONFIG.width}
            className={cx({
              'cursor-zoom-in': canvas?.zoomed && !isZooming,
              'cursor-zoom-out': canvas?.zoomed && isZooming,
            })}
          >
            <Bridge>
              <Layer ref={layerRef} onMouseLeave={onMouseLeave}>
                <Rect
                  x={0}
                  y={0}
                  width={CONFIG.width}
                  height={CONFIG.height}
                  fill="#202026"
                  cornerRadius={8}
                />
                <Group ref={groupRef} onClick={onLayerClick}>
                  {(() => {
                    if (
                      payload?.status === Fragment_Status_Enum_Enum.CountDown
                    ) {
                      return (
                        <Rect
                          x={0}
                          y={0}
                          width={CONFIG.width}
                          height={CONFIG.height}
                          fill="#202026"
                          cornerRadius={8}
                        />
                      )
                    }
                    if (payload?.status === Fragment_Status_Enum_Enum.Live) {
                      layerRef.current?.destroyChildren()
                      if (titleSpalshData?.enable && isTitleSplash) {
                        return (
                          <>
                            <TitleSplash />
                            <CircleCenterShrink color="#000000" />
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
                  payload?.status !== Fragment_Status_Enum_Enum.Ended && (
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
                            (studioUserConfig &&
                              studioUserConfig[index + 1]) || {
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
                  )}
                <Group>{topLayerChildren}</Group>
              </Layer>
            </Bridge>
          </Stage>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="w-8/12 rounded-md"
            controls
            ref={async (ref) => {
              if (!ref || !getBlobs) return
              const blob = await getBlobs()
              const url = window.URL.createObjectURL(blob)
              // eslint-disable-next-line no-param-reassign
              ref.src = url
            }}
          />
        )}
      </div>

      <MissionControl controls={controls} />
    </div>
  )
}

export default Concourse
