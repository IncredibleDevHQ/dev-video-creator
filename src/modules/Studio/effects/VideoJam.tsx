import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import { FiPlay, FiPause } from 'react-icons/fi'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import { titleSplash } from './effects'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'

interface Dimension {
  width: number
  height: number
}

// @ts-ignore
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

const VideoJam = () => {
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(true)

  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const videoElement = React.useMemo(() => {
    if (!fragment?.configuration.properties) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.src = fragment.configuration.properties.find(
      (property: any) => property.key === 'source'
    )?.value
    // eslint-disable-next-line consistent-return
    return element
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'ready':
        videoElement.currentTime = 0

        break
      default:
        videoElement.currentTime = 0
    }
  }, [state])

  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line
    setPlaying(!!payload?.playing)
    // eslint-disable-next-line
    if (!!payload?.playing) {
      videoElement?.play()
    } else {
      // eslint-disable-next-line
      if (videoElement && payload) {
        videoElement.currentTime =
          typeof payload.currentTime === 'number' ? payload.currentTime : 0
        videoElement?.pause()
      }
    }
  }, [payload?.playing])

  const controls = [
    state === 'ready' || state === 'recording' ? (
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
      />
    ) : (
      <></>
    ),
  ]

  // let layerChildren = [<></>]
  // if (
  //   (state === 'recording' ||
  //     payload?.status === Fragment_Status_Enum_Enum.Live) &&
  //   isTitleSplash
  // ) {
  //   layerChildren = [
  //     <Group
  //       x={0}
  //       y={0}
  //       width={CONFIG.width}
  //       height={CONFIG.height}
  //       ref={(ref) =>
  //         ref?.to({
  //           duration: 3,
  //           onFinish: () => {
  //             setIsTitleSplash(false)
  //           },
  //         })
  //       }
  //     >
  //       {titleSplash(fragment?.name as string)}
  //     </Group>,
  //   ]
  // } else if (
  //   (state === 'recording' ||
  //     payload?.status === Fragment_Status_Enum_Enum.Live) &&
  //   !isTitleSplash
  // ) {
  const layerChildren = videoElement
    ? [<Video videoElement={videoElement} />]
    : [<></>]
  // }

  return <Concourse layerChildren={layerChildren} controls={controls} />
}

export default VideoJam
