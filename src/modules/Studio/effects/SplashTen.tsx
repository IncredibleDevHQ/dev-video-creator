import React, { useEffect, useState } from 'react'
import { Circle, Group, Rect, Text, Image } from 'react-konva'
import Konva from 'konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import { useParams } from 'react-router-dom'
import useImage from 'use-image'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import useSplash, { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { EmptyState } from '../../../components'
import config from '../../../config'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashTen = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [openSauced] = useImage(
    `${config.storage.baseUrl}open-sauce-logo.svg`,
    'anonymous'
  )
  const [openSaucedUser] = useImage(
    `${config.storage.baseUrl}opensauce-user.png`,
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
      <Group
        x={414}
        y={203}
        offsetX={60}
        offsetY={40}
        ref={(ref) => {
          ref?.to({
            duration: 0.4,
            scaleX: 1.2,
            scaleY: 1.2,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: 135,
                  duration: 0.6,
                  easing: Konva.Easings.BackEaseOut,
                })
              }, 1000)
            },
          })
        }}
      >
        <Rect
          x={13}
          y={12}
          width={240}
          height={162}
          fill="#D95C41"
          cornerRadius={8}
        />
        <Rect
          x={0}
          y={0}
          width={240}
          height={162}
          fill="#FAEACE"
          cornerRadius={8}
        />
        <Text
          key="text1"
          x={15}
          y={15}
          text="The path to your next"
          fontSize={30}
          fontFamily="Noto Sans"
          fontStyle="bold"
          lineHeight={1.2}
          fill="#313D3E"
          align="left"
          width={210}
        />
        <Text
          key="text2"
          x={15}
          y={90}
          text="Open Source"
          fontSize={30}
          fontFamily="Noto Sans"
          fontStyle="bold"
          lineHeight={1.1}
          fill="#D95C41"
          align="left"
          width={210}
        />
        <Text
          key="text3"
          x={15}
          y={126}
          text="contribution."
          fontSize={30}
          fontFamily="Noto Sans"
          fontStyle="bold"
          lineHeight={1.1}
          fill="#313D3E"
          align="left"
          width={210}
        />
      </Group>,
      <Image
        image={openSauced}
        x={588}
        y={376}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 0.4,
            opacity: 1,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: 75,
                  duration: 0.6,
                  easing: Konva.Easings.BackEaseOut,
                })
              }, 1000)
            },
          })
        }}
      />,
      <Group
        x={553}
        y={0}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.4,
              opacity: 1,
            })
          }, 1500)
        }}
      >
        <Rect x={0} y={0} width={407} height={CONFIG.height} fill="#F6D809" />
        <Image image={openSaucedUser} x={40} y={76} />
      </Group>,
      <Group
        x={592}
        y={280}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.4,
              opacity: 1,
            })
          }, 2000)
        }}
      >
        <Text
          key="userName1"
          x={0}
          y={0}
          text="Brain Douglas"
          fontSize={56}
          fontFamily="Noto Sans"
          fontStyle="bold"
          lineHeight={1.1}
          fill="#1F2937"
          align="left"
          width={260}
        />
        <Text
          key="userName2"
          x={6}
          y={6}
          text="Brain Douglas"
          fontSize={56}
          fontFamily="Noto Sans"
          fontStyle="bold"
          lineHeight={1.1}
          fill="#D95C41"
          align="left"
          width={260}
        />
      </Group>,
      <Text
        key="designation"
        x={592}
        y={426}
        text="Developer Advocate @ GitHub"
        fontSize={18}
        fontFamily="Noto Sans"
        fontStyle="normal 400"
        lineHeight={1.1}
        fill="#313D3E"
        align="left"
        width={260}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.4,
              opacity: 1,
            })
          }, 2200)
        }}
      />,
    ])
  }
  if (!configuration)
    return <EmptyState text="Missing cofiguration, Please Reload" width={400} />
  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default SplashTen
