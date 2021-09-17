import React, { useEffect, useState } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import { CONFIG } from './Concourse'
import useEdit, { ClipConfig } from '../hooks/use-edit'

export interface VideoConfig {
  x?: number
  y?: number
  width: number
  height: number
}

// @ts-ignore
export const Video = ({
  videoElement,
  videoConfig,
  clipConfig,
}: {
  videoElement: HTMLVideoElement
  videoConfig: VideoConfig
  clipConfig?: ClipConfig
}) => {
  const imageRef = React.useRef<Konva.Image>(null)
  const [size, setSize] = useState<VideoConfig>({
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
    <Group
      x={
        videoConfig.x ||
        (videoConfig.width -
          (videoConfig.height * videoElement.videoWidth) /
            videoElement.videoHeight) /
          2
      }
      y={videoConfig.y || 0}
      clipFunc={(ctx: any) => {
        if (!clipConfig) return
        clipRect(ctx, clipConfig)
      }}
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
  )
}
