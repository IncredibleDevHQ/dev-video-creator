import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  BlockProperties,
  CaptionTitleView,
  VideoBlockView,
  VideoBlockViewProps,
} from '../../../../utils/configTypes'
import { Transformations } from '../../../Flick/editor/blocks/VideoEditor'
import { VideoBlockProps } from '../../../Flick/editor/utils/utils'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
import { Video, VideoConfig } from '../../components/Video'
import { usePoint } from '../../hooks'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'

const VideoFragment = ({
  viewConfig,
  dataConfig,
  fragmentState,
  setFragmentState,
  stageRef,
  shortsMode,
}: {
  viewConfig: BlockProperties
  dataConfig: VideoBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
}) => {
  const { fragment, payload, updatePayload, state, theme, branding } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [studio, setStudio] = useRecoilState(studioStore)

  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    videoFill: '',
    cornerRadius: 0,
    performClip: true,
    clipVideoConfig: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
  })
  const [playing, setPlaying] = useState(false)

  // ref to the object grp
  const customLayoutRef = useRef<Konva.Group>(null)

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')
  const [transformations, setTransformations] = useState<Transformations>()

  const [objectConfig, setObjectConfig] = useState<ObjectConfig>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: 0,
  })

  const [objectRenderConfig, setObjectRenderConfig] =
    useState<ObjectRenderConfig>({
      startX: 0,
      startY: 0,
      availableWidth: 0,
      availableHeight: 0,
      textColor: '',
      surfaceColor: '',
    })
  const [videoFragmentData, setVideoFragentData] =
    useState<{ title: string; caption: string }>()
  const [renderMode, setRenderMode] = useState<CaptionTitleView>('titleOnly')

  const { getNoOfLinesOfText } = usePoint()

  useEffect(() => {
    return () => {
      videoElement?.pause()
      updatePayload?.({
        playing: false,
        currentTime: transformations?.clip?.start || 0,
      })
    }
  }, [])

  const videoElement = React.useMemo(() => {
    if (!dataConfig) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = dataConfig.videoBlock.url || ''

    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setVideoFragentData({
      title: dataConfig?.videoBlock.title || '',
      caption: dataConfig?.videoBlock?.caption || '',
    })
    const videoBlockViewProps: VideoBlockViewProps = (
      viewConfig?.view as VideoBlockView
    )?.video
    setRenderMode(videoBlockViewProps?.captionTitleView || 'titleOnly')
    if (dataConfig.videoBlock.transformations)
      setTransformations(dataConfig.videoBlock.transformations)
    // eslint-disable-next-line consistent-return
    return element
  }, [dataConfig, viewConfig, shortsMode, theme])

  useEffect(() => {
    setObjectRenderConfig(
      ThemeLayoutConfig({ theme, layoutConfig: objectConfig })
    )
  }, [objectConfig, theme])

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        playing,
        videoElement,
      },
    })
  }, [state, dataConfig, videoElement, playing])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'recording':
        updatePayload?.({
          playing: false,
          currentTime: transformations?.clip?.start || 0,
        })
        videoElement.currentTime = transformations?.clip?.start || 0
        break
      default:
        updatePayload?.({
          playing: false,
          currentTime: transformations?.clip?.start || 0,
        })
        videoElement.currentTime = transformations?.clip?.start || 0
    }
  }, [state, transformations, videoElement])

  // performing trim operation
  // on end time, reinitialize the video element's current time to start time
  videoElement?.addEventListener('timeupdate', () => {
    const { transformations } = dataConfig.videoBlock
    if (!transformations?.clip?.end) return
    if (videoElement.currentTime >= transformations.clip.end) {
      videoElement.pause()
      videoElement.currentTime = transformations?.clip?.start || 0
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
    if (videoElement) {
      videoElement.currentTime = payload?.currentTime || 0
    }
  }, [payload?.currentTime, videoElement])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }, 400)
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTimeout(() => {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }, 400)
    }
  }, [payload?.fragmentState])

  useEffect(() => {
    const noOfLinesOfTitle = getNoOfLinesOfText({
      text: videoFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: 24,
      fontFamily:
        branding?.font?.body?.family ||
        objectRenderConfig.titleFont ||
        'Gilroy',
      fontStyle: 'bold',
    })
    if (renderMode === 'titleOnly') {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y: objectRenderConfig.startY + 10 + noOfLinesOfTitle * 38 + 10,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          20 -
          (noOfLinesOfTitle * 38 + 10),
        // x: objectConfig.x,
        // y: objectConfig.y,
        // width: objectConfig.width,
        // height: objectConfig.height,
        videoFill: objectConfig.color || '#1F2937',
        cornerRadius: objectRenderConfig.borderRadius,
        performClip: true,
        clipVideoConfig: {
          x: transformations?.crop?.x || 0,
          y: transformations?.crop?.y || 0,
          width: transformations?.crop?.width || 1,
          height: transformations?.crop?.height || 1,
        },
      })
    } else if (renderMode === 'captionOnly') {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y: objectRenderConfig.startY + 20,
        width: objectRenderConfig.availableWidth - 20,
        height: objectRenderConfig.availableHeight - 80,
        videoFill: objectConfig.color || '#1F2937',
        cornerRadius: objectRenderConfig.borderRadius,
        performClip: true,
        clipVideoConfig: {
          x: transformations?.crop?.x || 0,
          y: transformations?.crop?.y || 0,
          width: transformations?.crop?.width || 1,
          height: transformations?.crop?.height || 1,
        },
      })
    } else {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y: objectRenderConfig.startY + 10,
        width: objectRenderConfig.availableWidth - 20,
        height: objectRenderConfig.availableHeight - 20,
        videoFill: objectConfig.color || '#1F2937',
        cornerRadius: objectRenderConfig.borderRadius,
        performClip: true,
        clipVideoConfig: {
          x: transformations?.crop?.x || 0,
          y: transformations?.crop?.y || 0,
          width: transformations?.crop?.width || 1,
          height: transformations?.crop?.height || 1,
        },
      })
    }
  }, [renderMode, objectRenderConfig, transformations, videoFragmentData])

  const layerChildren: any[] = [
    <Group x={0} y={0} opacity={0} ref={customLayoutRef}>
      <FragmentBackground
        theme={theme}
        objectConfig={objectConfig}
        backgroundRectColor={
          branding?.colors?.primary
            ? branding?.colors?.primary
            : objectRenderConfig.surfaceColor
        }
      />
      {videoElement && (
        <Video videoElement={videoElement} videoConfig={videoConfig} />
      )}
      <Group x={objectRenderConfig.startX} y={objectRenderConfig.startY}>
        {renderMode === 'titleOnly' && (
          <Text
            x={10}
            y={10}
            align="center"
            fontSize={24}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : objectRenderConfig.textColor
            }
            width={objectRenderConfig.availableWidth - 20}
            lineHeight={1.2}
            text={videoFragmentData?.title}
            fontStyle="bold"
            fontFamily={
              branding?.font?.body?.family ||
              objectRenderConfig.titleFont ||
              'Gilroy'
            }
            textTransform="capitalize"
          />
        )}

        {renderMode === 'captionOnly' && (
          <Text
            x={10}
            y={objectRenderConfig.availableHeight - 40}
            align="center"
            fontSize={16}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : objectRenderConfig.textColor
            }
            width={objectRenderConfig.availableWidth - 20}
            lineHeight={1.2}
            text={videoFragmentData?.caption}
            fontFamily={
              branding?.font?.body?.family ||
              objectRenderConfig.titleFont ||
              'GilroyRegular'
            }
          />
        )}
      </Group>
    </Group>,
  ]

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: viewConfig?.layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      studioUserConfig={studioUserConfig}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default VideoFragment
