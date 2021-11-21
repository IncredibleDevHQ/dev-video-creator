import React, { useEffect, useState } from 'react'
import { Rect, Text } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import { useParams } from 'react-router-dom'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import useSplash, { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { EmptyState } from '../../../components'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashFive = () => {
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
        text={configuration?.title.value as string}
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
        text={configuration?.subTitle.value as string}
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
    ])
  }
  if (!configuration)
    return <EmptyState text="Missing cofiguration, Please Reload" width={400} />
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashFive