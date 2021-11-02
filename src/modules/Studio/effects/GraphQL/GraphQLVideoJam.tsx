import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { Fragment_Status_Enum_Enum, User } from '../../../../generated/graphql'
import { userState } from '../../../../stores/user.store'
import { Concourse } from '../../components'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import { FragmentState } from '../../components/RenderTokens'
import { controls } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  MutipleRectMoveLeft,
  MutipleRectMoveRight,
} from '../FragmentTransitions'
import {
  graphqlVideoJamLayerChildren,
  studioCoordinates,
} from './GraphQLConfig'

const GraphQLVideoJam = () => {
  const { fragment, payload, updatePayload, state, users, participants } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSpalshData, settitleSpalshData] = useState<TitleSplashProps>({
    enable: false,
  })

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  const { displayName } = (useRecoilValue(userState) as User) || {}

  const videoElement = React.useMemo(() => {
    if (!fragment?.configuration.properties) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = fragment.configuration.properties.find(
      (property: any) => property.key === 'source'
    )?.value
    // eslint-disable-next-line consistent-return
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

    // eslint-disable-next-line consistent-return
    return element
  }, [fragment?.configuration.properties])

  useEffect(() => {
    if (!videoElement) return
    switch (state) {
      case 'recording':
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
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
        break
      default:
        videoElement.currentTime = 0
        updatePayload?.({
          playing: false,
          currentTime: 0,
          fragmentState: 'onlyUserMedia',
        })
        setTopLayerChildren([])
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

  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line
    setPlaying(!!payload?.playing)
    // eslint-disable-next-line
    if (!!payload?.playing) {
      videoElement?.play()
    } else {
      // eslint-disable-next-line
      if (videoElement && payload) {
        videoElement.currentTime =
          typeof payload.currentTime === 'number' ? payload.currentTime : 0
        videoElement?.pause()
      }
    }
  }, [payload?.playing])

  useEffect(() => {
    if (videoElement && payload?.status === Fragment_Status_Enum_Enum.Live)
      videoElement.currentTime = 0
  }, [payload?.status])

  useEffect(() => {
    setFragmentState(payload?.fragmentState)
  }, [payload?.fragmentState])

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  const bothGroupRef = useRef<Konva.Group>(null)
  const onlyFragmentGroupRef = useRef<Konva.Group>(null)

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

  const layerChildren = graphqlVideoJamLayerChildren(
    bothGroupRef,
    onlyFragmentGroupRef,
    videoElement
  )

  return (
    <Concourse
      layerChildren={layerChildren}
      controls={controls(playing, videoElement, fragmentState)}
      titleSpalshData={titleSpalshData}
      studioUserConfig={studioCoordinates(fragment, fragmentState)}
      topLayerChildren={topLayerChildren}
    />
  )
}

export default GraphQLVideoJam
