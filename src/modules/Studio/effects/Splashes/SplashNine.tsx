import React, { useEffect, useState } from 'react'
import { Circle, Rect, Text, Image } from 'react-konva'
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

const SplashNine = () => {
  const { state } = (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [configuration, setConfiguration] =
    useState<{ title: any; subTitle: any }>()
  const params: { fragmentId: string } = useParams()

  const { data } = useGetFragmentByIdQuery({
    variables: { id: params.fragmentId, sub: sub as string },
  })

  const [elasticLogo] = useImage(
    `${config.storage.baseUrl}elastic-logo.png`,
    'anonymous'
  )
  const [elasticUser] = useImage(
    `${config.storage.baseUrl}elastic-user.png`,
    'anonymous'
  )
  const [whiteCircle] = useImage(
    `${config.storage.baseUrl}circle.png`,
    'anonymous'
  )
  const [pinkCircle] = useImage(
    `${config.storage.baseUrl}pink2.png`,
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
      <Circle x={82} y={10} radius={55} fill="#7DE2D1" />,
      <Circle x={70} y={CONFIG.height - 70} radius={100} fill="#7DE2D1" />,
      <Circle x={273} y={400} radius={10} fill="#0077CC" />,
      <Circle x={640} y={80} radius={10} fill="#0077CC" />,
      <Image image={pinkCircle} x={790} y={360} />,
      <Image image={whiteCircle} x={615} y={205} />,
      <Text
        key="title"
        x={60}
        y={150}
        text="Elastic"
        fontSize={96}
        fontFamily="Poppins"
        fontStyle="normal 900"
        fill="#1F2937"
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
        key="subTitle"
        x={60}
        y={260}
        text="Limitless XDR. Unbounded security."
        fontSize={36}
        fontFamily="Poppins"
        lineHeight={1.25}
        fill="#1F2937"
        align="left"
        width={titleWidth}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Image
        image={elasticLogo}
        x={CONFIG.width - 130}
        y={20}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />,
      <Image
        image={elasticUser}
        x={490}
        y={355}
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
        x={600}
        y={400}
        text="Aravind Putrevu"
        fontSize={24}
        fontFamily="Source Sans Pro"
        fontStyle="normal 400"
        fill="#1F2937"
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
        x={600}
        y={430}
        text="Senior Developer Advocate @ Elastic"
        fontSize={16}
        fontFamily="Source Sans Pro"
        fill="#1F2937"
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

export default SplashNine
