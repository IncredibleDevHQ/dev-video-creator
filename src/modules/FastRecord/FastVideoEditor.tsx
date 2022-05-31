/* eslint-disable no-restricted-globals */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable consistent-return */
/* eslint-disable react/no-this-in-sfc */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable func-names */
// eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events  */

import { cx } from '@emotion/css'
import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react'
import { BiPause, BiPlay, BiTrim } from 'react-icons/bi'
import { FiLoader, FiScissors } from 'react-icons/fi'
import { IoCropSharp } from 'react-icons/io5'
import { Group, Image, Layer, Rect, Stage, Transformer } from 'react-konva'
import useImage from 'use-image'
import { v4 as uuidv4 } from 'uuid'
import { ASSETS } from '../../constants'
import { logEvent, logPage } from '../../utils/analytics'
import { PageCategory, PageEvent, PageTitle } from '../../utils/analytics-types'

type Size = {
  width: number
  height: number
}

type Coordinates = {
  x: number
  y: number
  width: number
  height: number
}

interface Clip {
  start?: number
  end?: number
  change?: 'start' | 'end'
}

export interface Transformations {
  crop?: Coordinates
  clip?: Clip
}

export interface VideoConfig {
  id: string
  start: number
  end: number
  duration: number
  thumbnail?: string
  transformations: Transformations
}

export interface EditorProps {
  url: string
  width: number
  totalDuration: number
  videosConfig: VideoConfig[]
  activeVideoConfig: VideoConfig
  saving: boolean
  setActiveVideoConfig: (videoConfig: VideoConfig) => void
  setVideosConfig: (videosConfig: VideoConfig[]) => void
}

const convertTimeToPx = ({
  width,
  duration,
  marker,
}: {
  width: number
  duration: number
  marker: number
}) => {
  return (marker / duration) * width
}

const convertPxToTime = ({
  width,
  duration,
  x,
}: {
  x: number
  width: number
  duration: number
}) => {
  return +((x / width) * duration)
}

const getAspectDimension = (
  videoElement: HTMLVideoElement,
  valueType: 'width' | 'height',
  value: number
) => {
  return valueType === 'height'
    ? value * (videoElement.videoHeight / videoElement.videoWidth)
    : value * (videoElement.videoWidth / videoElement.videoHeight)
}

const formattedTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secondsLeft = Math.floor(seconds % 60)
  if (isNaN(secondsLeft)) return '00:00'
  if (isNaN(minutes)) return `00:${secondsLeft}`
  return `${minutes < 10 ? `0${minutes}` : minutes}:${
    secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft
  }`
}

export const VideoCanvas = ({
  size,
  crop,
  underlay,
  videoElement,
}: {
  size: Size
  crop?: Coordinates
  underlay?: boolean
  videoElement: HTMLVideoElement
}) => {
  const imageRef = React.useRef<Konva.Image>(null)

  useEffect(() => {
    // @ts-ignore
    const layer = imageRef.current?.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    return () => {
      anim.stop()
    }
  }, [])

  return (
    <Group clip={crop}>
      <Image
        ref={imageRef}
        image={videoElement}
        width={size.width}
        height={size.height}
      />
      {underlay && (
        <Rect
          width={size.width}
          height={size.height}
          fill="#000"
          opacity={0.8}
        />
      )}
    </Group>
  )
}

const DarkButton = ({
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      className={cx('rounded-sm text-gray-300 bg-gray-700 p-2', className)}
      {...rest}
    />
  )
}

// A conversion utility for clip values (px <-> %)
export const convertTo = (
  unit: 'px' | '%',
  size: Size,
  value: Coordinates
): Coordinates => {
  if (unit === 'px') {
    return {
      x: value.x * size.width,
      y: value.y * size.height,
      width: value.width * size.width,
      height: value.height * size.height,
    }
  }

  return {
    x: value.x / size.width,
    y: value.y / size.height,
    width: value.width / size.width,
    height: value.height / size.height,
  }
}

