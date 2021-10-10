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

const NewVideoJamSix = () => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<TitleSplashProps>({
    enable: false,
  })

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible-black.svg`,
    'anonymous'
  )
  const [tensorflowLogo] = useImage(
    `${config.storage.baseUrl}100DaysOfTF.svg`,
    'anonymous'
  )
  const [tensorflowBg] = useImage(
    `${config.storage.baseUrl}tensorflow_bg.svg`,
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
      bgRectColor: ['#FF6F00', '#FFA100'],
      stripRectColor: ['#E6E6E6', '#FFFFFF'],
      textColor: ['#425066', '#425066'],
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
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
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
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#010101', '#010101']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
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
              backgroundRectColor: '#FF6E00',
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
              backgroundRectColor: '#FF6E00',
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
              borderWidth: 8,
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 50,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
            },
            {
              x: 420,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 100,
                y: 5,
                width: 400,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 510,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
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
              backgroundRectColor: '#FF6E00',
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
              backgroundRectColor: '#FF6E00',
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
              backgroundRectColor: '#FF6E00',
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
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 25,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
            },
            {
              x: 185,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 335,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
            },
            {
              x: 495,
              y: 25,
              width: 600,
              height: 450,
              clipTheme: 'rect',
              borderWidth: 8,
              studioUserClipConfig: {
                x: 160,
                y: 5,
                width: 280,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 645,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
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
              backgroundRectColor: '#FF6E00',
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
              borderWidth: 8,
              studioUserClipConfig: {
                x: 0,
                y: 80,
                width: 800,
                height: 440,
                radius: 8,
              },
              backgroundRectX: 75,
              backgroundRectY: 20,
              backgroundRectColor: '#FF6E00',
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

  const onlyFragmentVideoConfig: VideoConfig = {
    x: 85,
    y: 30,
    width: 800,
    height: 450,
    cornerRadius: 8,
    videoFill: '#E5E5E5',
    performClip: true,
    backgroundRectX: 75,
    backgroundRectY: 20,
    backgroundRectColor: '#FF6E00',
  }
  const bothGroupVideoConfig: VideoConfig = {
    x: 37,
    y: 58,
    width: 704,
    height: 396,
    cornerRadius: 8,
    videoFill: '#E5E5E5',
    performClip: true,
    backgroundRectX: 27,
    backgroundRectY: 48,
    backgroundRectColor: '#FF6E00',
  }

  const layerChildren = [
    <Group x={0} y={0}>
      <Rect
        strokeWidth={1}
        x={0}
        y={0}
        fill="#F5F6F7"
        width={CONFIG.width}
        height={CONFIG.height}
        stroke="#111111"
      />
      <Image
        image={tensorflowBg}
        x={1}
        y={1}
        fill="#F5F6F7"
        width={CONFIG.width - 2}
        height={CONFIG.height - 2}
      />
      <Image image={incredibleLogo} x={25} y={CONFIG.height - 60} />
      <Image image={tensorflowLogo} x={820} y={CONFIG.height - 50} />
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

export default NewVideoJamSix
