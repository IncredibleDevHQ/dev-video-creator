import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import {
  Fragment_Status_Enum_Enum,
  StudioFragmentFragment,
  ThemeFragment,
} from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import {
  BlockProperties,
  CaptionTitleView,
  Layout,
  VideoBlockView,
  VideoBlockViewProps,
} from '../../utils/configTypes'
import { BrandingJSON } from '../Branding/BrandingPage'
import { Transformations } from '../Flick/editor/blocks/VideoEditor'
import { VideoBlockProps } from '../Flick/editor/utils/utils'
import { StudioUser } from '../Studio/components'
import {
  CONFIG,
  SHORTS_CONFIG,
  StudioUserConfig,
} from '../Studio/components/Concourse'
import FragmentBackground from '../Studio/components/FragmentBackground'
import { FragmentState } from '../Studio/components/RenderTokens'
import { Video, VideoConfig } from '../Studio/components/Video'
import VideoBackground from '../Studio/components/VideoBackground'
import { usePoint } from '../Studio/hooks'
import useEdit from '../Studio/hooks/use-edit'
import { RTCUser } from '../Studio/hooks/use-video'
import { StudioState } from '../Studio/stores'
import {
  FragmentLayoutConfig,
  ObjectConfig,
} from '../Studio/utils/FragmentLayoutConfig'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../Studio/utils/StudioUserConfig'
import {
  ObjectRenderConfig,
  ThemeLayoutConfig,
} from '../Studio/utils/ThemeConfig'

const VideoFragment = ({
  viewConfig,
  dataConfig,
  fragmentState,
  fragment,
  stageRef,
  shortsMode,
  localVideoUrl,
  theme,
  state,
  payload,
  branding,
  users,
  stream,
  participants,
  setControlsConfig,
  setFragmentState,
  updatePayload,
}: {
  fragment: StudioFragmentFragment
  viewConfig: BlockProperties
  dataConfig: VideoBlockProps
  fragmentState: FragmentState
  stageRef: React.RefObject<Konva.Stage>
  shortsMode: boolean
  localVideoUrl?: string
  theme: ThemeFragment
  state: StudioState
  payload: any
  branding: BrandingJSON | null
  users: RTCUser[]
  stream: MediaStream | undefined
  participants: any
  setControlsConfig: (config: any) => void
  setFragmentState: React.Dispatch<React.SetStateAction<FragmentState>>
  updatePayload: (value: any) => void
}) => {
  const groupRef = useRef<Konva.Group>(null)
  const { sub, picture } = (useRecoilValue(userState) as User) || {}

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (shortsMode) setStageConfig(SHORTS_CONFIG)
    else setStageConfig(CONFIG)
  }, [shortsMode])

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
  const { getTextWidth, clipRect } = useEdit()

  useEffect(() => {
    return () => {
      videoElement?.pause()
      updatePayload?.({
        playing: false,
        currentTime: transformations?.clip?.start || 0,
      })
    }
  }, [])

  // useEffect(() => {
  //   setLayout(viewConfig?.layout)
  // }, [viewConfig])

  const videoElement = React.useMemo(() => {
    if (!dataConfig) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = localVideoUrl || dataConfig.videoBlock.url || ''

    setObjectConfig(
      FragmentLayoutConfig({
        theme,
        layout: layout || viewConfig?.layout || 'classic',
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
  }, [dataConfig, viewConfig, shortsMode, theme, layout])

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

  const [isZooming, setZooming] = useState(false)
  const zoomLevel = 2
  const userStudioImageGap = 170

  const onLayerClick = () => {
    if (!groupRef.current) return
    const tZooming = isZooming
    if (tZooming) {
      groupRef.current.to({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
      })
    } else {
      const pointer = stageRef?.current?.getPointerPosition()
      const scaleRatio =
        document.getElementsByClassName('konvajs-content')[0].clientWidth /
        stageConfig.width
      if (pointer) {
        groupRef.current.to({
          x: (pointer.x - pointer.x * zoomLevel) / scaleRatio,
          y: (pointer.y - pointer.y * zoomLevel) / scaleRatio,
          scaleX: zoomLevel,
          scaleY: zoomLevel,
          duration: 0.5,
        })
      }
    }
    setZooming(!isZooming)
  }
  const onMouseLeave = () => {
    if (!groupRef.current) return
    groupRef.current.to({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.5,
    })
    setZooming(false)
  }

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: layout || 'classic',
        fragment,
        fragmentState,
        theme,
      })

  const defaultStudioUserConfig: StudioUserConfig = {
    x: 780,
    y: 400,
    width: 0,
    height: 0,
  }

  return (
    <>
      <VideoBackground
        theme={theme}
        stageConfig={stageConfig}
        isShorts={shortsMode}
      />
      {(viewConfig?.layout === 'full-left' ||
        viewConfig?.layout === 'full-right') &&
        payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
        payload?.status !== Fragment_Status_Enum_Enum.Ended &&
        users &&
        stream && (
          <>
            <StudioUser
              stream={stream}
              studioUserConfig={
                (studioUserConfig && studioUserConfig[0]) ||
                defaultStudioUserConfig
              }
              picture={picture as string}
              type="local"
              uid={sub as string}
            />
            {users.map((user, index) => (
              <StudioUser
                key={user.uid as string}
                uid={user.uid as string}
                type="remote"
                stream={user.mediaStream as MediaStream}
                picture={participants?.[user.uid]?.picture || ''}
                studioUserConfig={
                  (studioUserConfig && studioUserConfig[index + 1]) || {
                    x:
                      defaultStudioUserConfig.x -
                      (index + 1) * userStudioImageGap,
                    y: defaultStudioUserConfig.y,
                    width: defaultStudioUserConfig.width,
                    height: defaultStudioUserConfig.height,
                  }
                }
              />
            ))}
          </>
        )}
      <Group
        clipFunc={(ctx: any) => {
          clipRect(
            ctx,
            FragmentLayoutConfig({
              theme,
              layout:
                fragmentState === 'onlyFragment'
                  ? 'classic'
                  : viewConfig?.layout || 'classic',
              isShorts: shortsMode || false,
            })
          )
        }}
      >
        <Group
          ref={groupRef}
          onClick={onLayerClick}
          onMouseLeave={onMouseLeave}
          // onMouseMove={onMouseMove}
        >
          {layerChildren}
        </Group>
      </Group>
      {viewConfig?.layout !== 'full-left' &&
        viewConfig?.layout !== 'full-right' &&
        payload?.status !== Fragment_Status_Enum_Enum.CountDown &&
        payload?.status !== Fragment_Status_Enum_Enum.Ended &&
        users &&
        stream && (
          <>
            <StudioUser
              stream={stream}
              studioUserConfig={
                (studioUserConfig && studioUserConfig[0]) ||
                defaultStudioUserConfig
              }
              picture={picture as string}
              type="local"
              uid={sub as string}
            />
            {users.map((user, index) => (
              <StudioUser
                key={user.uid as string}
                uid={user.uid as string}
                type="remote"
                stream={user.mediaStream as MediaStream}
                picture={participants?.[user.uid]?.picture || ''}
                studioUserConfig={
                  (studioUserConfig && studioUserConfig[index + 1]) || {
                    x:
                      defaultStudioUserConfig.x -
                      (index + 1) * userStudioImageGap,
                    y: defaultStudioUserConfig.y,
                    width: defaultStudioUserConfig.width,
                    height: defaultStudioUserConfig.height,
                  }
                }
              />
            ))}
          </>
        )}
    </>
  )
}

export default VideoFragment
