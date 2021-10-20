import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image, Rect } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import {
  Fragment_Status_Enum_Enum,
  useGetTokenisedCodeLazyQuery,
} from '../../../../generated/graphql'
import { User, userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { CONFIG, TitleSplashProps } from '../../components/Concourse'
import LowerThirds, { FragmentCard } from '../../components/LowerThirds'
import {
  controls,
  FragmentState,
  getRenderedTokens,
  getTokens,
  RenderMultipleLineFocus,
} from '../../components/RenderTokens'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import { studioCoordinates } from './TensorFlowConfig'

export const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}

interface CodeBlockConfig {
  from: number
  to: number
  explanation: string
  id: string
  order: number
}

const NewTensorFlowCodeJam = () => {
  const { fragment, payload, updatePayload, state, participants, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<TitleSplashProps>({
    enable: false,
  })

  const { initUseCode, computedTokens } = useCode()
  const [getTokenisedCode, { data }] = useGetTokenisedCodeLazyQuery()
  const [position, setPosition] = useState<Position>({
    prevIndex: -1,
    currentIndex: 0,
  })

  // a bool state which tells if the code render format is block-wise
  const [isBlockRender, setIsBlockRender] = useState<boolean>()
  // a state which stores the active block info like index
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0)
  // a state to tell if the block of code is focused or not
  const [focusBlockCode, setFocusBlockCode] = useState<boolean>(false)
  const [highlightBlockCode, setHiglightBlockCode] = useState<boolean>(false)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const bothGroupRef = useRef<Konva.Group>(null)
  // const onlyUserMediaGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

  const [blockConfig, setBlockConfig] = useState<CodeBlockConfig[]>([])

  const { displayName } = (useRecoilValue(userState) as User) || {}

  const [fragmentImages, setFragmentImages] = useState<string[]>([])
  const [fragmentImage] = useImage(fragmentImages?.[0] || '', 'anonymous')
  const [fragmentImageDim, setFragmentImageDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const code = fragment.configuration.properties.find(
      (property: any) => property.key === 'code'
    )?.value?.code
    const language: string = fragment.configuration.properties.find(
      (property: any) => property.key === 'code'
    )?.value?.language

    setIsBlockRender(
      fragment.configuration.properties.find(
        (property: any) => property.key === 'code'
      )?.value?.isAutomated
    )
    const blocks = Object.assign(
      [],
      fragment.configuration.properties.find(
        (property: any) => property.key === 'code'
      )?.value?.explanation
    )
    blocks.unshift({ from: 0, to: 0, explanation: '', id: '', order: 0 })
    setBlockConfig(blocks)
    // setConfig of titleSpalsh
    settitleSpalshData({
      enable: fragment.configuration.properties.find(
        (property: any) => property.key === 'showTitleSplash'
      )?.value,
      title: fragment.name as string,
      bgRectColor: ['#140D1F', '#6E1DDB'],
      stripRectColor: ['#FF5D01', '#B94301'],
      textColor: ['#E6E6E6', '#FFFFFF'],
    })
    ;(async () => {
      try {
        getTokenisedCode({
          variables: {
            code,
            language: language?.toLowerCase(),
          },
        })
      } catch (e) {
        console.error(e)
        throw e
      }
    })()
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!data?.TokenisedCode) return
    initUseCode({
      tokens: data.TokenisedCode.data,
      canvasWidth: 585,
      canvasHeight: 380,
      gutter: 5,
      fontSize: codeConfig.fontSize,
    })
  }, [data])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex || 0,
      currentIndex: payload?.currentIndex || 1,
    })
    setFragmentState(payload?.fragmentState)
    if (isBlockRender) {
      setActiveBlockIndex(payload?.activeBlockIndex)
      if (payload?.focusBlockCode) {
        setHiglightBlockCode(payload?.focusBlockCode)
        setTimeout(() => {
          setFocusBlockCode(payload?.focusBlockCode)
        }, 1000)
      } else {
        setFocusBlockCode(payload?.focusBlockCode)
        setTimeout(() => {
          setHiglightBlockCode(payload?.focusBlockCode)
        }, 1000)
      }
    }
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      setPosition({
        prevIndex: -1,
        currentIndex: 0,
      })
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        focusBlockCode: false,
        isFocus: false,
        fragmentState: 'onlyUserMedia',
        activeBlockIndex: 0,
      })
      setTopLayerChildren([])
    }
    if (state === 'recording') {
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        focusBlockCode: false,
        isFocus: false,
        fragmentState: 'onlyUserMedia',
        activeBlockIndex: 0,
      })
      setTopLayerChildren([])
      if (
        fragment?.participants.length === 1 &&
        !fragment?.configuration.properties.find(
          (property: any) => property.key === 'showTitleSplash'
        )?.value
      ) {
        setTimeout(() => {
          if (!displayName) return
          if (!fragment) return
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates[0] || 0}
              y={460}
              userName={displayName}
              rectOneColors={['#E6E6E6', '#FFFFFF']}
              rectTwoColors={['#425066', '#425066']}
              rectThreeColors={['#FF6F00', '#FFA100']}
            />,
            ...users.map((user, index) => (
              <LowerThirds
                x={lowerThirdCoordinates[index + 1] || 0}
                y={400}
                userName={participants?.[user.uid]?.displayName || ''}
                rectOneColors={['#E6E6E6', '#FFFFFF']}
                rectTwoColors={['#425066', '#425066']}
                rectThreeColors={['#FF6F00', '#FFA100']}
              />
            )),
          ])
        }, 1000)
        setTimeout(() => {
          setTopLayerChildren([
            <FragmentCard
              x={25}
              y={85}
              fragmentTitle={fragment?.name || ''}
              rectOneColors={['#FF6F00', '#FFA100']}
              rectTwoColors={['#E6E6E6', '#FFFFFF']}
              fragmentImage={fragmentImage}
              fragmentImageDimensions={fragmentImageDim}
            />,
          ])
        }, 5000)
      } else {
        setTimeout(() => {
          if (!displayName) return
          if (!fragment) return
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates[0] || 0}
              y={460}
              userName={displayName}
              rectOneColors={['#E6E6E6', '#FFFFFF']}
              rectTwoColors={['#425066', '#425066']}
              rectThreeColors={['#FF6F00', '#FFA100']}
            />,
            ...users.map((user, index) => (
              <LowerThirds
                x={lowerThirdCoordinates[index + 1] || 0}
                y={400}
                userName={participants?.[user.uid]?.displayName || ''}
                rectOneColors={['#E6E6E6', '#FFFFFF']}
                rectTwoColors={['#425066', '#425066']}
                rectThreeColors={['#FF6F00', '#FFA100']}
              />
            )),
          ])
        }, 5000)
      }
    }
  }, [state])

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'onlyFragment') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (fragmentState === 'onlyUserMedia') {
      setTopLayerChildren([
        <MutipleRectMoveLeft
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      onlyFragmentGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
      bothGroupRef.current.to({
        opacity: 0,
        duration: 0.2,
      })
    }
    // Checking if the current state is both and making the opacity of the only both group 1
    if (fragmentState === 'both') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#651CC8', '#9561DA']}
          rectTwoColors={['#FF5D01', '#B94301']}
          rectThreeColors={['#1F2937', '#778496']}
        />,
      ])
      bothGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const lowerThirdCoordinates = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return [70, 530]
      case 3:
        return [45, 355, 665]
      default:
        return [95]
    }
  })()

  const [incredibleLogo] = useImage(
    `${config.storage.baseUrl}x-incredible-black.svg`,
    'anonymous'
  )
  const [tensorflowLogo] = useImage(
    `${config.storage.baseUrl}100DaysOfTF.svg`,
    'anonymous'
  )
  const [tensorflowBg] = useImage(
    `${config.storage.baseUrl}tensorflow_bg.svg`,
    'anonymous'
  )

  const layerChildren = [
    <Group x={0} y={0}>
      <Rect
        strokeWidth={1}
        x={0}
        y={0}
        fill="#F5F6F7"
        width={CONFIG.width}
        height={CONFIG.height}
        stroke="#111111"
      />
      <Image
        image={tensorflowBg}
        x={1}
        y={1}
        fill="#F5F6F7"
        width={CONFIG.width - 2}
        height={CONFIG.height - 2}
      />
      <Image image={incredibleLogo} x={25} y={CONFIG.height - 60} />
      <Image image={tensorflowLogo} x={820} y={CONFIG.height - 50} />
    </Group>,
    <Group x={0} y={0} opacity={0} ref={bothGroupRef}>
      <Rect
        x={27}
        y={48}
        width={704}
        height={396}
        fillLinearGradientStartPoint={{
          x: -CONFIG.width / 2,
          y: -CONFIG.height / 2,
        }}
        fillLinearGradientEndPoint={{
          x: CONFIG.width / 2,
          y: CONFIG.height / 2,
        }}
        fillLinearGradientColorStops={[0.5, '#FF6E00 ', 1, '#FF9000']}
        cornerRadius={8}
      />
      <Rect
        x={37}
        y={58}
        width={704}
        height={396}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={52} y={73} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={57} y={88} key="group">
          {getRenderedTokens(computedTokens.current, position)}
        </Group>
      )}
    </Group>,
    <Group x={0} y={0} opacity={0} ref={onlyFragmentGroupRef}>
      <Rect
        x={70}
        y={20}
        width={800}
        height={440}
        fillLinearGradientStartPoint={{
          x: -CONFIG.width / 2,
          y: -CONFIG.height / 2,
        }}
        fillLinearGradientEndPoint={{
          x: CONFIG.width / 2,
          y: CONFIG.height / 2,
        }}
        fillLinearGradientColorStops={[0.5, '#FF6E00 ', 1, '#FF9000']}
        cornerRadius={8}
      />
      <Rect
        x={80}
        y={30}
        width={800}
        height={440}
        fill="#202026"
        cornerRadius={8}
      />
      <Group x={100} y={45} key="circleGroup">
        <Circle key="redCircle" x={0} y={0} fill="#FF605C" radius={5} />
        <Circle key="yellowCircle" x={14} y={0} fill="#FFBD44" radius={5} />
        <Circle key="greenCircle" x={28} y={0} fill="#00CA4E" radius={5} />
      </Group>
      {payload?.status === Fragment_Status_Enum_Enum.Live && (
        <Group x={105} y={60} key="codeGroup">
          {getTokens(
            computedTokens.current,
            computedTokens.current[
              computedTokens.current.find(
                (token) =>
                  token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].from - 1) || 0
              )?.startFromIndex || 0
            ]?.lineNumber
          )}
          {highlightBlockCode && (
            <Rect
              x={-5}
              y={
                (computedTokens.current.find(
                  (token) =>
                    token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].from - 1)
                )?.y || 0) - 5
              }
              width={585}
              height={
                (computedTokens.current.find(
                  (token) =>
                    token.lineNumber ===
                    (blockConfig &&
                      blockConfig[activeBlockIndex] &&
                      blockConfig[activeBlockIndex].to - 1)
                )?.y || 0) -
                  (computedTokens.current.find(
                    (token) =>
                      token.lineNumber ===
                      (blockConfig &&
                        blockConfig[activeBlockIndex] &&
                        blockConfig[activeBlockIndex].from - 1)
                  )?.y || 0) +
                  codeConfig.fontSize +
                  5 >
                0
                  ? (computedTokens.current.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].to - 1)
                    )?.y || 0) -
                    (computedTokens.current.find(
                      (token) =>
                        token.lineNumber ===
                        (blockConfig &&
                          blockConfig[activeBlockIndex] &&
                          blockConfig[activeBlockIndex].from - 1)
                    )?.y || 0) +
                    codeConfig.fontSize +
                    10
                  : 0
              }
              fill="#0066B8"
              opacity={0.3}
              cornerRadius={8}
            />
          )}
        </Group>
      )}
      {focusBlockCode && (
        <RenderMultipleLineFocus
          tokens={computedTokens.current}
          startLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].from - 1
          }
          endLineNumber={
            blockConfig &&
            blockConfig[activeBlockIndex] &&
            blockConfig[activeBlockIndex].to - 1
          }
          explanation={
            (blockConfig &&
              blockConfig[activeBlockIndex] &&
              blockConfig[activeBlockIndex].explanation) ||
            ''
          }
          groupCoordinates={{ x: 90, y: 60 }}
          bgRectInfo={{
            x: 80,
            y: 30,
            width: 800,
            height: 440,
            radius: 8,
          }}
          opacity={1}
        />
      )}
    </Group>,
  ]
  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(
        setFocusBlockCode,
        position,
        computedTokens.current,
        fragmentState,
        setFragmentState,
        isBlockRender,
        blockConfig.length
      )}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates(fragment, fragmentState)}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default NewTensorFlowCodeJam
