import React from 'react'
import { Group, Image, Line, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { ThemeFragment } from '../../../generated/graphql'
import { studioStore } from '../stores'
import { Video } from './Video'

const VideoBackground = ({
  theme,
  stageConfig,
  isShorts,
}: {
  theme: ThemeFragment
  stageConfig: {
    width: number
    height: number
  }
  isShorts: boolean
}) => {
  const { branding } = useRecoilValue(studioStore)
  const [bgImage] = useImage(branding?.background?.url || '', 'anonymous')
  const [darkGradientThemeBackground] = useImage(
    `${config.storage.baseUrl}themes/glassyThemeBackground.png`,
    'anonymous'
  )
  const [cassidooThemeBg] = useImage(
    `${config.storage.baseUrl}themes/cassidoo/cassidoo.svg`,
    'anonymous'
  )
  const [cassidooPortraitThemeBg] = useImage(
    `${config.storage.baseUrl}themes/cassidoo/cassidooPortrait.svg`,
    'anonymous'
  )
  const [lambdaTestThemeBg] = useImage(
    `${config.storage.baseUrl}themes/LambdaTest/LambdaTestBg.svg`,
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
        default: {
          return (
            <Image
              x={0}
              y={0}
              width={stageConfig.width}
              height={stageConfig.height}
              image={darkGradientThemeBackground}
              fill="#040E22"
            />
          )
        }
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
                points={
                  !isShorts
                    ? [64, 0, 64, stageConfig.height]
                    : [40, 0, 40, stageConfig.height]
                }
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [
                        stageConfig.width - 64,
                        0,
                        stageConfig.width - 64,
                        stageConfig.height,
                      ]
                    : [
                        stageConfig.width - 40,
                        0,
                        stageConfig.width - 40,
                        stageConfig.height,
                      ]
                }
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [0, 36, stageConfig.width, 36]
                    : [0, 40, stageConfig.width, 40]
                }
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [
                        0,
                        stageConfig.height - 36,
                        stageConfig.width,
                        stageConfig.height - 36,
                      ]
                    : [
                        0,
                        stageConfig.height - 40,
                        stageConfig.width,
                        stageConfig.height - 40,
                      ]
                }
                stroke={branding?.colors?.text || '#27272A'}
                strokeWidth={1}
              />
            </Group>
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
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#E0D6ED"
              />
              <Line
                points={
                  !isShorts
                    ? [64, 0, 64, stageConfig.height]
                    : [40, 0, 40, stageConfig.height]
                }
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [
                        stageConfig.width - 64,
                        0,
                        stageConfig.width - 64,
                        stageConfig.height,
                      ]
                    : [
                        stageConfig.width - 40,
                        0,
                        stageConfig.width - 40,
                        stageConfig.height,
                      ]
                }
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [0, 36, stageConfig.width, 36]
                    : [0, 40, stageConfig.width, 40]
                }
                stroke="#27272A"
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [
                        0,
                        stageConfig.height - 36,
                        stageConfig.width,
                        stageConfig.height - 36,
                      ]
                    : [
                        0,
                        stageConfig.height - 40,
                        stageConfig.width,
                        stageConfig.height - 40,
                      ]
                }
                stroke="#27272A"
                strokeWidth={1}
              />
            </Group>
          )
      }
    case 'Cassidoo':
      switch (branding?.background?.type) {
        case 'image':
          return (
            <Group>
              <Image
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                image={bgImage}
              />
              <Text
                text="Cassidoo"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Roboto Mono"
              />
            </Group>
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
              <Text
                text="Cassidoo"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Roboto Mono"
              />
            </Group>
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
              <Text
                text="Cassidoo"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Roboto Mono"
              />
            </Group>
          )
        default: {
          return (
            <Group>
              <Image
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                image={!isShorts ? cassidooThemeBg : cassidooPortraitThemeBg}
                fillLinearGradientColorStops={[
                  0,
                  '#10A2F5',
                  0.4945,
                  '#CA839F',
                  1,
                  '#24D05A',
                ]}
                fillLinearGradientStartPoint={{ x: -100, y: -100 }}
                fillLinearGradientEndPoint={{
                  x: stageConfig.width + 200,
                  y: stageConfig.height + 200,
                }}
              />
              <Text
                text="Cassidoo"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Roboto Mono"
              />
            </Group>
          )
        }
      }
    case 'LambdaTest':
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
        default: {
          return (
            <Image
              x={0}
              y={0}
              width={stageConfig.width}
              height={stageConfig.height}
              image={lambdaTestThemeBg}
              fill="#6AB3D3"
            />
          )
        }
      }
    default:
      return <></>
  }
}

export default VideoBackground
