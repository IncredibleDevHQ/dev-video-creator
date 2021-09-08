import React, { useEffect, useRef, useState } from 'react'
import { Image, Rect, Text } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import { Coordinates } from '../hooks/use-splash'
import useSplash from '../hooks/use-splash'
import { SchemaElementProps } from '../../Flick/components/Effects'

interface Dimension {
  width: number
  height: number
}
const Video = ({ videoElement }: { videoElement: HTMLVideoElement }) => {
  const imageRef = React.useRef<Konva.Image>(null)
  const [size, setSize] = useState<Dimension>({
    width: (CONFIG.height * 16) / 9,
    height: CONFIG.height,
  })

  // when video is loaded, we should read it size
  React.useEffect(() => {
    const onload = () => {
      setSize({
        width:
          (CONFIG.height * videoElement.videoWidth) / videoElement.videoHeight,
        height: CONFIG.height,
      })
    }
    videoElement.addEventListener('loadedmetadata', onload)
    return () => {
      videoElement.removeEventListener('loadedmetadata', onload)
    }
  }, [videoElement])

  // use Konva.Animation to redraw a layer
  useEffect(() => {
    // @ts-ignore
    const layer = imageRef.current?.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    return () => {
      anim.stop()
    }
  }, [videoElement])

  return (
    <Image
      x={
        (CONFIG.width -
          (CONFIG.height * videoElement.videoWidth) /
            videoElement.videoHeight) /
        2
      }
      ref={imageRef}
      image={videoElement}
      width={
        (CONFIG.height * videoElement.videoWidth) / videoElement.videoHeight
      }
      height={size.height}
    />
  )
}

const SplashFive = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  let coordinate: Coordinates = {
    titleX: 0,
    titleY: 0,
    subTitleX: 0,
    subTitleY: 0,
    titleHeight: 0,
  }
  const tempConfig: SchemaElementProps[] = [
    {
      dirty: false,
      value: true,
      editable: true,
      required: true,
      key: 'customSplash',
      name: 'Custom Splash',
      type: 'boolean',
      description: 'Do you want to show the title splash?',
    },
    {
      dirty: true,
      editable: true,
      value:
        'https://incredible-uploads-staging.s3.us-west-1.amazonaws.com/YHVvezrJqVm2q9AFCfTcvQY2uZhQ7tyd.mp4',
      required: true,
      key: 'source',
      name: 'Source URL',
      type: 'text',
      description: 'Add Custom Splash Video url',
    },
    {
      dirty: true,
      value: 'title',
      editable: true,
      required: true,
      key: 'title',
      name: 'Title',
      type: 'text',
      description: 'Title',
    },
    {
      dirty: true,
      value: 'lol',
      editable: true,
      required: true,
      key: 'subtitle',
      name: 'Subtitle',
      type: 'text',
      description: 'Subtitle',
    },
    {
      dirty: true,
      value: '0',
      editable: true,
      required: true,
      key: 'theme',
      name: 'Theme Number',
      type: 'text',
      description: "The theme's number",
    },
  ]
  const [customSplash, source, title, subTitle] = tempConfig

  const { getInitCoordinates } = useSplash()

  const controls: any = []

  const gutter = 10
  const titleWidth = 600
  const titleFontSize = 60
  const subTitleFontSize = 30

  const videoElement = React.useMemo(() => {
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.src = source.value
    return element
  }, [source])

  useEffect(() => {
    if (customSplash.value) {
      if (!videoElement) return
      if (state === 'recording') {
        videoElement?.play()
      }

      getLayerChildren()
    } else if (state === 'recording') {
      coordinate = getInitCoordinates({
        title: title.value as string,
        subTitle: subTitle.value as string,
        gutter,
        availableWidth: titleWidth - 100,
        titleFontSize,
        subTitleFontSize,
        stageWidth: 960,
        stageHeight: 540,
      })

      getLayerChildren()
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

  const getLayerChildren = () => {
    let incredibleSplashFiveConfig = [
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
        x={-600}
        y={coordinate.titleY}
        text={title.value as string}
        fontSize={60}
        fontFamily="Poppins"
        fill="#000000"
        align="left"
        opacity={1}
        width={titleWidth}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 75,
            easing: Konva.Easings.EaseInOut,
          })
        }}
      />,
      <Text
        key="subTitle"
        x={-600}
        y={coordinate.subTitleY}
        text={subTitle.value as string}
        fontSize={30}
        fontFamily="Poppins"
        lineHeight={1.25}
        fill="#5C595A"
        align="left"
        width={titleWidth}
        opacity={1}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 75,
            easing: Konva.Easings.EaseInOut,
          })
        }}
      />,
    ]
    console.log('customSplash', customSplash.value)
    {
      customSplash.value &&
        (incredibleSplashFiveConfig = videoElement
          ? [<Video videoElement={videoElement} />]
          : [<></>])
    }
    console.log('videosrc', videoElement)

    setLayerChildren((layerChildren) => [
      ...layerChildren,
      incredibleSplashFiveConfig,
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

export default SplashFive
