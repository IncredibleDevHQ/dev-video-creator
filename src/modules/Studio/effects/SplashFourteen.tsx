import React, { useEffect, useState } from 'react'
import { Rect, Text, Group, Image } from 'react-konva'
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

const SplashFourteen = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()
  const [msLogo] = useImage(`${config.storage.baseUrl}ms-logo.png`, 'anonymous')
  const [msUser] = useImage(`${config.storage.baseUrl}ms-user.png`, 'anonymous')

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
      fill="#FFFFFF"
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Group x={61} y={183} width={419} height={174} key="group1">
        <Text
          fontSize={64}
          fill="#1F2937"
          fontFamily="Poppins"
          fontStyle="normal"
          text="Microsoft"
          align="center"
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={64}
          y={67}
          fill="#1F2937"
          fontFamily="Poppins"
          fontStyle="normal"
          text="Dynamics 365"
          align="center"
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={24}
          fill="#6B7280"
          fontFamily="Poppins"
          text="Agility without limits"
          fontStyle="normal 400"
          align="center"
          y={150}
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
        <Image
          x={61}
          y={412}
          width={72}
          height={72}
          cornerRadius={12}
          image={msUser}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={20}
          fill="#1F2937"
          fontFamily="Poppins"
          text="Heather Newman"
          fontStyle="normal 600"
          align="center"
          x={150}
          y={445}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Text
          fontSize={14}
          fill="#6B7280"
          fontFamily="Poppins"
          text="Principal PM Manager @ Microsoft Dynamics 365"
          fontStyle="normal 400"
          align="center"
          x={150}
          y={470}
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
        <Rect x={553} y={0} fill="#1F2937" width={407} height={540} />
        <Image
          x={657}
          y={170}
          width={200}
          height={200}
          image={msLogo}
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
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashFourteen
