import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group } from 'react-konva'
import { useRecoilValue } from 'recoil'
import {
  BlockProperties,
  TopLayerChildren,
} from '../../../../utils/configTypes'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import Thumbnail from '../../components/Thumbnail'
import { Video } from '../../components/Video'
import { StudioProviderProps, studioStore } from '../../stores'
import {
  ShortsStudioUserConfiguration,
  StudioUserConfiguration,
} from '../../utils/StudioUserConfig'

export type IntroState = 'userMedia' | 'titleSplash' | 'introVideo'

export type SplashRenderState = 'static' | 'animate'

const IntroFragment = ({
  shortsMode,
  viewConfig,
  isPreview,
  setTopLayerChildren,
  introSequence,
}: {
  shortsMode: boolean
  viewConfig: BlockProperties
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

  const titleScreenRef = React.useRef<Konva.Group>(null)
  const brandVideoRef = React.useRef<Konva.Group>(null)

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

  // const [layerChildren, setLayerChildren] = useState<JSX.Element[]>([])

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
    if (
      state === 'start-recording' ||
      state === 'ready' ||
      state === 'resumed' ||
      isPreview
    ) {
      if (introSequence[payload.activeIntroIndex] === 'titleSplash') {
        // if (!isPreview) addMusic('splash')
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        titleScreenRef.current?.opacity(1)
        brandVideoRef.current?.opacity(0)
      }
      if (introSequence[payload.activeIntroIndex] === 'introVideo') {
        setTopLayerChildren?.({ id: '', state: '' })
        if (!videoElement) return
        videoElement?.play()
        titleScreenRef.current?.opacity(0)
        brandVideoRef.current?.opacity(1)
      }
      if (introSequence[payload.activeIntroIndex] === 'userMedia') {
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        titleScreenRef.current?.opacity(0)
        brandVideoRef.current?.opacity(0)
      }
    }
  }, [state, payload?.activeIntroIndex, videoElement])

  const layerChildren = [
    <Group>
      <Group x={0} y={0} ref={titleScreenRef} opacity={0}>
        <Thumbnail
          isShorts={shortsMode}
          viewConfig={{
            layout: viewConfig?.layout || 'bottom-right-tile',
            view: viewConfig?.view,
          }}
          isIntro
        />
      </Group>
      <Group x={0} y={0} ref={brandVideoRef} opacity={0}>
        {videoElement && (
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
        )}
      </Group>
    </Group>,
  ]

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
