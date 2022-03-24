import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'

export interface IntroConfig {
  layoutX: number
  layoutY: number
  layoutWidth: number
  layoutHeight: number
  layoutBorderRadius: number
  titleX: number
  titleY: number
  titleWidth: number
  titleHeight: number
  titleFontSize: number
  userNameX: number
  userNameY: number
  userNameWidth: number
  userNameHeight: number
  userNameFontSize: number
  userInfoX: number
  userInfoY: number
  userInfoWidth: number
  userInfoHeight: number
  userInfoFontSize: number
  logoX: number
  logoY: number
  logoWidth: number
  logoHeight: number
  userMediaLayout?: Layout
}

export const getIntroConfig = ({
  theme,
  layout,
  isShorts,
}: {
  theme: ThemeFragment
  layout: Layout
  isShorts?: boolean
}): IntroConfig => {
  if (!isShorts)
    switch (theme.name) {
      case 'DarkGradient':
        switch (layout) {
          case 'classic':
            return {
              layoutX: 0,
              layoutY: 0,
              layoutWidth: 960,
              layoutHeight: 540,
              layoutBorderRadius: 0,
              titleX: 80,
              titleY: 121,
              titleWidth: 685,
              titleHeight: 172,
              titleFontSize: 72,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 149,
              logoWidth: 32,
              logoHeight: 32,
            }
          case 'float-full-right':
            return {
              layoutX: 40,
              layoutY: 90,
              layoutWidth: 544,
              layoutHeight: 360,
              layoutBorderRadius: 8,
              titleX: 32,
              titleY: 72,
              titleWidth: 386,
              titleHeight: 122,
              titleFontSize: 48,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 488,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
              userMediaLayout: 'padded-split',
            }
          default:
            return {
              layoutX: 72,
              layoutY: 40,
              layoutWidth: 816,
              layoutHeight: 460,
              layoutBorderRadius: 8,
              titleX: 185,
              titleY: 205,
              titleWidth: 446,
              titleHeight: 57,
              titleFontSize: 48,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 149,
              logoWidth: 32,
              logoHeight: 32,
            }
        }
      case 'PastelLines':
        switch (layout) {
          case 'classic':
            return {
              layoutX: 64,
              layoutY: 64,
              layoutWidth: 832,
              layoutHeight: 412,
              layoutBorderRadius: 0,
              titleX: 121,
              titleY: 165,
              titleWidth: 832,
              titleHeight: 70,
              titleFontSize: 64,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 88,
              logoWidth: 54,
              logoHeight: 54,
            }
          case 'float-full-right':
            return {
              layoutX: 80,
              layoutY: 130,
              layoutWidth: 544,
              layoutHeight: 360,
              layoutBorderRadius: 0,
              titleX: 32,
              titleY: 72,
              titleWidth: 372,
              titleHeight: 150,
              titleFontSize: 64,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 308,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
              userMediaLayout: 'float-half-right',
            }
          default:
            return {
              layoutX: 72,
              layoutY: 40,
              layoutWidth: 816,
              layoutHeight: 460,
              layoutBorderRadius: 0,
              titleX: 185,
              titleY: 230,
              titleWidth: 446,
              titleHeight: 57,
              titleFontSize: 48,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 149,
              logoWidth: 54,
              logoHeight: 54,
            }
        }
      case 'Cassidoo':
        switch (layout) {
          case 'classic':
            return {
              layoutX: 40,
              layoutY: 40,
              layoutWidth: 880,
              layoutHeight: 460,
              layoutBorderRadius: 16,
              titleX: 143,
              titleY: 205,
              titleWidth: 880,
              titleHeight: 69,
              titleFontSize: 52,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 120,
              logoWidth: 54,
              logoHeight: 54,
            }
          case 'float-full-right':
            return {
              layoutX: 40,
              layoutY: 90,
              layoutWidth: 544,
              layoutHeight: 360,
              layoutBorderRadius: 16,
              titleX: 40,
              titleY: 96,
              titleWidth: 386,
              titleHeight: 122,
              titleFontSize: 48,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 468,
              logoY: 285,
              logoWidth: 48,
              logoHeight: 48,
              userMediaLayout: 'float-full-right',
            }
          default:
            return {
              layoutX: 40,
              layoutY: 40,
              layoutWidth: 880,
              layoutHeight: 460,
              layoutBorderRadius: 16,
              titleX: 143,
              titleY: 205,
              titleWidth: 594,
              titleHeight: 69,
              titleFontSize: 52,
              userNameX: 244,
              userNameY: 326,
              userNameWidth: 816,
              userNameHeight: 57,
              userNameFontSize: 48,
              userInfoX: 244,
              userInfoY: 388,
              userInfoWidth: 816,
              userInfoHeight: 57,
              userInfoFontSize: 16,
              logoX: 392,
              logoY: 120,
              logoWidth: 54,
              logoHeight: 54,
            }
        }
      default:
        return {
          layoutX: 72,
          layoutY: 40,
          layoutWidth: 816,
          layoutHeight: 460,
          layoutBorderRadius: 8,
          titleX: 185,
          titleY: 205,
          titleWidth: 446,
          titleHeight: 57,
          titleFontSize: 48,
          userNameX: 244,
          userNameY: 326,
          userNameWidth: 816,
          userNameHeight: 57,
          userNameFontSize: 48,
          userInfoX: 244,
          userInfoY: 388,
          userInfoWidth: 816,
          userInfoHeight: 57,
          userInfoFontSize: 16,
          logoX: 392,
          logoY: 149,
          logoWidth: 32,
          logoHeight: 32,
        }
    }
  return {
    layoutX: 72,
    layoutY: 40,
    layoutWidth: 816,
    layoutHeight: 460,
    layoutBorderRadius: 8,
    titleX: 185,
    titleY: 205,
    titleWidth: 446,
    titleHeight: 57,
    titleFontSize: 48,
    userNameX: 244,
    userNameY: 326,
    userNameWidth: 816,
    userNameHeight: 57,
    userNameFontSize: 48,
    userInfoX: 244,
    userInfoY: 388,
    userInfoWidth: 816,
    userInfoHeight: 57,
    userInfoFontSize: 16,
    logoX: 392,
    logoY: 149,
    logoWidth: 32,
    logoHeight: 32,
  }
}
