import FontFaceObserver from 'fontfaceobserver'
import Konva from 'konva'
import React, { SetStateAction, useEffect, useState } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import { IntroState, SplashRenderState } from '../fragments/IntroFragment'

const ShapesSplash = ({
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
        // fragment?.flick?.name?.length > 90
        //   ? `${fragment?.flick?.name.substring(0, 50)}...`
        //   : fragment?.flick.name,
      },
    })
  }, [fragment])

  useEffect(() => {
    const font = new FontFaceObserver('Poppins')
    font.load()
  }, [])

  const getLines = () => {
    let lineX1 = 0
    let lineX2 = 0
    const lines: JSX.Element[] = []
    for (let i = 0; i < 20; i += 1) {
      lines.push(
        <Line
          points={[lineX1, 0, lineX2, 120]}
          stroke="#f5e949"
          strokeWidth={2}
        />
      )
      lineX1 += 6
      lineX2 += 6
    }
    return lines
  }
  if (renderMode === 'animate')
    return (
      <Group>
        <Rect
          key="backgroundRect"
          x={0}
          y={0}
          fill="#ffffff"
          width={CONFIG.width}
          height={CONFIG.height}
        />
        <Rect
          key="firstRect"
          x={CONFIG.width / 2 + 180}
          y={-40}
          width={200}
          height={15}
          fill="#e6c24e"
          rotation={-45}
          ref={(ref) => {
            ref?.to({
              duration: 1.5,
              x: CONFIG.width / 2 + 80,
              y: 60,
              easing: Konva.Easings.BackEaseInOut,
            })
          }}
        />
        <Rect
          key="secondRect"
          x={CONFIG.width / 2 + 240}
          y={-40}
          width={200}
          height={15}
          fill="#85D4F6"
          rotation={-45}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 1,
                x: CONFIG.width / 2 + 140,
                y: 60,
                easing: Konva.Easings.BackEaseInOut,
              })
            }, 1000)
          }}
        />
        <Rect
          key="thirdRect"
          x={CONFIG.width}
          y={CONFIG.height / 2 - 100}
          width={85}
          height={85}
          fill="#f5e949"
          ref={(ref) => {
            ref?.to({
              duration: 0.5,
              x: CONFIG.width - 100,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    duration: 1,
                    rotation: -90,
                    easing: Konva.Easings.BackEaseOut,
                  })
                }, 500)
              },
            })
          }}
        />
        <Rect
          key="fourthRect"
          x={CONFIG.width}
          y={CONFIG.height / 2 - 100}
          width={85}
          height={85}
          fill="#7cd988"
          ref={(ref) => {
            ref?.to({
              duration: 0.5,
              x: CONFIG.width - 100,
              easing: Konva.Easings.BackEaseInOut,
            })
          }}
        />
        <Rect
          key="fifthRect"
          x={CONFIG.width - 75}
          y={CONFIG.height}
          width={50}
          height={150}
          fill="#85D4F6"
          rotation={180}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              y: CONFIG.height - 90,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                ref?.to({
                  duration: 1,
                  rotation: 90,
                })
              },
            })
          }}
        />
        <Group
          key="lineGroup"
          x={-280}
          y={CONFIG.height - 110}
          offsetX={60}
          offsetY={60}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              x: 120,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                ref?.to({
                  duartion: 2,
                  rotation: -135,
                })
              },
            })
          }}
        >
          {getLines()}
        </Group>
        <Line
          key="dashedLine1"
          points={[-120, CONFIG.height - 105, 0, CONFIG.height - 105]}
          stroke="#85D4F6"
          strokeWidth={2}
          lineJoin="round"
          dash={[10, 4]}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 1,
                points: [0, CONFIG.height - 105, 120, CONFIG.height - 105],
                easing: Konva.Easings.BackEaseInOut,
              })
            }, 1000)
          }}
        />
        <Line
          key="dashedLine2"
          points={[120, CONFIG.height + 105, 120, CONFIG.height]}
          stroke="#85D4F6"
          strokeWidth={2}
          lineJoin="round"
          dash={[10, 4]}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 1,
                points: [120, CONFIG.height, 120, CONFIG.height - 105],
                easing: Konva.Easings.BackEaseInOut,
              })
            }, 1000)
          }}
        />
        {/* <Line
        key="titleDashedLine"
        points={[150, CONFIG.height / 2, CONFIG.width - 150, CONFIG.height / 2]}
        stroke="#85D4F6"
        strokeWidth={2}
        lineJoin="round"
        dash={[10, 4]}
        // ref={() => {}}
      /> */}
        <Text
          key="title"
          x={150}
          y={CONFIG.height / 2 - 40}
          text={configuration?.title.value as string}
          fontSize={40}
          fontFamily="Gilroy"
          fill="#21C5FA"
          lineHeight={1.2}
          width={660}
          height={100}
          // width={CONFIG.width}
          align="center"
          opacity={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              opacity: 1,
            })
          }}
        />
        <Circle
          key="secondCircle"
          x={CONFIG.width + 70}
          y={CONFIG.height - 100}
          radius={60}
          stroke="orange"
          strokeWidth={3}
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                duration: 3,
                x: CONFIG.width - 75,
                easing: Konva.Easings.BackEaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    if (!viewMode) setFragmentState?.('onlyUserMedia')
                  }, 2000)
                },
              })
            }, 1000)
          }}
        />
        <Circle
          key="firstCircle"
          x={150}
          y={75}
          radius={6}
          fill="#027BC2"
          opacity={1}
          scaleX={0}
          scaleY={0}
          ref={(ref) => {
            ref?.to({
              duration: 1,
              scaleX: 11,
              scaleY: 11,
              easing: Konva.Easings.BackEaseOut,
              // onFinish: () => {
              //   setTimeout(() => {
              //     ref?.to({
              //       duration: 1,
              //       scaleX: 160,
              //       scaleY: 160,
              //       easing: Konva.Easings.BackEaseInOut,
              //     })
              //   }, 3000)
              // },
            })
          }}
        />
      </Group>
    )
  return (
    <Group>
      <Rect
        key="backgroundRect"
        x={0}
        y={0}
        fill="#ffffff"
        width={CONFIG.width}
        height={CONFIG.height}
      />
      <Rect
        key="firstRect"
        x={CONFIG.width / 2 + 80}
        y={60}
        width={200}
        height={15}
        fill="#e6c24e"
        rotation={-45}
      />
      <Rect
        key="secondRect"
        x={CONFIG.width / 2 + 140}
        y={60}
        width={200}
        height={15}
        fill="#85D4F6"
        rotation={-45}
      />
      <Rect
        key="thirdRect"
        x={CONFIG.width - 100}
        y={CONFIG.height / 2 - 100}
        width={85}
        height={85}
        fill="#f5e949"
        rotation={-90}
      />
      <Rect
        key="fourthRect"
        x={CONFIG.width - 100}
        y={CONFIG.height / 2 - 100}
        width={85}
        height={85}
        fill="#7cd988"
      />
      <Rect
        key="fifthRect"
        x={CONFIG.width - 75}
        y={CONFIG.height - 90}
        width={50}
        height={150}
        fill="#85D4F6"
        rotation={90}
      />
      <Group
        key="lineGroup"
        x={120}
        y={CONFIG.height - 110}
        offsetX={60}
        offsetY={60}
        rotation={-135}
      >
        {getLines()}
      </Group>
      <Line
        key="dashedLine1"
        points={[0, CONFIG.height - 105, 120, CONFIG.height - 105]}
        stroke="#85D4F6"
        strokeWidth={2}
        lineJoin="round"
        dash={[10, 4]}
      />
      <Line
        key="dashedLine2"
        points={[120, CONFIG.height, 120, CONFIG.height - 105]}
        stroke="#85D4F6"
        strokeWidth={2}
        lineJoin="round"
        dash={[10, 4]}
      />
      <Text
        key="title"
        x={150}
        y={CONFIG.height / 2 - 40}
        text={configuration?.title.value as string}
        fontSize={40}
        fontFamily="Gilroy"
        fill="#21C5FA"
        lineHeight={1.2}
        width={660}
        height={100}
        align="center"
        opacity={1}
      />
      <Circle
        key="secondCircle"
        x={CONFIG.width - 75}
        y={CONFIG.height - 100}
        radius={60}
        stroke="orange"
        strokeWidth={3}
        ref={(ref) => {
          ref?.to({
            duration: 3,
            onFinish: () => {
              setIsTitleSplash?.(false)
            },
          })
        }}
      />
      <Circle
        key="firstCircle"
        x={150}
        y={75}
        radius={6}
        fill="#027BC2"
        opacity={1}
        scaleX={11}
        scaleY={11}
      />
    </Group>
  )
}

export default ShapesSplash