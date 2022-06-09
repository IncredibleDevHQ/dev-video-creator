import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { ObjectConfig } from './FragmentLayoutConfig'
import { getCanvasGradient } from './StudioUserConfig'

export interface ObjectRenderConfig {
  startX: number
  startY: number
  availableWidth: number
  availableHeight: number
  textColor: string
  surfaceColor: string
  surfaceOpacity?: number
  // used only as the border radius of the video
  borderRadius?: number
  titleFont?: string
  bodyFont?: string
  pointsBulletColor?: string | CanvasGradient
  pointsBulletCornerRadius?: number
  pointsBulletRotation?: number
  pointsBulletYOffset?: number
  // these bottom 4 are for the rectangle that contains the points
  horizontalPointRectColor?: string | CanvasGradient
  horizontalPointRectStrokeColor?: string | CanvasGradient
  horizontalPointRectCornerRadius?: number
  horizontalPointsTextColor?: string
  horizontalPointTextVerticalAlign?: string
  // block title config
  blockTitleFontSize?: number
  blockTitleHeight?: number
}

export const ThemeLayoutConfig = ({
  theme,
  layoutConfig,
}: {
  theme: ThemeFragment
  layoutConfig: ObjectConfig
}): ObjectRenderConfig => {
  switch (theme.name) {
    case 'DarkGradient':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y + 40,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height - 40,
        textColor: '#ffffff',
        surfaceColor: '#151D2C',
        borderRadius: 8,
        titleFont: 'Gilroy',
        bodyFont: 'GilroyRegular',
        pointsBulletColor: '#4B5563',
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectStrokeColor: '#ffffff',
        horizontalPointRectCornerRadius: 8,
      }
    case 'PastelLines':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#27272A',
        borderRadius: 0,
        titleFont: 'Gilroy',
        bodyFont: 'GilroyRegular',
        surfaceColor: '#E0D6ED7B',
        pointsBulletColor: '#27272A',
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectStrokeColor: '#ffffff',
        horizontalPointRectCornerRadius: 0,
      }
    case 'Cassidoo':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y + 56,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height - 56,
        textColor: '#374151',
        borderRadius: 16,
        surfaceColor: '#fafafa',
        surfaceOpacity: 0.8,
        titleFont: 'Roboto Mono',
        bodyFont: 'Roboto Mono',
        pointsBulletColor: '#374151',
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectStrokeColor: '#ffffff',
        horizontalPointRectCornerRadius: 16,
      }
    case 'LambdaTest':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#27272A',
        surfaceColor: '#ffffff',
        borderRadius: 16,
        titleFont: 'Inter',
        bodyFont: 'GilroyRegular',
        pointsBulletColor: '#0EBAC5',
        pointsBulletCornerRadius: 2,
        pointsBulletRotation: -45,
        pointsBulletYOffset: 9,
        horizontalPointRectStrokeColor: getCanvasGradient(
          [
            { color: '#8BCBF9', offset: 0.0 },
            { color: '#5A80D6', offset: 0.5204 },
            { color: '#B7AEFA', offset: 1 },
          ],
          {
            x0: 0,
            y0: 0,
            x1: 248,
            y1: 80,
          }
        ),
        horizontalPointRectCornerRadius: 4,
      }
    case 'LeeRob':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
        borderRadius: 0,
        surfaceColor: layoutConfig?.surfaceColor || '',
        titleFont: 'Inter',
        bodyFont: 'Inter',
        pointsBulletColor: getCanvasGradient(
          [
            { color: '#EA369B', offset: 0.0 },
            { color: '#8165D6', offset: 0.5208 },
            { color: '#48A8F6', offset: 0.8764 },
          ],
          {
            x0: 0,
            y0: 6,
            x1: 12,
            y1: 6,
          }
        ),
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectStrokeColor: '',
        horizontalPointRectCornerRadius: 0,
        horizontalPointTextVerticalAlign: 'top',
      }
    case 'Web3Auth':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
        borderRadius: 0,
        surfaceColor: layoutConfig?.surfaceColor || '',
        titleFont: 'DM Sans',
        bodyFont: 'DM Sans',
        pointsBulletColor: getCanvasGradient(
          [
            { color: '#0364FF', offset: 0.0 },
            { color: '#1AC7FE', offset: 1 },
          ],
          {
            x0: 0,
            y0: 6,
            x1: 12,
            y1: 6,
          }
        ),
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectColor: '#fafafa19',
        horizontalPointRectStrokeColor: '#ffffff',
        horizontalPointRectCornerRadius: 4,
      }
    case 'DevsForUkraine':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
        borderRadius: 8,
        surfaceColor: layoutConfig?.surfaceColor || '',
        titleFont: 'Montserrat',
        bodyFont: 'Inter',
        pointsBulletColor: '#E2CE68',
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointRectStrokeColor: '',
        horizontalPointRectCornerRadius: 0,
        horizontalPointTextVerticalAlign: 'top',
      }
    case 'Whitep4nth3r':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
        borderRadius: 0,
        surfaceColor: '#0F111A7B',
        titleFont: 'Work Sans',
        bodyFont: 'Work Sans',
        pointsBulletColor: '#FFB626',
        pointsBulletCornerRadius: 0,
        pointsBulletYOffset: 9,
        horizontalPointRectColor: '#2C2E39',
        horizontalPointRectStrokeColor: '',
        horizontalPointRectCornerRadius: 8,
        horizontalPointTextVerticalAlign: 'middle',
        blockTitleFontSize: 32,
      }
    case 'VetsWhoCode':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: layoutConfig?.textColor || '#ffffff',
        borderRadius: 0,
        surfaceColor: layoutConfig?.surfaceColor || '',
        titleFont: 'Gotham',
        bodyFont: 'GothamLight',
        pointsBulletColor: '#C5203E',
        pointsBulletCornerRadius: 0,
        pointsBulletYOffset: 8.5,
        horizontalPointRectColor: '#ffffff',
        horizontalPointRectStrokeColor: '',
        horizontalPointRectCornerRadius: 8,
        horizontalPointsTextColor: '#091F40',
        horizontalPointTextVerticalAlign: 'middle',
      }
    case 'ShrutiKapoor':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
        borderRadius: 0,
        surfaceColor: layoutConfig?.surfaceColor || '',
        titleFont: 'Space Mono',
        bodyFont: 'Space Mono',
        pointsBulletColor: '#ffffff',
        pointsBulletCornerRadius: 0,
        pointsBulletYOffset: 8,
        horizontalPointRectColor: '#fafafa19',
        horizontalPointRectStrokeColor: getCanvasGradient(
          [
            { color: '#FAFAFABF', offset: 0.0 },
            { color: '#FFFFFF00', offset: 1 },
          ],
          {
            x0: 124,
            y0: 0,
            x1: 124,
            y1: 80,
          }
        ),
        horizontalPointRectCornerRadius: 0,
        horizontalPointsTextColor: '#ffffff',
        horizontalPointTextVerticalAlign: 'middle',
      }
    case 'Mux':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#383838',
        borderRadius: 0,
        surfaceColor: '#FAFAFC',
        titleFont: 'Work Sans',
        bodyFont: 'Work Sans',
        pointsBulletColor: getCanvasGradient(
          [
            { color: '#EB4F3E', offset: 0.0 },
            { color: '#EB4463', offset: 0.7604 },
          ],
          {
            x0: 0,
            y0: 6,
            x1: 12,
            y1: 6,
          }
        ),
        pointsBulletCornerRadius: 0,
        pointsBulletYOffset: 3.5,
        horizontalPointRectColor: '#FAFAFC',
        horizontalPointRectStrokeColor: '#D4D4D8',
        horizontalPointRectCornerRadius: 6,
        horizontalPointsTextColor: '#383838',
        horizontalPointTextVerticalAlign: 'middle',
      }
    default:
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height,
        surfaceColor: '',
        textColor: '#ffffff',
        titleFont: 'Gilroy',
        bodyFont: 'GilroyRegular',
      }
  }
}

