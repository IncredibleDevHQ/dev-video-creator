import Konva from 'konva'
import React, { createRef, useEffect, useMemo, useState } from 'react'
import { Circle, Group, Image, Layer, Rect, Stage, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { RectReadOnly } from 'react-use-measure'
import { useRecoilBridgeAcrossReactRoots_UNSTABLE } from 'recoil'
import { useGetHW } from '../Flick/components/IntroOutroView'
import { Video } from '../Studio/components/Video'
import useEdit from '../Studio/hooks/use-edit'
import { BrandingInterface } from './BrandingPage'

const CONFIG = {
  width: 747,
  height: 420,
}

const BrandPreview = ({
  branding,
  bounds,
}: {
  branding: BrandingInterface
  bounds: RectReadOnly
}) => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  Konva.pixelRatio = 2

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height / 1.2,
    maxW: bounds.width / 1.2,
    aspectRatio: 16 / 9,
  })

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.2,
    maxW: bounds.width / 1.2,
    aspectRatio: 16 / 9,
  })

  const [personA] = useImage(
    `https://images.unsplash.com/photo-1530268729831-4b0b9e170218?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80`,
    'anonymous'
  )
  const [personB] = useImage(
    `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=776&q=80`,
    'anonymous'
  )
  const [laptop] = useImage(
    `https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1744&q=80`,
    'anonymous'
  )

  const [logo] = useImage(branding.branding?.logo || '', 'anonymous')

  const { clipRect } = useEdit()

  return (
    <div
      style={{
        height: divHeight,
        width: divWidth,
      }}
      className="flex justify-center"
    >
      <Stage
        ref={stageRef}
        height={height}
        width={width}
        scale={{
          x: height / CONFIG.height,
          y: width / CONFIG.width,
        }}
      >
        <Bridge>
          <Layer ref={layerRef}>
            {/* First Rect */}
            <Rect
              cornerRadius={8}
              x={1}
              y={13}
              // fill="#000"
              width={189}
              height={394}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
            <Background
              x={1}
              y={13}
              width={189}
              height={394}
              branding={branding}
            />
            <Rect
              cornerRadius={4}
              x={12}
              y={28}
              fill={branding.branding?.colors?.primary || '#1F2937'}
              width={165}
              height={176}
            />
            <Text
              x={24}
              y={40}
              text="Heading"
              fontSize={16}
              fontFamily="Gilroy"
              fontStyle="bold"
              lineHeight={1.2}
              fill={branding.branding?.colors?.text || '#F9FAFB'}
              align="center"
              verticalAlign="middle"
            />
            {['one', 'two', 'three', 'four'].map((item, index) => {
              return (
                <>
                  <Circle
                    x={27}
                    borderRadius={3}
                    y={80 + index * 20}
                    fill={branding.branding?.colors?.text || '#F9FAFB'}
                  />
                  <Text
                    x={38}
                    y={72 + index * 20}
                    text={`This is point ${item}`}
                    fontSize={14}
                    fontFamily="Inter"
                    fontStyle="regular"
                    fill={branding.branding?.colors?.text || '#F9FAFB'}
                    align="left"
                    verticalAlign="middle"
                  />
                </>
              )
            })}
            <Group
              y={216}
              x={12}
              clipFunc={(ctx: any) => {
                clipRect(ctx, {
                  x: 0,
                  y: 0,
                  width: 165,
                  height: 176,
                  borderRadius: 4,
                })
              }}
            >
              <Image image={personB} width={165} height={247.5} />
            </Group>
            {/* Second Rect */}
            <Rect
              cornerRadius={8}
              x={205}
              y={13}
              fill="#000"
              width={336}
              height={189}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
            <Background
              x={205}
              y={13}
              width={336}
              height={189}
              branding={branding}
            />
            <Group
              y={10.32}
              x={222.32}
              clipFunc={(ctx: any) => {
                clipRect(ctx, {
                  x: 0,
                  y: 20,
                  width: 302,
                  height: 156,
                  borderRadius: 4,
                })
              }}
            >
              <Image image={personA} width={302} height={201.33} />
            </Group>
            {logo && (
              <Image
                x={507.35 - 21 * (logo.width / logo.height)}
                y={44.59}
                image={logo}
                height={21}
                width={21 * (logo.width / logo.height)}
              />
            )}
            {/* Third Rect */}
            <Rect
              cornerRadius={8}
              x={205}
              y={218}
              fill="#000"
              width={336}
              height={189}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
            <Background
              x={205}
              y={218}
              width={336}
              height={189}
              branding={branding}
            />
            <Rect
              cornerRadius={4}
              x={215.5}
              y={233.75}
              fill="#1F2937"
              width={279.3}
              height={157.5}
            />
            <Group
              y={258.25}
              x={409.8}
              clipFunc={(ctx: any) => {
                clipRect(ctx, {
                  x: 50,
                  y: 0,
                  width: 70,
                  height: 109.2,
                  borderRadius: 4,
                })
              }}
            >
              <Image image={personA} width={163.8} height={109.2} />
            </Group>
            {/* Fourth Rect */}
            <Rect
              cornerRadius={8}
              x={557}
              y={13}
              fill="#000"
              width={189}
              height={189}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
            <Background
              x={557}
              y={13}
              width={189}
              height={189}
              branding={branding}
            />
            <Group
              y={29.8}
              x={533.8}
              clipFunc={(ctx: any) => {
                clipRect(ctx, {
                  x: 40,
                  y: 0,
                  width: 155.4,
                  height: 155.4,
                  borderRadius: 4,
                })
              }}
            >
              <Image image={laptop} width={233.1} height={155.4} />
            </Group>
            {/* Fifth Rect */}
            <Rect
              cornerRadius={8}
              x={557}
              y={218}
              fill={branding.branding?.colors?.primary || '#1F2937'}
              width={189}
              height={189}
              stroke="#D4D4D8"
              strokeWidth={1}
            />
            <Background
              x={557}
              y={218}
              width={189}
              height={189}
              branding={branding}
            />
            <Text
              x={580.1}
              y={293}
              text="This is your text color and font"
              fontSize={14}
              fontFamily="Gilroy"
              fontStyle="bold"
              lineHeight={1.2}
              fill={branding.branding?.colors?.text || '#000000'}
              align="center"
              width={133.81}
              height={40}
              verticalAlign="middle"
            />
            {logo && (
              <Image
                x={573.62}
                y={235.16}
                image={logo}
                height={21}
                width={21 * (logo.width / logo.height)}
              />
            )}
          </Layer>
        </Bridge>
      </Stage>
    </div>
  )
}

