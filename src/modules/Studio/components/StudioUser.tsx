/* eslint-disable consistent-return */
import React, { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import Gravatar from 'react-gravatar'
import { StudioProviderProps, studioStore } from '../stores'
import { Fragment_Participant } from '../../../generated/graphql'

const StudioUser = ({
  stream,
  x,
  y,
  width,
  height,
  type,
  key,
}: {
  x: number
  y: number
  width?: number
  height?: number
  type: string
  key: string
  stream: MediaStream | null
}) => {
  const imageConfig = { width: width || 160, height: height || 120 }
  const imageRef = useRef<Konva.Image | null>(null)

  const { picture, participants, constraints } =
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

  const clipSquare = (ctx: any) => {
    const x = 0
    const y = 0
    const w = imageConfig.width
    const h = imageConfig.height
    const r = 8
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  return (
    <Group
      x={x}
      y={y}
      clipFunc={(ctx: any) => {
        clipSquare(ctx)
      }}
      draggable
    >
      {type === 'local' && constraints?.video ? (
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
      {type === 'remote' && stream ? (
        <Image
          ref={imageRef}
          image={videoElement}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      ) : (
        <Gravatar
          className="w-6 h-6 rounded-full bg-gray-100"
          email={participants[key].email as string}
        />
      )}
    </Group>
  )
}

export default StudioUser
