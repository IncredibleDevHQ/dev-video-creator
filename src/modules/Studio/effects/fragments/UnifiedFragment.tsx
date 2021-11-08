import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { User, userState } from '../../../../stores/user.store'
import {
  CodejamConfig,
  Config,
  ConfigType,
  PointsConfig,
  TriviaConfig,
  VideojamConfig,
  ViewConfig,
} from '../../../../utils/configTypes'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import { TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import PointsFragment from './PointsFragment'
import { FragmentState } from '../../components/RenderTokens'
import TriviaFragment from './TriviaFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
  stageRef,
  layerRef,
  config,
}: {
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  config?: Config
}) => {
  const { fragment, payload, updatePayload, state, participants, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSplashData, setTitleSplashData] = useState<TitleSplashProps>({
    enable: false,
  })

  // data config holds all the info abt the object
  const [dataConfig, setDataConfig] =
    useState<(CodejamConfig | VideojamConfig | TriviaConfig | PointsConfig)[]>()
  // view config holds all the info abt the view of the canvas
  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  // holds the index of the present object
  const [activeObjectIndex, setActiveObjectIndex] = useState(0)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  // holds the user's display name
  const { displayName } = (useRecoilValue(userState) as User) || {}

  useEffect(() => {
    if (!config) return
    setDataConfig(config.dataConfig)
    setViewConfig(config.viewConfig)
  }, [config])

  useEffect(() => {
    if (!fragment) return
    if (!config) {
      setDataConfig(fragment?.configuration.dataConfig)
      setViewConfig(fragment?.configuration.viewConfig)
    } else {
      setDataConfig(config.dataConfig)
      setViewConfig(config.viewConfig)
    }
    setTitleSplashData({
      enable: fragment?.configuration?.viewConfig.hasTitleSplash || true,
      title: fragment.name as string,
      titleSplashConfig:
        fragment?.configuration?.viewConfig?.titleSplashConfig || {},
    })
    updatePayload?.({
      activeObjectIndex: 0,
    })
  }, [fragment])

  useEffect(() => {
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        fragmentState: 'onlyUserMedia',
      })
    }
    if (state === 'recording') {
      updatePayload?.({
        activeObjectIndex: 0,
        fragmentState: 'onlyUserMedia',
      })
      setTopLayerChildren([])
      setTimeout(() => {
        if (!displayName) return
        if (!fragment) return
        setTopLayerChildren([
          <LowerThirds
            x={lowerThirdCoordinates[0] || 0}
            y={450}
            userName={displayName}
            rectOneColors={['#651CC8', '#9561DA']}
            rectTwoColors={['#FF5D01', '#B94301']}
            rectThreeColors={['#1F2937', '#778496']}
          />,
          ...users.map((user, index) => (
            <LowerThirds
              x={lowerThirdCoordinates[index + 1] || 0}
              y={450}
              userName={participants?.[user.uid]?.displayName || ''}
              rectOneColors={['#651CC8', '#9561DA']}
              rectTwoColors={['#FF5D01', '#B94301']}
              rectThreeColors={['#1F2937', '#778496']}
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
        return [70]
    }
  })()

  useEffect(() => {
    if (activeObjectIndex !== 0) setTitleSplashData({ enable: false })
    else
      setTitleSplashData({
        enable: fragment?.configuration?.viewConfig.hasTitleSplash || true,
        title: fragment?.name as string,
        titleSplashConfig:
          fragment?.configuration?.viewConfig?.titleSplashConfig || {},
      })
  }, [activeObjectIndex])

  if (!dataConfig || !viewConfig || dataConfig.length === 0) return <></>
  return (
    <>
      {(() => {
        switch (dataConfig[activeObjectIndex]?.type) {
          case ConfigType.CODEJAM: {
            return (
              <CodeFragment
                dataConfig={dataConfig[activeObjectIndex] as CodejamConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.VIDEOJAM: {
            return (
              <VideoFragment
                dataConfig={dataConfig[activeObjectIndex] as VideojamConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.TRIVIA: {
            return (
              <TriviaFragment
                dataConfig={dataConfig[activeObjectIndex] as TriviaConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          case ConfigType.POINTS: {
            return (
              <PointsFragment
                dataConfig={dataConfig[activeObjectIndex] as PointsConfig}
                viewConfig={viewConfig.configs[activeObjectIndex]}
                dataConfigLength={dataConfig.length}
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
              />
            )
          }
          default:
            return <></>
        }
      })()}
    </>
  )
}

export default UnifiedFragment
