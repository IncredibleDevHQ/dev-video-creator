import Konva from 'konva'
import React, { useEffect, useRef } from 'react'
import { Group, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'

const StoryBook = () => {
  const { stream, picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const imageConfig = { width: 640, height: 480 }
  const imageRef = useRef<Konva.Image | null>(null)
  const [image] = useImage(picture as string, 'anonymous')

  useEffect(() => {
    var font = new FontFaceObserver('Gilroy')
    font.load()
  }, [])

  const videoElement = React.useMemo(() => {
    if (!stream) return undefined
    const element = document.createElement('video')
    element.srcObject = stream
    element.muted = true
    return element
  }, [stream])

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!videoElement || !imageRef.current) return undefined
    videoElement.play()
    const layer = imageRef.current.getLayer()
    const anim = new Konva.Animation(() => {}, layer)
    anim.start()
    return () => {
      anim.stop()
    }
  }, [videoElement, imageRef.current])

  const ref = useRef<HTMLVideoElement | null>(null)
  const isDisableCamera = true

  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
  }, [ref.current])

  const controls: any = []
  const layerChildren = [
    //To get the white background color
    <Group x={0} y={0} fill="#ffffff" key="group0">
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#ffffff"
      />
    </Group>,

    <Group
      y={30}
      x={536}
      clipFunc={(ctx: any) => {
        const x = 0
        const y = 0
        const w = 348
        const h = 480
        let r = 8
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
      }}
    >
      {constraints?.video ? (
        <Image
          ref={imageRef}
          x={-imageConfig.width / 3}
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
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      disableUserMedia={isDisableCamera}
      controls={controls}
    />
  )
}

export default StoryBook
