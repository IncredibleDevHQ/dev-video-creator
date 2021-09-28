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

const videoJamEight = () => {
  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [nextJSLogo] = useImage(
    `${config.storage.baseUrl}nextJSLogo.svg`,
    'anonymous'
  )
  const [nextJSBg] = useImage(
    `${config.storage.baseUrl}nextJS_bg.svg`,
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
    cornerRadius: 0,
    performClip: true,
    borderColor: '#111111',
    borderWidth: 4,
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
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 0,
            },
          },
          {
            x: 735,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 40,
              y: 0,
              width: 160,
              height: 180,
              radius: 0,
            },
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
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
            borderWidth: 4,
            borderColor: '#111111',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 0,
            },
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
            borderWidth: 4,
            borderColor: '#111111',
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 0,
            },
          },
        ]
    }
  })()

  const layerChildren = videoElement
    ? [
        <Rect
          strokeWidth={1}
          x={0}
          y={0}
          fill="#F5F6F7"
          width={CONFIG.width}
          height={CONFIG.height}
          stroke="#111111"
        />,
        <Image
          image={nextJSBg}
          x={1}
          y={1}
          fill="#F5F6F7"
          width={CONFIG.width - 2}
          height={CONFIG.height - 2}
        />,
        <Video videoElement={videoElement} videoConfig={videoConfig} />,
        <Image image={nextJSLogo} x={40} y={CONFIG.height - 65} />,
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

export default videoJamEight
