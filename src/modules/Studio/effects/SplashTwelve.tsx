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

const SplashTwelve = () => {
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

  const gradientStroke = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const gradient = ctx?.createLinearGradient(0, 50, 100, 50)
    gradient?.addColorStop(0.1, '#21E8EE')
    gradient?.addColorStop(0.25, '#4E7BFA')
    gradient?.addColorStop(0.5, '#5B5AFD')
    gradient?.addColorStop(0.75, '#6249FF')
    gradient?.addColorStop(0.9, '#6347FF')

    return gradient
  }

  const [layerChildren, setLayerChildren] = useState([
    <Rect
      x={0}
      y={0}
      fill="#6031E2"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Circle
        key="FirstCircle"
        x={345}
        y={175}
        radius={78}
        stroke={gradientStroke()}
        strokeWidth={39}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      //   <Circle
      //     key="SecondCircle"
      //     x={458}
      //     y={208}
      //     radius={78}
      //     stroke={gradientStroke()}
      //     strokeWidth={39}
      //     opacity={0}
      //     ref={(ref) => {
      //       ref?.to({
      //         duration: 1,
      //         opacity: 1,
      //       })
      //     }}
      //   />,
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

export default SplashTwelve
