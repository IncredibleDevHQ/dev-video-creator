import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { StudioUserConfig } from '../components/Concourse'
import { ObjectConfig } from './FragmentLayoutConfig'

export interface ObjectRenderConfig {
  startX: number
  startY: number
  availableWidth: number
  availableHeight: number
  textColor: string
  surfaceColor: string
  pointsBulletColor?: string
  borderRadius?: number
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
}: {
  theme: ThemeFragment
  layoutConfig: ObjectConfig
}): ObjectRenderConfig => {
  switch (theme.name) {
    case 'DarkGradient':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y + 40,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height - 40,
        textColor: '#ffffff',
        surfaceColor: '#151D2C',
        pointsBulletColor: '#713654',
        borderRadius: layoutConfig.borderRadius,
      }
    case 'PastelLines':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#27272A',
        pointsBulletColor: '#27272A',
        borderRadius: layoutConfig.borderRadius,
        surfaceColor: '',
      }
    default:
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height,
        surfaceColor: '',
        textColor: '#ffffff',
      }
  }
}

export const getThemeTextColor = (theme: ThemeFragment): string => {
  switch (theme.name) {
    case 'DarkGradient':
      return '#ffffff'
    case 'PastelLines':
      return '#27272A'
    default:
      return '#ffffff'
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
        'bottom-right-tile',
        'padded-split',
        'padded-bottom-right-circle',
        'bottom-right-circle',
        'split',
        'full',
      ]
    case 'PastelLines':
      return [
        'classic',
        'float-full-right',
        'float-half-right',
        'bottom-right-tile',
        'bottom-right-circle',
        'full',
      ]
    default:
      return []
  }
}
