import Konva from 'konva'
import React, { SetStateAction, useEffect, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { CONFIG } from '../../components/Concourse'
import { StudioProviderProps, studioStore } from '../../stores'
import { IntroState, SplashRenderState } from '../fragments/IntroFragment'

const RectangleSplash = ({
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
        value: fragment?.flick.name,
        // fragment?.flick?.name?.length > 12
        //   ? `${fragment?.flick?.name.substring(0, 12)}...`
        //   : fragment?.flick.name,
      },
    })
  }, [fragment])

  if (renderMode === 'animate')
    return (
      <>
        <Group x={0} y={0}>
          <Rect
            x={0}
            y={0}
            fill="#ffffff"
            width={CONFIG.width}
            height={CONFIG.height}
          />
          <Rect
            key="firstRect"
            x={-500}
            y={500}
            width={500}
            height={75}
            fill="#7B16A2"
            rotation={-45}
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: -60,
                y: 60,
                // easing: Konva.Easings.BackEaseInOut,
              })
            }}
          />
          <Rect
            key="secondRect"
            x={CONFIG.width + 140}
            y={0}
            width={600}
            height={75}
            fill="#4A148A"
            rotation={-45}
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: 550,
                y: 550,
                // easing: Konva.Easings.BackEaseInOut,
              })
            }}
          />
          <Rect
            key="thirdRect"
            x={200}
            y={1005}
            width={600}
            height={75}
            fill="#7B16A2"
            rotation={-45}
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: 600,
                y: 605,
                // easing: Konva.Easings.BackEaseInOut,
              })
            }}
          />
          <Rect
            key="fourthRect"
            x={1055}
            y={255}
            width={600}
            height={75}
            fill="#BB6AC9"
            rotation={-45}
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: 655,
                y: 655,
                // easing: Konva.Easings.BackEaseInOut,
              })
            }}
          />
          <Rect
            key="fifthRect"
            x={310}
            y={1105}
            width={500}
            height={75}
            fill="#E3BDEA"
            rotation={-45}
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: 710,
                y: 705,
                // easing: Konva.Easings.BackEaseInOut,
              })
            }}
          />
          <Text
            key="title"
            x={-600}
            y={0}
            text={configuration?.title.value as string}
            fontSize={54}
            fontFamily="Gilroy"
            fill="#000000"
            height={CONFIG.height}
            width={600}
            align="left"
            opacity={1}
            verticalAlign="middle"
            ref={(ref) => {
              ref?.to({
                duration: 1,
                x: 75,
                easing: Konva.Easings.EaseInOut,
                onFinish: () => {
                  setTimeout(() => {
                    if (!viewMode) setFragmentState?.('discord')
                  }, 2000)
                },
              })
            }}
          />
        </Group>
      </>
    )
  return (
    <>
      <Group x={0} y={0}>
        <Rect
          x={0}
          y={0}
          fill="#ffffff"
          width={CONFIG.width}
          height={CONFIG.height}
        />
        <Rect
          key="firstRect"
          x={-60}
          y={60}
          width={500}
          height={75}
          fill="#7B16A2"
          rotation={-45}
        />
        <Rect
          key="secondRect"
          x={550}
          y={550}
          width={600}
          height={75}
          fill="#4A148A"
          rotation={-45}
        />
        <Rect
          key="thirdRect"
          x={600}
          y={605}
          width={600}
          height={75}
          fill="#7B16A2"
          rotation={-45}
        />
        <Rect
          key="fourthRect"
          x={655}
          y={655}
          width={600}
          height={75}
          fill="#BB6AC9"
          rotation={-45}
        />
        <Rect
          key="fifthRect"
          x={710}
          y={705}
          width={500}
          height={75}
          fill="#E3BDEA"
          rotation={-45}
        />
        <Text
          key="title"
          x={75}
          y={0}
          text={configuration?.title.value as string}
          fontSize={54}
          fontFamily="Gilroy"
          fill="#000000"
          height={CONFIG.height}
          width={600}
          align="left"
          opacity={1}
          verticalAlign="middle"
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
    </>
  )
}

export default RectangleSplash
