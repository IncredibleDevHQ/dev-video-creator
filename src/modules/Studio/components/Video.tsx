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

  const { clipRect } = useEdit()

  // when video is loaded, we should read it size
  React.useEffect(() => {
    const onload = () => {
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

  // use Konva.Animation to redraw a layer
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
        y={videoConfig.backgroundRectY || videoConfig.y || 0}
        width={
          (videoConfig.height * videoElement.videoWidth) /
          videoElement.videoHeight
        }
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
        y={videoConfig.y || 0}
        width={
          (videoConfig.height * videoElement.videoWidth) /
          videoElement.videoHeight
        }
        height={videoConfig.height}
        stroke={videoConfig.borderColor}
        strokeWidth={videoConfig?.borderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Group
        x={
          videoConfig.x ||
          (videoConfig.width -
            (videoConfig.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={videoConfig.y || 0}
        clipFunc={
          videoConfig.performClip &&
          ((ctx: any) => {
            clipRect(ctx, {
              x: 0,
              y: 0,
              width:
                (videoConfig.height * videoElement.videoWidth) /
                videoElement.videoHeight,
              height: videoConfig.height,
              radius: videoConfig?.cornerRadius || 8,
            })
          })
        }
      >
        <Image
          ref={imageRef}
          image={videoElement}
          width={
            (videoConfig.height * videoElement.videoWidth) /
            videoElement.videoHeight
          }
          height={videoConfig.height}
        />
      </Group>
    </>
  )
}
