import Konva from 'konva'
import React, { useContext, useEffect, useState } from 'react'
import { Image } from 'react-konva'
import { FiPlay, FiPause } from 'react-icons/fi'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import { CONFIG } from '../components/Concourse'
import { StudioContext } from '../Studio'

// @ts-ignore
const Video = ({ videoElement }: { videoElement: HTMLVideoElement }) => {
  const imageRef = React.useRef(null)
  const [size, setSize] = React.useState({ width: 50, height: 50 })

  // when video is loaded, we should read it size
  React.useEffect(() => {
    const onload = function () {
      setSize({
        width: CONFIG.width,
        height: (CONFIG.width * 9) / 16,
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
      ref={imageRef}
      image={videoElement}
      width={size.width}
      height={size.height}
    />
  )
}

const VideoJam = () => {
  const videoElement = React.useMemo(() => {
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.src =
      'https://incredible-uploads-staging.s3.us-west-1.amazonaws.com/hasura.mp4'
    return element
  }, [])

  const { state } = useContext(StudioContext)

  useEffect(() => {
    switch (state) {
      case 'preview':
        videoElement.pause()
        break
      case 'ready':
        videoElement.currentTime = 0
        break
      default:
        videoElement.currentTime = 0
    }
  }, [state])

  const [playing, setPlaying] = useState(false)

  const controls = [
    <ControlButton
      key="control"
      icon={playing ? FiPause : FiPlay}
      className="my-2"
      appearance={playing ? 'danger' : 'primary'}
      onClick={() => {
        const next = !playing
        setPlaying(next)
        if (next) {
          videoElement.play()
        } else {
          videoElement.pause()
        }
      }}
    />,
  ]

  const layerChildren = [<Video videoElement={videoElement} />]

  return <Concourse layerChildren={layerChildren} controls={controls} />
}

export default VideoJam
