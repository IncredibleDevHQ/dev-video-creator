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

const VideoJamSix = () => {
  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  const [windowOps] = useImage(
    `${config.storage.baseUrl}window-ops.svg`,
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
    backgroundRectX: 27,
    videoFill: '#1F2937',
    backgroundRectY: 48,
    backgroundRectColor: '#FF5D01',
    borderColor: '#1F2937',
    borderWidth: 6,
    backgroundRectBorderWidth: 3,
    backgroundRectBorderColor: '#1F2937',
  }

  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: 755,
            y: 80,
            width: 200,
            height: 150,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 160,
              height: 150,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 70,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 755,
            y: 305,
            width: 200,
            height: 150,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 20,
              y: 0,
              width: 160,
              height: 150,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 295,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
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
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 48.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 198.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 188.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
          {
            x: 775,
            y: 338.5,
            width: 160,
            height: 120,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 160,
              height: 120,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 328.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
      default:
        return [
          {
            x: 695,
            y: 140.5,
            width: 320,
            height: 240,
            clipTheme: 'rect',
            borderWidth: 6,
            borderColor: '#1F2937',
            studioUserClipConfig: {
              x: 80,
              y: 0,
              width: 160,
              height: 240,
              radius: 8,
            },
            backgroundRectX: 765,
            backgroundRectY: 130.5,
            backgroundRectColor: '#FF5D01',
            backgroundRectBorderWidth: 3,
            backgroundRectBorderColor: '#1F2937',
          },
        ]
    }
  })()

  const windowOpsImages = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return (
          <>
            <Image image={windowOps} x={860} y={35} />
            <Image image={windowOps} x={860} y={260} />
          </>
        )
      case 3:
        return <></>
      default:
        return <Image image={windowOps} x={860} y={95} />
    }
  })()

  const layerChildren = videoElement
    ? [
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fillLinearGradientColorStops={[
            0,
            '#140D1F',
            0.41,
            '#361367',
            1,
            '#6E1DDB',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{
            x: CONFIG.width,
            y: CONFIG.height,
          }}
        />,
        <Image image={astroPlanet} x={-10} y={0} />,
        <Video videoElement={videoElement} videoConfig={videoConfig} />,
        { ...windowOpsImages },
        <Image image={astroLogo} x={30} y={CONFIG.height - 60} />,
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

export default VideoJamSix
