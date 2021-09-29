import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import Konva from 'konva'
import { Circle, Group, Image, Rect } from 'react-konva'
import { FiPlay, FiPause } from 'react-icons/fi'
import useImage from 'use-image'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { Video, VideoConfig } from '../components/Video'
import { ClipConfig } from '../hooks/use-edit'
import config from '../../../config'

const VideoJamFour = () => {
  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [circleGroup] = useImage(
    `${config.storage.baseUrl}black-circles.svg`,
    'anonymous'
  )
  const [graphqlLogo] = useImage(
    `${config.storage.baseUrl}graphql3.svg`,
    'anonymous'
  )

  const videoElement = React.useMemo(() => {
    if (!fragment?.configuration.properties) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = fragment.configuration.properties.find(
      (property: any) => property.key === 'source'
    )?.value
    // eslint-disable-next-line consistent-return
    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })

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

  useEffect(() => {
    if (videoElement && payload?.status === Fragment_Status_Enum_Enum.Live)
      videoElement.currentTime = 0
  }, [payload?.status])

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

  const videoConfig: VideoConfig = {
    x: 37,
    y: 58,
    width: 704,
    height: 396,
    videoFill: '#1F2937',
    cornerRadius: 8,
    performClip: true,
    backgroundRectX: 27,
    backgroundRectY: 48,
    backgroundRectColor: '#60A5FA',
  }

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 735,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 50,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 735,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 255,
            backgroundRectColor: '#4FD1C5',
          },
        ]
      case 3:
        return [
          {
            x: 775,
            y: 58.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 48.5,
            backgroundRectColor: '#C084FC',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 188.5,
            backgroundRectColor: '#4FD1C5',
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 328.5,
            backgroundRectColor: '#FCA5A5',
          },
        ]
      default:
        return [
          {
            x: 695,
            y: 120.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 110.5,
            backgroundRectColor: '#C084FC',
          },
        ]
    }
  })()

  const layerChildren = videoElement
    ? [
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fill="#1F2937"
        />,
        <Image image={circleGroup} x={400} y={450} />,
        <Video videoElement={videoElement} videoConfig={videoConfig} />,
        <Image image={incredibleLogo} x={30} y={CONFIG.height - 60} />,
        <Image image={graphqlLogo} x={840} y={CONFIG.height - 58} />,
      ]
    : [<></>]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
    />
  )
}

export default VideoJamFour
