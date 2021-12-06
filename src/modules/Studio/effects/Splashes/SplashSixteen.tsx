import FontFaceObserver from 'fontfaceobserver'
import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Circle, Group, Image, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import Concourse, { CONFIG } from '../../components/Concourse'
import useSplash, { Coordinates } from '../../hooks/use-splash'
import { StudioProviderProps, studioStore } from '../../stores'

const SplashSixteen = () => {
  const { state, fragment } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()

  useEffect(() => {
    if (!fragment) return
    setConfiguration({
      title: { value: fragment?.flick?.name },
      subTitle: { value: fragment?.flick?.description },
    })
  }, [fragment])

  const { getInitCoordinates } = useSplash()

  const controls: any = []

  const [W] = useImage(`${config.storage.baseUrl}W.svg`, 'anonymous')
  const [T] = useImage(`${config.storage.baseUrl}T.svg`, 'anonymous')
  const [F] = useImage(`${config.storage.baseUrl}F.svg`, 'anonymous')
  const [JS] = useImage(`${config.storage.baseUrl}JS.svg`, 'anonymous')
  const [wtfjsLogo] = useImage(
    `${config.storage.baseUrl}WTFJS.svg`,
    'anonymous'
  )
  const [logo] = useImage(`${config.storage.baseUrl}idev-logo.svg`, 'anonymous')
  const [logoText] = useImage(
    `${config.storage.baseUrl}incredible.svg`,
    'anonymous'
  )

  const [imageDimensions, setImageDimensions] = useState({
    logoWidth: 60,
    logoHeight: 60,
    logoTextWidth: 158,
    logoTextHeight: 26,
    secondaryLogoWidth: 244,
    secondaryLogoHeight: 100,
  })

  let coordinate: Coordinates = {
    titleX: 0,
    titleY: 0,
    subTitleX: 0,
    subTitleY: 0,
    titleHeight: 0,
  }

  const gutter = 10
  const titleWidth = 600
  const titleFontSize = 60
  const subTitleFontSize = 30

  useEffect(() => {
    if (state === 'recording') {
      coordinate = getInitCoordinates({
        title: configuration?.title.value as string,
        subTitle: configuration?.subTitle.value as string,
        gutter,
        availableWidth: titleWidth - 100,
        titleFontSize,
        subTitleFontSize,
        stageWidth: 960,
        stageHeight: 540,
      })

      getLayerChildren()
    }
  }, [state, configuration])

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  const [layerChildren, setLayerChildren] = useState([
    <Rect
      x={0}
      y={0}
      fill="#ffffff"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Group x={390} y={247}>
        <Image
          image={logoText}
          x={-imageDimensions.logoTextWidth}
          y={0}
          width={imageDimensions.logoTextWidth}
          height={imageDimensions.logoTextHeight}
          opacity={0}
          ref={(ref) =>
            ref?.to({
              x: 14,
              opacity: 1,
              duration: 0.4,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: -imageDimensions.logoTextWidth,
                    duration: 0.6,
                  })
                }, 600)
              },
            })
          }
        />
      </Group>,
      <Rect
        x={0}
        y={0}
        width={460}
        height={CONFIG.height}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            width: 375,
            duration: 0.4,
            easing: Konva.Easings.BackEaseInOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  width: 460,
                  duration: 0.6,
                  easing: Konva.Easings.BackEaseInOut,
                })
              }, 600)
            },
          })
        }
      />,
      <Image
        image={logo}
        x={CONFIG.width / 2}
        y={CONFIG.height / 2 - 10}
        width={imageDimensions.logoWidth}
        height={imageDimensions.logoHeight}
        offsetX={imageDimensions.logoWidth / 2}
        offsetY={imageDimensions.logoHeight / 2}
        ref={(ref) => {
          ref?.to({
            rotation: -90,
            x: 362,
            easing: Konva.Easings.BackEaseInOut,
            duration: 0.4,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: CONFIG.width / 2,
                  rotation: 90,
                  easing: Konva.Easings.BackEaseInOut,
                  duration: 0.6,
                  onFinish: () => {
                    ref?.to({
                      opacity: 0,
                      scaleX: 24,
                      scaleY: 24,
                      duration: 0.6,
                    })
                  },
                })
              }, 600)
            },
          })
        }}
      />,
      <Group
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        offsetX={CONFIG.width / 2}
        offsetY={CONFIG.height / 2}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.3,
              scaleX: 2,
              scaleY: 2,
              onFinish: () => {
                ref?.to({
                  duration: 0.3,
                  scaleX: 3,
                  scaleY: 3,
                  onFinish: () => {
                    ref?.to({
                      duration: 0.3,
                      scaleX: 0,
                      scaleY: 0,
                    })
                  },
                })
              },
            })
          }, 2900)
        }}
      >
        <Group
          x={234}
          y={247}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.3,
                x: 194,
              })
            }, 2600)
          }}
        >
          <Image
            image={W}
            x={0}
            y={0}
            opacity={0}
            ref={(ref) => {
              setTimeout(() => {
                ref?.to({
                  opacity: 1,
                  duration: 0.3,
                  x: 180,
                })
              }, 2200)
            }}
          />
          <Image
            image={T}
            x={229}
            y={0}
            opacity={0}
            ref={(ref) => {
              setTimeout(() => {
                ref?.to({
                  opacity: 1,
                  duration: 0.3,
                  x: 249,
                })
              }, 2200)
            }}
          />
          <Image
            image={F}
            x={432}
            y={0}
            opacity={0}
            ref={(ref) => {
              setTimeout(() => {
                ref?.to({
                  opacity: 1,
                  duration: 0.3,
                  x: 286,
                })
              }, 2200)
            }}
          />
        </Group>
        <Image
          image={JS}
          x={510}
          y={CONFIG.height}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.3,
                y: 247,
              })
            }, 2600)
          }}
        />
      </Group>,
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={10}
        opacity={0}
        fill="#1F2937"
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.3,
              scaleX: 100,
              scaleY: 100,
              opacity: 1,
            })
          }, 3800)
        }}
      />,
      <Group
        x={230}
        y={-328}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              y: 130,
              duration: 1,
              easing: Konva.Easings.BackEaseOut,
            })
          }, 4100)
        }}
      >
        <Rect x={0} y={0} width={500} height={280} fill="#ffffff" />
        <Text
          key="text1"
          x={50}
          y={32}
          text="A list of funny and tricky JavaScript examples"
          fontSize={48}
          fontFamily="Poppins"
          fontStyle="normal 300"
          lineHeight={1.2}
          fill="#1F2937"
          align="left"
          width={420}
        />
        <Image image={wtfjsLogo} x={0} y={300} />
      </Group>,
    ])
  }
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashSixteen
