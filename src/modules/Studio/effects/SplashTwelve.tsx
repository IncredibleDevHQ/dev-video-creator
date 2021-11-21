import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Line, Group, Image } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { useParams } from 'react-router-dom'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import useSplash, { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { EmptyState } from '../../../components'
import config from '../../../config'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashTwelve = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()
  const [cockroachLogo] = useImage(
    `${config.storage.baseUrl}cockroachLogoSVG.svg`,
    'anonymous'
  )

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

  const gradientStrokeOne = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const gradient = ctx?.createLinearGradient(0, 100, 100, 0)
    gradient?.addColorStop(0, 'rgba(33, 232, 238, 1)')
    gradient?.addColorStop(1, 'rgba(99, 71, 255, 1)')

    return gradient
  }

  const gradientStrokeTwo = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const gradient = ctx?.createLinearGradient(0, 100, 100, 0)
    gradient?.addColorStop(0, 'rgba(80, 118, 248, 0)')
    gradient?.addColorStop(1, 'rgba(79, 118, 248, 1)')

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
        x={200}
        y={175}
        radius={78}
        stroke={gradientStrokeOne()}
        strokeWidth={39}
        scaleX={3}
        scaleY={3}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 2,
            opacity: 1,
          })
        }}
      />,
      <Circle
        key="SecondCircle"
        x={670}
        y={250}
        radius={78}
        stroke={gradientStrokeTwo()}
        strokeWidth={39}
        scaleX={3}
        scaleY={3}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 2,
            opacity: 1,
          })
        }}
      />,
      <Group x={114} y={161} width={732} height={184} key="group1">
        <Text
          fontSize={104}
          fill="#FFFFFF"
          fontFamily="Poppins"
          fontStyle="normal 700"
          text="CockroachDB"
          align="center"
          opacity={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                opacity: 1,
              })
            }, 2000)
          }}
        />
        <Text
          fontSize={24}
          fill="#FFFFFF"
          fontFamily="Poppins"
          text="The most highly evolved database on planet"
          fontStyle="normal 400"
          align="center"
          y={126}
          x={65}
          opacity={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                opacity: 1,
              })
            }, 2000)
          }}
        />
      </Group>,
      <Group x={697} y={476} width={220} height={32} key="group2">
        <Image
          image={cockroachLogo}
          opacity={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                opacity: 1,
              })
            }, 3000)
          }}
        />
      </Group>,
    ])
  }
  if (!configuration)
    return <EmptyState text="Missing cofiguration, Please Reload" width={400} />
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashTwelve
