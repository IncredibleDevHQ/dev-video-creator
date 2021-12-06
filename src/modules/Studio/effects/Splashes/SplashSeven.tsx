import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Image, Group, Line } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import { useParams } from 'react-router-dom'
import useImage from 'use-image'
import Concourse, { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import useSplash, { Coordinates } from '../../hooks/use-splash'
import { User, userState } from '../../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../../generated/graphql'
import { EmptyState } from '../../../../components'
import config from '../../../../config'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashSeven = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [hasuraLogo] = useImage(
    `${config.storage.baseUrl}hasura-logo.png`,
    'anonymous'
  )
  const [hasuraText] = useImage(
    `${config.storage.baseUrl}hasura.png`,
    'anonymous'
  )
  const [userImage] = useImage(
    `${config.storage.baseUrl}hasura-user.png`,
    'anonymous'
  )

  useEffect(() => {
    if (!data?.Fragment[0].configuration.properties) return
    const title = data?.Fragment[0].configuration.properties.find(
      (property: any) => property.key === titleEnum
    )
    const subTitle = data?.Fragment[0].configuration.properties.find(
      (property: any) => property.key === subTitleEnum
    )
    setConfiguration({ title, subTitle })
  }, [data])

  const { getInitCoordinates } = useSplash()

  const controls: any = []

  let coordinate: Coordinates = {
    titleX: 0,
    titleY: 0,
    subTitleX: 0,
    subTitleY: 0,
    titleHeight: 0,
  }

  const gutter = 10
  const titleWidth = 600
  const titleFontSize = 60
  const subTitleFontSize = 30

  useEffect(() => {
    if (state === 'recording') {
      coordinate = getInitCoordinates({
        title: configuration?.title.value as string,
        subTitle: configuration?.subTitle.value as string,
        gutter,
        availableWidth: titleWidth - 100,
        titleFontSize,
        subTitleFontSize,
        stageWidth: 960,
        stageHeight: 540,
      })

      getLayerChildren()
    }
  }, [state, configuration])

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
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Rect
        key="backRect"
        x={CONFIG.width - 560}
        y={0}
        width={560}
        height={CONFIG.height}
        fill="#D6EBFF"
      />,
      <Rect
        key="smallRect1"
        x={490}
        y={138}
        width={18}
        height={18}
        fill="#F47E7E"
        rotation={-45}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Rect
        key="smallRect2"
        x={870}
        y={415}
        width={38}
        height={38}
        fill="#5C94C8"
        rotation={-45}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Circle
        x={CONFIG.width}
        y={0}
        radius={100}
        fill="#D6EBFF"
        stroke="#ffffff"
        strokeWidth={4}
      />,
      <Line
        key="line1"
        points={[
          400,
          CONFIG.height - 153,
          540,
          CONFIG.height - 140,
          553,
          CONFIG.height,
        ]}
        stroke="#ffffff"
        strokeWidth={4}
        lineJoin="round"
        tension={0.3}
      />,
      <Image image={hasuraLogo} x={578} y={188} />,
      <Image image={hasuraText} x={282} y={487} />,
      <Group x={43.5} y={373}>
        <Image
          image={userImage}
          x={0}
          y={0}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          key="title"
          x={96}
          y={15}
          text="VISHWA MEHTA"
          fontSize={18}
          fontFamily="Darker Grotesque"
          fontStyle="bold"
          fill="#000000"
          align="left"
          opacity={0}
          width={276}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          key="title"
          x={96}
          y={43}
          text="DevRel Associate @ Hasura"
          fontSize={16}
          fontFamily="Darker Grotesque"
          fill="#000000"
          align="left"
          opacity={0}
          width={276}
          fontStyle="normal 400"
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
      </Group>,
      <Text
        key="title"
        x={-600}
        y={47}
        text="GETTING STARTED WITH GRAPHQL IN HASURA"
        fontSize={56}
        fontFamily="Darker Grotesque"
        fill="#000000"
        align="left"
        opacity={1}
        width={320}
        fontStyle="normal 800"
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 44,
            easing: Konva.Easings.EaseInOut,
          })
        }}
      />,
    ])
  }
  if (!configuration)
    return <EmptyState text="Missing cofiguration, Please Reload" width={400} />
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashSeven
