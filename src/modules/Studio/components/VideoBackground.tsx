import React from 'react'
import { Circle, Group, Image, Line, Rect, Ring, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
import { ThemeFragment } from '../../../generated/graphql'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { studioStore } from '../stores'
import { Video } from './Video'

const VideoBackground = ({
  theme,
  stageConfig,
  isShorts,
  branding: brandingProp,
}: {
  theme: ThemeFragment
  stageConfig: {
    width: number
    height: number
  }
  isShorts: boolean
  branding?: BrandingJSON | null
}) => {
  const brandingFromStore = useRecoilValue(studioStore).branding
  const branding = brandingProp || brandingFromStore
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
  const [web3AuthThemeBg] = useImage(
    `${config.storage.baseUrl}themes/Web3Auth/Web3AuthBg.svg`,
    'anonymous'
  )
  const [web3AuthShortsThemeBg] = useImage(
    `${config.storage.baseUrl}themes/Web3Auth/Web3AuthShortsBg.svg`,
    'anonymous'
  )
  const [shrutiKapoorThemeBg] = useImage(
    `${config.storage.baseUrl}themes/ShrutiKapoor/shrutiKapoorBg.svg`,
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
    case 'LeeRob':
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
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#000000"
              />
              {[160, 320, 480, 640, 800].map((x) => {
                return (
                  <Line
                    points={[x, 0, x, stageConfig.height]}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    opacity={0.2}
                  />
                )
              })}
            </Group>
          )
        }
      }
    case 'Web3Auth':
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
                fill="#040E22"
              />
              <Text
                text="Web3Auth"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="D M Sans"
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
                text="Web3Auth"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="D M Sans"
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
                text="Web3Auth"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="D M Sans"
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
                image={!isShorts ? web3AuthThemeBg : web3AuthShortsThemeBg}
                fill="#27272A"
              />
              <Text
                text="Web3Auth"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="D M Sans"
              />
            </Group>
          )
        }
      }
    case 'DevsForUkraine':
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Montserrat"
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Montserrat"
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Montserrat"
              />
            </Group>
          )
        default: {
          return (
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#1C1C1C"
              />
              <Ring
                x={-3}
                y={67}
                innerRadius={28}
                outerRadius={36}
                fill="#FAFAFA"
              />
              <Rect
                x={!isShorts ? -20 : -40}
                y={!isShorts ? 500 : 639}
                width={64}
                height={8}
                fill="#FAFAFA"
              />
              <Circle x={628} y={477} radius={20} fill="#E2CE68" />
              <Circle
                x={!isShorts ? 868 : 302}
                y={!isShorts ? 548 : 720}
                radius={36}
                fill="#2696FA"
              />
              <Ring
                x={stageConfig.width + 5}
                y={212}
                innerRadius={28}
                outerRadius={36}
                fill="#FFE87B"
              />
              <Text
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Montserrat"
              />
            </Group>
          )
        }
      }
    case 'Whitep4nth3r':
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
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
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
              />
            </Group>
          )
        default: {
          return (
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#0F111A"
              />
              <Text
                text="DevsForUkraine"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
              />
            </Group>
          )
        }
      }
    case 'VetsWhoCode':
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
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Gotham"
              />
              <Text
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="GothamLight"
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
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Gotham"
              />
              <Text
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="GothamLight"
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
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Gotham"
              />
              <Text
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="GothamLight"
              />
            </Group>
          )
        default: {
          return (
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#091F40"
              />
              <Rect
                x={!isShorts ? 44 : 16}
                y={!isShorts ? 45 : 16}
                width={
                  !isShorts ? stageConfig.width - 88 : stageConfig.width - 32
                }
                height={
                  !isShorts ? stageConfig.height - 90 : stageConfig.height - 32
                }
                stroke="#ffffff"
                strokeWidth={1}
                dash={[10, 5.5]}
              />
              <Text
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Gotham"
              />
              <Text
                text="VetsWhoCode"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="GothamLight"
              />
            </Group>
          )
        }
      }
    case 'ShrutiKapoor':
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
                fill="#040E22"
              />
              <Text
                text="ShrutiKapoor"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Space Mono"
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
                text="ShrutiKapoor"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Space Mono"
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
                text="ShrutiKapoor"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Space Mono"
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
                image={shrutiKapoorThemeBg}
                fill="#18181B"
              />
              <Text
                text="ShrutiKapoor"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Space Mono"
              />
            </Group>
          )
        }
      }
    case 'Mux':
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
                text="Mux"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
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
              <Line
                points={!isShorts ? [40, 40, 520, 40] : [40, 40, 520, 40]}
                stroke={branding?.colors?.text || '#383838'}
                strokeWidth={1}
              />
              <Line
                points={!isShorts ? [440, 500, 920, 500] : [40, 40, 520, 40]}
                stroke={branding?.colors?.text || '#383838'}
                strokeWidth={1}
              />
              <Text
                text="Mux"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
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
                text="Mux"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
              />
            </Group>
          )
        default: {
          return (
            <Group>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fillLinearGradientColorStops={[0, '#FB249119', 1, '#FB501D19']}
                fillLinearGradientStartPoint={{ x: stageConfig.width, y: 0 }}
                fillLinearGradientEndPoint={{
                  x: 0,
                  y: stageConfig.height,
                }}
              />
              <Line
                points={
                  !isShorts
                    ? [40, 40, 520, 40]
                    : [16, 16, stageConfig.width / 2 + 16, 16]
                }
                stroke="#383838"
                strokeWidth={1}
              />
              <Line
                points={
                  !isShorts
                    ? [440, 500, 920, 500]
                    : [182, 688, stageConfig.width / 2 + 182, 688]
                }
                stroke="#383838"
                strokeWidth={1}
              />
              <Text
                text="Mux"
                x={0}
                y={0}
                fontSize={2}
                fill="#fff"
                opacity={0}
                fontFamily="Work Sans"
              />
            </Group>
          )
        }
      }
    default:
      return <></>
  }
}

export default VideoBackground
