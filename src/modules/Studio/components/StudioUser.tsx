/* eslint-disable consistent-return */
import React, { useContext, useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import useImage from 'use-image'
import { StudioContext } from '../Studio'

const StudioUser = ({ stream }: { stream: MediaStream | null }) => {
  const imageRef = useRef<Konva.Image | null>(null)

  const { picture, constraints } = useContext(StudioContext)

  const [image] = useImage(picture as string)

  const videoElement = React.useMemo(() => {
    console.log({ stream })
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
      x={800}
      y={400}
      clipFunc={(ctx: any) => {
        ctx.arc(50, 50, 50, 0, Math.PI * 2, true)
      }}
      draggable
    >
      {constraints?.video ? (
        <Image ref={imageRef} image={videoElement} width={100} height={100} />
      ) : (
        <Image image={image} width={100} height={100} />
      )}
    </Group>
  )
}

export default StudioUser
