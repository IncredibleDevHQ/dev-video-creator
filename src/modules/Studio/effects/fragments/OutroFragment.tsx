import React, { useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import DiscordLogo from '../../../../assets/OutroFragment/discord.svg'
import TwitterLogo from '../../../../assets/OutroFragment/twitter.svg'
import YoutubeLogo from '../../../../assets/OutroFragment/youtube.svg'
import { ThemeFragment } from '../../../../generated/graphql'
import {
  BlockProperties,
  OutroBlockView,
  OutroBlockViewProps,
} from '../../../../utils/configTypes'
import Concourse, { SHORTS_CONFIG } from '../../components/Concourse'
import FragmentBackground from '../../components/FragmentBackground'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'
import {
  getOutroConfig,
  getSocialHandlePositions,
  OutroConfig,
} from '../../utils/OutroConfig'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import {
  getThemeFont,
  getThemeSurfaceColor,
  getThemeTextColor,
} from '../../utils/ThemeConfig'

const getImagePosition = (theme: ThemeFragment) => {
  switch (theme.name) {
    case 'DarkGradient':
      return {
        imageX: 40,
      }
    case 'PastelLines':
      return {
        imageX: 60,
      }
    case 'Cassidoo':
      return {
        imageX: 40,
      }
    default:
      return {
        imageX: 0,
      }
  }
}

export interface SocialHandles {
  twitterHandle?: string
  discordHandle?: string
  youtubeHandle?: string
}

const OutroFragment = ({
  isShorts,
  viewConfig,
}: {
  isShorts: boolean
  viewConfig: BlockProperties
}) => {
  const { fragment, branding, theme } = useRecoilValue(studioStore)
  const [logo] = useImage(branding?.logo || '', 'anonymous')
  const [twitterLogo] = useImage(TwitterLogo, 'anonymous')
  const [discordLogo] = useImage(DiscordLogo, 'anonymous')
  const [youtubeLogo] = useImage(YoutubeLogo, 'anonymous')

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
  })

  const { clipRect } = useEdit()

  useEffect(() => {
    if (!viewConfig) return
    const outroBlockViewProps: OutroBlockViewProps = (
      viewConfig?.view as OutroBlockView
    )?.outro
    // setOutroLayout(outroBlockViewProps?.layout)
    setOutroConfig(
      getOutroConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
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
      } || {}
    )
  }, [viewConfig, theme])

  useEffect(() => {
    if (!outroConfig) return
    const outroBlockViewProps: OutroBlockViewProps = (
      viewConfig?.view as OutroBlockView
    )?.outro
    setSocialHandlesPositionInfo(
      getSocialHandlePositions({
        layout: viewConfig?.layout || 'classic',
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
  }, [outroConfig, viewConfig, socialHandles])

  const layerChildren = !isShorts
    ? [
        <Group
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
              align={viewConfig?.layout === 'classic' ? 'center' : 'left'}
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
            />
            {socialHandles?.twitterHandle && (
              <>
                <Image
                  x={socialHandlesPositionInfo?.twitterX}
                  y={socialHandlesPositionInfo?.twitterY || 0}
                  width={24}
                  height={24}
                  image={twitterLogo}
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
          </Group>
        </Group>,
      ]
    : [
        <Group>
          <Text
            width={SHORTS_CONFIG.width}
            height={SHORTS_CONFIG.height}
            align="center"
            verticalAlign="middle"
            text="Thanks for watching"
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={64}
            fontFamily={branding?.font?.heading?.family || 'Gilroy'}
            fontStyle="normal 600"
            lineHeight={1.2}
          />
          <Image
            x={getImagePosition(theme).imageX}
            y={SHORTS_CONFIG.height - 100}
            width={60}
            height={60}
            image={logo}
          />
        </Group>,
      ]

  const studioUserConfig = StudioUserConfiguration({
    layout: outroConfig?.userMediaLayout || 'classic',
    fragment,
    fragmentState: 'customLayout',
    theme,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      blockType="outroBlock"
      studioUserConfig={studioUserConfig}
      isShorts={isShorts}
    />
  )
}

export default OutroFragment
