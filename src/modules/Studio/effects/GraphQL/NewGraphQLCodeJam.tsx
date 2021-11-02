import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { useGetTokenisedCodeLazyQuery } from '../../../../generated/graphql'
import { User, userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import {
  controls,
  FragmentState,
  shortsCodeConfig,
} from '../../components/RenderTokens'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import {
  studioCoordinates,
  graphqlCodexLayerChildren,
  graphqlShortsCodexLayerChildren,
  shortsStudioCoordinates,
} from './GraphQLConfig'

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

const NewGraphQLCodeJam = () => {
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

  const [isShorts, setIsShorts] = useState<boolean>(false)

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
      bgRectColor: ['#1F2937', '#1F2937'],
      stripRectColor: ['#e535ab', '#e535ab'],
      textColor: ['#ffffff', '#ffffff'],
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
      setTimeout(() => {
        if (!displayName) return
        if (!fragment) return
        if (!isShorts)
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates[0] || 0}
              y={400}
              userName={displayName}
              rectOneColors={['#60A5FA', '#60A5FA']}
              rectTwoColors={['#C084FC', '#C084FC']}
              rectThreeColors={['#4FD1C5', '#4FD1C5']}
            />,
            ...users.map((user, index) => (
              <LowerThirds
                x={lowerThirdCoordinates[index + 1] || 0}
                y={400}
                userName={participants?.[user.uid]?.displayName || ''}
                rectOneColors={['#60A5FA', '#60A5FA']}
                rectTwoColors={['#C084FC', '#C084FC']}
                rectThreeColors={['#4FD1C5', '#4FD1C5']}
              />
            )),
          ])
        else
          setTopLayerChildren([
            <LowerThirds
              x={lowerThirdCoordinates[0] || 0}
              y={570}
              userName={displayName}
              rectOneColors={['#60A5FA', '#60A5FA']}
              rectTwoColors={['#C084FC', '#C084FC']}
              rectThreeColors={['#4FD1C5', '#4FD1C5']}
            />,
          ])
      }, 5000)
    }
  }, [state])

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#60A5FA', '#60A5FA']}
          rectTwoColors={['#C084FC', '#C084FC']}
          rectThreeColors={['#4FD1C5', '#4FD1C5']}
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
          rectOneColors={['#60A5FA', '#60A5FA']}
          rectTwoColors={['#C084FC', '#C084FC']}
          rectThreeColors={['#4FD1C5', '#4FD1C5']}
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
          return [70, 530]
        case 3:
          return [45, 355, 665]
        default:
          return [95]
      }
    else return [30]
  })()

  const layerChildren = !isShorts
    ? graphqlCodexLayerChildren({
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
    : graphqlShortsCodexLayerChildren({
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

export default NewGraphQLCodeJam
