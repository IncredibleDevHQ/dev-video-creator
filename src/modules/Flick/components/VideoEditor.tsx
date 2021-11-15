// eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events  */

import Konva from 'konva'
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react'
import { cx } from '@emotion/css'
import { BiPause, BiPlay } from 'react-icons/bi'
import {
  Group,
  Image as KonvaImage,
  Layer,
  Stage,
  Rect,
  Transformer,
} from 'react-konva'
import trim from '../../../assets/trim.svg'
import cropIcon from '../../../assets/crop-outline.svg'

const getAspectDimension = (
  videoElement: HTMLVideoElement,
  valueType: 'width' | 'height',
  value: number
) => {
  return valueType === 'height'
    ? value * (videoElement.videoHeight / videoElement.videoWidth)
    : value * (videoElement.videoWidth / videoElement.videoHeight)
}

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

export const VideoCanvas = ({
  videoElement,
  size,
  underlay,
  crop,
}: {
  videoElement: HTMLVideoElement
  size: Size
  underlay?: boolean
  crop?: Coordinates
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
      <KonvaImage
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

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  time: number
  handleTimeChange?: (time: number) => void
  duration: number
  trimmer?: boolean
  clip?: Clip
  setClip?: (clip: Clip) => void
}

interface Clip {
  start?: number
  end?: number
}

const Progress = ({
  time,
  handleTimeChange,
  duration,
  className,
  clip,
  setClip,
  trimmer,
  ...rest
}: ProgressProps) => {
  const progressRef = useRef<HTMLDivElement | null>(null)

  const cb = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // @ts-ignore
    const rect = progressRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    // @ts-ignore
    const width = progressRef.current?.clientWidth
    // @ts-ignore
    const time = (x / width) * duration
    // @ts-ignore
    handleTimeChange(time)
  }

  const handleClip = (
    handle: 'left' | 'right',
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    // @ts-ignore
    const rect = progressRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    // @ts-ignore
    const width = progressRef.current?.clientWidth
    // @ts-ignore
    let time = (x / width) * duration

    if (handle === 'left' && time > (clip?.end || duration)) {
      return
    }

    if (handle === 'right' && time < (clip?.start || 0)) {
      return
    }

    if (handle === 'left' && time < 0) {
      time = 0
    }

    if (handle === 'right' && time > duration) {
      time = duration
    }

    if (clip) {
      setClip?.(
        handle === 'left' ? { ...clip, start: time } : { ...clip, end: time }
      )
    }
  }

  if (trimmer) {
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        ref={progressRef}
        // onClick={cb}
        className={cx('relative overflow-hidden', className)}
        {...rest}
      >
        <div
          className="bg-brand absolute inset-0"
          // style={{ maxWidth: `${(time * 100) / duration}%` }}
        >
          <span
            draggable
            onDragStart={(e) => {
              const img = new Image()
              img.src =
                'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
              e.dataTransfer.setDragImage(img, 0, 0)
            }}
            onDrag={(e) => {
              // @ts-ignore
              handleClip('left', e)
            }}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            style={{
              left: clip?.start ? `${(clip?.start * 100) / duration}%` : 0,
            }}
            className="h-full w-1 bg-white absolute rounded-l-md cursor-pointer"
          />
          <span
            draggable
            onDragStart={(e) => {
              const img = new Image()
              img.src =
                'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
              e.dataTransfer.setDragImage(img, 0, 0)
            }}
            onDrag={(e) => {
              // @ts-ignore
              handleClip('right', e)
            }}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            style={{
              // eslint-disable-next-line no-nested-ternary
              left: clip?.end
                ? clip?.end === duration
                  ? // @ts-ignore
                    progressRef.current?.clientWidth - 4
                  : `${(clip?.end * 100) / duration}%`
                : // @ts-ignore
                  progressRef.current?.clientWidth - 4,
            }}
            className="h-full w-1 bg-white absolute right-0 rounded-r-md cursor-pointer"
          />
        </div>
      </div>
    )
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={progressRef}
      onClick={cb}
      className={cx('relative overflow-hidden cursor-pointer', className)}
      {...rest}
    >
      {clip?.start && clip?.end && (
        <span
          className="bg-white rounded-md opacity-60 absolute inset-0"
          style={{
            left: `${(clip.start * 100) / duration}%`,
            maxWidth: `${((clip.end - clip.start) * 100) / duration}%`,
          }}
        />
      )}
      {clip?.start && clip.end ? (
        <span
          className="bg-brand absolute rounded-md inset-0"
          style={{
            maxWidth: `${((time - clip.start) * 100) / duration}%`,
            left: `${((clip?.start || 0) * 100) / duration}%`,
          }}
        />
      ) : (
        <span
          className="bg-brand absolute rounded-md inset-0"
          style={{
            maxWidth: `${(time * 100) / duration}%`,
          }}
        />
      )}
    </div>
  )
}

