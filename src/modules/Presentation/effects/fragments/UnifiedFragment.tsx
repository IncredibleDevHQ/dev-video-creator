import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../../generated/graphql'
import { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { FragmentState } from '../../components/RenderTokens'
import VideoBackground from '../../components/VideoBackground'
import { presentationStore } from '../../stores'
import { PresentationProviderProps } from '../../stores/presentation.store'
import {
  BlockProperties,
  BrandingJSON,
  IntroBlockView,
  OutroBlockView,
  TopLayerChildren,
  ViewConfig,
} from '../../utils/configTypes'
import {
  Block,
  CodeBlockProps,
  HeadingBlockProps,
  ImageBlockProps,
  ListBlockProps,
  VideoBlockProps,
} from '../../utils/utils'
import CodeFragment from './CodeFragment'
import HeadingFragment from './HeadingFragment'
import ImageFragment from './ImageFragment'
import IntroFragment from './IntroFragment'
import OutroFragment from './OutroFragment'
import PointsFragment from './PointsFragment'
import VideoFragment from './VideoFragment'

const UnifiedFragment = ({
  theme,
  config,
  branding,
  stageRef,
  layoutConfig,
  setTopLayerChildren,
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
  const { payload, theme: flickTheme } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}

  const [studio, setStudio] = useRecoilState(presentationStore)

  // data config holds all the info abt the object
  const [dataConfig, setDataConfig] = useState<Block[]>()
  // view config holds all the info abt the view of the canvas
  const [viewConfig, setViewConfig] = useState<ViewConfig>()
  // holds the index of the present object
  const [activeObjectIndex, setActiveObjectIndex] = useState(-1)

  // state of the fragment
  const [fragmentState, setFragmentState] =
    useState<FragmentState>('customLayout')

  const isPreview = false

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
    if (!config) return
    setDataConfig(config)
    if (!layoutConfig) return
    setViewConfig(layoutConfig)
  }, [config, layoutConfig])

  useEffect(() => {
    if (
      payload?.activeObjectIndex === undefined ||
      payload?.activeObjectIndex === -1 ||
      !viewConfig
    )
      return
    setActiveObjectIndex(payload?.activeObjectIndex)
  }, [payload?.activeObjectIndex, viewConfig])

  // useEffect(() => {
  // 	if (!payload?.activeObjectIndex || payload?.activeObjectIndex === 0) return;
  // 	if (viewConfig?.mode !== 'Portrait') {
  // 		// Checking if the current state is only fragment group and making the opacity of the only fragment group 1
  // 		if (payload?.fragmentState === 'customLayout') {
  // 			setTopLayerChildren?.({ id: nanoid(), state: 'transition right' });
  // 		}
  // 		// Checking if the current state is only usermedia group and making the opacity of the only fragment group 0
  // 		if (payload?.fragmentState === 'onlyUserMedia') {
  // 			setTopLayerChildren?.({ id: nanoid(), state: 'transition left' });
  // 		}
  // 	} else {
  // 		setTopLayerChildren?.({ id: nanoid(), state: '' });
  // 	}
  // }, [payload?.fragmentState]);

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
                key={activeObjectIndex}
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
              <ImageFragment
                key={activeObjectIndex}
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
          case 'headingBlock': {
            return (
              <HeadingFragment
                key={activeObjectIndex}
                dataConfig={dataConfig[activeObjectIndex] as HeadingBlockProps}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
                setFragmentState={setFragmentState}
                stageRef={stageRef}
                shortsMode={viewConfig.mode === 'Portrait'}
              />
            )
          }
          case 'introBlock': {
            const introBlockViewProps = (
              viewConfig.blocks[
                dataConfig[activeObjectIndex].id
              ] as BlockProperties
            )?.view as IntroBlockView
            return (
              <IntroFragment
                shortsMode={viewConfig.mode === 'Portrait'}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
                isPreview={isPreview}
                setTopLayerChildren={setTopLayerChildren}
                introSequence={['titleSplash']}
              />
            )
          }
          case 'outroBlock': {
            const outroBlockViewProps = (
              viewConfig.blocks[
                dataConfig[activeObjectIndex].id
              ] as BlockProperties
            )?.view as OutroBlockView
            return (
              <OutroFragment
                isShorts={viewConfig.mode === 'Portrait'}
                viewConfig={
                  viewConfig.blocks[
                    dataConfig[activeObjectIndex].id
                  ] as BlockProperties
                }
                isPreview={isPreview}
                outroSequence={['titleSplash']}
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