// used in intro and outro fragments
export const getThemeTextColor = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
    case 'LeeRob':
    case 'Web3Auth':
    case 'DevsForUkraine':
    case 'Whitep4nth3r':
    case 'ShrutiKapoor':
      return '#ffffff'
    case 'PastelLines':
      return '#27272A'
    case 'Cassidoo':
      return '#27272A'
    case 'LambdaTest':
      return '#27272A'
    case 'VetsWhoCode':
      return '#091F40'
    case 'Mux':
      return '#383838'
    default:
      return '#ffffff'
  }
}

// used in intro and outro fragments
export const getThemeSurfaceColor = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
      return '#151D2C'
    case 'PastelLines':
    case 'LeeRob':
    case 'Web3Auth':
    case 'DevsForUkraine':
    case 'Whitep4nth3r':
    case 'ShrutiKapoor':
      return ''
    case 'Cassidoo':
      return '#fafafa'
    case 'LambdaTest':
    case 'VetsWhoCode':
      return '#ffffff'
    case 'Mux':
      return '#FAFAFC'
    default:
      return '#ffffff'
  }
}

export const getThemeFont = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
      return 'Gilroy'
    case 'PastelLines':
      return 'Outfit'
    case 'Cassidoo':
      return 'Roboto Mono'
    case 'LambdaTest':
    case 'LeeRob':
      return 'Inter'
    case 'Web3Auth':
      return 'DM Sans'
    case 'DevsForUkraine':
      return 'Montserrat'
    case 'Whitep4nth3r':
    case 'Mux':
      return 'Work Sans'
    case 'VetsWhoCode':
      return 'Gotham'
    case 'ShrutiKapoor':
      return 'Space Mono'
    default:
      return 'Gilroy'
  }
}

