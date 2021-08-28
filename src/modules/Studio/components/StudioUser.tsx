/* eslint-disable consistent-return */
import React, { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import useImage from 'use-image'
import { useRecoilValue } from 'recoil'
import { StudioProviderProps, studioStore } from '../stores'

const StudioUser = ({
  stream,
  x,
  y,
}: {
  x: number
  y: number

  stream: MediaStream | null
}) => {
  const imageConfig = { width: 160, height: 120 }
  const imageRef = useRef<Konva.Image | null>(null)

  const { picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [image] = useImage(picture as string)

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

  return (
    <Group
      x={x}
      y={y}
      clipFunc={(ctx: any) => {
        ctx.arc(
          imageConfig.width / 2,
          imageConfig.height / 2,
          imageConfig.width > imageConfig.height
            ? imageConfig.height / 2
            : imageConfig.width / 2,
          0,
          Math.PI * 2,
          true
        )
      }}
      draggable
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
  )
}

export default StudioUser
