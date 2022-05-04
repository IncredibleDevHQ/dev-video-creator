import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../../config'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import { Video } from '../../components/Video'
import useEdit from '../../hooks/use-edit'
import { presentationStore } from '../../stores'
import {
  BlockProperties,
  OutroBlockView,
  OutroBlockViewProps,
  OutroState,
} from '../../utils/configTypes'
import {
  getOutroConfig,
  getSocialHandlePositions,
  OutroConfig,
} from '../../utils/OutroConfig'
import {
  getThemeFont,
  getThemeSurfaceColor,
  getThemeTextColor,
} from '../../utils/ThemeConfig'

export interface SocialHandles {
  twitterHandle?: string
  discordHandle?: string
  youtubeHandle?: string
  websiteHandle?: string
  linkedinHandle?: string
}

const OutroFragment = ({
  isShorts,
  viewConfig,
  isPreview,
  outroSequence,
}: {
  isShorts: boolean
  viewConfig: BlockProperties
  isPreview: boolean
  outroSequence: OutroState[]
}) => {
  const { branding, theme } = useRecoilValue(presentationStore)
  // const [studio, setStudio] = useRecoilState(presentationStore);
  const [logo] = useImage(branding?.logo || '', 'anonymous')
  const [twitterLogo] = useImage(
    `${config.storage.baseUrl}outroBlockIcons/twitter.svg`,
    'anonymous'
  )
  const [discordLogo] = useImage(
    `${config.storage.baseUrl}outroBlockIcons/discord.svg`,
    'anonymous'
  )
  const [youtubeLogo] = useImage(
    `${config.storage.baseUrl}outroBlockIcons/youtube.svg`,
    'anonymous'
  )
  const [linkedinLogo] = useImage(
    `${config.storage.baseUrl}outroBlockIcons/linkedin.svg`,
    'anonymous'
  )
  const [websiteLogo] = useImage(
    `${config.storage.baseUrl}outroBlockIcons/website.svg`,
    'anonymous'
  )

  const [outroConfig, setOutroConfig] = useState<OutroConfig>()
  const [outroMsg, setOutroMsg] = useState<string>()
  const [socialHandles, setSocialHandles] = useState<SocialHandles>({})
  // const [outroLayout, setOutroLayout] = useState<OutroLayout>()

  const [socialHandlesPositionInfo, setSocialHandlesPositionInfo] = useState({
    twitterX: 0,
    twitterY: 0,
    discordX: 0,
    discordY: 0,
    youtubeX: 0,
    youtubeY: 0,
    linkedinX: 0,
    linkedinY: 0,
    websiteX: 0,
    websiteY: 0,
  })

  // const [outroPayload, setOutroPayload] = useState({
  // 	activeOutroIndex: 0,
  // });

  const { clipRect } = useEdit()

  const outroScreenRef = React.useRef<Konva.Group>(null)
  const brandVideoRef = React.useRef<Konva.Group>(null)

  // useEffect(() => {
  // 	setStudio({
  // 		...studio,
  // 		outroPayload,
  // 		setOutroPayload,
  // 	});
  // }, [outroPayload, setOutroPayload]);

  useEffect(() => {
    if (!viewConfig) return
    const outroBlockViewProps: OutroBlockViewProps = (
      viewConfig?.view as OutroBlockView
    )?.outro
    // setOutroLayout(outroBlockViewProps?.layout)
    setOutroConfig(
      getOutroConfig({
        theme,
        layout: 'classic',
        isShorts,
      })
    )
    setOutroMsg(outroBlockViewProps?.title || 'Thanks for watching')
    setSocialHandles(
      {
        twitterHandle:
          outroBlockViewProps?.twitter?.enabled &&
          outroBlockViewProps?.twitter?.handle !== ''
            ? outroBlockViewProps?.twitter.handle
            : undefined,
        discordHandle:
          outroBlockViewProps?.discord?.enabled &&
          outroBlockViewProps?.discord?.handle !== ''
            ? outroBlockViewProps?.discord.handle
            : undefined,
        youtubeHandle:
          outroBlockViewProps?.youtube?.enabled &&
          outroBlockViewProps?.youtube?.handle !== ''
            ? outroBlockViewProps?.youtube.handle
            : undefined,
        linkedinHandle:
          outroBlockViewProps?.linkedin?.enabled &&
          outroBlockViewProps?.linkedin?.handle !== ''
            ? outroBlockViewProps?.linkedin.handle
            : undefined,
        websiteHandle:
          outroBlockViewProps?.website?.enabled &&
          outroBlockViewProps?.website?.handle !== ''
            ? outroBlockViewProps?.website.handle
            : undefined,
      } || {}
    )
  }, [viewConfig, theme, isShorts])

  useEffect(() => {
    if (!outroConfig) return
    const outroBlockViewProps: OutroBlockViewProps = (
      viewConfig?.view as OutroBlockView
    )?.outro
    setSocialHandlesPositionInfo(
      getSocialHandlePositions({
        layout: 'classic',
        socialHandles:
          {
            twitterHandle:
              outroBlockViewProps?.twitter?.enabled &&
              outroBlockViewProps?.twitter?.handle !== ''
                ? outroBlockViewProps?.twitter.handle
                : undefined,
            discordHandle:
              outroBlockViewProps?.discord?.enabled &&
              outroBlockViewProps?.discord?.handle !== ''
                ? outroBlockViewProps?.discord.handle
                : undefined,
            youtubeHandle:
              outroBlockViewProps?.youtube?.enabled &&
              outroBlockViewProps?.youtube?.handle !== ''
                ? outroBlockViewProps?.youtube.handle
                : undefined,
            linkedinHandle:
              outroBlockViewProps?.linkedin?.enabled &&
              outroBlockViewProps?.linkedin?.handle !== ''
                ? outroBlockViewProps?.linkedin.handle
                : undefined,
            websiteHandle:
              outroBlockViewProps?.website?.enabled &&
              outroBlockViewProps?.website?.handle !== ''
                ? outroBlockViewProps?.website.handle
                : undefined,
          } || {},
        isShorts,
        noOfSocialHandles: outroBlockViewProps?.noOfSocialHandles || 3,
        textProperties: {
          textFontSize: 16,
          textFontFamily: branding?.font?.body?.family || 'GilroyRegular',
          // textFontStyle: 'normal',
        },
        availableWidth: outroConfig?.layoutWidth || 0,
        availableHeight: outroConfig?.layoutHeight || 0,
        socialX: outroConfig?.socialX || 0,
        socialY: outroConfig?.socialY || 0,
      })
    )
  }, [outroConfig, viewConfig, socialHandles, isShorts])

  const videoElement = React.useMemo(() => {
    if (!branding?.introVideoUrl) return
    const element = document.createElement('video')
    element.autoplay = false
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.muted = true
    element.src = branding?.outroVideoUrl || ''
    // eslint-disable-next-line consistent-return
    return element
  }, [branding])

  // useEffect(() => {
  // 	if (isPreview) {
  // 		if (outroSequence[outroPayload?.activeOutroIndex] === 'titleSplash') {
  // 			videoElement?.pause();
  // 			if (videoElement) videoElement.currentTime = 0;
  // 			outroScreenRef.current?.opacity(1);
  // 			brandVideoRef.current?.opacity(0);
  // 		}
  // 		if (outroSequence[outroPayload?.activeOutroIndex] === 'outroVideo') {
  // 			if (!videoElement) return;
  // 			if (videoElement) videoElement.currentTime = 0;
  // 			videoElement?.play();
  // 			outroScreenRef.current?.opacity(0);
  // 			brandVideoRef.current?.opacity(1);
  // 		}
  // 	}
  // }, [outroPayload?.activeOutroIndex, videoElement]);

  // useEffect(() => {
  // 	if (!videoElement) return;
  // 	if (isPreview) return;
  // 	if (outroSequence[outroPayload?.activeOutroIndex] !== 'outroVideo') return;
  // 	videoElement.addEventListener('ended', () => {
  // 		if (outroPayload?.activeOutroIndex !== outroSequence.length - 1) {
  // 			setOutroPayload?.({
  // 				...outroPayload,
  // 				activeOutroIndex: outroPayload?.activeOutroIndex + 1,
  // 			});
  // 		} else {
  // 			videoElement.pause();
  // 		}
  // 	});
  // }, [videoElement, outroPayload?.activeOutroIndex]);

  const layerChildren = [
    <Group key={0}>
      <Group
        x={0}
        y={0}
        ref={outroScreenRef}
        opacity={1}
        clipFunc={(ctx: any) => {
          clipRect(ctx, {
            x: outroConfig?.layoutX || 0,
            y: outroConfig?.layoutY || 0,
            width: outroConfig?.layoutWidth || 0,
            height: outroConfig?.layoutHeight || 0,
            borderRadius: outroConfig?.layoutBorderRadius || 0,
          })
        }}
      >
        <FragmentBackground
          theme={theme}
          objectConfig={{
            x: outroConfig?.layoutX || 0,
            y: outroConfig?.layoutY || 0,
            width: outroConfig?.layoutWidth || 0,
            height: outroConfig?.layoutHeight || 0,
            borderRadius: outroConfig?.layoutBorderRadius || 0,
          }}
          backgroundRectColor={
            branding?.colors?.primary
              ? branding?.colors?.primary
              : getThemeSurfaceColor(theme)
          }
        />
        <Group x={outroConfig?.layoutX} y={outroConfig?.layoutY}>
          <Text
            x={outroConfig?.textX || 16}
            y={outroConfig?.textY || 0}
            width={outroConfig?.textWidth || 0}
            height={outroConfig?.textHeight || 0}
            text={outroMsg}
            align="center"
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={outroConfig?.textFontSize || 0}
            fontFamily={getThemeFont(theme)}
            fontStyle="normal 600"
            lineHeight={1.1}
          />
          <Image
            x={outroConfig?.logoX || 0}
            y={outroConfig?.logoY || 0}
            width={outroConfig?.logoWidth || 0}
            height={outroConfig?.logoHeight || 0}
            image={logo}
            alt="logo"
          />
          {socialHandles?.twitterHandle && (
            <>
              <Image
                x={socialHandlesPositionInfo?.twitterX}
                y={socialHandlesPositionInfo?.twitterY || 0}
                width={24}
                height={24}
                image={twitterLogo}
                alt="twitterLogo"
              />
              <Text
                x={socialHandlesPositionInfo?.twitterX + 8 + 24}
                y={socialHandlesPositionInfo?.twitterY + 3}
                text={socialHandles?.twitterHandle}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={outroConfig?.socialHandlesFontSize || 0}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
              />
            </>
          )}
          {socialHandles?.discordHandle && (
            <>
              <Image
                x={socialHandlesPositionInfo?.discordX}
                y={socialHandlesPositionInfo?.discordY || 0}
                width={24}
                height={24}
                image={discordLogo}
                alt="discordLogo"
              />
              <Text
                x={socialHandlesPositionInfo?.discordX + 8 + 24}
                y={socialHandlesPositionInfo?.discordY + 3}
                text={socialHandles?.discordHandle}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={outroConfig?.socialHandlesFontSize || 0}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
                lineHeight={1.2}
              />
            </>
          )}
          {socialHandles?.youtubeHandle && (
            <>
              <Image
                x={socialHandlesPositionInfo?.youtubeX}
                y={socialHandlesPositionInfo?.youtubeY || 0}
                width={24}
                height={24}
                image={youtubeLogo}
                alt="youtubeLogo"
              />
              <Text
                x={socialHandlesPositionInfo?.youtubeX + 8 + 24}
                y={socialHandlesPositionInfo?.youtubeY + 3}
                text={socialHandles?.youtubeHandle}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={outroConfig?.socialHandlesFontSize || 0}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
                lineHeight={1.2}
              />
            </>
          )}
          {socialHandles?.linkedinHandle && (
            <>
              <Image
                x={socialHandlesPositionInfo?.linkedinX}
                y={socialHandlesPositionInfo?.linkedinY || 0}
                width={24}
                height={24}
                image={linkedinLogo}
                alt="linkedinLogo"
              />
              <Text
                x={socialHandlesPositionInfo?.linkedinX + 8 + 24}
                y={socialHandlesPositionInfo?.linkedinY + 3}
                text={socialHandles?.linkedinHandle}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={outroConfig?.socialHandlesFontSize || 0}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
                lineHeight={1.2}
              />
            </>
          )}
          {socialHandles?.websiteHandle && (
            <>
              <Image
                x={socialHandlesPositionInfo?.websiteX}
                y={socialHandlesPositionInfo?.websiteY || 0}
                width={24}
                height={24}
                image={websiteLogo}
                alt="websiteLogo"
              />
              <Text
                x={socialHandlesPositionInfo?.websiteX + 8 + 24}
                y={socialHandlesPositionInfo?.websiteY + 3}
                text={socialHandles?.websiteHandle}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={outroConfig?.socialHandlesFontSize || 0}
                fontFamily={branding?.font?.body?.family || 'GilroyRegular'}
                lineHeight={1.2}
              />
            </>
          )}
        </Group>
      </Group>
      <Group x={0} y={0} ref={brandVideoRef} opacity={0}>
        {videoElement && (
          <Video
            videoElement={videoElement}
            videoConfig={{
              x: 0,
              y: 0,
              width: !isShorts ? CONFIG.width : SHORTS_CONFIG.width,
              height: !isShorts ? CONFIG.height : SHORTS_CONFIG.height,
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

  // const studioUserConfig = !isShorts
  // 	? StudioUserConfiguration({
  // 			layout:
  // 				outroSequence[payload?.activeOutroIndex] === 'titleSplash'
  // 					? outroConfig?.userMediaLayout || 'classic'
  // 					: 'classic',
  // 			fragment,
  // 			fragmentState: 'customLayout',
  // 			theme,
  // 	  })
  // 	: ShortsStudioUserConfiguration({
  // 			layout:
  // 				outroSequence[payload?.activeOutroIndex] === 'titleSplash'
  // 					? outroConfig?.userMediaLayout || 'classic'
  // 					: 'classic',
  // 			fragment,
  // 			fragmentState: 'customLayout',
  // 			theme,
  // 	  });

  return (
    <Concourse
      layerChildren={layerChildren}
      blockType="outroBlock"
      // studioUserConfig={studioUserConfig}
      isShorts={isShorts}
    />
  )
}

export default OutroFragment
