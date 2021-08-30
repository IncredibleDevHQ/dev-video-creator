import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'

interface Dimension {
  width: number
  height: number
}

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

  const [logoDimensions, setLogoDimensions] = useState<Dimension>({
    width: 60,
    height: 60,
  })

  const [logoTextDimensions, setLogoTextDimensions] = useState<Dimension>({
    width: 158,
    height: 26,
  })

  const [versionLogoDimensions, setVersionLogoDimensions] = useState<Dimension>(
    {
      width: 265,
      height: 30,
    }
  )

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
          x={-logoTextDimensions.width}
          y={0}
          width={logoTextDimensions.width}
          height={logoTextDimensions.height}
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
                    x: -logoTextDimensions.width,
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
        x={(CONFIG.width - logoDimensions.width) / 2}
        y={(CONFIG.height - logoDimensions.height) / 2}
        width={logoDimensions.width}
        height={logoDimensions.height}
        offsetX={logoDimensions.width / 2}
        offsetY={logoDimensions.height / 2}
        ref={(ref) => {
          ref?.to({
            rotation: -90,
            x: 362,
            easing: Konva.Easings.BackEaseInOut,
            duration: 0.4,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: (CONFIG.width - logoDimensions.width) / 2,
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
        x={(CONFIG.width - versionLogoDimensions.width) / 2}
        y={(CONFIG.height - versionLogoDimensions.height) / 2 - 20}
        width={versionLogoDimensions.width}
        height={versionLogoDimensions.height}
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
