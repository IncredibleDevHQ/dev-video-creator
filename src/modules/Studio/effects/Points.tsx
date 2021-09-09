import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import usePoint from '../hooks/use-point'

const Points = () => {
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const { fragment, state, stream, picture, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [image] = useImage(picture as string, 'anonymous')

  const imageConfig = { width: 702, height: 540 }
  const imageRef = useRef<Konva.Image | null>(null)

  const [groupCoordinate, setGroupCoordinate] = useState<number>(0)

  const { initUsePoint, computedPoints } = usePoint()

  const [yCoordinate, setYCoordinate] = useState<number>(0)

  const [titleNumberOfLines, setTitleNumberOfLines] = useState<number>(0)

  const initialX = 32
  const lineLength = 15

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  const videoElement = React.useMemo(() => {
    if (!stream) return undefined
    const element = document.createElement('video')
    element.srcObject = stream
    element.muted = true

    return element
  }, [stream])

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
    setPoints(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'text[]'
      )?.value
    )
    const titleLineNumber = fragment.name
      ? // This logic is to support titles of multiple length, which can span 1/2/3 lines. Each line at the most can have 15 characters acc to the design.
        Math.ceil(fragment.name.length / lineLength)
      : 0

    setTitleNumberOfLines(titleLineNumber)
  }, [fragment?.configuration.properties])

  useEffect(() => {
    const startingCoordinate = initUsePoint({
      points,
      availableWidth: 392,
      availableHeight: 220,
      gutter: 12,
      fontSize: 14,
    })
    setGroupCoordinate(
      startingCoordinate > initialX ? startingCoordinate : initialX
    )
  }, [points])

  useEffect(() => {
    return () => {
      setPoints([])
      setGroupCoordinate(0)
    }
  }, [])

  useEffect(() => {
    if (!videoElement || !imageRef.current) return
    videoElement.play()

    const layer = imageRef.current.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

    // eslint-disable-next-line consistent-return
    return () => {
      anim.stop()
    }
  }, [videoElement, imageRef.current])

  const ref = useRef<HTMLVideoElement | null>(null)
  const isDisableCamera = true

  useEffect(() => {
    if (!ref.current) return

    ref.current.srcObject = stream
  }, [ref.current])

  useEffect(() => {
    if (state === 'recording') {
      setActivePointIndex(0)
    }
  }, [state])

  const controls = [
    <ControlButton
      key="nextQuestion"
      icon={NextTokenIcon}
      className="my-2"
      appearance="primary"
      disabled={activePointIndex === points.length}
      onClick={() => {
        setActivePointIndex(activePointIndex + 1)
        setYCoordinate(yCoordinate + 30)
      }}
    />,
  ]

  const layerChildren = [
    <Group x={0} y={0} fill="#ffffff" key="group0">
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#E5E5E5"
      />
    </Group>,

    <Group
      x={546}
      y={30}
      key="group1"
      clipFunc={(ctx: any) => {
        const x = 0
        const y = 0
        const w = 384
        const h = 480
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
      {constraints?.video ? (
        <Image
          x={-imageConfig.width / 3}
          ref={imageRef}
          image={videoElement}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      ) : (
        <Image
          image={image}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      )}
    </Group>,

    <Group x={30} y={94} key="group3">
      <Text
        key="fragmentTitle"
        x={0}
        y={0}
        align="left"
        fontSize={48}
        fill="#374151"
        width={367}
        height={128}
        text={fragment?.name as string}
        fontStyle="normal 600"
        fontFamily="Poppins"
      />
    </Group>,
    <Group
      x={30}
      y={groupCoordinate + (94 + 64 * titleNumberOfLines)}
      key="group4"
    >
      {computedPoints.current
        .filter((_, i) => i < activePointIndex)
        .map((point) => (
          <>
            <Rect
              key="points"
              x={-76}
              width={4}
              height={9}
              y={point.y + 12}
              fill="#374151"
              ref={(ref) =>
                ref?.to({
                  x: 0,
                  duration: 0.3,
                })
              }
            />
            <Text
              key={point.text}
              x={-64}
              y={point.y + 12}
              align="left"
              fontSize={14}
              fill="#374151"
              width={460}
              height={64}
              text={point.text}
              fontStyle="normal 400"
              fontFamily="Poppins"
              ref={(ref) =>
                ref?.to({
                  x: 16,
                  duration: 0.3,
                })
              }
            />
          </>
        ))}
    </Group>,
  ]
  // }
  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      disableUserMedia={isDisableCamera}
      titleSpalshData={titleSpalshData}
    />
  )
}

export default Points
