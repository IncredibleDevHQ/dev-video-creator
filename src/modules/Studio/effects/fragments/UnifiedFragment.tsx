import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  ListBlockProps,
  useUtils,
  VideoBlockProps,
} from '../../../../components/TextEditor/utils'
import { User, userState } from '../../../../stores/user.store'
import { BlockProperties, ViewConfig } from '../../../../utils/configTypes2'
import { SHORTS_CONFIG, TitleSplashProps } from '../../components/Concourse'
import LowerThirds from '../../components/LowerThirds'
import { FragmentState } from '../../components/RenderTokens'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import PointsFragment from './PointsFragment'
import TriviaFragment from './TriviaFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
  stageRef,
  layerRef,
  config,
  layoutConfig,
}: {
  stageRef: React.RefObject<Konva.Stage>
  layerRef: React.RefObject<Konva.Layer>
  config?: Block[]
  layoutConfig?: ViewConfig
}) => {
  const { fragment, payload, updatePayload, state, participants, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSplashData, setTitleSplashData] = useState<TitleSplashProps>({
    enable: false,
  })

  const { getSimpleAST } = useUtils()

  // data config holds all the info abt the object
  // const [dataConfig, setDataConfig] =
  //   useState<(CodejamConfig | VideojamConfig | TriviaConfig | PointsConfig)[]>()
  const [dataConfig, setDataConfig] = useState<Block[]>()
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
    setDataConfig(config)
    setViewConfig(layoutConfig)
  }, [config])

  useEffect(() => {
    if (!fragment) return
    if (!config) {
      if (fragment.configuration && fragment.editorState) {
        setDataConfig(getSimpleAST(fragment.editorState).blocks)
        setViewConfig(fragment.configuration)
      }
    } else {
      setDataConfig(config)
      setViewConfig(layoutConfig)
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
    if (!viewConfig || !dataConfig) return
    if (viewConfig?.mode === 'Portrait') {
      setDataConfig(dataConfig.filter((c) => c.type !== 'videoBlock'))
    }
  }, [viewConfig, dataConfig])

  useEffect(() => {
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload])

  useEffect(() => {
    if (state === 'ready') {
      updatePayload?.({
        fragmentState: 'onlyUserMedia',
      })
      setTopLayerChildren([])
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
            x={
              viewConfig?.mode === 'Landscape'
                ? lowerThirdCoordinates[0]
                : SHORTS_CONFIG.width - 50
            }
            y={viewConfig?.mode === 'Landscape' ? 450 : 630}
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
        return [530, 70]
      case 3:
        return [665, 355, 45]
      default:
        return [95]
    }
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
          case 'codeBlock': {
            return (
              <CodeFragment
                dataConfig={dataConfig[activeObjectIndex] as CodeBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
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
          case 'videoBlock': {
            return (
              <VideoFragment
                dataConfig={dataConfig[activeObjectIndex] as VideoBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
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
          case 'imageBlock': {
            return (
              <TriviaFragment
                dataConfig={dataConfig[activeObjectIndex] as ImageBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
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
          case 'listBlock': {
            return (
              <PointsFragment
                dataConfig={dataConfig[activeObjectIndex] as ListBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
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
