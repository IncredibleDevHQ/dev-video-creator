import React, { useEffect, useState } from 'react'
import { Group } from 'react-konva'
import { useRecoilValue } from 'recoil'
import { ThemeFragment } from '../../../../generated/graphql'
import { TopLayerChildren } from '../../../../utils/configTypes'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import { Video } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'
import CassidooSplash from '../Splashes/CassidooSplash'
import GlassySplash from '../Splashes/GlassySplash'
import PastelLinesSplash from '../Splashes/PastelLinesSplash'

export type IntroState = 'userMedia' | 'titleSplash' | 'introVideo'

export type SplashRenderState = 'static' | 'animate'

const Splash = ({
  theme,
  stageConfig,
  isShorts,
}: {
  theme: ThemeFragment
  stageConfig: {
    width: number
    height: number
  }
  isShorts: boolean
}) => {
  switch (theme.name) {
    case 'DarkGradient':
      return <GlassySplash stageConfig={stageConfig} isShorts={isShorts} />
    case 'PastelLines':
      return <PastelLinesSplash stageConfig={stageConfig} isShorts={isShorts} />
    case 'Cassidoo':
      return <CassidooSplash stageConfig={stageConfig} isShorts={isShorts} />
    default:
      return <></>
  }
}

const IntroFragment = ({
  shortsMode,
  isPreview,
  setTopLayerChildren,
  introSequence,
}: {
  shortsMode: boolean
  isPreview: boolean
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{
      id: string
      state: TopLayerChildren
    }>
  >
  introSequence: IntroState[]
}) => {
  const { fragment, state, payload, branding, theme } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  const [layerChildren, setLayerChildren] = useState<JSX.Element[]>([])

  const videoElement = React.useMemo(() => {
    if (!branding?.introVideoUrl) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = branding.introVideoUrl || ''
    // eslint-disable-next-line consistent-return
    return element
  }, [branding, stageConfig])

  useEffect(() => {
    if (state === 'start-recording' || state === 'ready' || isPreview) {
      if (introSequence[payload.activeIntroIndex] === 'titleSplash') {
        // if (!isPreview) addMusic('splash')
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        setLayerChildren([
          <Group x={0} y={0}>
            <Splash
              theme={theme}
              stageConfig={stageConfig}
              isShorts={shortsMode}
            />
          </Group>,
        ])
      }
      if (introSequence[payload.activeIntroIndex] === 'introVideo') {
        setTopLayerChildren?.({ id: '', state: '' })
        if (!videoElement) return
        videoElement?.play()
        setLayerChildren([
          <Group x={0} y={0}>
            <Video
              videoElement={videoElement}
              videoConfig={{
                x: 0,
                y: 0,
                width: stageConfig.width,
                height: stageConfig.height,
                videoFill: branding?.background?.color?.primary,
                cornerRadius: 0,
                performClip: true,
                clipVideoConfig: {
                  x: 0,
                  y: 0,
                  width: 1,
                  height: 1,
                },
              }}
            />
          </Group>,
        ])
      }
      if (introSequence[payload.activeIntroIndex] === 'userMedia') {
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        setLayerChildren([])
      }
    }
  }, [state, payload?.activeIntroIndex, videoElement, stageConfig])

  const studioUserConfig = !shortsMode
    ? StudioUserConfiguration({
        layout: 'classic',
        fragment,
        fragmentState:
          introSequence[payload.activeIntroIndex] === 'userMedia'
            ? 'onlyUserMedia'
            : 'customLayout',
        theme,
      })
    : ShortsStudioUserConfiguration({
        layout: 'classic',
        fragment,
        fragmentState:
          introSequence[payload.activeIntroIndex] === 'userMedia'
            ? 'onlyUserMedia'
            : 'customLayout',
        theme,
      })

  return (
    <Concourse
      studioUserConfig={studioUserConfig}
      layerChildren={layerChildren}
      blockType="introBlock"
      isShorts={shortsMode}
    />
  )
}

export default IntroFragment
