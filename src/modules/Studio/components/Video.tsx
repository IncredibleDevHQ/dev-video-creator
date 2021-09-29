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
          imgDim.x ||
          (imgDim.width -
            (imgDim.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={videoConfig.backgroundRectY || imgDim.y || 0}
        width={imgDim.width}
        fill={videoConfig.backgroundRectColor}
        height={imgDim.height}
        stroke={videoConfig.backgroundRectBorderColor}
        strokeWidth={videoConfig?.backgroundRectBorderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Rect
        x={
          videoConfig.x ||
          (imgDim.width -
            (imgDim.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={videoConfig.y || 0}
        width={imgDim.width}
        height={imgDim.height}
        stroke={videoConfig.borderColor}
        strokeWidth={videoConfig?.borderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Group
        x={
          videoConfig.x ||
          (imgDim.width -
            (imgDim.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={videoConfig.y || 0}
        width={imgDim.width}
        height={imgDim.height}
        clipFunc={
          videoConfig.performClip &&
          ((ctx: any) => {
            clipRect(ctx, {
              x: 0,
              y: 0,
              width: imgDim.width,
              height: imgDim.height,
              radius: videoConfig?.cornerRadius || 0,
            })
          })
        }
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
