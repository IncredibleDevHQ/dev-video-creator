import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilValue } from 'recoil'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../../../Flick/editor/utils/utils'
import { User, userState } from '../../../../stores/user.store'
import {
  BlockProperties,
  TitleSplashConfig,
  ViewConfig,
} from '../../../../utils/configTypes'
import {
  getGradientConfig,
  gradients,
} from '../../../Flick/components/BlockPreview'
import { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { IncredibleLowerThirds } from '../../components/LowerThirds'
import { FragmentState } from '../../components/RenderTokens'
import useEdit from '../../hooks/use-edit'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import PointsFragment from './PointsFragment'
import TriviaFragment from './TriviaFragment'
import VideoFragment from './VideoFragment'
import { Fragment_Status_Enum_Enum } from '../../../../generated/graphql'

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
  const {
    fragment,
    payload,
    updatePayload,
    state,
    participants,
    users,
    addMusic,
    reduceSplashAudioVolume,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [titleSplashData, setTitleSplashData] = useState<
    TitleSplashConfig & { title: string }
  >({
    enable: false,
    title: '',
    titleSplashConfig: getGradientConfig(gradients[0]),
  })

  // data config holds all the info abt the object
  const [dataConfig, setDataConfig] = useState<Block[]>()
  // view config holds all the info abt the view of the canvas
  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  // holds the index of the present object
  const [activeObjectIndex, setActiveObjectIndex] = useState(0)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('onlyUserMedia')

  const [isPreview, setIsPreview] = useState(false)

  // state which stores the layer children which have to be placed over the studio user
  const [topLayerChildren, setTopLayerChildren] = useState<JSX.Element[]>([])

  // holds the user's display name
  const { displayName, username } = (useRecoilValue(userState) as User) || {}

  const { getTextWidth } = useEdit()

  const timer = useRef<any>(null)

  useEffect(() => {
    clearTimeout(timer.current)
    return () => {
      clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!config) return
    setDataConfig(config)
    if (!layoutConfig) return
    setViewConfig(layoutConfig)
  }, [config, layoutConfig])

  useEffect(() => {
    if (!fragment) return
    if (!config) {
      setIsPreview(false)
      if (fragment.configuration && fragment.editorState) {
        setDataConfig(fragment.editorState?.blocks)
        setViewConfig(fragment.configuration)
      }
    } else {
      setIsPreview(true)
      setDataConfig(config)
      setViewConfig(layoutConfig)
    }
    setTitleSplashData({
      enable: fragment?.configuration?.titleSplash?.enable || false,
      title: fragment.name as string,
      titleSplashConfig:
        fragment?.configuration?.titleSplash?.titleSplashConfig ||
        getGradientConfig(gradients[0]),
    })
    updatePayload?.({
      activeObjectIndex: 0,
    })
  }, [fragment])

  useEffect(() => {
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload])

  useEffect(() => {
    return () => {
      updatePayload?.({
        activePointIndex: 0,
        currentIndex: 0,
        currentTime: 1,
        isFocus: false,
        playing: false,
        prevIndex: 0,
        status: Fragment_Status_Enum_Enum.NotStarted,
      })
    }
  }, [])

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
      if (viewConfig?.mode === 'Portrait') {
        addMusic('splash', 0.2)
        setTimeout(() => {
          reduceSplashAudioVolume(0.12)
        }, 2000)
        setTimeout(() => {
          reduceSplashAudioVolume(0.06)
        }, 2200)
      }
      setTopLayerChildren([])
      timer.current = setTimeout(() => {
        if (!displayName) return
        if (!fragment) return
        setTopLayerChildren([
          <IncredibleLowerThirds
            x={
              viewConfig?.mode === 'Landscape'
                ? lowerThirdCoordinates[0]
                : SHORTS_CONFIG.width - 90
            }
            y={viewConfig?.mode === 'Landscape' ? 450 : 630}
            displayName={displayName}
            username={username ? `/${username}` : `/${displayName}`}
            width={
              getTextWidth(displayName, 'Inter', 20, 'normal 500') >
              getTextWidth(`/${username}`, 'Inter', 20, 'normal 500')
                ? getTextWidth(displayName, 'Inter', 20, 'normal 500') + 20
                : getTextWidth(`/${username}`, 'Inter', 20, 'normal 500') + 20
            }
          />,
          ...users.map((user, index) => (
            <IncredibleLowerThirds
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              x={lowerThirdCoordinates[index + 1]}
              y={viewConfig?.mode === 'Landscape' ? 450 : 630}
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
    switch (fragment?.participants.length) {
      case 2:
        return [CONFIG.width - 140, CONFIG.width / 2 - 130]
      case 3:
        // TODO: calculate the coordinates for 3 people
        return [665, 355, 45]
      default:
        return [CONFIG.width - 170]
    }
  })()
  useEffect(() => {
    if (activeObjectIndex !== 0)
      setTitleSplashData({ ...titleSplashData, enable: false })
    else
      setTitleSplashData({
        enable: fragment?.configuration?.titleSplash?.enable || false,
        title: fragment?.name as string,
        titleSplashConfig:
          fragment?.configuration?.titleSplash?.titleSplashConfig || {},
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
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
                shortsMode={viewConfig.mode === 'Portrait'}
                isPreview={isPreview}
              />
            )
          }
          case 'videoBlock': {
            return (
              <VideoFragment
                key={activeObjectIndex}
                dataConfig={dataConfig[activeObjectIndex] as VideoBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
                shortsMode={viewConfig.mode === 'Portrait'}
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
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
                shortsMode={viewConfig.mode === 'Portrait'}
              />
            )
          }
          case 'listBlock': {
            return (
              <PointsFragment
                key={activeObjectIndex}
                dataConfig={dataConfig[activeObjectIndex] as ListBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
                topLayerChildren={topLayerChildren}
                setTopLayerChildren={setTopLayerChildren}
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                layerRef={layerRef}
                shortsMode={viewConfig.mode === 'Portrait'}
                isPreview={isPreview}
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
