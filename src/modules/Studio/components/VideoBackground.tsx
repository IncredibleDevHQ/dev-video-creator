import React from 'react'
import { Group, Image, Line, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { ThemeFragment } from '../../../generated/graphql'
import { studioStore } from '../stores'

const VideoBackground = ({
  theme,
  stageConfig,
}: {
  theme: ThemeFragment
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
  switch (theme.name) {
    case 'DarkGradient':
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
    case 'PastelLines':
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
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill={branding?.background?.color?.primary}
              />
              <Line
                points={[64, 0, 64, stageConfig.height]}
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={[
                  stageConfig.width - 64,
                  0,
                  stageConfig.width - 64,
                  stageConfig.height,
                ]}
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={[0, 36, stageConfig.width, 36]}
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={[
                  0,
                  stageConfig.height - 36,
                  stageConfig.width,
                  stageConfig.height - 36,
                ]}
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
            </Group>
          )
        default:
          return (
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#E0D6ED"
              />
              <Line
                points={[64, 0, 64, stageConfig.height]}
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={[
                  stageConfig.width - 64,
                  0,
                  stageConfig.width - 64,
                  stageConfig.height,
                ]}
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={[0, 36, stageConfig.width, 36]}
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={[
                  0,
                  stageConfig.height - 36,
                  stageConfig.width,
                  stageConfig.height - 36,
                ]}
                stroke="#27272A"
                strokeWidth={1}
              />
            </Group>
          )
      }
    default:
      return <></>
  }
}

export default VideoBackground
