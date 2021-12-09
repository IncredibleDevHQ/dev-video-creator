import React, { useEffect, useState } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { CONFIG } from '../../components/Concourse'
import useSplash, { Coordinates } from '../../hooks/use-splash'
import { StudioProviderProps, studioStore } from '../../stores'
import { IntroState } from '../fragments/IntroFragment'

const SplashEleven = ({
  setFragmentState,
  viewMode,
}: {
  setFragmentState: React.Dispatch<React.SetStateAction<IntroState>>
  viewMode: boolean
}) => {
  const { fragment } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const [configuration, setConfiguration] = useState<{ title: any }>()

  useEffect(() => {
    if (!fragment) return
    setConfiguration({
      title: {
        value: fragment.flick.name,
        // fragment?.flick?.name?.length > 15
        //   ? `${fragment?.flick?.name.substring(0, 15)}...`
        //   : fragment?.flick.name,
      },
    })
  }, [fragment])

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        fill="#ffffff"
        width={CONFIG.width}
        height={CONFIG.height}
      />
      <Line
        key="firstBlob"
        points={[
          23, 90, 200, 10, 180, 120, 140, 80, 100, 140, 60, 105, 40, 170,
        ]}
        fill="#00D2FF"
        tension={0.3}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="secondBlob"
        points={[360, 0, 610, 0, 550, 100, 480, 30, 430, 80]}
        fill="#00C075"
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="thirdBlob"
        points={[
          CONFIG.width - 190,
          0,
          CONFIG.width - 15,
          0,
          CONFIG.width - 20,
          45,
          CONFIG.width - 10,
          95,
          CONFIG.width - 90,
          100,
          CONFIG.width - 110,
          105,
          CONFIG.width - 220,
          95,
          CONFIG.width - 220,
          40,
          CONFIG.width - 190,
          35,
        ]}
        fill="#F1C452"
        tension={0.3}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="fourthBlob"
        points={[
          CONFIG.width - 120,
          CONFIG.height / 2 - 70,
          CONFIG.width - 110,
          CONFIG.height / 2 + 30,
          CONFIG.width - 150,
          CONFIG.height / 2 + 60,
          CONFIG.width - 190,
          CONFIG.height / 2 + 30,
        ]}
        fill="#5873F4"
        tension={0.4}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Circle
        key="firstCircle"
        x={CONFIG.width - 140}
        y={CONFIG.height - 40}
        radius={50}
        fill="#F4ACDA"
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
        x={CONFIG.width - 90}
        y={CONFIG.height - 80}
        radius={65}
        fill="#F4ACDA"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Circle
        key="thirdCircle"
        x={CONFIG.width - 35}
        y={CONFIG.height - 130}
        radius={55}
        fill="#F4ACDA"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="fifthBlob"
        points={[
          CONFIG.width / 2,
          CONFIG.height - 20,
          CONFIG.width / 2 - 5,
          CONFIG.height - 80,
          CONFIG.width / 2 + 20,
          CONFIG.height - 120,
          CONFIG.width / 2 + 70,
          CONFIG.height - 90,
        ]}
        fill="#FF0000"
        tension={0.4}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="sixthBlob"
        points={[
          50,
          CONFIG.height,
          45,
          CONFIG.height - 5,
          75,
          CONFIG.height - 30,
          50,
          CONFIG.height - 90,
          100,
          CONFIG.height - 50,
          120,
          CONFIG.height - 110,
          140,
          CONFIG.height - 50,
          160,
          CONFIG.height - 120,
          170,
          CONFIG.height - 50,
          240,
          CONFIG.height - 130,
          215,
          CONFIG.height - 50,
          315,
          CONFIG.height - 40,
          255,
          CONFIG.height - 10,
          265,
          CONFIG.height,
        ]}
        fill="#758dff"
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Line
        key="seventhBlob"
        points={[
          120,
          CONFIG.height / 2 - 70,
          110,
          CONFIG.height / 2 + 30,
          150,
          CONFIG.height / 2 + 60,
          190,
          CONFIG.height / 2 + 30,
        ]}
        fill="#F4ACDA"
        tension={0.4}
        closed
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
          })
        }}
      />
      <Text
        key="title"
        x={195}
        y={CONFIG.height / 2 - 40}
        text={configuration?.title.value as string}
        fontSize={40}
        width={570}
        height={100}
        fontFamily="Gilroy"
        fill="#000000"
        align="center"
        opacity={0}
        ref={(ref) => {
          ref?.to({
            duration: 1,
            opacity: 1,
            onFinish: () => {
              setTimeout(() => {
                if (!viewMode) setFragmentState('discord')
              }, 2500)
            },
          })
        }}
      />
    </Group>
  )
}

export default SplashEleven
