import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Line } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { useParams } from 'react-router-dom'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import useSplash, { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { EmptyState } from '../../../components'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashEleven = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

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
  const titleFontSize = 50
  const subTitleFontSize = 25

  useEffect(() => {
    if (state === 'recording') {
      coordinate = getInitCoordinates({
        title: configuration?.title.value as string,
        subTitle: configuration?.subTitle.value as string,
        gutter,
        availableWidth: 450,
        titleFontSize,
        subTitleFontSize,
        stageWidth: 960,
        stageHeight: 540,
        fontFamily: 'Poppins',
      })

      getLayerChildren()
    }
  }, [state, configuration])

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
      <Line
        key="firstBlob"
        points={[
          23, 90, 200, 10, 180, 120, 140, 80, 100, 140, 60, 105, 40, 170,
        ]}
        fill="#00D2FF"
        tension={0.3}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="secondBlob"
        points={[360, 0, 610, 0, 550, 100, 480, 30, 430, 80]}
        fill="#00C075"
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="thirdBlob"
        points={[
          CONFIG.width - 190,
          0,
          CONFIG.width - 15,
          0,
          CONFIG.width - 20,
          45,
          CONFIG.width - 10,
          95,
          CONFIG.width - 90,
          100,
          CONFIG.width - 110,
          105,
          CONFIG.width - 220,
          95,
          CONFIG.width - 220,
          40,
          CONFIG.width - 190,
          35,
        ]}
        fill="#F1C452"
        tension={0.3}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="fourthBlob"
        points={[
          CONFIG.width - 120,
          CONFIG.height / 2 - 70,
          CONFIG.width - 110,
          CONFIG.height / 2 + 30,
          CONFIG.width - 150,
          CONFIG.height / 2 + 60,
          CONFIG.width - 190,
          CONFIG.height / 2 + 30,
        ]}
        fill="#5873F4"
        tension={0.4}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Circle
        key="firstCircle"
        x={CONFIG.width - 140}
        y={CONFIG.height - 40}
        radius={50}
        fill="#F4ACDA"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Circle
        key="secondCircle"
        x={CONFIG.width - 90}
        y={CONFIG.height - 80}
        radius={65}
        fill="#F4ACDA"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Circle
        key="thirdCircle"
        x={CONFIG.width - 35}
        y={CONFIG.height - 130}
        radius={55}
        fill="#F4ACDA"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="fifthBlob"
        points={[
          CONFIG.width / 2,
          CONFIG.height - 20,
          CONFIG.width / 2 - 5,
          CONFIG.height - 80,
          CONFIG.width / 2 + 20,
          CONFIG.height - 120,
          CONFIG.width / 2 + 70,
          CONFIG.height - 90,
        ]}
        fill="#FF0000"
        tension={0.4}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="sixthBlob"
        points={[
          50,
          CONFIG.height,
          45,
          CONFIG.height - 5,
          75,
          CONFIG.height - 30,
          50,
          CONFIG.height - 90,
          100,
          CONFIG.height - 50,
          120,
          CONFIG.height - 110,
          140,
          CONFIG.height - 50,
          160,
          CONFIG.height - 120,
          170,
          CONFIG.height - 50,
          240,
          CONFIG.height - 130,
          215,
          CONFIG.height - 50,
          315,
          CONFIG.height - 40,
          255,
          CONFIG.height - 10,
          265,
          CONFIG.height,
        ]}
        fill="#758dff"
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Line
        key="seventhBlob"
        points={[
          120,
          CONFIG.height / 2 - 70,
          110,
          CONFIG.height / 2 + 30,
          150,
          CONFIG.height / 2 + 60,
          190,
          CONFIG.height / 2 + 30,
        ]}
        fill="#F4ACDA"
        tension={0.4}
        closed
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
        x={coordinate.titleX}
        y={coordinate.titleY}
        text={configuration?.title.value as string}
        fontSize={50}
        fontFamily="Poppins"
        fill="#000000"
        align="center"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Text
        key="subTitle"
        x={coordinate.subTitleX}
        y={coordinate.subTitleY}
        text={configuration?.subTitle.value as string}
        fontSize={25}
        fontFamily="Poppins"
        lineHeight={1.25}
        fill="#5C595A"
        align="center"
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
  return (
    <Concourse
      disableUserMedia
      layerChildren={layerChildren}
      controls={controls}
    />
  )
}

export default SplashEleven
