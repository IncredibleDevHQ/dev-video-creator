import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../../generated/graphql'
import {
  BlockProperties,
  TitleSplashConfig,
  TopLayerChildren,
  ViewConfig,
} from '../../../../utils/configTypes'
import { BrandingJSON } from '../../../Branding/BrandingPage'
import {
  getGradientConfig,
  gradients,
} from '../../../Flick/components/BlockPreview'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../../../Flick/editor/utils/utils'
import { FragmentState } from '../../components/RenderTokens'
import { StudioProviderProps, studioStore } from '../../stores'
import CodeFragment from './CodeFragment'
import IntroFragment from './IntroFragment'
import OutroFragment from './OutroFragment'
import PointsFragment from './PointsFragment'
import TriviaFragment from './TriviaFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
  stageRef,
  setTopLayerChildren,
  config,
  layoutConfig,
  branding,
  theme,
}: {
  stageRef: React.RefObject<Konva.Stage>
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{
      id: string
      state: TopLayerChildren
    }>
  >
  config?: Block[]
  layoutConfig?: ViewConfig
  branding?: BrandingJSON
  theme?: ThemeFragment | null
}) => {
  const { fragment, payload, updatePayload, state, addMusic } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

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
    if (!config) return
    if (branding !== studio.branding) {
      setStudio((prev) => ({
        ...prev,
        branding,
      }))
    }
  }, [branding, studio])

  useEffect(() => {
    if (!config) return
    if (!theme) return
    if (theme !== studio.theme) {
      setStudio((prev) => ({
        ...prev,
        theme,
      }))
    }
  }, [theme, studio.theme])

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
      activeIntroIndex: 0,
    })
  }, [fragment])

  useEffect(() => {
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload])

  useEffect(() => {
    return () => {
      updatePayload?.({
        activeIntroIndex: 0,
        activePointIndex: 0,
        currentIndex: 0,
        currentTime: 0,
        isFocus: false,
        playing: false,
        prevIndex: 0,
        // status: Fragment_Status_Enum_Enum.NotStarted,
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
        activeIntroIndex: 0,
        fragmentState: 'onlyUserMedia',
      })
      // if (viewConfig?.mode === 'Portrait') {
      //   addMusic('splash', 0.2)
      //   setTimeout(() => {
      //     reduceSplashAudioVolume(0.12)
      //   }, 2000)
      //   setTimeout(() => {
      //     reduceSplashAudioVolume(0.06)
      //   }, 2200)
      // }
      setTopLayerChildren?.({ id: '', state: '' })
      timer.current = setTimeout(() => {
        setTopLayerChildren?.({ id: nanoid(), state: 'lowerThird' })
      }, 2000)
    }
  }, [state])

  useEffect(() => {
    // Checking if the current state is only fragment group and making the opacity of the only fragment group 1
    if (payload?.fragmentState === 'customLayout') {
      setTopLayerChildren?.({ id: nanoid(), state: 'transition right' })
      addMusic()
    }
    // Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
    if (payload?.fragmentState === 'onlyUserMedia') {
      setTopLayerChildren?.({ id: nanoid(), state: 'transition left' })
      addMusic()
    }
  }, [payload?.fragmentState])

  useEffect(() => {
    if (activeObjectIndex === 0) return
    setTopLayerChildren?.({ id: nanoid(), state: 'transition right' })
  }, [activeObjectIndex])

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
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
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
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
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
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
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
                titleSplashData={titleSplashData}
                fragmentState={fragmentState}
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                shortsMode={viewConfig.mode === 'Portrait'}
                isPreview={isPreview}
              />
            )
          }
          case 'introBlock': {
            const introBlockProps = dataConfig[
              activeObjectIndex
            ] as IntroBlockProps
            return (
              <IntroFragment
                shortsMode={viewConfig.mode === 'Portrait'}
                isPreview={isPreview}
                setTopLayerChildren={setTopLayerChildren}
                introSequence={
                  studio.branding && studio.branding.introVideoUrl
                    ? introBlockProps.introBlock.order
                    : ['userMedia', 'titleSplash']
                }
              />
            )
          }
          case 'outroBlock': {
            return <OutroFragment isShorts={viewConfig.mode === 'Portrait'} />
          }
          default:
            return <></>
        }
      })()}
    </>
  )
}

export default UnifiedFragment
