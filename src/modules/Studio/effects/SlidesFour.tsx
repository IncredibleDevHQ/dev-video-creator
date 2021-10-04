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

const SlidesFour = () => {
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
  const [hasuraLogo] = useImage(
    `${config.storage.baseUrl}hasura.png`,
    'anonymous'
  )
  const [slideDim, setSlideDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  const { clipRect } = useEdit()

  useEffect(() => {
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
      borderColor: '#1EB4D4',
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

  const ref = useRef<HTMLVideoElement | null>(null)

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
      fill="#D6EBFF"
    />,
    <Rect
      key="smallRect1"
      x={490}
      y={20}
      width={12}
      height={12}
      fill="#F47E7E"
      rotation={-45}
      opacity={1}
    />,
    <Rect
      key="smallRect2"
      x={820}
      y={505}
      width={24}
      height={24}
      fill="#5C94C8"
      rotation={-45}
      opacity={1}
    />,
    <Circle x={240} y={460} radius={20} stroke="#F47E7E" strokeWidth={8} />,
    <Rect
      width={slideDim.width}
      y={slideDim.y + 58}
      x={slideDim.x + 37}
      height={slideDim.height}
      cornerRadius={8}
      shadowOpacity={0.3}
      shadowOffset={{ x: 0, y: 1 }}
      shadowBlur={2}
      fill="#E6EBF2"
      stroke="#1EB4D4"
      strokeWidth={6}
    />,
    <Group
      x={37}
      y={58}
      width={714}
      height={406}
      clipFunc={(ctx: any) => {
        clipRect(ctx, {
          x: 0,
          y: 0,
          width: slideDim.width,
          height: slideDim.height,
          radius: 8,
        })
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

    <Image image={hasuraLogo} x={30} y={CONFIG.height - 60} />,
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

export default SlidesFour
