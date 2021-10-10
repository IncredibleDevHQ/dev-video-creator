import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { FiPause, FiPlay } from 'react-icons/fi'
import { Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import SwapIcon from '../../../components/SwapIcon'
import useEdit from '../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../stores'
import { CONFIG } from './Concourse'
import { ControlButton } from './MissionControl'
import { FragmentState } from './RenderTokens'

export interface VideoConfig {
  x?: number
  y?: number
  width: number
  height: number
  borderColor?: string
  borderWidth?: number
  cornerRadius?: number
  performClip: boolean
  videoFill?: string
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
  }, [])

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
          imgDim.x -
          ((videoConfig.x ? videoConfig.x : 0) -
            (videoConfig?.backgroundRectX ? videoConfig?.backgroundRectX : 0))
        }
        y={
          imgDim.y -
          ((videoConfig.y ? videoConfig.y : 0) -
            (videoConfig.backgroundRectY ? videoConfig?.backgroundRectY : 0))
        }
        //  videoConfig.backgroundRectY || imgDim.y || 0}
        width={imgDim.width}
        fill={videoConfig.backgroundRectColor}
        height={imgDim.height}
        stroke={videoConfig.backgroundRectBorderColor}
        strokeWidth={videoConfig?.backgroundRectBorderWidth || 0}
        cornerRadius={videoConfig?.cornerRadius || 0}
      />
      <Rect
        x={
          imgDim.x ||
          (imgDim.width -
            (imgDim.height * videoElement.videoWidth) /
              videoElement.videoHeight) /
            2
        }
        y={imgDim.y || 0}
        width={imgDim.width}
        height={imgDim.height}
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
        y={imgDim.y || 0}
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

export const controls = (
  playing: boolean,
  videoElement: HTMLVideoElement | undefined,
  fragmentState?: FragmentState
) => {
  const { payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  if (state === 'recording' || state === 'ready')
    return [
      <ControlButton
        key="swap"
        icon={SwapIcon}
        className="my-2"
        appearance="primary"
        onClick={() => {
          // if (!setFragmentState) return
          if (fragmentState === 'onlyUserMedia') {
            // setFragmentState('onlyFragment')
            // updating the fragment state in the payload to onlyFragment state
            updatePayload?.({
              playing: payload?.playing,
              currentTime: payload?.currentTime,
              fragmentState: 'onlyFragment',
            })
          } else {
            // setFragmentState('onlyUserMedia')
            // updating the fragment state in the payload to onlyUserMedia state
            updatePayload?.({
              playing: payload?.playing,
              currentTime: payload?.currentTime,
              fragmentState: 'onlyUserMedia',
            })
          }
        }}
      />,
      <ControlButton
        key="control"
        icon={playing ? FiPause : FiPlay}
        className="my-2"
        appearance={playing ? 'danger' : 'primary'}
        onClick={() => {
          const next = !playing
          updatePayload?.({
            playing: next,
            currentTime: videoElement?.currentTime,
          })
        }}
      />,
    ]
  return [<></>]
}
