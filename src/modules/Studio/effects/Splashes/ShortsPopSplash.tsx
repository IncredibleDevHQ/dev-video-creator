import Konva from 'konva'
import React, { SetStateAction, useEffect, useState } from 'react'
import { Arc, Circle, Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { StudioProviderProps, studioStore } from '../../stores'
import { SplashRenderState } from '../fragments/IntroFragment'

const ShortsPopSplash = ({
  setIsTitleSplash,
  stageConfig,
  renderMode = 'animate',
}: {
  setIsTitleSplash?: React.Dispatch<SetStateAction<boolean>>
  stageConfig: {
    width: number
    height: number
  }
  renderMode?: SplashRenderState
}) => {
  const { fragment } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [configuration, setConfiguration] = useState<{ title: any }>()

  useEffect(() => {
    if (!fragment) return
    setConfiguration({
      title: {
        value: fragment.name,
      },
    })
  }, [fragment])

  if (renderMode === 'animate')
    return (
      <Group>
        <Rect
          x={0}
          y={0}
          width={stageConfig.width}
          height={stageConfig.height}
          fill="#1F2937"
        />
        <Rect
          x={200}
          y={-50}
          width={10}
          height={62}
          fill="#58BDB0"
          cornerRadius={50}
          rotation={45}
          ref={(ref) => {
            ref?.to({
              duration: 1.5,
              width: 260,
              easing: Konva.Easings.StrongEaseInOut,
            })
          }}
        />
        <Circle
          x={78}
          y={70}
          radius={27}
          scaleX={0}
          scaleY={0}
          fill="#F5D24B"
          ref={(ref) => {
            ref?.to({
              duration: 0.25,
              onFinish: () => {
                ref?.to({
                  duration: 0.5,
                  scaleX: 1,
                  scaleY: 1,
                  easing: Konva.Easings.StrongEaseInOut,
                })
              },
            })
          }}
        />
        <Arc
          x={30}
          y={254}
          innerRadius={0}
          outerRadius={56}
          fill="#58BDB0"
          angle={180}
          rotation={-15}
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            ref?.to({
              duration: 0.75,
              onFinish: () => {
                ref?.to({
                  duration: 0.5,
                  scaleX: 1,
                  scaleY: 1,
                  easing: Konva.Easings.StrongEaseInOut,
                })
              },
            })
          }}
        />
        <Text
          key="title"
          x={37}
          y={400}
          text={configuration?.title.value as string}
          fontSize={34}
          fontFamily="Gilroy"
          fill="#ffffff"
          lineHeight={1.2}
          width={322}
          height={140}
          align="left"
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 0.75,
              y: 340,
              onFinish: () => {
                ref?.to({
                  duration: 0.05,
                  onFinish: () => {
                    ref?.to({
                      duration: 0.5,
                      y: 320,
                      opacity: 1,
                      easing: Konva.Easings.StrongEaseInOut,
                    })
                  },
                })
              },
            })
          }}
        />
        <Rect
          x={0}
          y={300}
          width={stageConfig.width}
          height={stageConfig.height / 2}
          fill="#1F2937"
          // fill="white"
          ref={(ref) => {
            ref?.to({
              duration: 0.75,
              onFinish: () => {
                ref?.to({
                  duration: 0.5,
                  y: 340,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        duration: 0.8,
                        y: stageConfig.height,
                      })
                    }, 50)
                  },
                })
              },
            })
          }}
        />
        <Circle
          x={275}
          y={470}
          radius={27}
          fill="#A869F1"
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            ref?.to({
              duration: 0.75,
              onFinish: () => {
                ref?.to({
                  duration: 0.5,
                  scaleX: 1,
                  scaleY: 1,
                  easing: Konva.Easings.StrongEaseInOut,
                })
              },
            })
          }}
        />
        <Arc
          x={174}
          y={546}
          innerRadius={0}
          outerRadius={56}
          fill="#F5D24B"
          angle={180}
          rotation={125}
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            ref?.to({
              duration: 1.25,
              onFinish: () => {
                ref?.to({
                  duration: 0.5,
                  scaleX: 1,
                  scaleY: 1,
                  onFinish: () => {
                    setTimeout(() => {
                      setIsTitleSplash?.(false)
                    }, 2000)
                  },
                })
              },
            })
          }}
        />
      </Group>
    )
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height}
        fill="#1F2937"
      />
      <Rect
        x={200}
        y={-50}
        width={260}
        height={62}
        fill="#58BDB0"
        cornerRadius={50}
        rotation={45}
      />
      <Circle x={78} y={70} radius={27} fill="#F5D24B" />
      <Arc
        x={80}
        y={254}
        innerRadius={0}
        outerRadius={56}
        fill="#58BDB0"
        angle={180}
        rotation={-15}
      />
      <Text
        key="title"
        x={37}
        y={330}
        text={configuration?.title.value as string}
        fontSize={34}
        fontFamily="Gilroy"
        fill="#ffffff"
        lineHeight={1.2}
        width={322}
        height={140}
        align="left"
        opacity={1}
      />
      <Circle x={285} y={470} radius={27} fill="#A869F1" />
      <Arc
        x={134}
        y={576}
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

export default ShortsPopSplash
