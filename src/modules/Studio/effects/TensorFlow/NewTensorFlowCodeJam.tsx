import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import { useGetTokenisedCodeLazyQuery } from '../../../../generated/graphql'
import { User, userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds, { FragmentCard } from '../../components/LowerThirds'
import {
  controls,
  FragmentState,
  shortsCodeConfig,
} from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import useCode from '../../hooks/use-code'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import {
  shortsStudioCoordinates,
  studioCoordinates,
  TensorflowCodexLayerChildren,
  TensorflowShortsCodexLayerChildren,
} from './TensorFlowConfig'

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

  const { getImageDimensions } = useEdit()
  const { getNoOfLinesOfText } = usePoint()

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

  const [isShorts, setIsShorts] = useState<boolean>(false)

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

    setFragmentImages(
      fragment.configuration.properties.find(
        (property: any) => property.type === 'file[]'
      )?.value
    )

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
      bgRectColor: ['#FF6F00', '#FFA100'],
      stripRectColor: ['#E6E6E6', '#FFFFFF'],
      textColor: ['#425066', '#425066'],
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
    if (!isShorts)
      initUseCode({
        tokens: data.TokenisedCode.data,
        canvasWidth: 585,
        canvasHeight: 380,
        gutter: 5,
        fontSize: codeConfig.fontSize,
      })
    else
      initUseCode({
        tokens: data.TokenisedCode.data,
        canvasWidth: 300,
        canvasHeight: 550,
        gutter: 5,
        fontSize: shortsCodeConfig.fontSize,
      })
  }, [data, isShorts])

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
    setFragmentImageDim(
      getImageDimensions(
        {
          w: (fragmentImage && fragmentImage.width) || 0,
          h: (fragmentImage && fragmentImage.height) || 0,
        },
        380,
        230,
        400,
        getNoOfLinesOfText({
          text: fragment?.name || '',
          availableWidth: 350,
          fontSize: 36,
          fontFamily: 'Roboto',
          stageWidth: 400,
        }) === 1
          ? 285
          : 230,
        0,
        getNoOfLinesOfText({
          text: fragment?.name || '',
          availableWidth: 350,
          fontSize: 36,
          fontFamily: 'Roboto',
          stageWidth: 400,
        }) === 1
          ? 60
          : 110
      )
    )
  }, [fragmentImage])

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
      if (!displayName) return
      if (!fragment) return
      if (
        fragment?.participants.length === 1 &&
        !fragment?.configuration.properties.find(
          (property: any) => property.key === 'showTitleSplash'
        )?.value &&
        !isShorts &&
        fragmentImage
      ) {
        setTimeout(() => {
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates.x[0] || 0}
              y={460}
              userName={displayName}
              rectOneColors={['#E6E6E6', '#FFFFFF']}
              rectTwoColors={['#425066', '#425066']}
              rectThreeColors={['#FF6F00', '#FFA100']}
            />,
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
      } else if (!isShorts) {
        setTimeout(() => {
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates.x[0] || 0}
              y={lowerThirdCoordinates.y?.[0]}
              userName={displayName}
              rectOneColors={['#E6E6E6', '#FFFFFF']}
              rectTwoColors={['#425066', '#425066']}
              rectThreeColors={['#FF6F00', '#FFA100']}
            />,
            ...users.map((user, index) => (
              <LowerThirds
                x={lowerThirdCoordinates.x[index + 1] || 0}
                y={lowerThirdCoordinates.y[index + 1]}
                userName={participants?.[user.uid]?.displayName || ''}
                rectOneColors={['#E6E6E6', '#FFFFFF']}
                rectTwoColors={['#425066', '#425066']}
                rectThreeColors={['#FF6F00', '#FFA100']}
              />
            )),
          ])
        }, 5000)
      } else {
        setTimeout(() => {
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates.x[0] || 0}
              y={570}
              userName={displayName}
              rectOneColors={['#E6E6E6', '#FFFFFF']}
              rectTwoColors={['#425066', '#425066']}
              rectThreeColors={['#FF6F00', '#FFA100']}
            />,
          ])
        }, 5000)
      }
    }
  }, [state])

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
          isShorts={isShorts}
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
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
          isShorts={isShorts}
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
    if (!isShorts)
      switch (fragment?.participants.length) {
        case 2:
          return { x: [70, 530], y: [400, 400] }
        case 3:
          return { x: [45, 355, 665], y: [400, 400, 400] }
        default:
          return { x: [20], y: [460] }
      }
    else return { x: [30], y: [570] }
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

  const layerChildren = !isShorts
    ? TensorflowCodexLayerChildren({
        bothGroupRef,
        onlyFragmentGroupRef,
        computedTokens: computedTokens.current,
        position,
        focusBlockCode,
        highlightBlockCode,
        blockConfig,
        activeBlockIndex,
        payload,
      })
    : TensorflowShortsCodexLayerChildren({
        bothGroupRef,
        onlyFragmentGroupRef,
        computedTokens: computedTokens.current,
        position,
        focusBlockCode,
        highlightBlockCode,
        blockConfig,
        activeBlockIndex,
        payload,
      })

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
        blockConfig.length,
        isShorts,
        setIsShorts
      )}
      titleSpalshData={titleSpalshData}
      studioUserConfig={
        !isShorts
          ? studioCoordinates(fragment, fragmentState)
          : shortsStudioCoordinates(fragment, fragmentState)
      }
      topLayerChildren={topLayerChildren}
      isShorts={isShorts}
    />
  )
}

export default NewTensorFlowCodeJam
