import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Image } from 'react-konva'
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

const SplashEight = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [sourceGraphLogo] = useImage(
    `${config.storage.baseUrl}sourcegraph-logo.png`,
    'anonymous'
  )
  const [sourceGraphUser] = useImage(
    `${config.storage.baseUrl}sourcegraph-user.png`,
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
      fill="#C084FC"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Image
        image={sourceGraphLogo}
        x={44}
        y={443}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Text
        key="title"
        x={-550}
        y={55}
        text="Getting started with code search using Sourcegraph"
        fontSize={64}
        fontFamily="Source Sans Pro"
        fill="#ffffff"
        align="left"
        opacity={1}
        width={500}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            x: 44,
          })
        }}
      />,
      <Circle
        x={750}
        y={300}
        radius={100}
        fill="#C084FC"
        shadowColor="#000000"
        shadowBlur={10}
        shadowOpacity={0.1}
        shadowOffsetX={0}
        shadowOffsetY={10}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
            scaleX: 2,
            scaleY: 2,
          })
        }}
      />,
      <Circle
        x={750}
        y={300}
        radius={85}
        fill="#A855F7"
        shadowColor="#000000"
        shadowBlur={10}
        shadowOpacity={0.12}
        shadowOffsetX={0}
        shadowOffsetY={10}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
            scaleX: 2,
            scaleY: 2,
          })
        }}
      />,
      <Circle
        x={750}
        y={300}
        radius={60}
        fill="#9333EA"
        shadowColor="#000000"
        shadowBlur={15}
        shadowOpacity={0.12}
        shadowOffsetX={0}
        shadowOffsetY={20}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
            scaleX: 2,
            scaleY: 2,
          })
        }}
      />,
      <Image
        image={sourceGraphUser}
        x={520}
        y={335}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Text
        key="userName"
        x={630}
        y={380}
        text="Beyang Liu"
        fontSize={24}
        fontFamily="Source Sans Pro"
        fontStyle="normal 400"
        fill="#ffffff"
        align="left"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Text
        key="userDesignation"
        x={630}
        y={410}
        text="CTO and Co-founder @ Sourcegraph"
        fontSize={16}
        fontFamily="Source Sans Pro"
        fill="#ffffff"
        align="left"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
    ])
  }
  if (!configuration)
    return <EmptyState text="Missing cofiguration, Please Reload" width={400} />
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashEight
