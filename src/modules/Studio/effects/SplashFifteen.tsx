import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Image, Group, Line } from 'react-konva'
import { useRecoilValue } from 'recoil'
import FontFaceObserver from 'fontfaceobserver'
import { useParams } from 'react-router-dom'
import useImage from 'use-image'
import Konva from 'konva'
import Concourse, { CONFIG } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import useSplash, { Coordinates } from '../hooks/use-splash'
import { User, userState } from '../../../stores/user.store'
import { useGetFragmentByIdQuery } from '../../../generated/graphql'
import { EmptyState } from '../../../components'
import config from '../../../config'

const titleEnum = 'title'
const subTitleEnum = 'subtitle'

const SplashFifteen = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [astroPlanet] = useImage(
    `${config.storage.baseUrl}planet.svg`,
    'anonymous'
  )
  const [astroLogo] = useImage(
    `${config.storage.baseUrl}astro-logo.svg`,
    'anonymous'
  )
  const [astroA] = useImage(`${config.storage.baseUrl}astro-A.svg`, 'anonymous')
  const [astroFlame] = useImage(
    `${config.storage.baseUrl}flame.svg`,
    'anonymous'
  )
  const [windowOps] = useImage(
    `${config.storage.baseUrl}window-ops.svg`,
    'anonymous'
  )
  const [comet1] = useImage(`${config.storage.baseUrl}comet-1.svg`, 'anonymous')
  const [comet2] = useImage(`${config.storage.baseUrl}comet-2.svg`, 'anonymous')

  // useEffect(() => {
  //   if (!data?.Fragment[0].configuration.properties) return
  //   const title = data?.Fragment[0].configuration.properties.find(
  //     (property: any) => property.key === titleEnum
  //   )
  //   const subTitle = data?.Fragment[0].configuration.properties.find(
  //     (property: any) => property.key === subTitleEnum
  //   )
  //   setConfiguration({ title, subTitle })
  // }, [data])

  // const { getInitCoordinates } = useSplash()

  const controls: any = []

  // let coordinate: Coordinates = {
  //   titleX: 0,
  //   titleY: 0,
  //   subTitleX: 0,
  //   subTitleY: 0,
  //   titleHeight: 0,
  // }

  // const gutter = 10
  // const titleWidth = 600
  // const titleFontSize = 60
  // const subTitleFontSize = 30

  useEffect(() => {
    if (state === 'recording') {
      // coordinate = getInitCoordinates({
      //   title: configuration?.title.value as string,
      //   subTitle: configuration?.subTitle.value as string,
      //   gutter,
      //   availableWidth: titleWidth - 100,
      //   titleFontSize,
      //   subTitleFontSize,
      //   stageWidth: 960,
      //   stageHeight: 540,
      // })

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
      fillLinearGradientColorStops={[
        0,
        '#140D1F',
        0.41,
        '#361367',
        1,
        '#6E1DDB',
      ]}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{
        x: CONFIG.width,
        y: CONFIG.height,
      }}
      width={CONFIG.width}
      height={CONFIG.height}
    />,
  ])

  const getLayerChildren = () => {
    setLayerChildren((layerChildren) => [
      ...layerChildren,
      <Group
        x={452}
        y={243}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.5,
              y: -100,
            })
          }, 1500)
        }}
      >
        <Image
          image={astroFlame}
          x={14}
          y={17}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 0.5,
              opacity: 1,
              y: 54,
            })
          }}
        />
        <Image image={astroA} x={0} y={0} />
      </Group>,
      <Group
        x={396}
        y={170}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.2,
              opacity: 1,
              y: 250,
              onFinish: () => {
                ref?.to({
                  duration: 0.2,
                  opacity: 0,
                  y: 335,
                })
              },
            })
          }, 500)
        }}
      >
        <Line
          key="line1"
          points={[0, 0, 0, 24]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line2"
          points={[15, -25, 15, 55]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line3"
          points={[137, 0, 137, 24]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line4"
          points={[152, -25, 152, 55]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
      </Group>,
      <Group
        x={396}
        y={170}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.2,
              opacity: 1,
              y: 250,
              onFinish: () => {
                ref?.to({
                  duration: 0.2,
                  opacity: 0,
                  y: 335,
                })
              },
            })
          }, 1000)
        }}
      >
        <Line
          key="line5"
          points={[0, 0, 0, 24]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line6"
          points={[15, -25, 15, 55]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line7"
          points={[137, 0, 137, 24]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
        <Line
          key="line8"
          points={[152, -25, 152, 55]}
          stroke="#ffffff"
          strokeWidth={4}
          lineJoin="round"
        />
      </Group>,
      <Image
        image={astroPlanet}
        x={-10}
        y={0}
        opacity={0}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 0.5,
              opacity: 1,
            })
          }, 2000)
        }}
      />,
      <Group
        x={567}
        y={-278}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              y: 138,
              duration: 1,
              easing: Konva.Easings.BackEaseOut,
            })
          }, 2500)
        }}
      >
        <Image image={windowOps} x={256} y={-36} />
        <Rect
          x={0}
          y={0}
          width={315}
          height={196}
          fill="#ffffff"
          cornerRadius={8}
        />
        <Rect
          x={13}
          y={13}
          width={315}
          height={196}
          fill="#FD5D00"
          cornerRadius={8}
        />
        <Text
          key="text1"
          x={32}
          y={32}
          text="Build faster websites with less client-side Javascript"
          fontSize={30}
          fontFamily="Open Sans"
          fontStyle="bold"
          lineHeight={1.2}
          fill="#ffffff"
          align="left"
          width={250}
        />
        <Image image={astroLogo} x={233} y={222} />
      </Group>,
      <Image
        image={comet1}
        x={393}
        y={-200}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 2.5,
              x: -120,
              y: 320,
            })
          }, 3500)
        }}
      />,
      <Image
        image={comet2}
        x={623}
        y={-200}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 2.5,
              x: -112,
              y: 617,
            })
          }, 3500)
        }}
      />,
      <Image
        image={comet1}
        x={965}
        y={222}
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              duration: 2.5,
              x: 240,
              y: 663,
            })
          }, 3500)
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

export default SplashFifteen
