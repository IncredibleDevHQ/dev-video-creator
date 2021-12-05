import React, { useEffect, useState } from 'react'
import { Group, Rect, Text, Image } from 'react-konva'
import { useRecoilState, useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { GradientConfig } from '../../../../utils/configTypes2'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import { StudioProviderProps, studioStore } from '../../stores'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import incredibleLogo from '../../../../assets/incredible_logo.svg'
import outroPattern from '../../../../assets/outroPattern.svg'

const OutroFragment = ({
  gradientConfig,
  themeNumber,
  viewMode = false,
}: {
  gradientConfig?: GradientConfig
  themeNumber?: string
  viewMode?: boolean
}) => {
  const { fragment, state, addMusic, payload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  useEffect(() => {
    if (viewMode) setFragmentState(payload?.fragmentState || 'customLayout')
  }, [payload?.fragmentState])

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
  const [outroPatternImage] = useImage(outroPattern)

  useEffect(() => {
    if (state === 'recording')
      setStudio({
        ...studio,
        controlsConfig: {
          setFragmentState,
        },
      })
  }, [state])

  useEffect(() => {
    if (state === 'recording' || viewMode) {
      if (fragmentState === 'customLayout') {
        addMusic('splash')
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
              fill="#1F2937"
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    x: -CONFIG.width / 3,
                    duration: 0.5,
                  })
                }, 200)
              }
            />
            <Image
              image={outroPatternImage}
              x={(CONFIG.width * 2) / 3 - 360}
              y={CONFIG.height - 140}
              width={360}
              height={140}
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
              x={140}
              y={205}
              text="Thanks for watching"
              fill="#ffffff"
              fontSize={32}
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              fontFamily="Inter"
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
              x={140}
              y={250}
              text="To create incredible videos like these"
              fill="#ffffff"
              fontSize={16}
              fontFamily="Inter"
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
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
              x={140}
              y={270}
              text="Sign up on"
              fill="#ffffff"
              fontSize={16}
              fontFamily="Inter"
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
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
              x={225}
              y={270}
              text="incredible.dev"
              fill="#16A34A"
              fontSize={16}
              fontFamily="Inter"
              width={(CONFIG.width * 2) / 3}
              lineHeight={1.2}
              opacity={0}
              fontStyle="bold"
              textDecoration="underline"
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
        setTopLayerChildren([])
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
  }, [state, fragmentState, gradientConfig, themeNumber])

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

export const ShortsOutro = ({
  performFinishAction,
}: {
  performFinishAction: () => void
}) => {
  const [incredibleLogoImage] = useImage(incredibleLogo)
  const [outroPatternImage] = useImage(outroPattern)
  return (
    <Group x={0} y={0}>
      <Rect
        x={-SHORTS_CONFIG.width}
        y={0}
        width={SHORTS_CONFIG.width}
        height={SHORTS_CONFIG.height}
        fill="#1F2937"
        ref={(ref) =>
          ref?.to({
            x: 0,
            duration: 0.2,
          })
        }
      />
      <Rect
        x={-SHORTS_CONFIG.width}
        y={SHORTS_CONFIG.height - 70}
        width={SHORTS_CONFIG.width}
        height={70}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            x: 0,
            duration: 0.2,
          })
        }
      />
      <Image
        image={outroPatternImage}
        x={SHORTS_CONFIG.width - 385}
        y={SHORTS_CONFIG.height - 225}
        width={380}
        height={150}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={40}
        y={245}
        text="Thanks for watching"
        fill="#ffffff"
        fontSize={32}
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        fontFamily="Inter"
        fontStyle="bold"
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={44}
        y={290}
        text="To create incredible videos like these"
        fill="#ffffff"
        fontSize={16}
        fontFamily="Inter"
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={45}
        y={315}
        text="Sign up on"
        fill="#ffffff"
        fontSize={16}
        fontFamily="Inter"
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={131}
        y={315}
        text="incredible.dev"
        fill="#16A34A"
        fontSize={16}
        fontFamily="Inter"
        width={(SHORTS_CONFIG.width * 2) / 3}
        lineHeight={1.2}
        opacity={0}
        fontStyle="bold"
        textDecoration="underline"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
              onFinish: () => {
                setTimeout(() => {
                  performFinishAction()
                }, 2000)
              },
            })
          }, 100)
        }
      />
      <Image
        image={incredibleLogoImage}
        x={SHORTS_CONFIG.width - 140}
        y={SHORTS_CONFIG.height - 50}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
    </Group>
  )
}
