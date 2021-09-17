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

const SplashThirteen = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()
  const [ghLogo] = useImage(`${config.storage.baseUrl}gh-logo.png`, 'anonymous')
  const [ghUser] = useImage(`${config.storage.baseUrl}gh-user.png`, 'anonymous')

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
      fill="#040D21"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Group x={82} y={78} width={429} height={192} key="group1">
        <Text
          fontSize={96}
          fill="#9DF4D1"
          fontFamily="Poppins"
          fontStyle="normal 900"
          text="Github"
          align="center"
          opacity={1}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={36}
          fill="#FFFFFF"
          fontFamily="Poppins"
          text="Where the world builds"
          fontStyle="normal"
          align="center"
          y={108}
          opacity={1}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={36}
          fill="#FFFFFF"
          fontFamily="Poppins"
          text="software"
          fontStyle="normal"
          align="center"
          y={150}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 0.5,
              opacity: 1,
            })
          }}
        />
      </Group>,
      <Group x={826} y={406} width={54} height={54} key="group2">
        <Image
          image={ghLogo}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
      </Group>,
      <Group>
        <Rect
          fill="#0C162D"
          x={80}
          y={340}
          cornerRadius={12}
          width={381}
          height={120}
        />
        <Image
          x={90}
          y={360}
          width={80}
          height={80}
          cornerRadius={12}
          image={ghUser}
          opacity={1}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={20}
          fill="#FFFFFF"
          fontFamily="Poppins"
          text="Brian Douglas"
          fontStyle="normal 600"
          align="center"
          x={190}
          y={400}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={16}
          fill="#FFFFFF"
          fontFamily="Poppins"
          text="Developer Advocate @ Github"
          fontStyle="normal"
          align="center"
          x={190}
          y={425}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
      </Group>,
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

export default SplashThirteen
