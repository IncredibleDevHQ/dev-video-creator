import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'

export interface ObjectConfig {
  x: number
  y: number
  width: number
  height: number
  borderRadius: number
  color?: string
}

export const FragmentLayoutConfig = ({
  theme,
  layout,
  isShorts,
}: {
  theme: ThemeFragment
  layout: Layout
  isShorts?: boolean
}): ObjectConfig => {
  if (isShorts) {
    switch (layout) {
      case 'classic':
      case 'padded-bottom-right-circle':
      case 'padded-bottom-right-tile':
        return {
          x: 16,
          y: 16,
          width: 364,
          height: 672,
          borderRadius: 8,
        }
      case 'bottom-right-tile':
      case 'bottom-right-circle':
        return {
          x: 0,
          y: 0,
          width: 396,
          height: 704,
          borderRadius: 8,
        }
      case 'split':
        return {
          x: 16,
          y: 12,
          width: 364,
          height: 336,
          borderRadius: 8,
        }
      case 'full':
        return {
          x: 16,
          y: 24,
          width: 364,
          height: 280,
          borderRadius: 8,
        }
      default:
        return {
          x: 16,
          y: 16,
          width: 364,
          height: 672,
          borderRadius: 8,
        }
    }
  }
  switch (theme.name) {
    case 'DarkGradient':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 8,
            color: '#182E42',
          }
        case 'float-full-right':
          return {
            x: 32,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 8,
          }
        case 'float-full-left':
          return {
            x: 288,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 8,
          }
        case 'float-half-right':
          return {
            x: 32,
            y: 45,
            width: 800,
            height: 450,
            borderRadius: 8,
          }
        case 'padded-bottom-right-tile':
        case 'padded-bottom-right-circle':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            borderRadius: 8,
          }
        case 'bottom-right-tile':
        case 'bottom-right-circle':
          return {
            x: 0,
            y: 0,
            width: 960,
            height: 540,
            borderRadius: 0,
          }
        case 'padded-split':
          return {
            x: 40,
            y: 112.5,
            width: 560,
            height: 315,
            borderRadius: 8,
          }
        case 'split':
          return {
            x: 0,
            y: 130,
            width: 480,
            height: 280,
            borderRadius: 0,
          }
        case 'full':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 8,
          }
        default:
          return {
            x: 288,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 8,
          }
      }
    case 'PastelLines':
      switch (layout) {
        case 'classic':
          return {
            x: 64,
            y: 36,
            width: 832,
            height: 468,
            borderRadius: 0,
          }
        case 'float-full-right':
          return {
            x: 64,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 0,
          }
        case 'float-full-left':
          return {
            x: 288,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 0,
          }
        case 'float-half-right':
          return {
            x: 64,
            y: 63,
            width: 736,
            height: 414,
            borderRadius: 0,
          }
        case 'padded-bottom-right-tile':
        case 'padded-bottom-right-circle':
        case 'bottom-right-tile':
        case 'bottom-right-circle':
          return {
            x: 64,
            y: 36,
            width: 832,
            height: 468,
            borderRadius: 0,
          }
        case 'padded-split':
          return {
            x: 40,
            y: 112.5,
            width: 560,
            height: 315,
            borderRadius: 0,
          }
        case 'split':
          return {
            x: 0,
            y: 130,
            width: 480,
            height: 280,
            borderRadius: 0,
          }
        case 'full':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 0,
          }
        default:
          return {
            x: 288,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 0,
          }
      }
    default:
      return {
        x: 56,
        y: 32,
        width: 848,
        height: 477,
        borderRadius: 8,
      }
  }
}
