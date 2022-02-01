import React from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { VideoTheme } from '../../../utils/configTypes'
import { studioStore } from '../stores'
import { Video } from './Video'

const VideoBackground = ({
  theme,
  stageConfig,
}: {
  theme: VideoTheme
  stageConfig: {
    width: number
    height: number
  }
}) => {
  const { branding } = useRecoilValue(studioStore)
  const [bgImage] = useImage(branding?.background?.url || '', 'anonymous')
  const [glassyThemeBackground] = useImage(
    `${config.storage.baseUrl}themes/glassyThemeBackground.png`,
    'anonymous'
  )

  const videoElement = React.useMemo(() => {
    if (!branding?.background?.url) return
    const element = document.createElement('video')
    element.autoplay = true
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.loop = true
    element.src = branding.background?.url || ''
    element.play()
    // eslint-disable-next-line consistent-return
    return element
  }, [branding, stageConfig])

  switch (theme) {
    case 'glassy':
      switch (branding?.background?.type) {
        case 'image':
          return (
            <Image
              x={0}
              y={0}
              width={stageConfig.width}
              height={stageConfig.height}
              image={bgImage}
              fill="#040E22"
            />
          )
        case 'color':
          return (
            <Rect
              x={0}
              y={0}
              width={stageConfig.width}
              height={stageConfig.height}
              fill={branding?.background?.color?.primary}
            />
          )
        case 'video':
          return (
            <Group x={0} y={0}>
              {videoElement && (
                <Video
                  videoElement={videoElement}
                  videoConfig={{
                    x: 0,
                    y: 0,
                    width: stageConfig.width,
                    height: stageConfig.height,
                    videoFill: branding?.background?.color?.primary,
                    cornerRadius: 0,
                    performClip: true,
                    clipVideoConfig: {
                      x: 0,
                      y: 0,
                      width: 1,
                      height: 1,
                    },
                  }}
                />
              )}
            </Group>
          )
        default:
          return (
            <Image
              x={0}
              y={0}
              width={stageConfig.width}
              height={stageConfig.height}
              image={glassyThemeBackground}
              fill="#040E22"
            />
          )
      }

    default:
      return <></>
  }
}

export default VideoBackground
