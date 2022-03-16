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
  surfaceOpacity?: number
  pointsBulletColor?: string
  borderRadius?: number
  titleFont?: string
  bodyFont?: string
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
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height - 40,
        textColor: '#ffffff',
        surfaceColor: '#151D2C',
        pointsBulletColor: '#713654',
        borderRadius: layoutConfig.borderRadius,
        titleFont: 'Gilroy',
        bodyFont: 'GilroyRegular',
      }
    case 'PastelLines':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#27272A',
        pointsBulletColor: '#27272A',
        borderRadius: layoutConfig.borderRadius,
        surfaceColor: '',
      }
    case 'Cassidoo':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y + 56,
        availableWidth: layoutConfig?.availableWidth || layoutConfig.width,
        availableHeight: layoutConfig.height - 56,
        textColor: '#374151',
        pointsBulletColor: '#374151',
        borderRadius: layoutConfig.borderRadius,
        surfaceColor: '#fafafa',
        surfaceOpacity: 0.8,
        titleFont: 'Roboto Mono',
        bodyFont: 'Roboto Mono',
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
    case 'Cassidoo':
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
    case 'Cassidoo':
      return [
        'classic',
        'float-full-right',
        'float-full-left',
        'float-half-right',
        'padded-bottom-right-circle',
        'bottom-right-circle',
        'padded-split',
        'full',
      ]
    default:
      return []
  }
}