export const getThemeSupportedUserMediaLayouts = (
  themeName: string
): Layout[] => {
  switch (themeName) {
    case 'DarkGradient':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'padded-bottom-right-circle',
        'bottom-right-tile',
        'bottom-right-circle',
        'padded-split',
        'split',
        'full-left',
        'full-right',
      ]
    case 'PastelLines':
      return [
        'classic',
        'float-full-right',
        'float-half-right',
        'bottom-right-tile',
        'bottom-right-circle',
        'full-left',
        'full-right',
      ]
    case 'Cassidoo':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-circle',
        'bottom-right-circle',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'LambdaTest':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'bottom-right-tile',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'LeeRob':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'Web3Auth':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'padded-bottom-right-circle',
        'bottom-right-tile',
        'bottom-right-circle',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'DevsForUkraine':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        // 'padded-bottom-right-circle',
        'bottom-right-tile',
        // 'bottom-right-circle',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'Whitep4nth3r':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'VetsWhoCode':
      return [
        'classic',
        'float-full-right',
        'float-half-right',
        'padded-bottom-right-circle',
        'split',
        'full-left',
        'full-right',
      ]
    case 'ShrutiKapoor':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'bottom-right-tile',
        'padded-split',
        'full-left',
        'full-right',
      ]
    case 'Mux':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-tile',
        'padded-split',
        'full-left',
        'full-right',
      ]
    default:
      return []
  }
}

export const getThemeBasedIntroLayouts = (themeName: string): Layout[] => {
  switch (themeName) {
    case 'DarkGradient':
    case 'PastelLines':
    case 'Cassidoo':
    case 'LambdaTest':
    case 'LeeRob':
    case 'Web3Auth':
      return ['bottom-right-tile', 'float-full-right']
    case 'DevsForUkraine':
    case 'Whitep4nth3r':
      return ['classic', 'bottom-right-tile']
    case 'VetsWhoCode':
      return ['classic', 'bottom-right-circle', 'float-full-right']
    case 'ShrutiKapoor':
    case 'Mux':
      return ['classic', 'bottom-right-tile', 'float-full-right']
    default:
      return []
  }
}
