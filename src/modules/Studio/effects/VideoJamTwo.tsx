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

const VideoJamTwo = () => {
  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [elasticLogo] = useImage(
    `${config.storage.baseUrl}elastic-logo.png`,
    'anonymous'
  )
  const [whiteCircle] = useImage(
    `${config.storage.baseUrl}circle.png`,
    'anonymous'
  )
  const [pinkCircle] = useImage(
    `${config.storage.baseUrl}pink2.png`,
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
    x: 30,
    y: 40,
    width: 720,
    height: 405,
    videoFill: '#EDEEF0',
    borderColor: '#EDEEF0',
    borderWidth: 8,
    cornerRadius: 8,
    performClip: true,
  }

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 735,
            y: 50,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
          },
          {
            x: 735,
            y: 255,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 8,
            },
          },
        ]
      case 3:
        return [
          {
            x: 775,
            y: 42.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
          },
          {
            x: 775,
            y: 182.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
          },
          {
            x: 775,
            y: 322.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
          },
        ]
      default:
        return [
          {
            x: 695,
            y: 122.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderColor: '#D1D5DB',
            borderWidth: 8,
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
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
          fill="#ffffff"
          // fillLinearGradientColorStops={[0, '#60D0ED', 1, '#536FA8']}
          // fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          // fillLinearGradientEndPoint={{ x: CONFIG.width, y: CONFIG.height }}
        />,
        <Circle x={82} y={10} radius={55} fill="#7DE2D1" />,
        <Circle x={70} y={CONFIG.height - 70} radius={100} fill="#7DE2D1" />,
        <Circle x={640} y={20} radius={10} fill="#0077CC" />,
        <Circle x={270} y={CONFIG.height - 70} radius={10} fill="#0077CC" />,
        <Image image={pinkCircle} x={790} y={400} />,
        <Image image={whiteCircle} x={615} y={245} />,
        <Video videoElement={videoElement} videoConfig={videoConfig} />,
        <Image image={elasticLogo} x={30} y={CONFIG.height - 60} />,
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

export default VideoJamTwo
