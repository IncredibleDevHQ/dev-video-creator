import Konva from 'konva'
import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { CONFIG, SHORTS_CONFIG } from '../components/Concourse'
import { SocialHandles } from '../effects/fragments/OutroFragment'

export interface OutroConfig {
  layoutX: number
  layoutY: number
  layoutWidth: number
  layoutHeight: number
  layoutBorderRadius: number
  textX: number
  textY: number
  textWidth: number
  textHeight: number
  textFontSize: number
  socialX: number
  socialY: number
  socialHandlesFontSize: number
  logoX: number
  logoY: number
  logoWidth: number
  logoHeight: number
  userMediaLayout?: Layout
}

export const getOutroConfig = ({
  theme,
  layout,
  isShorts,
}: {
  theme: ThemeFragment
  layout: Layout
  isShorts?: boolean
}): OutroConfig => {
  if (!isShorts) {
    switch (theme.name) {
      case 'DarkGradient':
        switch (layout) {
          case 'classic':
            return {
              layoutX: 72,
              layoutY: 40,
              layoutWidth: 816,
              layoutHeight: 460,
              layoutBorderRadius: 8,
              textX: 16,
              textY: 205,
              textWidth: 784,
              textHeight: 57,
              textFontSize: 48,
              socialX: 244,
              socialY: 326,
              socialHandlesFontSize: 16,
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
              textX: 32,
              textY: 72,
              textWidth: 450,
              textHeight: 122,
              textFontSize: 48,
              socialX: 32,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 488,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
              userMediaLayout: 'padded-split',
            }
          case 'split-without-media':
            return {
              layoutX: 40,
              layoutY: 90,
              layoutWidth: 400,
              layoutHeight: 360,
              layoutBorderRadius: 8,
              textX: 32,
              textY: 72,
              textWidth: 350,
              textHeight: 122,
              textFontSize: 48,
              socialX: 32,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 338,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
            }
          default:
            return {
              layoutX: 72,
              layoutY: 40,
              layoutWidth: 816,
              layoutHeight: 460,
              layoutBorderRadius: 8,
              textX: 185,
              textY: 205,
              textWidth: 446,
              textHeight: 57,
              textFontSize: 48,
              socialX: 244,
              socialY: 326,
              socialHandlesFontSize: 16,
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
              textX: 16,
              textY: 165,
              textWidth: 800,
              textHeight: 70,
              textFontSize: 64,
              socialX: 252,
              socialY: 300,
              socialHandlesFontSize: 16,
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
              textX: 32,
              textY: 72,
              textWidth: 372,
              textHeight: 150,
              textFontSize: 64,
              socialX: 32,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 308,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
              userMediaLayout: 'float-half-right',
            }
          case 'split-without-media':
            return {
              layoutX: 80,
              layoutY: 130,
              layoutWidth: 544,
              layoutHeight: 360,
              layoutBorderRadius: 0,
              textX: 32,
              textY: 72,
              textWidth: 372,
              textHeight: 150,
              textFontSize: 64,
              socialX: 32,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 308,
              logoY: 300,
              logoWidth: 32,
              logoHeight: 32,
            }
          default:
            return {
              layoutX: 64,
              layoutY: 64,
              layoutWidth: 832,
              layoutHeight: 412,
              layoutBorderRadius: 0,
              textX: 16,
              textY: 165,
              textWidth: 800,
              textHeight: 70,
              textFontSize: 64,
              socialX: 252,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 392,
              logoY: 88,
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
              textX: 16,
              textY: 205,
              textWidth: 848,
              textHeight: 69,
              textFontSize: 52,
              socialX: 242,
              socialY: 330,
              socialHandlesFontSize: 16,
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
              textX: 40,
              textY: 96,
              textWidth: 450,
              textHeight: 122,
              textFontSize: 48,
              socialX: 40,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 468,
              logoY: 285,
              logoWidth: 48,
              logoHeight: 48,
              userMediaLayout: 'float-full-right',
            }
          case 'split-without-media':
            return {
              layoutX: 40,
              layoutY: 90,
              layoutWidth: 400,
              layoutHeight: 360,
              layoutBorderRadius: 16,
              textX: 30,
              textY: 96,
              textWidth: 360,
              textHeight: 122,
              textFontSize: 48,
              socialX: 30,
              socialY: 300,
              socialHandlesFontSize: 16,
              logoX: 318,
              logoY: 285,
              logoWidth: 48,
              logoHeight: 48,
            }
          default:
            return {
              layoutX: 40,
              layoutY: 40,
              layoutWidth: 880,
              layoutHeight: 460,
              layoutBorderRadius: 16,
              textX: 16,
              textY: 205,
              textWidth: 848,
              textHeight: 69,
              textFontSize: 52,
              socialX: 242,
              socialY: 330,
              socialHandlesFontSize: 16,
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
          textX: 185,
          textY: 205,
          textWidth: 446,
          textHeight: 57,
          textFontSize: 48,
          socialX: 244,
          socialY: 326,
          socialHandlesFontSize: 16,
          logoX: 392,
          logoY: 149,
          logoWidth: 32,
          logoHeight: 32,
        }
    }
  }
  switch (theme.name) {
    case 'DarkGradient':
      switch (layout) {
        case 'classic':
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 70,
            textFontSize: 26,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
        case 'split':
          return {
            layoutX: 16,
            layoutY: 16,
            layoutWidth: 364,
            layoutHeight: 328,
            layoutBorderRadius: 8,
            textX: 30,
            textY: 65,
            textWidth: 270,
            textHeight: 130,
            textFontSize: 36,
            socialX: 30,
            socialY: 210,
            socialHandlesFontSize: 16,
            logoX: 300,
            logoY: 270,
            logoWidth: 32,
            logoHeight: 32,
            userMediaLayout: 'split',
          }
        default:
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 70,
            textFontSize: 26,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
      }
    case 'PastelLines':
      switch (layout) {
        case 'classic':
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 70,
            textFontSize: 26,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
        case 'split':
          return {
            layoutX: 16,
            layoutY: 16,
            layoutWidth: 364,
            layoutHeight: 328,
            layoutBorderRadius: 8,
            textX: 30,
            textY: 65,
            textWidth: 270,
            textHeight: 130,
            textFontSize: 36,
            socialX: 30,
            socialY: 210,
            socialHandlesFontSize: 16,
            logoX: 300,
            logoY: 270,
            logoWidth: 32,
            logoHeight: 32,
            userMediaLayout: 'split',
          }
        default:
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 70,
            textFontSize: 26,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
      }
    case 'Cassidoo':
      switch (layout) {
        case 'classic':
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 57,
            textFontSize: 22,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
        case 'split':
          return {
            layoutX: 16,
            layoutY: 16,
            layoutWidth: 364,
            layoutHeight: 328,
            layoutBorderRadius: 8,
            textX: 30,
            textY: 75,
            textWidth: 270,
            textHeight: 100,
            textFontSize: 36,
            socialX: 30,
            socialY: 210,
            socialHandlesFontSize: 16,
            logoX: 300,
            logoY: 270,
            logoWidth: 32,
            logoHeight: 32,
            userMediaLayout: 'split',
          }
        default:
          return {
            layoutX: 40,
            layoutY: 40,
            layoutWidth: 316,
            layoutHeight: 624,
            layoutBorderRadius: 8,
            textX: 16,
            textY: 290,
            textWidth: 284,
            textHeight: 57,
            textFontSize: 22,
            socialX: 244,
            socialY: 376,
            socialHandlesFontSize: 16,
            logoX: 140,
            logoY: 234,
            logoWidth: 28,
            logoHeight: 28,
          }
      }
    default:
      return {
        layoutX: 72,
        layoutY: 40,
        layoutWidth: 816,
        layoutHeight: 460,
        layoutBorderRadius: 8,
        textX: 185,
        textY: 205,
        textWidth: 446,
        textHeight: 57,
        textFontSize: 48,
        socialX: 244,
        socialY: 326,
        socialHandlesFontSize: 16,
        logoX: 392,
        logoY: 149,
        logoWidth: 32,
        logoHeight: 32,
      }
  }
}

export const getSocialHandlePositions = ({
  layout,
  socialHandles,
  noOfSocialHandles,
  isShorts,
  textProperties,
  availableWidth,
  availableHeight,
  socialX,
  socialY,
}: {
  layout: Layout
  socialHandles: SocialHandles
  noOfSocialHandles: number
  isShorts: boolean
  textProperties: {
    textFontSize: number
    textFontFamily?: string
    textFontStyle?: string
  }
  availableWidth: number
  availableHeight: number
  socialX: number
  socialY: number
}) => {
  switch (layout) {
    case 'classic': {
      const twitterHandleWidth = getTextWidth({
        isShorts,
        text: socialHandles.twitterHandle || '',
        textProperties,
      })
      const discordHandleWidth = getTextWidth({
        isShorts,
        text: socialHandles.discordHandle || '',
        textProperties,
      })
      const youtubeHandleWidth = getTextWidth({
        isShorts,
        text: socialHandles.youtubeHandle || '',
        textProperties,
      })
      const socialHandlesPositionInfo = {
        twitterX: 0,
        twitterY: 0,
        discordX: 0,
        discordY: 0,
        youtubeX: 0,
        youtubeY: 0,
      }
      if (!isShorts) {
        const consumedWidth =
          24 * (noOfSocialHandles * 2 - 1) +
          8 * noOfSocialHandles +
          twitterHandleWidth +
          discordHandleWidth +
          youtubeHandleWidth
        let startX = (availableWidth - consumedWidth) / 2

        Object.entries(socialHandles).forEach(([key, value]) => {
          if (key === 'twitterHandle' && value) {
            socialHandlesPositionInfo.twitterX = startX
            socialHandlesPositionInfo.twitterY = socialY
            startX +=
              24 +
              4 +
              getTextWidth({
                isShorts,
                text: value,
                textProperties,
              }) +
              24
          }
          if (key === 'discordHandle' && value) {
            socialHandlesPositionInfo.discordX = startX
            socialHandlesPositionInfo.discordY = socialY
            startX +=
              24 +
              4 +
              getTextWidth({
                isShorts,
                text: value,
                textProperties,
              }) +
              24
          }
          if (key === 'youtubeHandle' && value) {
            socialHandlesPositionInfo.youtubeX = startX
            socialHandlesPositionInfo.youtubeY = socialY
            startX +=
              24 +
              4 +
              getTextWidth({
                isShorts,
                text: value,
                textProperties,
              }) +
              24
          }
        })
        return socialHandlesPositionInfo
      }
      const maxSocialHandleWidth = Math.max(
        twitterHandleWidth,
        discordHandleWidth,
        youtubeHandleWidth
      )
      const startX = (availableWidth - maxSocialHandleWidth - 24 - 8) / 2
      let startY = socialY
      Object.entries(socialHandles).forEach(([key, value]) => {
        if (key === 'twitterHandle' && value) {
          socialHandlesPositionInfo.twitterX = startX
          socialHandlesPositionInfo.twitterY = startY
          startY += 24 + 8
        }
        if (key === 'discordHandle' && value) {
          socialHandlesPositionInfo.discordX = startX
          socialHandlesPositionInfo.discordY = startY
          startY += 24 + 8
        }
        if (key === 'youtubeHandle' && value) {
          socialHandlesPositionInfo.youtubeX = startX
          socialHandlesPositionInfo.youtubeY = startY
          startY += 24 + 8
        }
      })
      return socialHandlesPositionInfo
    }
    case 'float-full-right':
    case 'float-full-left':
    case 'split-without-media':
    case 'split': {
      const consumedHeight =
        28 + 24 * noOfSocialHandles + 16 * (noOfSocialHandles - 1)
      let startY = availableHeight - consumedHeight
      const socialHandlesPositionInfo = {
        twitterX: 0,
        twitterY: 0,
        discordX: 0,
        discordY: 0,
        youtubeX: 0,
        youtubeY: 0,
      }
      Object.entries(socialHandles).forEach(([key, value]) => {
        if (key === 'twitterHandle' && value) {
          socialHandlesPositionInfo.twitterX = socialX
          socialHandlesPositionInfo.twitterY = startY
          startY += 24 + 16
        }
        if (key === 'discordHandle' && value) {
          socialHandlesPositionInfo.discordX = socialX
          socialHandlesPositionInfo.discordY = startY
          startY += 24 + 16
        }
        if (key === 'youtubeHandle' && value) {
          socialHandlesPositionInfo.youtubeX = socialX
          socialHandlesPositionInfo.youtubeY = startY
          startY += 24 + 16
        }
      })
      return socialHandlesPositionInfo
    }
    default: {
      return {
        twitterX: 0,
        twitterY: 0,
        discordX: 0,
        discordY: 0,
        youtubeX: 0,
        youtubeY: 0,
      }
    }
  }
}

export const getTextWidth = ({
  isShorts,
  text,
  textProperties,
}: {
  isShorts: boolean
  text: string
  textProperties: {
    textFontSize: number
    textFontFamily?: string
    textFontStyle?: string
  }
}) => {
  const layer = new Konva.Layer({
    width: !isShorts ? CONFIG.width : SHORTS_CONFIG.width,
    height: !isShorts ? CONFIG.height : SHORTS_CONFIG.height,
  })
  const konvaText = new Konva.Text({
    text,
    fontSize: textProperties.textFontSize,
    fontFamily: textProperties.textFontFamily,
    fontStyle: textProperties.textFontStyle,
  })
  layer.add(konvaText)

  return konvaText.textWidth
}