const Background = ({
  height,
  width,
  x,
  y,
  branding,
}: {
  x: number
  y: number
  width: number
  height: number
  branding: BrandingInterface
}) => {
  const [backgroundImage] = useImage(
    branding.branding?.background?.url || '',
    'anonymous'
  )

  const { clipRect } = useEdit()

  const adjust = useMemo(() => {
    if (backgroundImage) {
      if (backgroundImage.width > backgroundImage.height) {
        return (
          (height *
            ((backgroundImage.width || 0) / (backgroundImage.height || 0)) -
            width) /
          2
        )
      }
    }
    return 0
  }, [backgroundImage])

  const [mediaSize, setMediaSize] = useState<{
    width: number
    height: number
    ratio: number
  }>()

  const onLoad = () => {
    if (!videoElement) return
    if (videoElement.videoWidth > videoElement.videoHeight) {
      setMediaSize({
        width: height * (videoElement.videoWidth / videoElement.videoHeight),
        height,
        ratio: videoElement.videoWidth / videoElement.videoHeight,
      })
    } else {
      setMediaSize({
        width,
        height: width * (videoElement.videoHeight / videoElement.videoWidth),
        ratio: videoElement.videoWidth / videoElement.videoHeight,
      })
    }
    videoElement.play()
  }

  const videoElement = useMemo(() => {
    if (branding.branding?.background?.type === 'video') {
      const element = document.createElement('video')
      element.crossOrigin = 'anonymous'
      element.preload = 'auto'
      element.muted = true
      element.loop = true
      element.src = branding.branding?.background?.url || ''
      element.addEventListener('loadedmetadata', onLoad)
      return element
    }
    setMediaSize(undefined)
    return null
  }, [branding.branding?.background?.url])

  useEffect(() => {
    if (!backgroundImage) return
    if (backgroundImage.width > backgroundImage.height) {
      setMediaSize({
        width: height * (backgroundImage.width / backgroundImage.height),
        height,
        ratio: backgroundImage.width / backgroundImage.height,
      })
    } else {
      setMediaSize({
        width,
        height: width * (backgroundImage.height / backgroundImage.width),
        ratio: backgroundImage.width / backgroundImage.height,
      })
    }
  }, [backgroundImage])

  return (
    <>
      {(() => {
        switch (branding.branding?.background?.type) {
          case 'video':
            return (
              <>
                {videoElement && mediaSize ? (
                  <Group
                    x={x}
                    y={y}
                    clipFunc={(ctx: any) => {
                      clipRect(ctx, {
                        x: 0,
                        y: 0,
                        width,
                        height,
                        borderRadius: 8,
                      })
                    }}
                  >
                    <Video
                      key={videoElement.src}
                      videoElement={videoElement}
                      videoConfig={{
                        x: 0,
                        y: 0,
                        width: mediaSize.width,
                        height: mediaSize.height,
                        cornerRadius: 8,
                        performClip: true,
                        clipVideoConfig: {
                          x: 0,
                          y: 0,
                          width: 1,
                          height: 1,
                        },
                      }}
                    />
                  </Group>
                ) : (
                  <Rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    cornerRadius={8}
                    fill={
                      branding.branding?.background?.color?.primary || '#fff'
                    }
                  />
                )}
              </>
            )
          case 'color':
            return (
              <Rect
                cornerRadius={8}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={branding.branding?.background?.color?.primary || '#fff'}
              />
            )
          case 'image':
            return (
              <Group
                x={x - adjust}
                y={y}
                clipFunc={(ctx: any) => {
                  clipRect(ctx, {
                    x: adjust,
                    y: 0,
                    width,
                    height,
                    borderRadius: 8,
                  })
                }}
              >
                {backgroundImage && mediaSize && (
                  <Image
                    width={mediaSize.width}
                    height={mediaSize.height}
                    image={backgroundImage}
                  />
                )}
              </Group>
            )
          default:
            return (
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                cornerRadius={8}
                fill={branding.branding?.background?.color?.primary || '#fff'}
              />
            )
        }
      })()}
    </>
  )
}

export default BrandPreview
