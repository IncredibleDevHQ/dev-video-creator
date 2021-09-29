import React, { useEffect, useState } from 'react'
import Konva from 'konva'
import { Group, Image, Rect } from 'react-konva'
import { CONFIG } from './Concourse'
import useEdit from '../hooks/use-edit'

export interface VideoConfig {
  x?: number
  y?: number
  width: number
  height: number
  borderColor?: string
  videoFill?: string
  borderWidth?: number
  cornerRadius?: number
  performClip: boolean
  backgroundRectX?: number
  backgroundRectY?: number
  backgroundRectColor?: string
  backgroundRectBorderColor?: string
  backgroundRectBorderWidth?: number
}

// @ts-ignore
export const Video = ({
  videoElement,
  videoConfig,
}: {
  videoElement: HTMLVideoElement
  videoConfig: VideoConfig
}) => {
  const imageRef = React.useRef<Konva.Image>(null)
  const [size, setSize] = useState({
    width: (CONFIG.height * 16) / 9,
    height: CONFIG.height,
  })
  const { getImageDimensions } = useEdit()
  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })

  const { clipRect } = useEdit()
  useEffect(() => {
    console.log('imgdd', videoElement.videoWidth, videoElement.videoHeight)
  }, [imgDim])

  // when video is loaded, we should read it size
  React.useEffect(() => {
    const onload = () => {
      setImgDim(
        getImageDimensions(
          {
            w: (videoElement && videoElement.videoWidth) || 0,
            h: (videoElement && videoElement.videoHeight) || 0,
          },
          videoConfig.width,
          videoConfig.height,
          videoConfig.width,
          videoConfig.height,
          videoConfig.x ? videoConfig.x : 0,
          videoConfig.y ? videoConfig.y : 0
        )
      )
      setSize({
        width:
          (CONFIG.height * videoElement.videoWidth) / videoElement.videoHeight,
        height: CONFIG.height,
      })
    }
    videoElement.addEventListener('loadedmetadata', onload)
    return () => {
      videoElement.removeEventListener('loadedmetadata', onload)
    }
  }, [videoElement])

  useEffect(() => {
    // @ts-ignore
    const layer = imageRef.current?.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    return () => {
      anim.stop()
    }
  }, [videoElement])

  return (
    <>
      <Rect
        x={
          videoConfig.backgroundRectX ||
          videoConfig.x ||
          (videoConfig.width -
            (videoConfig.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={videoConfig.backgroundRectY || imgDim.y || 0}
        width={videoConfig.width}
        fill={videoConfig.backgroundRectColor}
        height={videoConfig.height}
        stroke={videoConfig.backgroundRectBorderColor}
        strokeWidth={videoConfig?.backgroundRectBorderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Rect
        x={
          videoConfig.x ||
          (videoConfig.width -
            (videoConfig.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        fill={videoConfig.videoFill || undefined}
        y={videoConfig.y || 0}
        width={videoConfig.width}
        height={videoConfig.height}
        stroke={videoConfig.borderColor}
        strokeWidth={videoConfig?.borderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Group
        x={
          imgDim.x ||
          (imgDim.width -
            (imgDim.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={imgDim.y}
        width={imgDim.width}
        height={imgDim.height}
      >
        <Image
          ref={imageRef}
          image={videoElement}
          width={imgDim.width}
          height={imgDim.height}
        />
      </Group>
    </>
  )
}
