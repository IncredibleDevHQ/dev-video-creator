import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { useGetTokenisedCodeLazyQuery } from '../../../../generated/graphql'
import { User, userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds, { FragmentCard } from '../../components/LowerThirds'
import { controls, FragmentState } from '../../components/RenderTokens'
import { usePoint } from '../../hooks'
import useCode from '../../hooks/use-code'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import {
  studioCoordinates,
  tensorflowCodeJamLayerChildren,
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

const TensorFlowCodeJam = () => {
  const { fragment, payload, updatePayload, state, users, participants } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const { getImageDimensions } = useEdit()
  const { getNoOfLinesOfText } = usePoint()

  const [titleSpalshData, setTitleSpalshData] = useState<TitleSplashProps>({
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

    // setConfig of titleSpalsh
    setTitleSpalshData({
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
        isFocus: false,
        fragmentState: 'onlyUserMedia',
      })
      setTopLayerChildren([])
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
      } else {
        setTimeout(() => {
          if (!displayName) return
          if (!fragment) return
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
      }
    }
  }, [state])

  const lowerThirdCoordinates = (() => {
    switch (fragment?.participants.length) {
      case 2:
        return { x: [70, 530], y: [400, 400] }
      case 3:
        return { x: [45, 355, 665], y: [400, 400, 400] }
      default:
        return { x: [20], y: [460] }
    }
  })()

  useEffect(() => {
    if (!onlyFragmentGroupRef.current || !bothGroupRef.current) return
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (fragmentState === 'onlyFragment') {
      setTopLayerChildren([
        <MutipleRectMoveRight
          rectOneColors={['#FF6F00', '#FFA100']}
          rectTwoColors={['#425066', '#425066']}
          rectThreeColors={['#E6E6E6', '#FFFFFF']}
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

  const layerChildren = tensorflowCodeJamLayerChildren(
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

export default TensorFlowCodeJam
