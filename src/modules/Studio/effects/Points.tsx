import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group, Text, Image, Rect, Circle } from 'react-konva'
import FontFaceObserver from 'fontfaceobserver'
import { useRecoilValue } from 'recoil'
import { useImage } from 'react-konva-utils'
import { NextTokenIcon } from '../../../components'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import { User, userState } from '../../../stores/user.store'
import { Concourse } from '../components'
import { CONFIG } from '../components/Concourse'
import { ControlButton } from '../components/MissionControl'
import { StudioProviderProps, studioStore } from '../stores'
import { titleSplash } from './effects'
import usePoint, { ComputedPoint } from '../hooks/use-point'

const Points = () => {
  const [isTitleSplash, setIsTitleSplash] = useState<boolean>(true)
  const [activePointIndex, setActivePointIndex] = useState<number>(0)
  const [points, setPoints] = useState<string[]>([])
  const { fragment, state, stream, picture, payload, constraints } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const userData = (useRecoilValue(userState) as User) || {}

  const [image] = useImage(picture as string, 'anonymous')

  const imageConfig = { width: 702, height: 540 }
  const imageRef = useRef<Konva.Image | null>(null)

  const [groupCoordinate, setGroupCoordinate] = useState<number>(0)

  const { initUsePoint, computedPoints, getGroupCoordinates } = usePoint()

  const [yCoordinate, setYCoordinate] = useState<number>(0)

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
    setPoints(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'text[]'
      )?.value
    )
  }, [fragment?.configuration.properties])

  useEffect(() => {
    const startingCoordinate = initUsePoint({
      points,
      availableWidth: 392,
      availableHeight: 490,
      gutter: 3,
      fontSize: 24,
    })
    setGroupCoordinate(startingCoordinate > 32 ? startingCoordinate : 32)
  }, [points])

  useEffect(() => {
    return () => {
      setPoints([])
      setGroupCoordinate(0)
    }
  }, [])

  useEffect(() => {
    console.log(groupCoordinate)
  }, [groupCoordinate])

  useEffect(() => {
    if (!videoElement || !imageRef.current) return undefined
    videoElement.play()

    const layer = imageRef.current.getLayer()

    const anim = new Konva.Animation(() => {}, layer)
    anim.start()

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

  const controls =
    state === 'recording'
      ? [
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
      : [<></>]
  const layerChildren = [
    <Group x={600} y={0} key="group0">
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

      <Rect x={-600} y={0} width={600} height={CONFIG.height} fill="#ffffff" />
    </Group>,
    <Group x={32} y={groupCoordinate} key="group">
      <Text
        key="fragmentTitle"
        x={0}
        y={0}
        align="left"
        fontSize={36}
        fill="#424242"
        width={472}
        height={64}
        text={fragment?.name as string}
        fontStyle="bold"
        fontFamily="Poppins"
      />
    </Group>,
    <Group x={64} y={groupCoordinate + 52} key="group1">
      {computedPoints.current
        .filter((_, i) => i < activePointIndex)
        .map((point, j) => (
          <>
            <Circle
              key="redCircle"
              x={-76}
              y={point.y + 12}
              fill="#424242"
              radius={4}
              ref={(ref) =>
                ref?.to({
                  x: 0,
                  duration: 0.3,
                })
              }
            />
            <Text
              key={`${point.text}`}
              x={-64}
              y={point.y}
              align="left"
              fontSize={24}
              fill="#424242"
              width={460}
              height={64}
              text={point.text}
              fontStyle="normal 400"
              fontFamily="Poppins"
              textTransform="capitalize"
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
    <Group x={664} y={412} width={234} height={64} key="group2">
      <Rect width={234} cornerRadius={4} height={64} fill="#F3F4F6" />

      <Text
        fontSize={18}
        fill="#1F2937"
        y={14}
        fontFamily="Poppins"
        width={234}
        height={64}
        align="center"
        fontStyle="bold"
        text={userData.displayName as string}
        textTransform="capitalize"
      />
      <Text
        fontSize={9}
        fill="#1F2937"
        fontFamily="Poppins"
        align="center"
        width={234}
        height={64}
        text={userData.email as string}
        textTransform="capitalize"
        y={36}
      />
    </Group>,
  ]
  // }
  return (
    <Concourse
      controls={controls}
      layerChildren={layerChildren}
      disableUserMedia={isDisableCamera}
    />
  )
}

export default Points
