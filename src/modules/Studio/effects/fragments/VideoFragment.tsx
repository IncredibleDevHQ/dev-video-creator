import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  BlockProperties,
  CaptionTitleView,
  Layout,
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
import useEdit from '../../hooks/use-edit'
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
  isPreview,
}: {
  viewConfig: BlockProperties
  dataConfig: VideoBlockProps
  fragmentState: FragmentState
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  isPreview: boolean
}) => {
  const {
    fragment,
    payload,
    updatePayload,
    state,
    theme,
    branding,
    preloadedBlobUrls,
    users,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
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

  const [layout, setLayout] = useState<Layout | undefined>()

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
  const { getTextWidth } = useEdit()

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
    element.src =
      preloadedBlobUrls?.[dataConfig.id] || dataConfig.videoBlock.url || ''

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
    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: !isPreview
          ? layout || viewConfig?.layout || 'classic'
          : viewConfig?.layout || 'classic',
        isShorts: shortsMode || false,
      })
    )
  }, [viewConfig, shortsMode, theme, layout, isPreview])

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
      if (!shortsMode)
        setTimeout(() => {
          setLayout(viewConfig?.layout || 'classic')
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setLayout(viewConfig?.layout || 'classic')
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      if (!shortsMode)
        setTimeout(() => {
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 0,
            duration: 0.1,
          })
        }, 400)
      else {
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 0,
          duration: 0.1,
        })
      }
    }
    if (payload?.fragmentState === 'onlyFragment') {
      if (!shortsMode)
        setTimeout(() => {
          setLayout('classic')
          setFragmentState(payload?.fragmentState)
          customLayoutRef?.current?.to({
            opacity: 1,
            duration: 0.1,
          })
        }, 400)
      else {
        setLayout('classic')
        setFragmentState(payload?.fragmentState)
        customLayoutRef?.current?.to({
          opacity: 1,
          duration: 0.1,
        })
      }
    }
  }, [payload?.fragmentState, payload?.status])

  useEffect(() => {
    let noOfLinesOfTitle = getNoOfLinesOfText({
      text: videoFragmentData?.title || '',
      availableWidth: objectRenderConfig.availableWidth - 20,
      fontSize: objectRenderConfig?.blockTitleFontSize || 24,
      fontFamily:
        branding?.font?.heading?.family ||
        objectRenderConfig.titleFont ||
        'Gilroy',
      fontStyle: 'bold',
    })
    noOfLinesOfTitle =
      theme?.name === 'Whitep4nth3r' ? noOfLinesOfTitle + 0.8 : noOfLinesOfTitle
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
    setNoOfLinesOfText({
      noOfLinesOfCaption,
      noOfLinesOfTitle,
    })
    if (renderMode === 'titleOnly') {
      setVideoConfig({
        x: objectRenderConfig.startX + 10,
        y:
          objectRenderConfig.startY +
          // adding 16 bcoz its the starting y coordinate of the text
          16 +
          noOfLinesOfTitle *
            ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
          // this addition of 16 is for the pading between the title and the video
          16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          // this 48 constitutes of, the starting y coordinate of the text ie 16, padding between the title and the video ie 16, and the bottom padding
          48 -
          noOfLinesOfTitle *
            ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2),
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
        // adding 16 is for the padding
        y: objectRenderConfig.startY + 16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          16 -
          noOfLinesOfCaption * (16 + 0.2) -
          // this 32 is the space for the caption and the bottom padding between the video and the caption
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
        y:
          objectRenderConfig.startY +
          // adding 16 bcoz its the starting y coordinate of the text
          16 +
          noOfLinesOfTitle *
            ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) +
          // this addition of 16 is for the pading between the title and the video
          16,
        width: objectRenderConfig.availableWidth - 20,
        height:
          objectRenderConfig.availableHeight -
          // 16 bcoz its the starting y coordinate of the text
          16 -
          noOfLinesOfTitle *
            ((objectRenderConfig?.blockTitleFontSize || 24) + 0.2) -
          // padding between the title and the video
          16 -
          // padding between the video and the caption
          16 -
          noOfLinesOfCaption * (16 + 0.2) -
          // the bottom padding
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
    <Group x={0} y={0} opacity={!isPreview ? 0 : 1} ref={customLayoutRef}>
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
          <Group>
            {theme.name === 'Whitep4nth3r' && videoFragmentData?.title !== '' && (
              <Rect
                x={
                  (objectRenderConfig.availableWidth - 20) / 2 -
                  (noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                    ? getTextWidth(
                        videoFragmentData?.title || '',
                        branding?.font?.heading?.family ||
                          objectRenderConfig.titleFont ||
                          'Gilroy',
                        objectRenderConfig?.blockTitleFontSize || 24,
                        'bold'
                      ) + 30
                    : objectRenderConfig.availableWidth - 80) /
                    2 +
                  10
                }
                y={
                  16 +
                  (noOfLinesOfText.noOfLinesOfTitle - 0.25) *
                    (objectRenderConfig?.blockTitleFontSize || 24)
                }
                width={
                  // checking if the no of lines of title is equal to 1, and based on that calculate the width of the title
                  noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                    ? getTextWidth(
                        videoFragmentData?.title || '',
                        branding?.font?.heading?.family ||
                          objectRenderConfig.titleFont ||
                          'Gilroy',
                        objectRenderConfig?.blockTitleFontSize || 24,
                        'bold'
                      ) + 30
                    : objectRenderConfig.availableWidth - 80
                }
                height={5}
                fillLinearGradientColorStops={[0, '#F11012', 1, '#FFB626']}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{
                  x:
                    noOfLinesOfText.noOfLinesOfTitle - 0.8 === 1
                      ? getTextWidth(
                          videoFragmentData?.title || '',
                          branding?.font?.heading?.family ||
                            objectRenderConfig.titleFont ||
                            'Gilroy',
                          objectRenderConfig?.blockTitleFontSize || 24,
                          'bold'
                        ) + 30
                      : objectRenderConfig.availableWidth - 80,
                  y: 0,
                }}
              />
            )}
            <Text
              x={10}
              y={16}
              align="center"
              fontSize={objectRenderConfig?.blockTitleFontSize || 24}
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
          </Group>
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

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: !isPreview
          ? layout || 'classic'
          : viewConfig?.layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: !isPreview
          ? layout || 'classic'
          : viewConfig?.layout || 'classic',
        noOfParticipants: users
          ? users?.length + 1
          : fragment?.configuration?.speakers?.length,
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
      fragmentState={fragmentState}
    />
  )
}

export default VideoFragment
