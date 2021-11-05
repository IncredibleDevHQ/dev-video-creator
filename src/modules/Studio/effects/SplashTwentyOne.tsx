import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import config from '../../../config'

const SplashTwentyOne = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [logo] = useImage(`${config.storage.baseUrl}idev-logo.svg`, 'anonymous')
  const [logoText] = useImage(
    `${config.storage.baseUrl}incredible.svg`,
    'anonymous'
  )
  const [secondaryLogo] = useImage(
    `${config.storage.baseUrl}Svelte.svg`,
    'anonymous'
  )
  const [secondaryBg] = useImage(
    `${config.storage.baseUrl}svelte_bg.svg`,
    'anonymous'
  )

  const [imageDimensions] = useState({
    logoWidth: 60,
    logoHeight: 60,
    logoTextWidth: 158,
    logoTextHeight: 26,
    secondaryLogoWidth: 244,
    secondaryLogoHeight: 100,
  })

  const controls: any = []

  const secondaryLogoRef = useRef<Konva.Image | null>(null)
  const secondaryBgRef = useRef<Konva.Image | null>(null)

  useEffect(() => {
    if (state === 'recording') {
      handleRecord()
    }
  }, [state])

  const [layerChildren, setLayerChildren] = useState([
    <Rect
      x={0}
      y={0}
      fill="#ffffff"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const handleRecord = () => {
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
                      duration: 0.6,
                      onFinish: () => {
                        secondaryLogoRef.current?.to({
                          opacity: 1,
                          duration: 0.3,
                        })
                        secondaryBgRef.current?.to({
                          opacity: 1,
                          duration: 0.3,
                        })
                      },
                    })
                    ref?.to({
                      scaleX: 24,
                      scaleY: 24,
                      easing: Konva.Easings.BackEaseInOut,
                      duration: 0.6,
                    })
                  },
                })
              }, 600)
            },
          })
        }}
      />,
      <Image
        image={secondaryBg}
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        ref={secondaryBgRef}
        opacity={0}
      />,
      <Image
        image={secondaryLogo}
        x={
          (CONFIG.width -
            (secondaryLogo?.width ? secondaryLogo?.width * 3 : 0)) /
          2
        }
        y={
          (CONFIG.height -
            (secondaryLogo?.width ? secondaryLogo?.height * 3 : 0)) /
          2
        }
        width={secondaryLogo?.width ? secondaryLogo?.width * 3 : 0}
        height={secondaryLogo?.height ? secondaryLogo?.height * 3 : 0}
        ref={secondaryLogoRef}
        opacity={0}
      />,
    ])
  }

  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashTwentyOne
