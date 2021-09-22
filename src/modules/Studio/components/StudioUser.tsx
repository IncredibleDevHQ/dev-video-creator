/* eslint-disable consistent-return */
import React, { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Image, Circle, Rect } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import Gravatar from 'react-gravatar'
import { StudioProviderProps, studioStore } from '../stores'
import { Fragment_Participant } from '../../../generated/graphql'
import { StudioUserConfig } from './Concourse'
import useEdit, { ClipConfig } from '../hooks/use-edit'

const StudioUser = ({
  stream,
  studioUserConfig,
}: {
  stream: MediaStream | null
  studioUserConfig: StudioUserConfig
}) => {
  const {
    x,
    y,
    width,
    height,
    clipTheme,
    borderColor,
    borderWidth,
    studioUserClipConfig,
    backgroundRectColor,
    backgroundRectX,
    backgroundRectY,
  } = studioUserConfig
  const imageConfig = { width: width || 160, height: height || 120 }
  const imageRef = useRef<Konva.Image | null>(null)

  const { clipCircle, clipRect } = useEdit()
  const defaultStudioUserClipConfig: ClipConfig = {
    x: 0,
    y: 0,
    width: 160,
    height: 120,
    radius: 8,
  }

  const { picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [image] = useImage(picture as string, 'anonymous')

  const videoElement = React.useMemo(() => {
    if (!stream) return
    const element = document.createElement('video')
    element.srcObject = stream
    element.muted = true

    return element
  }, [stream])

  useEffect(() => {
    if (!videoElement || !imageRef.current) return
    videoElement.play()

    const layer = imageRef.current.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    return () => {
      anim.stop()
    }
  }, [videoElement, imageRef.current])

  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    ref.current.srcObject = stream
  }, [ref.current])

  const getClipFunc = ({
    clipTheme,
    ctx,
    clipConfig,
  }: {
    clipTheme?: string
    ctx: any
    clipConfig: ClipConfig
  }) => {
    if (clipTheme === 'circle') return clipCircle(ctx, clipConfig)
    return clipRect(ctx, clipConfig)
  }

  return (
    <>
      <Rect
        x={backgroundRectX || 775}
        y={backgroundRectY || y}
        width={160}
        height={imageConfig.height}
        fill={backgroundRectColor}
        stroke={borderColor}
        strokeWidth={borderWidth || 0}
        cornerRadius={8}
      />
      <Group
        x={x}
        y={y}
        clipFunc={(ctx: any) => {
          getClipFunc({
            clipTheme,
            ctx,
            clipConfig: studioUserClipConfig || defaultStudioUserClipConfig,
          })
        }}
        draggable
        offsetX={imageConfig.width}
        scaleX={-1}
      >
        {constraints?.video ? (
          <Image
            ref={imageRef}
            image={videoElement}
            width={imageConfig.width}
            height={imageConfig.height}
          />
        ) : (
          <Image
            image={image}
            width={imageConfig.width}
            height={imageConfig.height}
          />
        )}
      </Group>
    </>
  )
}

export default StudioUser
