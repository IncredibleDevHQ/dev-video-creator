import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import { Concourse } from '../../components'
import {
  CONFIG,
  StudioUserConfig,
  TitleSplashProps,
} from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { controls, Video, VideoConfig } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'

const NewVideoJamFour = () => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<TitleSplashProps>({
    enable: false,
  })

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
      bgRectColor: ['#140D1F', '#6E1DDB'],
      stripRectColor: ['#FF5D01', '#B94301'],
      textColor: ['#E6E6E6', '#FFFFFF'],
    })

    // eslint-disable-next-line consistent-return
    return element
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'ready':
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
          fragmentState: 'onlyUserMedia',
        })
        break
      default:
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
          fragmentState: 'onlyUserMedia',
        })
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

  useEffect(() => {
    setFragmentState(payload?.fragmentState)
  }, [payload?.fragmentState])

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const bothGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'onlyFragment') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
      bothGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
    // Checking if the current state is both and making the opacity of the only both group 1
    if (fragmentState === 'both') {
      bothGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  // returns all the information to render the studio user based on the fragment state and the number of fragment participants
  const studioCoordinates: StudioUserConfig[] = (() => {
    switch (fragment?.participants.length) {
      case 2:
        if (fragmentState === 'both')
          return [
            {
              x: 735,
              y: 60,
              width: 240,
              height: 180,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 40,
                y: 0,
                width: 160,
                height: 180,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 50,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
            {
              x: 735,
              y: 265,
              width: 240,
              height: 180,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 40,
                y: 0,
                width: 160,
                height: 180,
                radius: 8,
              },
              backgroundRectX: 765,
              backgroundRectY: 255,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
          ]
        if (fragmentState === 'onlyUserMedia')
          return [
            {
              x: -40,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 50,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
            {
              x: 420,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 510,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
          ]
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
      case 3:
        if (fragmentState === 'both')
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
        if (fragmentState === 'onlyUserMedia')
          return [
            {
              x: -125,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 25,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
            {
              x: 185,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 335,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
            {
              x: 495,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 645,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
          ]
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
      default:
        if (fragmentState === 'both')
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
        if (fragmentState === 'onlyUserMedia') {
          return [
            {
              x: 85,
              y: -50,
              width: 800,
              height: 600,
              clipTheme: 'rect',
              borderWidth: 6,
              borderColor: '#1F2937',
              studioUserClipConfig: {
                x: 0,
                y: 80,
                width: 800,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 75,
              backgroundRectY: 20,
              backgroundRectColor: '#FF5D01',
              backgroundRectBorderWidth: 3,
              backgroundRectBorderColor: '#1F2937',
            },
          ]
        }
        return [
          {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              radius: 0,
            },
            backgroundRectX: 0,
            backgroundRectY: 0,
          },
        ]
    }
  })()

  // to get images based on the no of participants
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

  const onlyFragmentVideoConfig: VideoConfig = {
    x: 85,
    y: 30,
    width: 800,
    height: 450,
    videoFill: '#1F2937',
    cornerRadius: 8,
    performClip: true,
    backgroundRectX: 75,
    backgroundRectY: 20,
    backgroundRectColor: '#FF5D01',
    borderColor: '#1F2937',
    borderWidth: 6,
    backgroundRectBorderWidth: 3,
    backgroundRectBorderColor: '#1F2937',
  }
  const bothGroupVideoConfig: VideoConfig = {
    x: 37,
    y: 58,
    width: 704,
    height: 396,
    videoFill: '#1F2937',
    cornerRadius: 8,
    performClip: true,
    backgroundRectX: 27,
    backgroundRectY: 48,
    backgroundRectColor: '#FF5D01',
    borderColor: '#1F2937',
    borderWidth: 6,
    backgroundRectBorderWidth: 3,
    backgroundRectBorderColor: '#1F2937',
  }

  const layerChildren = [
    <Group x={0} y={0}>
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
      />
      <Image image={astroPlanet} x={-10} y={0} />
      <Image image={astroLogo} x={40} y={CONFIG.height - 55} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      {videoElement && (
        <Video
          videoElement={videoElement}
          videoConfig={onlyFragmentVideoConfig}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      {windowOpsImages}
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={bothGroupVideoConfig} />
      )}
    </Group>,
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(playing, videoElement, fragmentState)}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default NewVideoJamFour
