import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { NextTokenIcon } from '../../../components'
import config from '../../../config'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import useEdit from '../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../stores'

const SlidesTen = () => {
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0)
  const [slides, setSlides] = useState<string[]>([])
  const { fragment, state, stream } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [slide] = useImage(slides[activeSlideIndex] || '', 'anonymous')
  const { getImageDimensions } = useEdit()
  const [tsLogo] = useImage(`${config.storage.baseUrl}tslogo.svg`, 'anonymous')

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible.svg`,
    'anonymous'
  )
  const [slideDim, setSlideDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  // width: 704,
  // height: 396,
  useEffect(() => {
    setSlideDim(
      getImageDimensions(
        {
          w: (slide && slide.width) || 0,
          h: (slide && slide.height) || 0,
        },
        714,
        406,
        714,
        406,
        0,
        0
      )
    )
  }, [slide])

  const studioUserConfig: StudioUserConfig[] = [
    {
      x: 695,
      y: 122.5,
      width: 320,
      height: 240,
      clipTheme: 'rect',
      borderColor: '#235A97',
      studioUserClipConfig: {
        x: 80,
        y: 0,
        width: 160,
        height: 240,
        radius: 8,
      },
    },
  ]

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    setSlides(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'file[]'
      )?.value
    )
    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
  }, [fragment?.configuration.properties])

  const ref = useRef<HTMLVideoElement | null>(null)
  const isDisableCamera = true

  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
  }, [ref.current])

  useEffect(() => {
    if (state === 'recording') {
      setActiveSlideIndex(0)
    }
  }, [state])

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activeSlideIndex === slides.length - 1}
      onClick={() => setActiveSlideIndex(activeSlideIndex + 1)}
    />,
  ]

  const layerChildren = [
    // To get the white background color
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#3178C6"
    />,

    <Rect
      x={32}
      y={53}
      width={714}
      height={406}
      strokeWidth={4}
      fill="#00273F"
      stroke="#235A97"
      cornerRadius={8}
    />,
    <Group x={37} y={58} width={714} height={406} key="group1">
      {slides.length > 0 && (
        <>
          <Image
            image={slide}
            fill="#E5E5E5"
            width={slideDim.width}
            y={slideDim.y}
            x={slideDim.x}
            height={slideDim.height}
            shadowOpacity={0.3}
            shadowOffset={{ x: 0, y: 1 }}
            shadowBlur={2}
          />
        </>
      )}
    </Group>,
    <Image image={incredibleLogo} x={25} y={CONFIG.height - 60} />,
    <Image image={tsLogo} x={820} y={CONFIG.height - 60} />,
  ]

  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioUserConfig}
    />
  )
}

export default SlidesTen
