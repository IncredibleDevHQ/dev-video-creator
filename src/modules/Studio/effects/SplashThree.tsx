import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'

const SplashThree = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [logo] = useImage(
    'http://incredible-uploads-staging.s3.us-west-1.amazonaws.com/idev-logo.svg',
    'anonymous'
  )
  const [logoText] = useImage(
    'http://incredible-uploads-staging.s3.us-west-1.amazonaws.com/incredible.svg',
    'anonymous'
  )

  const [versionLogo] = useImage(
    'https://incredible-uploads-staging.s3.us-west-1.amazonaws.com/version-logo.svg',
    'anonymous'
  )

  const [imageDimensions, setImageDimensions] = useState({
    logoWidth: 60,
    logoHeight: 60,
    logoTextWidth: 158,
    logoTextHeight: 26,
    versionLogoWidth: 265,
    versionLogoHeight: 30,
  })

  const controls: any = []

  const versionLogoRef = useRef<Konva.Image | null>(null)

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
      <Group x={390} y={227}>
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
        width={470}
        height={CONFIG.height}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            width: 350,
            duration: 0.4,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  width: 480,
                  duration: 0.6,
                })
              }, 600)
            },
          })
        }
      />,
      <Image
        image={logo}
        x={(CONFIG.width - imageDimensions.logoWidth) / 2}
        y={(CONFIG.height - imageDimensions.logoHeight) / 2}
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
                  x: (CONFIG.width - imageDimensions.logoWidth) / 2,
                  rotation: 90,
                  easing: Konva.Easings.BackEaseInOut,
                  duration: 0.6,
                  onFinish: () => {
                    ref?.to({
                      opacity: 0,
                      duration: 0.6,
                      onFinish: () => {
                        versionLogoRef.current?.to({
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
        image={versionLogo}
        x={(CONFIG.width - imageDimensions.versionLogoWidth) / 2}
        y={(CONFIG.height - imageDimensions.versionLogoHeight) / 2 - 20}
        width={imageDimensions.versionLogoWidth}
        height={imageDimensions.versionLogoHeight}
        ref={versionLogoRef}
        opacity={0}
      />,
    ])
  }

  return (
    <Concourse
      disableUserMedia
      layerChildren={layerChildren}
      controls={controls}
    />
  )
}

export default SplashThree
