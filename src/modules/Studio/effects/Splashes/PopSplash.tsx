import Konva from 'konva'
import React, { SetStateAction, useEffect, useState } from 'react'
import { Arc, Circle, Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import { IntroState, SplashRenderState } from '../fragments/IntroFragment'

const PopSplash = ({
  setFragmentState,
  viewMode,
  renderMode = 'animate',
  setIsTitleSplash,
}: {
  setFragmentState?: React.Dispatch<React.SetStateAction<IntroState>>
  viewMode?: boolean
  renderMode?: SplashRenderState
  setIsTitleSplash?: React.Dispatch<SetStateAction<boolean>>
}) => {
  const { fragment } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [configuration, setConfiguration] = useState<{ title: any }>()

  useEffect(() => {
    if (!fragment) return
    setConfiguration({
      title: {
        value: fragment.flick.name,
      },
    })
  }, [fragment])

  if (renderMode === 'animate')
    return (
      <Group>
        <Rect
          x={0}
          y={0}
          width={CONFIG.width}
          height={CONFIG.height}
          fill="#1F2937"
        />
        <Rect
          x={638}
          y={-50}
          width={10}
          height={62}
          fill="#58BDB0"
          cornerRadius={50}
          rotation={45}
          ref={(ref) => {
            ref?.to({
              duration: 1.5,
              width: 352,
              easing: Konva.Easings.StrongEaseInOut,
            })
          }}
        />
        <Circle
          x={272}
          y={75}
          radius={37}
          scaleX={0}
          scaleY={0}
          fill="#F5D24B"
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 1.5,
                scaleX: 1,
                scaleY: 1,
                easing: Konva.Easings.StrongEaseInOut,
              })
            }, 250)
          }}
        />
        <Arc
          x={92}
          y={218}
          innerRadius={0}
          outerRadius={56}
          fill="#58BDB0"
          angle={180}
          rotation={-15}
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                scaleX: 1,
                scaleY: 1,
                easing: Konva.Easings.StrongEaseInOut,
              })
            }, 750)
          }}
        />
        <Text
          key="title"
          x={98}
          y={370}
          text={configuration?.title.value as string}
          fontSize={58}
          fontFamily="Gilroy"
          fill="#ffffff"
          lineHeight={1.2}
          width={570}
          height={140}
          align="left"
          opacity={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                y: 285,
                opacity: 1,
                easing: Konva.Easings.StrongEaseInOut,
              })
            }, 750)
          }}
        />
        <Rect
          x={0}
          y={270}
          width={CONFIG.width}
          height={CONFIG.height / 2}
          fill="#1F2937"
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                y: 345,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      duration: 0.8,
                      y: CONFIG.height,
                    })
                  }, 50)
                },
              })
            }, 750)
          }}
        />
        <Circle
          x={857}
          y={365}
          radius={37}
          fill="#A869F1"
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                scaleX: 1,
                scaleY: 1,
                easing: Konva.Easings.StrongEaseInOut,
              })
            }, 750)
          }}
        />
        <Arc
          x={520}
          y={515}
          innerRadius={0}
          outerRadius={56}
          fill="#F5D24B"
          angle={180}
          rotation={125}
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 0.5,
                scaleX: 1,
                scaleY: 1,
                onFinish: () => {
                  setTimeout(() => {
                    if (!viewMode) setFragmentState?.('userMedia')
                  }, 2000)
                },
              })
            }, 1250)
          }}
        />
      </Group>
    )
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill="#1F2937"
      />
      <Rect
        x={638}
        y={-50}
        width={352}
        height={62}
        fill="#58BDB0"
        cornerRadius={50}
        rotation={45}
      />
      <Circle x={272} y={75} radius={37} fill="#F5D24B" />
      <Arc
        x={92}
        y={218}
        innerRadius={0}
        outerRadius={56}
        fill="#58BDB0"
        angle={180}
        rotation={-15}
      />
      <Text
        key="title"
        x={98}
        y={285}
        text={configuration?.title.value as string}
        fontSize={58}
        fontFamily="Gilroy"
        fill="#ffffff"
        lineHeight={1.2}
        width={570}
        height={140}
        align="left"
        opacity={1}
      />
      <Circle x={857} y={365} radius={37} fill="#A869F1" />
      <Arc
        x={520}
        y={515}
        innerRadius={0}
        outerRadius={56}
        fill="#F5D24B"
        angle={180}
        rotation={125}
        ref={(ref) => {
          ref?.to({
            duration: 3,
            onFinish: () => {
              setIsTitleSplash?.(false)
            },
          })
        }}
      />
    </Group>
  )
}

export default PopSplash
