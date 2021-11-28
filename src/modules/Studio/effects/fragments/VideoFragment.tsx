import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import { VideoBlockProps } from '../../../../components/TextEditor/utils'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'
import { ConfigType } from '../../../../utils/configTypes'
import { BlockProperties } from '../../../../utils/configTypes2'
import Concourse, { CONFIG, TitleSplashProps } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { Video, VideoConfig } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { TrianglePathTransition } from '../FragmentTransitions'

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
  viewConfig: BlockProperties
  dataConfig: VideoBlockProps
  dataConfigLength: number
  topLayerChildren: JSX.Element[]
  setTopLayerChildren: React.Dispatch<React.SetStateAction<JSX.Element[]>>
  titleSplashData?: TitleSplashProps | undefined
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
}) => {
  const { fragment, payload, updatePayload, state, addTransitionAudio } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  const [playing, setPlaying] = useState(false)

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

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
    element.muted = false
    element.src = dataConfig.videoBlock.url || ''

    setObjectConfig(
      FragmentLayoutConfig({ layout: viewConfig.layout || 'classic' })
    )
    // eslint-disable-next-line consistent-return
    return element
  }, [dataConfig])

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
  }, [state, dataConfig, videoElement, fragmentState, playing])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'recording':
        updatePayload?.({
          playing: false,
          currentTime: dataConfig.videoBlock.from || 0,
        })
        setTopLayerChildren([])
        break
      default:
        updatePayload?.({
          playing: false,
          currentTime: dataConfig.videoBlock.from || 0,
        })
        setTopLayerChildren([])
    }
  }, [state, dataConfig])

  // performing trim operation
  // on end time, reinitialize the video element's current time to start time
  videoElement?.addEventListener('timeupdate', () => {
    if (!dataConfig.videoBlock.to) return
    if (videoElement.currentTime >= dataConfig.videoBlock?.to) {
      videoElement.pause()
      videoElement.currentTime = dataConfig.videoBlock.from || 0
      videoElement.play()
    }
  })

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
    if (!customLayoutRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren([<TrianglePathTransition direction="right" />])
      addTransitionAudio()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef.current?.to({
          opacity: 1,
          duration: 0.2,
        })
      }, 800)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([<TrianglePathTransition direction="left" />])
      addTransitionAudio()
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef.current?.to({
          opacity: 0,
          duration: 0.2,
        })
      }, 800)
    }
  }, [payload?.fragmentState])

  const videoConfig: VideoConfig = {
    x: objectConfig.x,
    y: objectConfig.y,
    width: objectConfig.width,
    height: objectConfig.height,
    videoFill: objectConfig.color || '#1F2937',
    cornerRadius: objectConfig.borderRadius,
    performClip: true,
    clipVideoConfig: {
      x: dataConfig?.videoBlock?.x || 0,
      y: dataConfig?.videoBlock?.y || 0,
      width: dataConfig?.videoBlock?.width || 1,
      height: dataConfig?.videoBlock?.height || 1,
    },
  }

  const layerChildren: any[] = [
    <Group x={0} y={0}>
      {/* {dataConfig..type === 'color' ? ( */}
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fillLinearGradientColorStops={viewConfig.gradient?.values}
        fillLinearGradientStartPoint={viewConfig.gradient?.startIndex}
        fillLinearGradientEndPoint={viewConfig.gradient?.endIndex}
      />
      {/* ) : (
        <Image
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          image={bgImage}
        />
      )} */}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={videoConfig} />
      )}
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layout: viewConfig.layout || 'classic',
    fragment,
    fragmentState,
  })

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
