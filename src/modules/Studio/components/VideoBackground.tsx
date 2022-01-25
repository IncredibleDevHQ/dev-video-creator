import React from 'react'
import { Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { VideoTheme } from '../../../utils/configTypes'
import { studioStore } from '../stores'

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