const Marker = ({
  marker,
  duration,
  scrubberSize,
  handleUpdateMarker,
}: {
  marker: number
  duration: number
  scrubberSize: { width?: number; height?: number }
  handleUpdateMarker?: (currentTime: number) => void
}) => {
  const mainRectRef = useRef<Konva.Rect | null>()
  const markerRef = useRef<Konva.Image | null>()
  const [pin] = useImage(ASSETS.ICONS.PIN)

  return (
    <Group>
      <Rect
        fill="#D1D5DB"
        ref={(ref) => {
          mainRectRef.current = ref
        }}
        cornerRadius={8}
        width={scrubberSize.width}
        height={scrubberSize.height}
        opacity={0.5}
      />
      <Image
        image={pin}
        height={scrubberSize.height ? scrubberSize.height + 30 : 6}
        width={16}
        draggable
        y={-20}
        ref={(ref) => {
          markerRef.current = ref
        }}
        x={
          convertTimeToPx({
            marker,
            duration,
            width: scrubberSize.width as number,
          }) - 8
        }
        dragBoundFunc={function (pos) {
          const mainAreaRect = mainRectRef.current!.getClientRect()

          if (!this)
            return {
              x: pos.x,
              y: pos.y,
            }

          let actualMarkerPosition = pos.x + this.width() / 2

          actualMarkerPosition =
            actualMarkerPosition < mainAreaRect.width + mainAreaRect.x
              ? actualMarkerPosition
              : mainAreaRect.width + mainAreaRect.x - this.width() / 2

          actualMarkerPosition =
            actualMarkerPosition > mainAreaRect.x
              ? actualMarkerPosition
              : mainAreaRect.x - this.width() / 2

          handleUpdateMarker?.(
            convertPxToTime({
              x: actualMarkerPosition + this.width() / 2,
              duration,
              width: scrubberSize.width as number,
            })
          )

          return {
            x: actualMarkerPosition,
            y: this.absolutePosition().y,
          }
        }}
      />
    </Group>
  )
}

const Scrubber = ({
  duration,
  start,
  end,
  handleChange,
  scrubberSize = { width: 320, height: 40 },
}: {
  scrubberSize: { width?: number; height?: number }
  duration: number
  start?: number
  end?: number
  handleChange?: (props: {
    start: number
    end: number
    change: 'start' | 'end'
  }) => void
}) => {
  const mainRectRef = useRef<Konva.Rect | null>()
  const leftHandleRef = useRef<Konva.Rect | null>()
  const rightHandleRef = useRef<Konva.Rect | null>()
  const scrubAreaRectRef = useRef<Konva.Rect | null>()

  const [trim] = useState<{ start: number; end: number }>({
    end: end || duration,
    start: start || 0,
  })

  useEffect(() => {
    if (!leftHandleRef.current) return

    handleMove('start')
  }, [leftHandleRef])

  useEffect(() => {
    if (!rightHandleRef.current) return

    handleMove('end')
  }, [rightHandleRef])

  const handleMove = (type: 'start' | 'end') => {
    const left = leftHandleRef.current!.getClientRect()
    const right = rightHandleRef.current!.getClientRect()
    const main = mainRectRef.current!.getClientRect()

    scrubAreaRectRef.current!.setPosition({
      x: left.x - main.x + left.width / 2,
      y: 0,
    })

    scrubAreaRectRef.current!.setSize({
      width: right.x - left.x,
      height: scrubberSize.height,
    })

    const rect = scrubAreaRectRef.current!.getClientRect()

    // -1 because of stroke width of 2px
    const start = convertPxToTime({
      width: scrubberSize.width as number,
      duration,
      x: rect.x - main.x + 1,
    })
    const end = convertPxToTime({
      width: scrubberSize.width as number,
      duration,
      x: rect.width + rect.x - main.x - 1,
    })

    handleChange?.({
      start,
      end,
      change: type,
    })
  }

  return (
    <Group>
      <Rect
        fill="#D1D5DB"
        ref={(ref) => {
          mainRectRef.current = ref
        }}
        cornerRadius={8}
        width={scrubberSize.width}
        height={scrubberSize.height}
        opacity={0.5}
      />

      <Rect
        fill="#f3f4f6"
        stroke="#16A34A"
        opacity={0.5}
        strokeWidth={2}
        cornerRadius={8}
        ref={(ref) => {
          scrubAreaRectRef.current = ref
        }}
      />

      <Rect
        id="left-handle"
        ref={(ref) => {
          leftHandleRef.current = ref
        }}
        dragBoundFunc={function (pos) {
          const mainRect = mainRectRef.current!.getClientRect()
          const rightHandleRect = rightHandleRef.current!.getClientRect()

          // Should be more than left bounds...
          let newX = Math.max(pos.x, mainRect.x - this.width() / 2)

          // Should be less than right handle...
          newX = Math.min(newX, rightHandleRect.x - rightHandleRect.width / 2)

          return {
            x: newX,
            y: this.absolutePosition().y,
          }
        }}
        fill="#4b5563"
        opacity={0.7}
        draggable
        cornerRadius={6}
        x={
          convertTimeToPx({
            width: scrubberSize.width as number,
            duration,
            marker: trim.start || 0,
          }) - 10
        }
        width={20}
        height={20}
        y={10}
        onDragMove={() => handleMove('start')}
      />
      <Rect
        x={
          convertTimeToPx({
            width: scrubberSize.width as number,
            duration,
            marker: trim.end,
          }) - 10
        }
        id="right-handle"
        // eslint-disable-next-line no-return-assign
        ref={(ref) => (rightHandleRef.current = ref)}
        dragBoundFunc={function (pos) {
          const mainRect = mainRectRef.current!.getClientRect()
          const leftHandleRect = leftHandleRef.current!.getClientRect()

          // Should be less than right bounds...
          let newX = Math.min(
            pos.x,
            mainRect.width + mainRect.x - this.width() / 2
          )

          // Should be more than left handle...
          newX = Math.max(newX, leftHandleRect.x + leftHandleRect.width / 2)

          return {
            x: newX,
            y: this.absolutePosition().y,
          }
        }}
        fill="#4b5563"
        opacity={0.7}
        draggable
        cornerRadius={6}
        width={20}
        height={20}
        y={10}
        onDragMove={() => handleMove('end')}
      />
    </Group>
  )
}

