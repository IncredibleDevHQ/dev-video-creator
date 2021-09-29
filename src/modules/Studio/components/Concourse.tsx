import React, { createRef, useEffect, useRef, useState } from 'react'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilState,
  useRecoilValue,
} from 'recoil'
import { cx } from '@emotion/css'
import Konva from 'konva'
import { Stage, Layer, Rect, Group, Text, Circle } from 'react-konva'
import { KonvaEventObject } from 'konva/lib/Node'
import MissionControl from './MissionControl'
import StudioUser from './StudioUser'
import { canvasStore, StudioProviderProps, studioStore } from '../stores'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import {
  CircleCenterShrink,
  MultiCircleCenterGrow,
} from '../effects/FragmentTransitions'
import { ClipConfig } from '../hooks/use-edit'
import { User, userState } from '../../../stores/user.store'

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
  disableUserMedia?: boolean
  titleSpalshData?: { enable: boolean; title?: string }
  studioUserConfig?: StudioUserConfig[]
}

export const CONFIG = {
  width: 960,
  height: 540,
}

const Concourse = ({
  controls,
  layerChildren,
  disableUserMedia,
  titleSpalshData,
  studioUserConfig,
}: ConcourseProps) => {
  const {
    state,
    tracks,
    payload,
    getBlobs,
    users,
    isHost,
    stopRecording,
    startRecording,
    updatePayload,
    constraints,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [canvas, setCanvas] = useRecoilState(canvasStore)
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isZooming, setZooming] = useState(false)

  const { sub } = (useRecoilValue(userState) as User) || {}

  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  const [timer, setTimer] = useState<number>(3)

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
    if (!stageRef.current || !layerRef.current || !canvas?.zoomed) return
    const tZooming = isZooming
    if (tZooming) {
      layerRef.current.x(0)
      layerRef.current.y(0)
      layerRef.current.scale({ x: 1, y: 1 })
    } else {
      const pointer = stageRef.current.getPointerPosition()
      if (pointer) {
        layerRef.current.x(-pointer.x)
        layerRef.current.y(-pointer.y)
      }
      layerRef.current.scale({ x: zoomLevel, y: zoomLevel })
    }
    setZooming(!isZooming)
  }

  const onMouseLeave = () => {
    if (!layerRef.current) return
    layerRef.current.x(0)
    layerRef.current.y(0)
    layerRef.current.scale({ x: 1, y: 1 })
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
          zIndex={100}
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
    if (state === 'ready') setTimer(3)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    titleSpalshData?.enable &&
      (payload?.status === Fragment_Status_Enum_Enum.Live
        ? setIsTitleSplash(true)
        : setIsTitleSplash(false))
  }, [titleSpalshData, state, payload?.status])

  useEffect(() => {
    const local =
      tracks && tracks?.length > 0
        ? new MediaStream([
            tracks?.[0].getMediaStreamTrack?.(),
            tracks?.[1].getMediaStreamTrack?.(),
          ])
        : null
    setLocalStream(local)
  }, [constraints?.video, constraints?.audio])

  return (
    <div className="flex-1 mt-4 justify-between items-stretch flex">
      <div className="bg-gray-100 flex-1 rounded-md p-4 flex justify-center items-center mr-8">
        {state === 'ready' || state === 'recording' || state === 'countDown' ? (
          <Stage
            ref={stageRef}
            height={CONFIG.height}
            width={CONFIG.width}
            onClick={onLayerClick}
            className={cx({
              'cursor-zoom-in': canvas?.zoomed && !isZooming,
              'cursor-zoom-out': canvas?.zoomed && isZooming,
            })}
          >
            <Bridge>
              <Layer
                ref={layerRef}
                // onMouseEnter={onMouseEnter}
                // onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
              >
                <Rect
                  x={0}
                  y={0}
                  width={CONFIG.width}
                  height={CONFIG.height}
                  fill="#202026"
                  cornerRadius={8}
                />

                {(() => {
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
                    // if (!titleSpalshData?.enable && !isTitleSplash) {
                    //   setIsTitleSplash(true)
                    //   return <CircleCenterShrink />
                    // }
                  }
                  if (payload?.status === Fragment_Status_Enum_Enum.Ended)
                    return (
                      <MultiCircleCenterGrow
                        performFinishAction={performFinishAction}
                      />
                    )
                  return layerChildren
                })()}

                {!disableUserMedia &&
                  !isTitleSplash &&
                  payload?.status !== Fragment_Status_Enum_Enum.Ended && (
                    <>
                      <StudioUser
                        stream={localStream}
                        studioUserConfig={
                          (studioUserConfig && studioUserConfig[0]) ||
                          defaultStudioUserConfig
                        }
                        type="local"
                        uid={sub as string}
                      />
                      {users.map((user, index) => (
                        <StudioUser
                          key={user.uid as string}
                          uid={user.uid as string}
                          type="remote"
                          stream={user.mediaStream as MediaStream}
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
                {timer >= 0 &&
                  (state === 'countDown' ||
                    payload?.status ===
                      Fragment_Status_Enum_Enum.CountDown) && (
                    <Group
                      x={0}
                      y={0}
                      key="group1"
                      width={CONFIG.width}
                      height={CONFIG.height}
                      zIndex={500}
                    >
                      <Circle
                        x={CONFIG.width / 2}
                        y={CONFIG.height / 2}
                        radius={CONFIG.width / 6}
                        fill="#000000"
                        opacity={0.5}
                      />
                      <Text
                        align="center"
                        verticalAlign="middle"
                        fontFamily="Poppins"
                        fontSize={100}
                        fill="#ffffff"
                        width={CONFIG.width / 2}
                        height={CONFIG.height / 2 + 25}
                        scaleX={2}
                        scaleY={2}
                        text={timer === 0 ? 'Go' : `${timer}`}
                        ref={(ref) => {
                          ref?.to({
                            duration: 1,
                            opacity: 1,
                            onFinish: () => {
                              setTimer(timer - 1)
                              if (timer === 0) {
                                startRecording()
                                updatePayload?.({
                                  status: Fragment_Status_Enum_Enum.Live,
                                })
                              }
                            },
                          })
                        }}
                      />
                    </Group>
                  )}
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

Concourse.defaultProps = {
  disableUserMedia: undefined,
}

export default Concourse
