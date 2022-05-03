import Konva from 'konva'
import React, { useEffect, useRef, useState } from 'react'
import { Group } from 'react-konva'
import { useRecoilValue } from 'recoil'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import Thumbnail from '../../components/Thumbnail'
import { Video } from '../../components/Video'
import { presentationStore } from '../../stores'
import { PresentationProviderProps } from '../../stores/presentation.store'
import { BlockProperties, TopLayerChildren } from '../../utils/configTypes'

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
  const { branding, theme } =
    (useRecoilValue(presentationStore) as PresentationProviderProps) || {}
  // const [studio, setStudio] = useRecoilState(presentationStore);

  const titleScreenRef = React.useRef<Konva.Group>(null)
  const brandVideoRef = React.useRef<Konva.Group>(null)

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  // const [introPayload, setIntroPayload] = useState({
  // 	activeIntroIndex: 0,
  // });

  const [activeIntroIndex, setActiveIntroIndex] = useState<number>(0)

  const timer = useRef<any>(null)

  useEffect(() => {
    clearTimeout(timer.current)
    return () => {
      clearTimeout(timer.current)
    }
  }, [])

  // useEffect(() => {
  // 	setStudio({
  // 		...studio,
  // 		introPayload,
  // 		setIntroPayload,
  // 	});
  // }, [introPayload, setIntroPayload]);

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

  // useEffect(() => {
  // 	if (introPayload?.activeIntroIndex === activeIntroIndex) return;
  // 	setActiveIntroIndex(introPayload?.activeIntroIndex);
  // }, [introPayload?.activeIntroIndex]);

  useEffect(() => {
    // if (isPreview) {
    if (introSequence[activeIntroIndex] === 'titleSplash') {
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
    // }
  }, [activeIntroIndex, videoElement])

  // useEffect(() => {
  // 	if (!isPreview && introSequence[activeIntroIndex] === 'userMedia') {
  // 		timer.current = setTimeout(() => {
  // 			setTopLayerChildren?.({ id: nanoid(), state: 'lowerThird' });
  // 		}, 2000);
  // 	}
  // }, [activeIntroIndex]);

  // useEffect(() => {
  // 	if (!videoElement) return;
  // 	if (isPreview) return;
  // 	if (introSequence[activeIntroIndex] !== 'introVideo') return;
  // 	videoElement.addEventListener('ended', () => {
  // 		if (activeIntroIndex !== introSequence.length - 1) {
  // 			setIntroPayload?.({
  // 				...introPayload,
  // 				activeIntroIndex: activeIntroIndex + 1,
  // 			});
  // 		} else {
  // 			videoElement.pause();
  // 		}
  // 	});
  // }, [videoElement, activeIntroIndex]);

  const layerChildren = [
    <Group key={0}>
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

  // const studioUserConfig = !shortsMode
  // 	? StudioUserConfiguration({
  // 			layout: 'classic',
  // 			fragment,
  // 			fragmentState:
  // 				introSequence[payload.activeIntroIndex] === 'userMedia'
  // 					? 'onlyUserMedia'
  // 					: 'customLayout',
  // 			theme,
  // 	  })
  // 	: ShortsStudioUserConfiguration({
  // 			layout: 'classic',
  // 			fragment,
  // 			fragmentState:
  // 				introSequence[payload.activeIntroIndex] === 'userMedia'
  // 					? 'onlyUserMedia'
  // 					: 'customLayout',
  // 			theme,
  // 	  });

  return (
    <Concourse
      // studioUserConfig={studioUserConfig}
      layerChildren={layerChildren}
      blockType="introBlock"
      isShorts={shortsMode}
    />
  )
}

export default IntroFragment
