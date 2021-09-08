import React, { useEffect, useRef, useState } from 'react'
import { Image, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useParams } from 'react-router-dom'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'

interface Dimension {
  width: number
  height: number
}
const Video = ({ videoElement }: { videoElement: HTMLVideoElement }) => {
  const imageRef = React.useRef<Konva.Image>(null)
  const [size, setSize] = useState<Dimension>({
    width: (CONFIG.height * 16) / 9,
    height: CONFIG.height,
  })

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
    <Image
      x={
        (CONFIG.width -
          (CONFIG.height * videoElement.videoWidth) /
            videoElement.videoHeight) /
        2
      }
      ref={imageRef}
      image={videoElement}
      width={
        (CONFIG.height * videoElement.videoWidth) / videoElement.videoHeight
      }
      height={size.height}
    />
  )
}

const Outro = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  let coordinate: Coordinates = {
    titleX: 0,
    titleY: 0,
    subTitleX: 0,
    subTitleY: 0,
    titleHeight: 0,
  }

  const { sub } = (useRecoilValue(userState) as User) || {}
  const params: { fragmentId: string } = useParams()
  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })
  const [customSplash, source, title, subTitle] =
    data?.Fragment[0].configuration.properties

  const controls: any = []

  const videoElement = React.useMemo(() => {
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.src = source.value
    return element
  }, [source])

  useEffect(() => {
    if (customSplash.value) {
      if (!videoElement) return
      if (state === 'recording') {
        videoElement?.play()
      }
      getLayerChildren()
    }
  }, [state])

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  const [layerChildren, setLayerChildren] = useState([
    <Rect
      x={0}
      y={0}
      fill="#ffffff"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      customSplash.value &&
        (videoElement ? [<Video videoElement={videoElement} />] : [<></>]),
    ])
  }

  return (
    <Concourse
      disableUserMedia
      layerChildren={layerChildren}
      controls={controls}
    />
  )
}

export default Outro
