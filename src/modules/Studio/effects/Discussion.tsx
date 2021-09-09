import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import Konva from 'konva'
import { Group, Image, Rect, Text } from 'react-konva'
import { FiPlay, FiPause } from 'react-icons/fi'
import useImage from 'use-image'
import { Concourse } from '../components'
import { ControlButton } from '../components/MissionControl'
import { CONFIG, StudioCoordinates } from '../components/Concourse'
import { StudioProviderProps, studioStore } from '../stores'
import { Fragment_Status_Enum_Enum } from '../../../generated/graphql'
import config from '../../../config'

interface Dimension {
  width: number
  height: number
}

const Discussion = () => {
  const { state, fragment, payload, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [titleSpalshData, settitleSpalshData] = useState<{
    enable: boolean
    title?: string
  }>({ enable: false })

  const [wallPaper] = useImage(
    `${config.storage.baseUrl}cassidyWallPaper.png`,
    'anonymous'
  )

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    console.log(fragment.configuration.properties)
    // const gistURL = fragment.configuration.properties.find(
    //   (property: any) => property.key === 'gistUrl'
    // )?.value

    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
    })
  }, [fragment?.configuration.properties])

  const controls: JSX.Element[] = [<></>]

  const layerChildren = [
    <Image
      image={wallPaper}
      x={0}
      y={0}
      width={CONFIG.width}
      height={CONFIG.height}
    />,
    // <Rect
    //   x={36}
    //   y={412}
    //   width={236}
    //   height={93}
    //   fill="#ffffff"
    //   stroke="#000000"
    //   strokeWidth={5}
    // />,
    // <Text
    //   key="username"
    //   x={59}
    //   y={439}
    //   text="Cassidy Williams"
    //   fontSize={18}
    //   fontStyle="bold"
    //   fontFamily="Roboto Mono"
    //   fill="#000000"
    // />,
    // <Text
    //   key="designation"
    //   x={59}
    //   y={460}
    //   text="Cassidy Williams"
    //   fontSize={12}
    //   fontStyle="bold"
    //   fontFamily="Roboto Mono"
    //   fill="#6B7280"
    // />,
    // <Rect
    //   x={655}
    //   y={412}
    //   width={236}
    //   height={93}
    //   fill="#ffffff"
    //   stroke="#000000"
    //   strokeWidth={5}
    // />,
    // <Text
    //   key="username"
    //   x={668}
    //   y={439}
    //   text="Cassidy Williams"
    //   fontSize={18}
    //   fontStyle="bold"
    //   fontFamily="Roboto Mono"
    //   fill="#000000"
    // />,
    // <Text
    //   key="designation"
    //   x={668}
    //   y={460}
    //   text="Cassidy Williams"
    //   fontSize={12}
    //   fontStyle="bold"
    //   fontFamily="Roboto Mono"
    //   fill="#6B7280"
    // />,
  ]

  const studioCoordinates: StudioCoordinates[] = [
    { x: 26, y: 107, width: 435, height: 326.5 },
    { x: 496, y: 107, width: 435, height: 326.5 },
  ]

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates}
    />
  )
}

export default Discussion