export interface Transformations {
  crop?: Coordinates
  clip?: Clip
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

export interface EditorProps {
  url: string
  width: number
  transformations?: Transformations
  handleAction?: (transformations: Transformations) => void
  action: string
}

const VideoEditor = ({
  url,
  width,
  transformations,
  handleAction,
  action,
}: EditorProps) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const [mode, setMode] = React.useState<'crop' | 'trim' | null>(null)
  const [crop, setCrop] = React.useState<Coordinates>(
    transformations?.crop || {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
  )
  const [clip, setClip] = React.useState<Clip>(transformations?.clip || {})

  const layerRef = React.useRef<Konva.Layer | null>(null)
  const transformerRectRef = React.useRef<Konva.Rect | null>(null)
  const transformerRef = React.useRef<Konva.Transformer | null>(null)

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

  useEffect(() => {
    const cb = () => {
      if (!videoRef.current) return
      const height = getAspectDimension(videoRef.current, 'height', width)
      //   videoRef.current.play()
      videoRef.current.currentTime = time
      videoRef.current.controls = true

      setSize({
        height,
        width,
      })

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
    const video = document.createElement('video')
    video.src = url
    videoRef.current = video

    video.addEventListener('loadedmetadata', cb)
    video.addEventListener('timeupdate', (e) => {
      // @ts-ignore
      setTime(e.target.currentTime)
    })

    return () => {
      video.removeEventListener('loadedmetadata', cb)
    }
  }, [url, width])

  const [size, setSize] = useState({
    width: 0,
    height: 0,
  })

  const [time, setTime] = useState(transformations?.clip?.start || 0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (videoRef.current && clip.start && clip.end) {
      if (time > clip.end || time < clip.start) {
        setPlaying(false)
        videoRef.current.pause()
      }
    }
  }, [time])

  return (
    <div className="flex items-center justify-center flex-col rounded-md">
      <div>
        <Stage {...size}>
          <Layer ref={layerRef}>
            {videoRef.current && (
              <>
                <VideoCanvas
                  underlay
                  size={size}
                  videoElement={videoRef.current}
                />
                <Group clip={crop}>
                  <VideoCanvas
                    crop={crop}
                    size={size}
                    videoElement={videoRef.current}
                  />
                </Group>
              </>
            )}
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
              anchorFill="white"
              anchorSize={10}
              borderStroke="white"
              borderStrokeWidth={3}
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
          </Layer>
        </Stage>
      </div>

      <div
        className="bg-gray-600 px-4 pt-3 gap-x-4 flex items-center justify-between"
        style={{ width: size.width }}
      >
        <DarkButton
          onClick={() => {
            if (playing) {
              videoRef.current?.pause()
              setPlaying(false)
            } else {
              videoRef.current?.play()
              setPlaying(true)
            }
          }}
        >
          {playing ? <BiPause size={24} /> : <BiPlay size={24} />}
        </DarkButton>

        <Progress
          trimmer={mode === 'trim'}
          time={time}
          handleTimeChange={(time) => {
            if (
              clip?.end &&
              clip.start &&
              (time > clip?.end || time < clip?.start)
            ) {
              return
            }
            setTime(time)
            if (!videoRef.current) return
            videoRef.current.currentTime = time
          }}
          duration={videoRef.current?.duration || 0}
          className={cx('flex-grow rounded-md bg-gray-500', {
            'h-8': mode === 'trim',
            'h-2': mode !== 'trim',
          })}
          clip={clip}
          setClip={setClip}
        />
      </div>

      <div
        className="bg-gray-600 px-4 py-3 flex items-center justify-between"
        style={{ width: size.width }}
      >
        <div className="grid grid-cols-2 gap-x-3">
          <DarkButton
            className={cx('border', {
              'border-brand': mode === 'crop',
              'border-transparent': mode !== 'crop',
            })}
            onClick={() => setMode(mode === 'crop' ? null : 'crop')}
          >
            <img className="w-6" src={cropIcon} alt="Crop" />
          </DarkButton>
          <DarkButton
            className={cx('border', {
              'border-brand': mode === 'trim',
              'border-transparent': mode !== 'trim',
            })}
            onClick={() => setMode(mode === 'trim' ? null : 'trim')}
          >
            <img className="w-6" src={trim} alt="Trim" />
          </DarkButton>
        </div>
        <div>
          <DarkButton
            onClick={() =>
              handleAction?.({ crop: convertTo('%', size, crop), clip })
            }
          >
            {action}
          </DarkButton>
        </div>
      </div>
    </div>
  )
}

export default VideoEditor
