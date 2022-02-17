import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../../generated/graphql'
import {
  BlockProperties,
  TopLayerChildren,
  ViewConfig,
} from '../../../../utils/configTypes'
import { BrandingJSON } from '../../../Branding/BrandingPage'
import {
  Block,
  CodeBlockProps,
  ImageBlockProps,
  IntroBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../../../Flick/editor/utils/utils'
import { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import VideoBackground from '../../components/VideoBackground'
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
  const {
    fragment,
    payload,
    updatePayload,
    state,
    addMusic,
    theme: flickTheme,
  } = (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [studio, setStudio] = useRecoilState(studioStore)

  // data config holds all the info abt the object
  const [dataConfig, setDataConfig] = useState<Block[]>()
  // view config holds all the info abt the view of the canvas
  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  // holds the index of the present object
  const [activeObjectIndex, setActiveObjectIndex] = useState(-1)

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
    if (theme.name !== studio.theme.name) {
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
      if (!theme) return
      setStudio({
        ...studio,
        branding,
        theme,
      })
    }
  }, [fragment])

  useEffect(() => {
    if (
      payload?.activeObjectIndex === undefined ||
      payload?.activeObjectIndex === -1
    )
      return
    // having a condition on state because on retake initially the active object index will be 3
    // and it goes to the else case, and at the same time upload payload triggers
    // and makes the active object index 0 which goes inside the if block,
    // as the else block contains set timeout it executes after the if block, so active object index becomes 3
    // so put the condition on state to be recording so that on recording it deosnt take time to make the active object index 0,
    // so that the old active object index's object doesnt get rendered on the canvas initially
    if (state === 'recording' && payload?.activeObjectIndex === 0)
      setActiveObjectIndex(payload?.activeObjectIndex)
    else
      setTimeout(() => {
        setActiveObjectIndex(payload?.activeObjectIndex)
      }, 800)
  }, [payload?.activeObjectIndex])

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
        activeObjectIndex: 0,
        activeIntroIndex: 0,
        fragmentState: 'onlyUserMedia',
        activePointIndex: 0,
        currentIndex: 0,
        currentTime: 0,
        isFocus: false,
        playing: false,
        prevIndex: 0,
      })
    }
    if (state === 'recording') {
      updatePayload?.({
        activeObjectIndex: 0,
        activeIntroIndex: 0,
        fragmentState: 'onlyUserMedia',
        activePointIndex: 0,
        currentIndex: 0,
        currentTime: 0,
        isFocus: false,
        playing: false,
        prevIndex: 0,
      })
      setTopLayerChildren?.({ id: '', state: '' })
      timer.current = setTimeout(() => {
        setTopLayerChildren?.({ id: nanoid(), state: 'lowerThird' })
      }, 2000)
    }
  }, [state])

  useEffect(() => {
    if (!payload?.activeObjectIndex || payload?.activeObjectIndex === 0) return
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
    if (!payload?.activeObjectIndex || payload?.activeObjectIndex === 0) return
    setTopLayerChildren?.({ id: nanoid(), state: 'transition right' })
  }, [payload?.activeObjectIndex])

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!viewConfig?.mode) return
    if (viewConfig?.mode === 'Landscape') setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [viewConfig?.mode])

  if (!dataConfig || !viewConfig || dataConfig.length === 0) return <></>
  return (
    <>
      <VideoBackground
        theme={flickTheme}
        stageConfig={stageConfig}
        isShorts={viewConfig.mode === 'Portrait'}
      />
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
