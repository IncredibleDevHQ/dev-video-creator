import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { NextTokenIcon } from '../../../components'
import config from '../../../config'
import { Concourse } from '../components'
import { CONFIG, StudioUserConfig } from '../components/Concourse'
import Gif from '../components/Gif'
import { ControlButton } from '../components/MissionControl'
import useEdit from '../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../stores'
import { getDimensions } from './effects'

const SlidesTwo = () => {
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0)
  const [slides, setSlides] = useState<string[]>([])
  const { fragment, state, stream } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [isGif, setIsGif] = useState(false)
  const [gifUrl, setGifUrl] = useState('')

  const [slide] = useImage(slides[activeSlideIndex] || '', 'anonymous')
  const { getImageDimensions } = useEdit()
  const [elasticLogo] = useImage(
    `${config.storage.baseUrl}elastic-logo.png`,
    'anonymous'
  )
  const [whiteCircle] = useImage(
    `${config.storage.baseUrl}circle.png`,
    'anonymous'
  )
  const [pinkCircle] = useImage(
    `${config.storage.baseUrl}pink2.png`,
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
    if (slide?.src.split('.').pop() === 'gif') {
      setIsGif(true)
      setGifUrl(slide.src)
    } else {
      setIsGif(false)
    }
    setSlideDim(
      getImageDimensions(
        {
          w: (slide && slide.width) || 0,
          h: (slide && slide.height) || 0,
        },
        704,
        396,
        704,
        396,
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
      borderColor: '#D1D5DB',
      borderWidth: 8,
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
    <Rect
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
      fill="#ffffff"
    />,
    <Circle x={82} y={10} radius={55} fill="#7DE2D1" />,
    <Circle x={70} y={CONFIG.height - 70} radius={100} fill="#7DE2D1" />,
    <Circle x={640} y={20} radius={10} fill="#0077CC" />,
    <Circle x={270} y={CONFIG.height - 70} radius={10} fill="#0077CC" />,
    <Image image={pinkCircle} x={790} y={400} />,
    <Image image={whiteCircle} x={615} y={245} />,

    <Group x={37} y={58} width={714} height={406} key="group1">
      <Rect
        width={slideDim.width}
        y={slideDim.y}
        x={slideDim.x}
        height={slideDim.height}
        fill="#EDEEF0"
        cornerRadius={8}
        shadowOpacity={0.3}
        shadowOffset={{ x: 0, y: 1 }}
        shadowBlur={2}
        stroke="#D1D5DB"
        strokeWidth={6}
      />
      {slides.length > 0 && (
        <>
          <Group
            width={714}
            height={406}
            clipFunc={(ctx: any) => {
              const { x, y } = slideDim
              const w = slideDim.width
              const h = slideDim.height
              const r = 8
              ctx.beginPath()
              ctx.moveTo(x + r, y)
              ctx.arcTo(x + w, y, x + w, y + h, r)
              ctx.arcTo(x + w, y + h, x, y + h, r)
              ctx.arcTo(x, y + h, x, y, r)
              ctx.arcTo(x, y, x + w, y, r)
              ctx.closePath()
            }}
          >
            {!isGif && (
              <Image
                image={slide}
                y={slideDim.y}
                x={slideDim.x}
                width={slideDim.width}
                height={slideDim.height}
                shadowOpacity={0.3}
                shadowOffset={{ x: 0, y: 1 }}
                shadowBlur={2}
              />
            )}
            {isGif && (
              <Gif
                src={gifUrl}
                x={slideDim.x}
                y={slideDim.y}
                width={slideDim.width}
                height={slideDim.height}
              />
            )}
          </Group>
        </>
      )}
    </Group>,

    <Image image={elasticLogo} x={30} y={CONFIG.height - 60} />,
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

export default SlidesTwo
