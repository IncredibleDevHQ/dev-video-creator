import React, { useEffect, useState } from 'react'
import { Group, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { GradientConfig } from '../../../../utils/configTypes2'
import Concourse, { CONFIG } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { StudioProviderProps, studioStore } from '../../stores'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import AstroSplash from '../Splashes/AstroSplash'
import GraphQLSplash from '../Splashes/GraphQLSplash'
import SplashEleven from '../Splashes/SplashEleven'
import SplashFive from '../Splashes/SplashFive'
import SplashFour from '../Splashes/SplashFour'
import TensorFlowSplash from '../Splashes/TensorFlowSplash'

const IntroFragment = ({
  gradientConfig,
  themeNumber,
}: {
  gradientConfig?: GradientConfig
  themeNumber?: string
}) => {
  const { fragment, state } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const colorStops = [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8']
  const startPoint = { x: 0, y: 0 }
  const endPoint = { x: CONFIG.width, y: CONFIG.height }

  const [fragmentState, setFragmentState] =
    useState<FragmentState>('customLayout')

  const Splash = (() => {
    if (themeNumber === '0') return GraphQLSplash
    if (themeNumber === '1') return AstroSplash
    if (themeNumber === '2') return TensorFlowSplash
    if (themeNumber === '3') return SplashFive
    if (themeNumber === '4') return SplashFour
    if (themeNumber === '5') return SplashEleven
    return SplashFive
  })()

  useEffect(() => {
    if (state === 'recording') {
      if (fragmentState === 'customLayout') {
        setLayerChildren([
          <Group x={0} y={0}>
            <Splash setFragmentState={setFragmentState} />
          </Group>,
        ])
      }
      if (fragmentState === 'onlyUserMedia') {
        setLayerChildren([
          <Group x={0} y={0}>
            <Rect
              x={0}
              y={0}
              width={CONFIG.width}
              height={CONFIG.height}
              fillLinearGradientColorStops={
                gradientConfig?.values || colorStops
              }
              fillLinearGradientStartPoint={
                gradientConfig?.startIndex || startPoint
              }
              fillLinearGradientEndPoint={gradientConfig?.endIndex || endPoint}
            />
          </Group>,
        ])
      }
    }
  }, [state, fragmentState])

  const [layerChildren, setLayerChildren] = useState<JSX.Element[]>([
    <Group x={0} y={0}>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fillLinearGradientColorStops={gradientConfig?.values || colorStops}
        fillLinearGradientStartPoint={gradientConfig?.startIndex || startPoint}
        fillLinearGradientEndPoint={gradientConfig?.endIndex || endPoint}
      />
    </Group>,
  ])

  const studioUserConfig = StudioUserConfiguration({
    layout: 'classic',
    fragment,
    fragmentState,
    isShorts: false,
  })

  return (
    <Concourse
      studioUserConfig={studioUserConfig}
      layerChildren={layerChildren}
    />
  )
}

export default IntroFragment
