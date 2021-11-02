import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { useGetTokenisedCodeLazyQuery } from '../../../../generated/graphql'
import { User, userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import { controls, FragmentState } from '../../components/RenderTokens'
import useCode from '../../hooks/use-code'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import { graphqlCodeJamLayerChildren, studioCoordinates } from './GraphQLConfig'

export const codeConfig = {
  fontSize: 14,
  width: 960,
  height: 540,
}

interface Position {
  prevIndex: number
  currentIndex: number
}

const GraphQLCodeJam = () => {
  const { fragment, payload, updatePayload, state, users, participants } =
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
  const [focusCode, setFocusCode] = useState<boolean>(false)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const bothGroupRef = useRef<Konva.Group>(null)
  // const onlyUserMediaGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

  const { displayName } = (useRecoilValue(userState) as User) || {}

  useEffect(() => {
    if (!fragment?.configuration.properties) return
    const code = fragment.configuration.properties.find(
      (property: any) => property.key === 'code'
    )?.value?.code
    const language: string = fragment.configuration.properties.find(
      (property: any) => property.key === 'code'
    )?.value?.language

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
    initUseCode({
      tokens: data.TokenisedCode.data,
      canvasWidth: 585,
      canvasHeight: 360,
      gutter: 5,
      fontSize: codeConfig.fontSize,
    })
  }, [data])

  useEffect(() => {
    setPosition({
      prevIndex: payload?.prevIndex || 0,
      currentIndex: payload?.currentIndex || 1,
    })
    setFocusCode(payload?.isFocus)
    setFragmentState(payload?.fragmentState)
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
        isFocus: false,
        fragmentState: 'onlyUserMedia',
      })
      // setFragmentState('onlyUserMedia')
    }
    if (state === 'recording') {
      // setFragmentState('onlyUserMedia')
      updatePayload?.({
        currentIndex: 1,
        prevIndex: 0,
        isFocus: false,
        fragmentState: 'onlyUserMedia',
      })
      setTopLayerChildren([])
      setTimeout(() => {
        if (!displayName) return
        if (!fragment) return
        setTopLayerChildren([
          <LowerThirds
            x={lowerThirdCoordinates[0] || 0}
            y={400}
            userName={displayName}
            rectOneColors={['#4FD1C5', '#4FD1C5']}
            rectTwoColors={['#C084FC', '#C084FC']}
            rectThreeColors={['#60A5FA', '#60A5FA']}
          />,
          ...users.map((user, index) => (
            <LowerThirds
              x={lowerThirdCoordinates[index + 1] || 0}
              y={400}
              userName={participants?.[user.uid]?.displayName || ''}
              rectOneColors={['#4FD1C5', '#4FD1C5']}
              rectTwoColors={['#C084FC', '#C084FC']}
              rectThreeColors={['#60A5FA', '#60A5FA']}
            />
          )),
        ])
      }, 5000)
    }
  }, [state])

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

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'customLayout') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#60A5FA', '#60A5FA']}
          rectTwoColors={['#C084FC', '#C084FC']}
          rectThreeColors={['#4FD1C5', '#4FD1C5']}
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
      bothGroupRef.current.to({
        opacity: 1,
        duration: 0.2,
      })
    }
  }, [fragmentState])

  const layerChildren = graphqlCodeJamLayerChildren(
    bothGroupRef,
    onlyFragmentGroupRef,
    computedTokens.current,
    position,
    focusCode,
    payload
  )

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(
        setFocusCode,
        position,
        computedTokens.current,
        fragmentState,
        setFragmentState
      )}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates(fragment, fragmentState)}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default GraphQLCodeJam
