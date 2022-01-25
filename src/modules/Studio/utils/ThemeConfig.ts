import { VideoTheme } from '../../../utils/configTypes'
import { StudioUserConfig } from '../components/Concourse'
import { ObjectConfig } from './FragmentLayoutConfig'

export interface ObjectRenderConfig {
  startX: number
  startY: number
  availableWidth: number
  availableHeight: number
  textColor: string
  pointsBulletColor?: string
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
  theme: VideoTheme
  layoutConfig: ObjectConfig
}): ObjectRenderConfig => {
  switch (theme) {
    case 'glassy':
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y + 40,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height - 40,
        textColor: '#ffffff',
        pointsBulletColor: '#713654',
      }
    default:
      return {
        startX: layoutConfig.x,
        startY: layoutConfig.y,
        availableWidth: layoutConfig.width,
        availableHeight: layoutConfig.height,
        textColor: '#ffffff',
      }
  }
}

export const ThemeUserMediaConfig = ({
  theme,
  studioUserConfig,
}: {
  theme: VideoTheme
  studioUserConfig: StudioUserConfig
}): StudioUserThemeConfig => {
  const { x, y, studioUserClipConfig } = studioUserConfig
  switch (theme) {
    case 'glassy':
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
