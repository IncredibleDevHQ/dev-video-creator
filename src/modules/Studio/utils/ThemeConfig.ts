import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { StudioUserConfig } from '../components/Concourse'
import { ObjectConfig } from './FragmentLayoutConfig'
import { PointsConfig } from './PointsConfig'

export interface ObjectRenderConfig {
  startX: number
  startY: number
  availableWidth: number
  availableHeight: number
  textColor: string
  surfaceColor: string
  surfaceOpacity?: number
  borderRadius?: number
  titleFont?: string
  bodyFont?: string
  pointsBulletColor?: string
  pointsBulletCornerRadius?: number
  pointsBulletRotation?: number
  pointsBulletYOffset?: number
  horizontalPointsBulletColor?: string
  horizontalPointsNumberColor?: string
  horizontalPointsBulletXOffset?: number
  horizontalPointsBulletYOffset?: number
  horizontalPointsBulletCornerRadius?: number
}

export interface StudioUserThemeConfig {
  borderColor?: string
  borderWidth?: number
  backgroundRectX?: number
  backgroundRectY?: number
  backgroundRectWidth?: number
  backgroundRectHeight?: number
  backgroundRectColor?: string
  backgroundRectOpacity?: number
  backgroundRectBorderRadius?: number
  backgroundRectBorderColor?: string
  backgroundRectBorderWidth?: number
}

export const ThemeLayoutConfig = ({
  theme,
  layoutConfig,
  pointsConfig,
}: {
  theme: ThemeFragment
  layoutConfig: ObjectConfig
  pointsConfig?: PointsConfig
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
        horizontalPointsBulletCornerRadius: 8,
      }
    case 'PastelLines':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#27272A',
        borderRadius: 0,
        surfaceColor: '',
        pointsBulletColor: '#27272A',
        pointsBulletCornerRadius: 6,
        pointsBulletYOffset: 3.5,
        horizontalPointsBulletCornerRadius: 0,
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
        horizontalPointsBulletCornerRadius: 16,
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
        horizontalPointsNumberColor: '#ffffff',
        pointsBulletRotation: -45,
        pointsBulletYOffset: 9,
        horizontalPointsBulletColor: '#0EBAC5',
        horizontalPointsBulletXOffset: pointsConfig
          ? pointsConfig?.bulletWidth / 2
          : 0,
        horizontalPointsBulletYOffset: pointsConfig
          ? pointsConfig?.bulletHeight / 2
          : 0,
        horizontalPointsBulletCornerRadius: 4,
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

export const getThemeTextColor = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
      return '#ffffff'
    case 'PastelLines':
      return '#27272A'
    case 'Cassidoo':
      return '#27272A'
    case 'LambdaTest':
      return '#27272A'
    default:
      return '#ffffff'
  }
}

export const getThemeSurfaceColor = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
      return '#151D2C'
    case 'PastelLines':
      return ''
    case 'Cassidoo':
      return '#fafafa'
    case 'LambdaTest':
      return '#ffffff'
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
      return 'Inter'
    default:
      return 'Gilroy'
  }
}

export const ThemeUserMediaConfig = ({
  theme,
  studioUserConfig,
}: {
  theme: ThemeFragment
  studioUserConfig: StudioUserConfig
}): StudioUserThemeConfig => {
  const { x, y, studioUserClipConfig } = studioUserConfig
  switch (theme.name) {
    case 'DarkGradient':
      if (!studioUserClipConfig) return {}
      if (!studioUserClipConfig.width || !studioUserClipConfig.height) return {}
      return {
        backgroundRectX: studioUserClipConfig?.x + x - 16,
        backgroundRectY: studioUserClipConfig?.y + y - 16,
        backgroundRectWidth: studioUserClipConfig?.width + 32,
        backgroundRectHeight: studioUserClipConfig?.height + 32,
        backgroundRectBorderRadius: studioUserClipConfig?.borderRadius,
        backgroundRectColor: '#ffffff',
        backgroundRectOpacity: 0.3,
      }
    default:
      return {}
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
    default:
      return []
  }
}
