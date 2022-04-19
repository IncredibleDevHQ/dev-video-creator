/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from 'react'
import { Arc, Circle, Group, Image, Rect, Ring, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import config from '../../../config'
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
  const [star] = useImage(
    `${config.storage.baseUrl}themes/DevsForUkraine/star.svg`,
    'anonymous'
  )
  const [heart] = useImage(
    `${config.storage.baseUrl}themes/DevsForUkraine/heart.svg`,
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
      })
    )
  }, [viewConfig])

  useEffect(() => {
    if (
      theme.name === 'DevsForUkraine' &&
      viewConfig?.layout === 'bottom-right-tile'
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
  }, [viewConfig, theme, introConfig])

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
        {theme.name === 'DevsForUkraine' &&
          viewConfig?.layout === 'bottom-right-tile' &&
          !isShorts && (
            <>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#1C1C1C"
              />
              <Group x={85} y={(titleConfig?.y || 0) + 22 || 202}>
                <Ring innerRadius={22} outerRadius={30} fill="#fafafa" />
                <Circle x={123} radius={34} fill="#2696FA" />
                <Rect x={25} y={-4} width={98} height={8} fill="#fafafa" />
              </Group>
              <Group x={772} y={(titleConfig?.y || 0) + 22 || 202}>
                <Arc
                  innerRadius={22}
                  outerRadius={30}
                  angle={180}
                  fill="#ffe87b"
                  rotationDeg={90}
                />
                <Rect x={-4} y={-30} width={8} height={60} fill="#ffe87b" />
                <Rect x={25} y={8} width={64} height={8} fill="#fafafa" />
              </Group>
              <Group
                x={772}
                y={
                  (titleConfig?.y || 0) + (titleConfig?.height || 0) - 56 >
                  (titleConfig?.y || 0) + 22 + 80
                    ? (titleConfig?.y || 0) + (titleConfig?.height || 0) - 56
                    : (titleConfig?.y || 0) + 22 + 80
                }
              >
                <Circle radius={32} fill="#e2ce68" />
                <Arc
                  x={64}
                  innerRadius={0}
                  outerRadius={32}
                  angle={180}
                  fill="#2696FA"
                  rotationDeg={90}
                />
              </Group>
              <Image
                x={196}
                y={
                  (titleConfig?.y || 0) + (titleConfig?.height || 0) - 56 >
                  (titleConfig?.y || 0) + 30 + 80
                    ? (titleConfig?.y || 0) + (titleConfig?.height || 0) - 56
                    : (titleConfig?.y || 0) + 30 + 80
                }
                image={star}
                width={40}
                height={42}
              />
              <Image x={40} y={40} image={heart} width={56} height={56} />
            </>
          )}
        {theme.name === 'DevsForUkraine' &&
          viewConfig?.layout === 'float-full-right' &&
          !isShorts && (
            <>
              <Rect
                x={0}
                y={0}
                width={stageConfig.width}
                height={stageConfig.height}
                fill="#1C1C1C"
              />
              <Group x={83} y={120}>
                <Ring innerRadius={22} outerRadius={30} fill="#fafafa" />
                <Circle x={123} radius={34} fill="#2696FA" />
                <Rect x={25} y={-4} width={98} height={8} fill="#fafafa" />
              </Group>
              <Group x={780} y={114}>
                <Arc
                  innerRadius={22}
                  outerRadius={30}
                  angle={180}
                  fill="#ffe87b"
                  rotationDeg={90}
                />
                <Rect x={-4} y={-30} width={8} height={60} fill="#ffe87b" />
                <Rect x={25} y={8} width={64} height={8} fill="#fafafa" />
              </Group>
              <Group x={776} y={216}>
                <Circle radius={32} fill="#e2ce68" />
                <Arc
                  x={64}
                  innerRadius={0}
                  outerRadius={32}
                  angle={180}
                  fill="#2696FA"
                  rotationDeg={90}
                />
              </Group>
              <Image x={196} y={275} image={star} width={40} height={42} />
              <Image x={536} y={315} image={heart} width={40} height={40} />
            </>
          )}
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
            fill={branding?.colors?.text || getThemeTextColor(theme)}
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
            x={logo ? introConfig?.userNameX || 0 : introConfig?.logoX || 0}
            y={introConfig?.userNameY || 0}
            width={introConfig?.userNameWidth || 0}
            height={introConfig?.userNameHeight || 0}
            align={introConfig?.userNameAlign || 'left'}
            text={thumbnailInfo?.userName}
            fill={branding?.colors?.text || getThemeTextColor(theme)}
            fontSize={introConfig?.userNameFontSize || 0}
            fontFamily={getThemeFont(theme)}
            fontStyle={introConfig?.userNameFontStyle || 'normal'}
            lineHeight={1.1}
          />
          {thumbnailInfo?.designation !== '' &&
            thumbnailInfo?.organization === '' && (
              <Text
                key="userInfo"
                x={logo ? introConfig?.userNameX || 0 : introConfig?.logoX || 0}
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={thumbnailInfo?.designation}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={introConfig?.userInfoFontSize || 0}
                fontFamily={getThemeFont(theme)}
                lineHeight={1.1}
              />
            )}
          {thumbnailInfo?.designation === '' &&
            thumbnailInfo?.organization !== '' && (
              <Text
                key="userInfo"
                x={logo ? introConfig?.userNameX || 0 : introConfig?.logoX || 0}
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={thumbnailInfo?.organization}
                fill={branding?.colors?.text || getThemeTextColor(theme)}
                fontSize={introConfig?.userInfoFontSize || 0}
                fontFamily={getThemeFont(theme)}
                lineHeight={1.1}
              />
            )}
          {thumbnailInfo?.designation !== '' &&
            thumbnailInfo?.organization !== '' && (
              <Text
                key="userInfo"
                x={logo ? introConfig?.userNameX || 0 : introConfig?.logoX || 0}
                y={introConfig?.userInfoY || 0}
                width={introConfig?.userInfoWidth || 0}
                height={introConfig?.userInfoHeight || 0}
                align={introConfig?.userInfoAlign || 'left'}
                text={`${thumbnailInfo?.designation}, ${thumbnailInfo?.organization}`}
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
