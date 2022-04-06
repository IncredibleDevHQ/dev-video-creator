import React, { useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { userState } from '../../../stores/user.store'
import {
  BlockProperties,
  IntroBlockView,
  IntroBlockViewProps,
} from '../../../utils/configTypes'
import useEdit from '../hooks/use-edit'
import { studioStore } from '../stores'
import { getIntroConfig, IntroConfig } from '../utils/IntroConfig'
import {
  getThemeFont,
  getThemeSurfaceColor,
  getThemeTextColor,
} from '../utils/ThemeConfig'
import { CONFIG, SHORTS_CONFIG } from './Concourse'
import FragmentBackground from './FragmentBackground'
import VideoBackground from './VideoBackground'

const Thumbnail = ({
  isShorts,
  viewConfig,
  isIntro = false,
}: {
  isShorts: boolean
  viewConfig: BlockProperties
  isIntro?: boolean
}) => {
  const { fragment, branding, theme } = useRecoilValue(studioStore)
  const { displayName, designation, organization } =
    useRecoilValue(userState) || {}

  const [logo] = useImage(branding?.logo || '', 'anonymous')
  const [userImage] = useImage(
    (viewConfig?.view as IntroBlockView)?.intro?.displayPicture || '',
    'anonymous'
  )

  const [introConfig, setIntroConfig] = useState<IntroConfig>()
  const [thumbnailInfo, setThumbnailInfo] = useState<{
    title: string
    userName: string
    designation: string
    orgnization: string
  }>()
  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  const { clipRect, getImageFitDimensions } = useEdit()

  useEffect(() => {
    if (!viewConfig) return
    const introBlockViewProps: IntroBlockViewProps = (
      viewConfig?.view as IntroBlockView
    )?.intro
    setThumbnailInfo({
      title: introBlockViewProps?.heading || fragment?.flick.name || '',
      userName: introBlockViewProps?.name || displayName || '',
      designation: introBlockViewProps?.designation || designation || '',
      orgnization: introBlockViewProps?.organization || organization || '',
    })
    setIntroConfig(
      getIntroConfig({
        theme,
        layout: viewConfig?.layout || 'classic',
        isShorts,
      })
    )
  }, [viewConfig])

  useEffect(() => {
    if (!userImage || !introConfig) return
    setImgDim(
      getImageFitDimensions({
        imgWidth: userImage.width,
        imgHeight: userImage.height,
        maxWidth: introConfig.userImageWidth,
        maxHeight: introConfig.userImageHeight,
        x: introConfig.userImageX,
        y: introConfig.userImageY,
      })
    )
  }, [userImage, introConfig])

  useEffect(() => {
    if (!isShorts) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [isShorts])

  return (
    <>
      {!isIntro && (
        <VideoBackground
          theme={theme}
          stageConfig={stageConfig}
          isShorts={isShorts}
        />
      )}
      <Group
        clipFunc={(ctx: any) => {
          clipRect(ctx, {
            x: introConfig?.layoutX || 0,
            y: introConfig?.layoutY || 0,
            width: introConfig?.layoutWidth || 0,
            height: introConfig?.layoutHeight || 0,
            borderRadius: introConfig?.layoutBorderRadius || 0,
          })
        }}
      >
        {theme.name !== 'DarkGradient' && (
          <FragmentBackground
            theme={theme}
            objectConfig={{
              x: introConfig?.layoutX || 0,
              y: introConfig?.layoutY || 0,
              width: introConfig?.layoutWidth || 0,
              height: introConfig?.layoutHeight || 0,
              borderRadius: introConfig?.layoutBorderRadius || 0,
            }}
            backgroundRectColor={
              branding?.colors?.primary
                ? branding?.colors?.primary
                : getThemeSurfaceColor(theme)
            }
          />
        )}
        <Group x={introConfig?.layoutX} y={introConfig?.layoutY}>
          <Text
            key="title"
            x={introConfig?.titleX || 0}
            y={introConfig?.titleY || 0}
            width={introConfig?.titleWidth || 0}
            height={introConfig?.titleHeight || 0}
            verticalAlign="middle"
            align={isShorts ? 'center' : 'left'}
            text={thumbnailInfo?.title}
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={introConfig?.titleFontSize || 0}
            fontFamily={getThemeFont(theme)}
            fontStyle="normal 600"
            lineHeight={1.1}
          />
          <Image
            x={introConfig?.logoX || 0}
            y={introConfig?.logoY || 0}
            width={introConfig?.logoWidth || 0}
            height={introConfig?.logoHeight || 0}
            image={logo}
          />
          <Text
            key="userName"
            x={
              logo
                ? introConfig?.userNameX || 0
                : (introConfig?.logoX || 0) + 10
            }
            y={introConfig?.userNameY || 0}
            width={introConfig?.userNameWidth || 0}
            height={introConfig?.userNameHeight || 0}
            text={thumbnailInfo?.userName}
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={introConfig?.userNameFontSize || 0}
            fontFamily={getThemeFont(theme)}
            lineHeight={1.1}
          />
          {designation !== '' && organization === '' && (
            <Text
              key="userInfo"
              x={
                logo
                  ? introConfig?.userInfoX || 0
                  : (introConfig?.logoX || 0) + 10
              }
              y={introConfig?.userInfoY || 0}
              width={introConfig?.userInfoWidth || 0}
              height={introConfig?.userInfoHeight || 0}
              text={thumbnailInfo?.designation}
              fill={branding?.colors?.text || getThemeTextColor(theme)}
              fontSize={introConfig?.userInfoFontSize || 0}
              fontFamily={getThemeFont(theme)}
              lineHeight={1.1}
            />
          )}
          {designation === '' && organization !== '' && (
            <Text
              key="userInfo"
              x={
                logo
                  ? introConfig?.userInfoX || 0
                  : (introConfig?.logoX || 0) + 10
              }
              y={introConfig?.userInfoY || 0}
              width={introConfig?.userInfoWidth || 0}
              height={introConfig?.userInfoHeight || 0}
              text={thumbnailInfo?.orgnization}
              fill={branding?.colors?.text || getThemeTextColor(theme)}
              fontSize={introConfig?.userInfoFontSize || 0}
              fontFamily={getThemeFont(theme)}
              lineHeight={1.1}
            />
          )}
          {designation !== '' && organization !== '' && (
            <Text
              key="userInfo"
              x={
                logo
                  ? introConfig?.userInfoX || 0
                  : (introConfig?.logoX || 0) + 10
              }
              y={introConfig?.userInfoY || 0}
              width={introConfig?.userInfoWidth || 0}
              height={introConfig?.userInfoHeight || 0}
              text={`${thumbnailInfo?.designation}, ${thumbnailInfo?.orgnization}`}
              fill={branding?.colors?.text || getThemeTextColor(theme)}
              fontSize={introConfig?.userInfoFontSize || 0}
              fontFamily={getThemeFont(theme)}
              lineHeight={1.1}
            />
          )}
        </Group>
      </Group>
      <Group
        clipFunc={(ctx: any) => {
          clipRect(ctx, {
            x: introConfig?.userImageX || 0,
            y: introConfig?.userImageY || 0,
            width: introConfig?.userImageWidth || 0,
            height: introConfig?.userImageHeight || 0,
            borderRadius: introConfig?.userImageBorderRadius || 0,
          })
        }}
      >
        {userImage && (
          <Image
            x={imgDim.x}
            y={imgDim.y}
            width={imgDim.width}
            height={imgDim.height}
            image={userImage}
          />
        )}
      </Group>
    </>
  )
}

export default Thumbnail
