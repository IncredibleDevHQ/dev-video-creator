import React, { useEffect, useState } from 'react'
import { FiPause, FiPlay } from 'react-icons/fi'
import { Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import { Concourse } from '../../components'
import { CONFIG, StudioUserConfig } from '../../components/Concourse'
import { ControlButton } from '../../components/MissionControl'
import { Video, VideoConfig } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'

const videoJamEleven = () => {
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
  const [pytorchLogo] = useImage(
    `${config.storage.baseUrl}pytorch.svg`,
    'anonymous'
  )
  const [pytorchBg] = useImage(
    `${config.storage.baseUrl}pytorch_bg.svg`,
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
    cornerRadius: 8,
    performClip: true,
  }

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 700,
            y: 60,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 12,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 30,
              y: 0,
              width: 180,
              height: 180,
              radius: 90,
            },
          },
          {
            x: 700,
            y: 265,
            width: 240,
            height: 180,
            clipTheme: 'rect',
            borderWidth: 12,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 30,
              y: 0,
              width: 180,
              height: 180,
              radius: 90,
            },
          },
        ]
      case 3:
        return [
          {
            x: 705,
            y: 58.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 12,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 120,
              height: 120,
              radius: 60,
            },
          },
          {
            x: 705,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 12,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 120,
              height: 120,
              radius: 60,
            },
          },
          {
            x: 705,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 12,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 120,
              height: 120,
              radius: 60,
            },
          },
        ]
      default:
        return [
          {
            x: 660,
            y: 140.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 16,
            borderColor: '#8B008B',
            studioUserClipConfig: {
              x: 60,
              y: 0,
              width: 200,
              height: 200,
              radius: 100,
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
          image={pytorchBg}
          x={1}
          y={1}
          fill="#F5F6F7"
          width={CONFIG.width - 2}
          height={CONFIG.height - 2}
        />,
        <Video videoElement={videoElement} videoConfig={videoConfig} />,
        <Image image={pytorchLogo} x={30} y={CONFIG.height - 60} />,
        <Image image={incredibleLogo} x={810} y={CONFIG.height - 60} />,
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

export default videoJamEleven
