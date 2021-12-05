import React, { useEffect, useState } from 'react'
import { Group, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { GradientConfig } from '../../../../utils/configTypes2'
import { DiscordConfig } from '../../../Flick/components/IntroOutroView'
import Concourse, { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import DiscordSplash from '../DiscordSplash'
import AstroSplash from '../Splashes/AstroSplash'
import GraphQLSplash from '../Splashes/GraphQLSplash'
import SplashEleven from '../Splashes/SplashEleven'
import SplashFive from '../Splashes/SplashFive'
import SplashFour from '../Splashes/SplashFour'
import TensorFlowSplash from '../Splashes/TensorFlowSplash'

export type IntroState = 'onlyUserMedia' | 'customLayout' | 'discord'

const IntroFragment = ({
  gradientConfig,
  themeNumber,
  discordConfig,
  viewMode = false,
}: {
  gradientConfig: GradientConfig
  discordConfig: DiscordConfig
  themeNumber: string
  viewMode?: boolean
}) => {
  const { fragment, state, addMusic, stopMusic, payload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  // const [bgImage] = useImage(viewConfig?.background?.image || '', 'anonymous')

  const colorStops = [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8']
  const startPoint = { x: 0, y: 0 }
  const endPoint = { x: CONFIG.width, y: CONFIG.height }

  const [fragmentState, setFragmentState] = useState<IntroState>('customLayout')

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
    if (state === 'recording') setFragmentState('customLayout')
  }, [state])

  useEffect(() => {
    if (viewMode) setFragmentState(payload?.fragmentState || 'customLayout')
  }, [payload?.fragmentState])

  useEffect(() => {
    if (state === 'recording' || state === 'ready' || viewMode) {
      if (fragmentState === 'customLayout') {
        if (!viewMode) addMusic('splash')
        setLayerChildren([
          <Group x={0} y={0}>
            <Splash setFragmentState={setFragmentState} viewMode={viewMode} />
          </Group>,
        ])
      }
      if (fragmentState === 'discord') {
        setLayerChildren([
          <Group x={0} y={0}>
            <DiscordSplash
              setFragmentState={setFragmentState}
              viewMode={viewMode}
              discordConfig={discordConfig}
            />
          </Group>,
        ])
      }
      if (fragmentState === 'onlyUserMedia') {
        if (!viewMode) stopMusic()
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
  }, [state, fragmentState, themeNumber, discordConfig, gradientConfig])

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
    fragmentState:
      fragmentState === 'onlyUserMedia' ? 'onlyUserMedia' : 'customLayout',
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
