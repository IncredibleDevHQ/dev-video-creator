import React, { useEffect, useRef, useState } from 'react'
import { Group, Rect, Image } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { LayoutConfig, ViewConfig } from '../../../../utils/configTypes'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import CustomSplash from '../CustomSplash'
import SplashFifteen from '../SplashFifteen'
import SplashFive from '../SplashFive'
import SplashFour from '../SplashFour'
import SplashSixteen from '../SplashSixteen'
import SplashTen from '../SplashTen'
import SplashThree from '../SplashThree'

const IntroFragment = ({
  viewConfig,
  themeNumber,
}: {
  viewConfig: LayoutConfig
  themeNumber: string
}) => {
  const { fragment, state, shortsMode } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  const Splash = (() => {
    if (themeNumber === '0') return SplashFive
    if (themeNumber === '1') return SplashThree
    if (themeNumber === '2') return SplashTen
    if (themeNumber === '3') return SplashFifteen
    if (themeNumber === '4') return SplashSixteen
    if (themeNumber === '5') return SplashFour
    return CustomSplash
  })()

  const layerChildren = [
    <Group x={0} y={0}>
      {viewConfig.background.type === 'color' ? (
        <Rect
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          fillLinearGradientColorStops={viewConfig.background.gradient?.values}
          fillLinearGradientStartPoint={
            viewConfig.background.gradient?.startIndex
          }
          fillLinearGradientEndPoint={viewConfig.background.gradient?.endIndex}
        />
      ) : (
        <Image
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          image={bgImage}
        />
      )}
    </Group>,
    <Group>
      <Splash />
    </Group>,
  ]

  return <Concourse disableUserMedia layerChildren={layerChildren} />
}

export default IntroFragment
