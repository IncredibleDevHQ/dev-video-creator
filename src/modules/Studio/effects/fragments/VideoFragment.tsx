import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import {
  ConfigType,
  LayoutConfig,
  VideojamConfig,
} from '../../../../utils/configTypes'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import Concourse, { CONFIG, TitleSplashProps } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { Video, VideoConfig } from '../../components/Video'

const VideoFragment = ({
  viewConfig,
  dataConfig,
  dataConfigLength,
  topLayerChildren,
  setTopLayerChildren,
  titleSplashData,
  fragmentState,
  setFragmentState,
  stageRef,
  layerRef,
}: {
  viewConfig: LayoutConfig
  dataConfig: VideojamConfig
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, payload, updatePayload, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  const [playing, setPlaying] = useState(false)

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const videoElement = React.useMemo(() => {
    if (!dataConfig) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = dataConfig.value.videoURL

    setObjectConfig(
      FragmentLayoutConfig({ layoutNumber: viewConfig.layoutNumber })
    )
    // eslint-disable-next-line consistent-return
    return element
  }, [dataConfig, viewConfig])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        playing,
        videoElement,
        fragmentState,
        type: ConfigType.VIDEOJAM,
        dataConfigLength,
      },
    })
  }, [dataConfig, videoElement, fragmentState, playing])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'recording':
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
        })
        setTopLayerChildren([])
        break
      default:
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
        })
        setTopLayerChildren([])
    }
  }, [state])

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

  useEffect(() => {
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      customLayoutRef.current.to({
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
      customLayoutRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const videoConfig: VideoConfig = {
    x: objectConfig.x,
    y: objectConfig.y,
    width: objectConfig.width,
    height: objectConfig.height,
    videoFill: objectConfig.color || '#1F2937',
    cornerRadius: objectConfig.borderRadius,
    performClip: true,
  }

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {viewConfig.background.type === 'color' ? (
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fillLinearGradientColorStops={viewConfig.background.gradient?.values}
          fillLinearGradientStartPoint={
            viewConfig.background.gradient?.startIndex
          }
          fillLinearGradientEndPoint={viewConfig.background.gradient?.endIndex}
        />
      ) : (
        <Image
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          image={bgImage}
        />
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={videoConfig} />
      )}
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layoutNumber: viewConfig.layoutNumber,
    fragment,
    fragmentState,
  })

  // console.log('studioUserConfig', studioUserConfig)

  return (
    <Concourse
      layerChildren={layerChildren}
      stageRef={stageRef}
      layerRef={layerRef}
      titleSplashData={titleSplashData}
      studioUserConfig={studioUserConfig}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default VideoFragment
