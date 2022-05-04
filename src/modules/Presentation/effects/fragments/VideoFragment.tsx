import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text } from 'react-konva'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import Concourse from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { FragmentState } from '../../components/RenderTokens'
import { Video, VideoConfig } from '../../components/Video'
import { usePoint } from '../../hooks'
import { presentationStore } from '../../stores'
import {
  controlsConfigStore,
  PresentationProviderProps,
} from '../../stores/presentation.store'
import {
  BlockProperties,
  CaptionTitleView,
  VideoBlockView,
  VideoBlockViewProps,
} from '../../utils/configTypes'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../../utils/FragmentLayoutConfig'
import { ObjectRenderConfig, ThemeLayoutConfig } from '../../utils/ThemeConfig'
import { Transformations, VideoBlockProps } from '../../utils/utils'

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
  const { videoPayload, setVideoPayload, theme, branding, preloadedBlobUrls } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}
  const setControlsConfig = useSetRecoilState(controlsConfigStore)

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
  const [videoFragmentData, setVideoFragmentData] =
    useState<{ title: string; caption: string }>()
  const [renderMode, setRenderMode] = useState<CaptionTitleView>('titleOnly')
  const [noOfLinesOfText, setNoOfLinesOfText] = useState<{
    noOfLinesOfTitle: number
    noOfLinesOfCaption: number
  }>({ noOfLinesOfCaption: 0, noOfLinesOfTitle: 0 })

  const { getNoOfLinesOfText } = usePoint()

  useEffect(() => {
    return () => {
      videoElement?.pause()
      setVideoPayload?.({
        ...videoPayload,
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
    element.src =
      preloadedBlobUrls?.[dataConfig.id] || dataConfig.videoBlock.url || ''

    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
    setVideoFragmentData({
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
    setControlsConfig({
      playing,
      videoElement,
    })
  }, [dataConfig, videoElement, playing])

  useEffect(() => {
    if (!videoElement) return
    setVideoPayload?.({
      ...videoPayload,
      playing: false,
      currentTime: transformations?.clip?.start || 0,
    })
    videoElement.currentTime = transformations?.clip?.start || 0
  }, [transformations, videoElement])

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
    setPlaying(!!videoPayload?.playing)
    // eslint-disable-next-line
    if (!!videoPayload?.playing) {
      videoElement?.play()
    } else {
      // eslint-disable-next-line
      if (videoElement && videoPayload) {
        videoElement.currentTime =
          typeof videoPayload.currentTime === 'number'
            ? videoPayload.currentTime
            : 0
        videoElement?.pause()
      }
    }
  }, [videoPayload?.playing])

  useEffect(() => {
    if (videoElement) {
      videoElement.currentTime = videoPayload?.currentTime || 0
    }
  }, [videoPayload?.currentTime, videoElement])

  // useEffect(() => {
  // 	// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
  // 	if (videoPayload?.fragmentState === 'customLayout') {
  // 		if (!shortsMode)
  // 			setTimeout(() => {
  // 				setFragmentState(videoPayload?.fragmentState);
  // 				customLayoutRef?.current?.to({
  // 					opacity: 1,
  // 					duration: 0.1,
  // 				});
  // 			}, 400);
  // 		else {
  // 			setFragmentState(videoPayload?.fragmentState);
  // 			customLayoutRef?.current?.to({
  // 				opacity: 1,
  // 				duration: 0.1,
  // 			});
  // 		}
  // 	}
  // 	// Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
  // 	if (videoPayload?.fragmentState === 'onlyUserMedia') {
  // 		if (!shortsMode)
  // 			setTimeout(() => {
  // 				setFragmentState(videoPayload?.fragmentState);
  // 				customLayoutRef?.current?.to({
  // 					opacity: 0,
  // 					duration: 0.1,
  // 				});
  // 			}, 400);
  // 		else {
  // 			setFragmentState(videoPayload?.fragmentState);
  // 			customLayoutRef?.current?.to({
  // 				opacity: 0,
  // 				duration: 0.1,
  // 			});
  // 		}
  // 	}
  // }, [videoPayload?.fragmentState, videoPayload?.status]);

  useEffect(() => {
    const noOfLinesOfTitle = getNoOfLinesOfText({
      text: videoFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: 24,
      fontFamily:
        branding?.font?.heading?.family ||
        objectRenderConfig.titleFont ||
        'Gilroy',
      fontStyle: 'bold',
    })
    const noOfLinesOfCaption = getNoOfLinesOfText({
      text: videoFragmentData?.caption || '',
      availableWidth: !shortsMode
        ? objectRenderConfig.availableWidth - 220
        : objectRenderConfig.availableWidth - 40,
      fontSize: 16,
      fontFamily:
        branding?.font?.body?.family || objectRenderConfig.bodyFont || 'Gilroy',
      fontStyle: 'normal',
    })
    setNoOfLinesOfText({ noOfLinesOfCaption, noOfLinesOfTitle })
    if (renderMode === 'titleOnly') {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y: objectRenderConfig.startY + 16 + noOfLinesOfTitle * (24 + 0.2) + 16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          48 -
          noOfLinesOfTitle * (24 + 0.2),
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
        y: objectRenderConfig.startY + 16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          16 -
          noOfLinesOfCaption * (16 + 0.2) -
          32,
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
    } else if (renderMode === 'titleAndCaption') {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y: objectRenderConfig.startY + 16 + noOfLinesOfTitle * (24 + 0.2) + 16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          16 -
          noOfLinesOfTitle * (24 + 0.2) -
          16 -
          16 -
          noOfLinesOfCaption * (16 + 0.2) -
          16,
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
    <Group x={0} y={0} opacity={1} ref={customLayoutRef} key={0}>
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
        {(renderMode === 'titleOnly' || renderMode === 'titleAndCaption') && (
          <Text
            x={10}
            y={16}
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
              branding?.font?.heading?.family ||
              objectRenderConfig.titleFont ||
              'Gilroy'
            }
            textTransform="capitalize"
          />
        )}

        {(renderMode === 'captionOnly' || renderMode === 'titleAndCaption') && (
          <Text
            x={!shortsMode ? 110 : 20}
            y={
              objectRenderConfig.availableHeight -
              noOfLinesOfText.noOfLinesOfCaption * (16 + 0.2) -
              16
            }
            align="center"
            fontSize={16}
            fill={
              branding?.colors?.text
                ? branding?.colors?.text
                : objectRenderConfig.textColor
            }
            width={
              !shortsMode
                ? objectRenderConfig.availableWidth - 220
                : objectRenderConfig.availableWidth - 40
            }
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

  // const studioUserConfig = !shortsMode
  //   ? StudioUserConfiguration({
  //       layout: viewConfig?.layout || 'classic',
  //       fragment,
  //       fragmentState,
  //       theme,
  //     })
  //   : ShortsStudioUserConfiguration({
  //       layout: viewConfig?.layout || 'classic',
  //       fragment,
  //       fragmentState,
  //       theme,
  //     })

  return (
    <Concourse
      layerChildren={layerChildren}
      viewConfig={viewConfig}
      stageRef={stageRef}
      // studioUserConfig={studioUserConfig}
      isShorts={shortsMode}
      blockType={dataConfig.type}
    />
  )
}

export default VideoFragment