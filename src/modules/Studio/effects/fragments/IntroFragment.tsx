import Konva from 'konva'
import { nanoid } from 'nanoid'
import React, { useEffect, useRef, useState } from 'react'
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
  const { fragment, state, payload, branding, theme, updatePayload } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}

  const titleScreenRef = React.useRef<Konva.Group>(null)
  const brandVideoRef = React.useRef<Konva.Group>(null)

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  const [activeIntroIndex, setActiveIntroIndex] = useState<number>(
    payload?.activeIntroIndex || 0
  )

  const timer = useRef<any>(null)

  useEffect(() => {
    clearTimeout(timer.current)
    return () => {
      clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!shortsMode) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [shortsMode])

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
    if (payload?.activeIntroIndex === activeIntroIndex) return
    setActiveIntroIndex(payload?.activeIntroIndex)
  }, [payload?.activeIntroIndex])

  useEffect(() => {
    if (
      state === 'start-recording' ||
      state === 'ready' ||
      state === 'resumed' ||
      isPreview
    ) {
      if (introSequence[activeIntroIndex] === 'titleSplash') {
        // if (!isPreview) addMusic('splash')
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        if (videoElement) videoElement.currentTime = 0
        titleScreenRef.current?.opacity(1)
        brandVideoRef.current?.opacity(0)
      }
      if (introSequence[activeIntroIndex] === 'introVideo') {
        setTopLayerChildren?.({ id: '', state: '' })
        if (!videoElement) return
        videoElement.currentTime = 0
        videoElement?.play()
        titleScreenRef.current?.opacity(0)
        brandVideoRef.current?.opacity(1)
      }
      if (introSequence[activeIntroIndex] === 'userMedia') {
        setTopLayerChildren?.({ id: '', state: '' })
        videoElement?.pause()
        if (videoElement) videoElement.currentTime = 0
        titleScreenRef.current?.opacity(0)
        brandVideoRef.current?.opacity(0)
      }
    }
  }, [state, activeIntroIndex, videoElement])

  useEffect(() => {
    if (!isPreview && introSequence[activeIntroIndex] === 'userMedia') {
      timer.current = setTimeout(() => {
        setTopLayerChildren?.({ id: nanoid(), state: 'lowerThird' })
      }, 2000)
    }
  }, [activeIntroIndex])

  useEffect(() => {
    if (!videoElement) return
    if (isPreview) return
    if (introSequence[activeIntroIndex] !== 'introVideo') return
    videoElement.addEventListener('ended', () => {
      if (activeIntroIndex !== introSequence.length - 1) {
        updatePayload?.({ activeIntroIndex: activeIntroIndex + 1 })
      } else {
        videoElement.pause()
      }
    })
  }, [videoElement, activeIntroIndex])

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
