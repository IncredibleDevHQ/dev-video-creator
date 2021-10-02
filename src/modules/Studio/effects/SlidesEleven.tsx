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

const SlidesEleven = () => {
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
  const [pytorchLogo] = useImage(
    `${config.storage.baseUrl}pytorch.svg`,
    'anonymous'
  )
  const [pytorchBg] = useImage(
    `${config.storage.baseUrl}pytorch_bg.svg`,
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
      x: 660,
      y: 140.5,
      width: 320,
      height: 240,
      clipTheme: 'rect',
      borderWidth: 16,
      borderColor: '#8B008B',
      studioUserClipConfig: {
        x: 60,
        y: 0,
        width: 200,
        height: 200,
        radius: 100,
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
    <Image
      image={pytorchBg}
      x={1}
      y={1}
      fill="#F5F6F7"
      width={CONFIG.width - 2}
      height={CONFIG.height - 2}
    />,

    <Group
      x={37}
      y={58}
      width={714}
      height={406}
      clipFunc={(ctx: any) => {
        const x = 0
        const y = 0
        const w = 714
        const h = 406
        const r = 8
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
      }}
      key="group1"
    >
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
    <Image image={pytorchLogo} x={30} y={CONFIG.height - 70} />,
    <Image image={incredibleLogo} x={820} y={CONFIG.height - 70} />,
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

export default SlidesEleven