const FastVideoEditor = ({
  url,
  width,
  videosConfig,
  totalDuration,
  saving,
  setVideosConfig,
  activeVideoConfig,
  setActiveVideoConfig,
}: EditorProps) => {
  const { transformations } = activeVideoConfig
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const [mode, setMode] = React.useState<'crop' | 'trim' | 'split' | null>(
    'trim'
  )
  const [crop, setCrop] = React.useState<Coordinates>({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
  })

  const [clip, setClip] = React.useState<Clip>(transformations?.clip || {})
  const [time, setTime] = useState(transformations?.clip?.start || 0)
  const [playing, setPlaying] = useState(false)
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  })
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape'
  )

  const layerRef = React.useRef<Konva.Layer | null>(null)
  const stageRef = React.useRef<Konva.Stage | null>(null)
  const transformerRectRef = React.useRef<Konva.Rect | null>(null)
  const transformerRef = React.useRef<Konva.Transformer | null>(null)

  const saveCrop = () => {
    setActiveVideoConfig({
      ...activeVideoConfig,
      transformations: {
        ...activeVideoConfig.transformations,
        crop: convertTo('%', size, crop),
      },
    })
  }

  const saveClip = () => {
    setActiveVideoConfig({
      ...activeVideoConfig,
      transformations: {
        ...activeVideoConfig.transformations,
        clip,
      },
    })
  }

  useEffect(() => {
    if (!activeVideoConfig.transformations.clip) return
    setClip(activeVideoConfig.transformations.clip)
  }, [activeVideoConfig.transformations.clip])

  useEffect(() => {
    if (!activeVideoConfig.transformations.crop || !size.width || !size.height)
      return
    setCrop(convertTo('px', size, activeVideoConfig.transformations.crop))
  }, [activeVideoConfig.transformations.crop])

  useEffect(() => {
    if (mode === 'crop') {
      if (!transformerRectRef.current) return
      transformerRef.current?.nodes([transformerRectRef.current])
      transformerRef.current?.getLayer()?.batchDraw()
    }

    // eslint-disable-next-line consistent-return
    return () => {
      transformerRef.current?.detach()
    }
  }, [mode])

  const getImageFromCanvas = () => {
    if (!stageRef.current) return
    return stageRef.current.toDataURL({
      pixelRatio: 3,
      ...crop,
      width: size.width,
      height: size.height,
    })
  }

  const addSplitVideoConfig = (time: number) => {
    const tempVideosConfig = [...videosConfig]
    tempVideosConfig.push({
      id: uuidv4(),
      start: time,
      end: activeVideoConfig.end,
      duration: activeVideoConfig.end - time,
      transformations: {
        ...activeVideoConfig.transformations,
        clip: {
          ...activeVideoConfig.transformations.clip,
          start: time,
          end: activeVideoConfig.end,
        },
      },
    })

    const index = tempVideosConfig.findIndex(
      (video) => video.id === activeVideoConfig.id
    )
    if (index !== -1) {
      tempVideosConfig[index] = {
        ...activeVideoConfig,
        end: time,
        duration: time - activeVideoConfig.start,
      }
    }
    setVideosConfig(tempVideosConfig)
  }

  const cb = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time || 0.1

    // const url = getImageFromCanvas()
    // setActiveVideoConfig({ ...activeVideoConfig, thumbnail: url })

    const orientation =
      videoRef.current.videoWidth > videoRef.current.videoHeight
        ? 'landscape'
        : 'portrait'

    setOrientation(orientation)

    let height = videoRef.current.videoHeight
    if (orientation === 'landscape') {
      height = getAspectDimension(videoRef.current, 'height', width)
      setSize({
        height,
        width,
      })
    } else {
      height = getAspectDimension(videoRef.current, 'height', width / 2.5)
      setSize({
        height,
        width: width / 2.5,
      })
    }

    const crop = convertTo(
      'px',
      { height, width },
      transformations?.crop || {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
      }
    )

    setCrop(crop)
  }

  useEffect(() => {
    const video = document.createElement('video')
    video.src = url
    videoRef.current = video
  }, [url, width])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.addEventListener('loadedmetadata', cb)
    videoRef.current.addEventListener('timeupdate', (e) => {
      // @ts-ignore
      setTime(e.target.currentTime)
    })

    return () => {
      videoRef.current?.removeEventListener('loadedmetadata', cb)
    }
  }, [videoRef])

  useEffect(() => {
    if (videoRef.current && clip.start && clip.end) {
      if (time > clip.end || time < clip.start) {
        setPlaying(false)
        videoRef.current.pause()
      }
      if (time === videoRef.current.duration) {
        setPlaying(false)
        videoRef.current.currentTime = 0
        setTime(0)
      }
    }
  }, [time])

  useEffect(() => {
    // Segment Tracking
    logPage(PageCategory.Studio, PageTitle.VideoEditor)
  }, [])

  if (!videoRef.current) return null

  return (
    <div className="my-auto flex flex-col w-full h-full items-center justify-between rounded-md relative">
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div
          className="absolute bottom-4 left-1/2 z-10 flex flex-col justify-end"
          style={{ transform: 'translate(-50%)' }}
        >
          <DarkButton
            className="flex"
            onClick={() => {
              if (!videoRef.current) return
              if (playing) {
                videoRef.current.pause()
                setPlaying(false)
              } else {
                videoRef.current.currentTime = clip.start || 0
                videoRef.current.play()
                setPlaying(true)
              }
            }}
          >
            {playing ? <BiPause size={24} /> : <BiPlay size={24} />}
            <p className="ml-1">
              {formattedTime(videoRef.current?.currentTime || 0)} /{' '}
              {formattedTime(totalDuration || 0)}
            </p>
          </DarkButton>
        </div>
        <Stage ref={stageRef} {...size}>
          <Layer ref={layerRef}>
            <VideoCanvas underlay size={size} videoElement={videoRef.current} />
            <Group clip={crop}>
              <VideoCanvas
                crop={crop}
                size={size}
                videoElement={videoRef.current}
              />
            </Group>

            {mode === 'crop' && (
              <>
                <Rect
                  x={crop.x || 0}
                  y={crop.y || 0}
                  width={crop.width || size.width}
                  height={crop.height || size.height}
                  ref={transformerRectRef}
                  onTransform={() => {
                    const node = transformerRectRef.current
                    if (!node) return
                    const scaleX = node.scaleX()
                    const scaleY = node.scaleY()

                    node.scaleX(1)
                    node.scaleY(1)

                    setCrop({
                      x: node.x(),
                      y: node.y(),
                      // set minimal value
                      width: Math.max(40, node.width() * scaleX),
                      height: Math.max(40, node.height() * scaleY),
                    })
                  }}
                />
                <Transformer
                  ref={transformerRef}
                  anchorFill="#16A34A"
                  anchorSize={6}
                  borderStroke="#16A34A"
                  borderStrokeWidth={1}
                  rotateEnabled={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    const box = newBox

                    // minimum dimensions = 40...
                    box.width = Math.max(40, box.width)
                    box.height = Math.max(40, box.height)

                    // check if the new box is out of bounds
                    if (box.x < 0) {
                      // if it is, set the width to the current width + the difference
                      box.width += box.x
                      // and set the x to 0
                      box.x = 0
                    }

                    if (box.y < 0) {
                      box.height += box.y
                      box.y = 0
                    }

                    if (box.x + box.width > size.width) {
                      box.width = size.width - box.x
                    }

                    if (box.y + box.height > size.height) {
                      box.height = size.height - box.y
                    }

                    return box
                  }}
                />
              </>
            )}
          </Layer>
        </Stage>
      </div>

      <div
        className="flex items-center justify-between pt-3"
        style={{
          width: size.width,
        }}
      >
        <div className="grid grid-cols-3 gap-x-3 text-sm">
          <p
            className={cx('cursor-pointer', {
              'text-gray-800': mode === 'split',
              'text-gray-400': mode !== 'split',
            })}
            onClick={() => {
              setMode(mode === 'split' ? null : 'split')
            }}
          >
            Split
          </p>
          <p
            className={cx('cursor-pointer', {
              'text-gray-800': mode === 'crop',
              'text-gray-400': mode !== 'crop',
            })}
            onClick={() => {
              logEvent(PageEvent.CropVideo)
              setMode(mode === 'crop' ? null : 'crop')
            }}
          >
            Crop
          </p>
          <p
            className={cx('cursor-pointer', {
              'text-gray-800': mode === 'trim',
              'text-gray-400': mode !== 'trim',
            })}
            onClick={() => {
              logEvent(PageEvent.TrimVideo)
              setMode(mode === 'trim' ? null : 'trim')
            }}
          >
            Trim
          </p>
        </div>
        <div>
          {mode === 'split' && (
            <button
              style={{
                minWidth: '112px',
              }}
              type="button"
              className="text-sm bg-dark-500 hover:bg-dark-100 active:bg-dark-300 text-white py-2 px-2 rounded-md cursor-pointer flex items-center justify-center h-9 min-w-max"
              onClick={() => {
                addSplitVideoConfig(time)
              }}
            >
              {saving && <FiLoader className="animate-spin" />}
              {!saving && (
                <>
                  <FiScissors className="mr-2" /> Split at {formattedTime(time)}
                </>
              )}
            </button>
          )}
          {mode === 'trim' && (
            <button
              type="button"
              className="text-sm bg-dark-500 hover:bg-dark-100 active:bg-dark-400 text-white py-2 px-2 rounded-md cursor-pointer flex items-center justify-center h-9 w-28"
              onClick={() => {
                saveClip()
              }}
            >
              {saving && <FiLoader className="animate-spin" />}
              {!saving && (
                <>
                  <BiTrim className="mr-2" /> Save trim
                </>
              )}
            </button>
          )}
          {mode === 'crop' && (
            <button
              type="button"
              className="text-sm bg-dark-500 hover:bg-dark-100 active:bg-dark-400 text-white py-2 px-2 rounded-md cursor-pointer flex items-center items-center justify-center h-9 w-28"
              onClick={() => {
                saveCrop()
              }}
            >
              {saving && <FiLoader className="animate-spin" />}
              {!saving && (
                <>
                  <IoCropSharp className="mr-2" /> Save crop
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div>
        <Stage height={100} width={size.width}>
          <Layer>
            {size.width > 0 && mode === 'trim' && (
              <Group y={30} x={0}>
                <Scrubber
                  scrubberSize={{
                    width: size.width,
                    height: 40,
                  }}
                  handleChange={(trim) => {
                    if (trim.change === 'start')
                      videoRef.current!.currentTime = trim.start
                    else if (trim.change === 'end') {
                      videoRef.current!.currentTime = trim.end
                    }
                    setClip(() => trim)
                  }}
                  duration={totalDuration}
                  {...clip}
                />
              </Group>
            )}

            {size.width > 0 && mode === 'split' && (
              <Group y={30} x={0}>
                <Marker
                  scrubberSize={{
                    width: size.width,
                    height: 40,
                  }}
                  handleUpdateMarker={(time) => {
                    videoRef.current!.currentTime = time
                    setTime(time)
                  }}
                  duration={totalDuration}
                  marker={time}
                />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

export default FastVideoEditor
