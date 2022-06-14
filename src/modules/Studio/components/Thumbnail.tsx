/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import { userState } from '../../../stores/user.store'
import {
  BlockProperties,
  IntroBlockView,
  IntroBlockViewProps,
} from '../../../utils/configTypes'
import { usePoint } from '../hooks'
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
import ThumbnailElements from './ThumbnailElements'
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
    organization: string
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

  // used only in 'DevsForUkraine' theme to align other elements position wrt the title
  const [titleConfig, setTitleConfig] =
    useState<{ y: number; height: number }>()

  const { clipRect, getImageFitDimensions } = useEdit()
  const { getNoOfLinesOfText } = usePoint()

  useEffect(() => {
    if (!viewConfig) return
    const introBlockViewProps: IntroBlockViewProps = (
      viewConfig?.view as IntroBlockView
    )?.intro
    setThumbnailInfo({
      title: introBlockViewProps?.heading || fragment?.flick.name || '',
      userName: introBlockViewProps?.name || displayName || '',
      designation: introBlockViewProps?.designation || designation || '',
      organization: introBlockViewProps?.organization || organization || '',
    })
    setIntroConfig(
      getIntroConfig({
        theme,
        layout: viewConfig?.layout || 'bottom-right-tile',
        isShorts,
        logoFallback: !logo,
        userImageFallback: !userImage,
      })
    )
  }, [viewConfig])

  useEffect(() => {
    if (
      theme.name === 'DevsForUkraine' &&
      (viewConfig?.layout === 'classic' || isShorts)
    ) {
      const introBlockViewProps: IntroBlockViewProps = (
        viewConfig?.view as IntroBlockView
      )?.intro
      const noOfLines = getNoOfLinesOfText({
        text: introBlockViewProps?.heading || fragment?.flick.name || '',
        availableWidth: introConfig?.titleWidth || 0,
        fontSize: introConfig?.titleFontSize || 0,
        fontFamily: getThemeFont(theme),
        fontStyle: introConfig?.titleFontStyle || 'normal 600',
      })
      setTitleConfig({
        y:
          (introConfig?.titleY || 0) +
          ((introConfig?.titleHeight || 0) -
            noOfLines * ((introConfig?.titleFontSize || 0) + 0.1)) /
            2,
        height: noOfLines * ((introConfig?.titleFontSize || 0) + 0.1),
      })
    }
  }, [viewConfig, theme, introConfig, isShorts])

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
        <ThumbnailElements
          theme={theme.name}
          layout={viewConfig?.layout}
          isShorts={isShorts}
          stageConfig={stageConfig}
          titleConfig={titleConfig}
        />
        <Group x={introConfig?.layoutX} y={introConfig?.layoutY}>
          <Text
            key="title"
            x={introConfig?.titleX || 0}
            y={introConfig?.titleY || 0}
            width={introConfig?.titleWidth || 0}
            height={introConfig?.titleHeight || 0}
            verticalAlign={introConfig?.titleVerticalAlign || 'middle'}
            align={introConfig?.titleAlign || 'left'}
            text={thumbnailInfo?.title}
            fill={
              branding?.colors?.text ||
              (introConfig?.titleColor as string) ||
              getThemeTextColor(theme)
            }
            fontSize={introConfig?.titleFontSize || 0}
            fontFamily={getThemeFont(theme)}
            fontStyle={introConfig?.titleFontStyle || 'normal 600'}
            lineHeight={1.1}
          />
          {theme.name !== 'DevsForUkraine' && (
            <Image
              x={introConfig?.logoX || 0}
              y={introConfig?.logoY || 0}
              width={introConfig?.logoWidth || 0}
              height={introConfig?.logoHeight || 0}
              image={logo}
            />
          )}
          <Text
            key="userName"
            x={introConfig?.userNameFallbackX || introConfig?.userNameX || 0}
            y={introConfig?.userNameY || 0}
            width={introConfig?.userNameWidth || 0}
            height={introConfig?.userNameHeight || 0}
            align={introConfig?.userNameAlign || 'left'}
            text={thumbnailInfo?.userName}
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={introConfig?.userNameFontSize || 0}
            fontFamily={getThemeFont(theme)}
            fontStyle={introConfig?.userNameFontStyle || 'normal'}
            lineHeight={1.2}
          />
          {thumbnailInfo?.designation !== '' &&
            thumbnailInfo?.organization === '' && (
              <Text
                key="userInfo"
                x={
                  introConfig?.userNameFallbackX || introConfig?.userNameX || 0
                }
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={thumbnailInfo?.designation}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={introConfig?.userInfoFontSize || 0}
                fontFamily={introConfig?.userInfoFont || getThemeFont(theme)}
                lineHeight={1.2}
              />
            )}
          {thumbnailInfo?.designation === '' &&
            thumbnailInfo?.organization !== '' && (
              <Text
                key="userInfo"
                x={
                  introConfig?.userNameFallbackX || introConfig?.userNameX || 0
                }
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={thumbnailInfo?.organization}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={introConfig?.userInfoFontSize || 0}
                fontFamily={introConfig?.userInfoFont || getThemeFont(theme)}
                lineHeight={1.2}
              />
            )}
          {thumbnailInfo?.designation !== '' &&
            thumbnailInfo?.organization !== '' && (
              <Text
                key="userInfo"
                x={
                  introConfig?.userNameFallbackX || introConfig?.userNameX || 0
                }
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={`${thumbnailInfo?.designation}, ${thumbnailInfo?.organization}`}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={introConfig?.userInfoFontSize || 0}
                fontFamily={introConfig?.userInfoFont || getThemeFont(theme)}
                lineHeight={1.2}
              />
            )}
        </Group>
      </Group>
      {userImage && (
        <Rect
          x={introConfig?.userImageX || 0}
          y={introConfig?.userImageY || 0}
          width={introConfig?.userImageWidth || 0}
          height={introConfig?.userImageHeight || 0}
          stroke={introConfig?.userImageBorderColor}
          strokeWidth={introConfig?.userImageBorderWidth || 0}
          cornerRadius={introConfig?.userImageBorderRadius || 0}
        />
      )}
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
