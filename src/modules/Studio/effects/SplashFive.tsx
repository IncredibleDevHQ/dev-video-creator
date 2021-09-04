import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Line, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import FontFaceObserver from 'fontfaceobserver'
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

  const handleRecord = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Rect
        key="firstRect"
        x={-500}
        y={500}
        width={500}
        height={75}
        fill="#7B16A2"
        rotation={-45}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: -60,
            y: 60,
            // easing: Konva.Easings.BackEaseInOut,
          })
        }}
      />,
      <Rect
        key="secondRect"
        x={CONFIG.width + 140}
        y={0}
        width={600}
        height={75}
        fill="#4A148A"
        rotation={-45}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 550,
            y: 550,
            // easing: Konva.Easings.BackEaseInOut,
          })
        }}
      />,
      <Rect
        key="thirdRect"
        x={200}
        y={1005}
        width={600}
        height={75}
        fill="#7B16A2"
        rotation={-45}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 600,
            y: 605,
            // easing: Konva.Easings.BackEaseInOut,
          })
        }}
      />,
      <Rect
        key="fourthRect"
        x={1055}
        y={255}
        width={600}
        height={75}
        fill="#BB6AC9"
        rotation={-45}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 655,
            y: 655,
            // easing: Konva.Easings.BackEaseInOut,
          })
        }}
      />,
      <Rect
        key="fifthRect"
        x={310}
        y={1105}
        width={500}
        height={75}
        fill="#E3BDEA"
        rotation={-45}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 710,
            y: 705,
            // easing: Konva.Easings.BackEaseInOut,
          })
        }}
      />,
      <Text
        key="title"
        x={-1000}
        y={150}
        text="Machine Learning Zero to Hero"
        fontSize={60}
        fontFamily="Poppins"
        fill="#000000"
        align="left"
        opacity={1}
        width={600}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 1,
              x: 75,
              easing: Konva.Easings.BackEaseInOut,
            })
          }, 1000)
        }}
      />,
      <Text
        key="subTitle"
        x={-1000}
        y={290}
        text="Getting started with TensorFlow - Regression"
        fontSize={30}
        fontFamily="Poppins"
        lineHeight={1.25}
        fill="#5C595A"
        align="left"
        width={400}
        opacity={1}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 1,
              x: 75,
              easing: Konva.Easings.BackEaseInOut,
            })
          }, 1000)
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
