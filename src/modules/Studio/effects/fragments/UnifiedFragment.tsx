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
import {
  CONFIG,
  SHORTS_CONFIG,
  TitleSplashProps,
} from '../../components/Concourse'
import CommonLowerThirds, {
  IncredibleLowerThirds,
} from '../../components/LowerThirds'
import { FragmentState } from '../../components/RenderTokens'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import PointsFragment from './PointsFragment'
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
  const {
    fragment,
    payload,
    updatePayload,
    state,
    participants,
    users,
    shortsMode,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

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
  const { displayName, username } = (useRecoilValue(userState) as User) || {}

  const { getTextWidth } = useEdit()

  useEffect(() => {
    if (!config) return
    setDataConfig(config.dataConfig)
    setViewConfig(config.viewConfig)
  }, [config])

  useEffect(() => {
    if (!fragment) return
    if (!config) {
      if (fragment.configuration) {
        if (shortsMode) {
          const conf = fragment.configuration as Config
          setDataConfig(
            conf.dataConfig.filter((c) => c.type !== ConfigType.VIDEOJAM)
          )
          setViewConfig({
            ...conf.viewConfig,
            configs: conf.viewConfig.configs.filter(
              (c) => c.type !== ConfigType.VIDEOJAM
            ),
          })
        } else {
          setDataConfig(fragment.configuration.dataConfig)
          setViewConfig(fragment.configuration.viewConfig)
        }
      }
    } else {
      setDataConfig(config.dataConfig)
      setViewConfig(config.viewConfig)
    }
    setTitleSplashData({
      enable: fragment?.configuration?.viewConfig.hasTitleSplash || false,
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
          <IncredibleLowerThirds
            x={lowerThirdCoordinates[0]}
            y={!shortsMode ? 450 : 630}
            displayName={displayName}
            username={`/${username}` || `/${displayName}`}
            width={
              getTextWidth(displayName, 'Inter', 20, 'normal 500') >
              getTextWidth(`/${username}`, 'Inter', 20, 'normal 500')
                ? getTextWidth(displayName, 'Inter', 20, 'normal 500') + 20
                : getTextWidth(`/${username}`, 'Inter', 20, 'normal 500') + 20
            }
          />,
          ...users.map((user, index) => (
            <IncredibleLowerThirds
              x={CONFIG.width - 170}
              y={!shortsMode ? 450 : 630}
              displayName={participants?.[user.uid]?.displayName}
              username={
                `/${participants?.[user.uid]?.userName}` ||
                `/${participants?.[user.uid]?.displayName}`
              }
              width={
                getTextWidth(
                  participants?.[user.uid]?.displayName,
                  'Inter',
                  20,
                  'normal 500'
                ) >
                getTextWidth(
                  `/${participants?.[user.uid]?.userName}`,
                  'Inter',
                  20,
                  'normal 500'
                )
                  ? getTextWidth(
                      participants?.[user.uid]?.displayName,
                      'Inter',
                      20,
                      'normal 500'
                    ) + 20
                  : getTextWidth(
                      `/${participants?.[user.uid]?.userName}`,
                      'Inter',
                      20,
                      'normal 500'
                    ) + 20
              }
            />
          )),
        ])
      }, 5000)
    }
  }, [state])

  const lowerThirdCoordinates = (() => {
    if (!shortsMode)
      switch (fragment?.participants.length) {
        case 2:
          return [CONFIG.width - 140, CONFIG.width / 2 - 130]
        case 3:
          // TODO: calculate the coordinates for 3 people
          return [665, 355, 45]
        default:
          return [CONFIG.width - 170]
      }
    else return [SHORTS_CONFIG.width - 30]
  })()

  useEffect(() => {
    if (activeObjectIndex !== 0) setTitleSplashData({ enable: false })
    else
      setTitleSplashData({
        enable: fragment?.configuration?.viewConfig.hasTitleSplash || false,
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
