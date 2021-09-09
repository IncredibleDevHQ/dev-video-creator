import React, { useEffect, useRef, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import config from '../../../config'

const SplashThree = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [wallPaper] = useImage(
    `${config.storage.baseUrl}cassidyWallPaper.png`,
    'anonymous'
  )
  const [userImage] = useImage(
    `${config.storage.baseUrl}Cassidy.png`,
    'anonymous'
  )
  const [emoji] = useImage(
    `${config.storage.baseUrl}raised-hand.png`,
    'anonymous'
  )

  const [imageDimensions, setImageDimensions] = useState({
    userImageWidth: 309,
    userImageHeight: 309,
    emojiWidth: 54,
    emojiHeight: 54,
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
      <Image
        image={wallPaper}
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
      />,
      <Image
        image={userImage}
        x={592}
        y={62}
        width={imageDimensions.userImageWidth}
        height={imageDimensions.userImageHeight}
      />,
      <Image
        image={emoji}
        x={900}
        y={106}
        rotation={23}
        width={imageDimensions.emojiWidth}
        height={imageDimensions.emojiHeight}
        // offsetX={imageDimensions.emojiWidth / 2}
        // offsetY={imageDimensions.emojiHeight / 2}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            x: 808,
            y: 60,
            rotation: 10,
            opacity: 1,
            easing: Konva.Easings.EaseIn,
            onFinish: () => {
              ref?.to({
                x: 830,
                y: 70,
                rotation: 15,
                easing: Konva.Easings.EaseIn,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      x: 830,
                      y: 70,
                      rotation: 15,
                      easing: Konva.Easings.EaseIn,
                    })
                  }, 1000)
                },
              })
            },
          })
        }}
      />,
      <Rect
        x={26}
        y={371}
        width={537}
        height={118}
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={5}
      />,
      <Text
        key="username"
        x={54}
        y={446}
        text="Cassidy Williams"
        fontSize={48}
        fontStyle="bold"
        fontFamily="Roboto Mono"
        fill="#000000"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 0.3,
            y: 389,
            opacity: 1,
            easing: Konva.Easings.EaseIn,
          })
        }}
      />,
      <Rect x={31} y={441} width={529} height={43} fill="#ffffff" />,
      <Text
        key="username"
        x={54}
        y={446}
        text="Director of Developer Experience @ Netlify"
        fontSize={18}
        fontStyle="bold"
        fontFamily="Roboto Mono"
        fill="#6b7280"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 0.3,
            opacity: 1,
          })
        }}
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
