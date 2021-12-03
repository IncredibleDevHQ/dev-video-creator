import React, { useEffect, useState } from 'react'
import { Group, Rect, Text, Image } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { GradientConfig } from '../../../../utils/configTypes2'
import Concourse, { CONFIG } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { StudioProviderProps, studioStore } from '../../stores'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import incredibleLogo from '../../../../assets/incredible_logo.svg'

const OutroFragment = ({
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
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const [studio, setStudio] = useRecoilState(studioStore)

  const [incredibleLogoImage] = useImage(incredibleLogo)

  useEffect(() => {
    setStudio({
      ...studio,
      controlsConfig: {
        setFragmentState,
      },
    })
  }, [])

  useEffect(() => {
    if (state === 'recording') {
      if (fragmentState === 'customLayout') {
        setTopLayerChildren([
          <Group x={0} y={0}>
            <Rect
              x={-CONFIG.width}
              y={0}
              width={CONFIG.width}
              height={CONFIG.height}
              fill="#ffffff"
              ref={(ref) =>
                ref?.to({
                  x: 0,
                  duration: 0.5,
                })
              }
            />
            <Rect
              x={-CONFIG.width}
              y={0}
              width={CONFIG.width}
              height={CONFIG.height}
              fillLinearGradientColorStops={
                gradientConfig?.values || [0, '#4ADE80', 1, '#16A34A']
              }
              fillLinearGradientStartPoint={
                gradientConfig?.startIndex || startPoint
              }
              fillLinearGradientEndPoint={gradientConfig?.endIndex || endPoint}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    x: -CONFIG.width / 3,
                    duration: 0.5,
                  })
                }, 200)
              }
            />
            <Text
              x={36}
              y={130}
              text="Thank you"
              fill="#ffffff"
              fontSize={70}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontStyle="bold"
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
            <Text
              x={40}
              y={210}
              text="for watching"
              fill="#ffffff"
              fontSize={70}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontStyle="bold"
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
            <Text
              x={40}
              y={300}
              text="To create incredible videos like these"
              fill="#ffffff"
              fontSize={20}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontStyle="bold"
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
            <Text
              x={40}
              y={330}
              text="Sign up on "
              fill="#ffffff"
              fontSize={20}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontStyle="bold"
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
            <Text
              x={150}
              y={330}
              text="incredible.dev"
              fill="#000000"
              fontSize={20}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontStyle="bold"
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
            <Image
              image={incredibleLogoImage}
              x={(CONFIG.width * 2) / 3 + 20}
              y={CONFIG.height - 50}
              opacity={0}
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    opacity: 1,
                    duration: 0.2,
                  })
                }, 700)
              }
            />
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
      topLayerChildren={topLayerChildren}
    />
  )
}

export default OutroFragment
