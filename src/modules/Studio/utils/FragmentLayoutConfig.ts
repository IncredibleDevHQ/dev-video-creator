import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { getCanvasGradient } from './StudioUserConfig'

export interface ObjectConfig {
  x: number
  y: number
  width: number
  height: number
  availableWidth?: number
  availableHeight?: number
  borderRadius: number
  borderColor?: CanvasGradient | string
  surfaceColor?: string
  textColor?: string
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
    switch (theme.name) {
      case 'DarkGradient':
      case 'DevsForUkraine':
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
              borderRadius: 0,
            }
          case 'split':
            return {
              x: 16,
              y: 12,
              width: 364,
              height: 336,
              borderRadius: 8,
            }
          case 'full-left':
            return {
              x: 16,
              y: 24,
              width: 364,
              height: 280,
              borderRadius: 8,
              surfaceColor: theme.name === 'DevsForUkraine' ? '#1c1c1c7B' : '',
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
      case 'PastelLines':
        switch (layout) {
          case 'classic':
          case 'padded-bottom-right-circle':
          case 'padded-bottom-right-tile':
          case 'bottom-right-tile':
          case 'bottom-right-circle':
            return {
              x: 40,
              y: 40,
              width: 316,
              height: 624,
              borderRadius: 0,
            }
          case 'split':
          case 'full-left':
            return {
              x: 40,
              y: 40,
              width: 316,
              height: 312,
              borderRadius: 0,
            }
          default:
            return {
              x: 40,
              y: 40,
              width: 316,
              height: 624,
              borderRadius: 0,
            }
        }
      case 'Cassidoo':
        switch (layout) {
          case 'classic':
          case 'padded-bottom-right-circle':
          case 'padded-bottom-right-tile':
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 16,
            }
          case 'bottom-right-tile':
          case 'bottom-right-circle':
            return {
              x: 0,
              y: 0,
              width: 396,
              height: 704,
              borderRadius: 0,
            }
          case 'split':
            return {
              x: 16,
              y: 12,
              width: 364,
              height: 336,
              borderRadius: 16,
            }
          case 'full-left':
            return {
              x: 16,
              y: 24,
              width: 364,
              height: 280,
              borderRadius: 16,
            }
          default:
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 16,
            }
        }
      case 'LambdaTest':
        switch (layout) {
          case 'classic':
          case 'padded-bottom-right-circle':
          case 'padded-bottom-right-tile':
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 16,
            }
          case 'bottom-right-tile':
          case 'bottom-right-circle':
            return {
              x: 0,
              y: 0,
              width: 396,
              height: 704,
              borderRadius: 0,
            }
          case 'split':
            return {
              x: 16,
              y: 12,
              width: 364,
              height: 336,
              borderRadius: 16,
            }
          case 'full-left':
            return {
              x: 16,
              y: 24,
              width: 364,
              height: 280,
              borderRadius: 16,
            }
          default:
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 16,
            }
        }
      case 'LeeRob':
      case 'Web3Auth':
      case 'Whitep4nth3r':
        switch (layout) {
          case 'classic':
          case 'padded-bottom-right-circle':
          case 'padded-bottom-right-tile':
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 0,
            }
          case 'bottom-right-tile':
          case 'bottom-right-circle':
            return {
              x: 0,
              y: 0,
              width: 396,
              height: 704,
              borderRadius: 0,
            }
          case 'split':
            return {
              x: 16,
              y: 12,
              width: 364,
              height: 336,
              borderRadius: 0,
            }
          case 'full-left':
            return {
              x: 16,
              y: 24,
              width: 364,
              height: 280,
              borderRadius: 0,
            }
          default:
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 0,
            }
        }
      case 'VetsWhoCode':
        switch (layout) {
          case 'classic':
          case 'padded-bottom-right-circle':
          case 'padded-bottom-right-tile':
            return {
              x: 24,
              y: 24,
              width: 348,
              height: 656,
              borderRadius: 0,
            }
          case 'bottom-right-tile':
          case 'bottom-right-circle':
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 0,
            }
          case 'split':
            return {
              x: 16,
              y: 12,
              width: 364,
              height: 336,
              borderRadius: 0,
            }
          case 'full-left':
            return {
              x: 16,
              y: 24,
              width: 364,
              height: 280,
              borderRadius: 0,
            }
          default:
            return {
              x: 16,
              y: 16,
              width: 364,
              height: 672,
              borderRadius: 0,
            }
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
    case 'DevsForUkraine':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 8,
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
            availableWidth: 650,
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
        case 'full-left':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 8,
            surfaceColor: theme.name === 'DevsForUkraine' ? '#1c1c1c7B' : '',
          }
        case 'full-right':
          return {
            x: 420,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 8,
            surfaceColor: theme.name === 'DevsForUkraine' ? '#1c1c1c7B' : '',
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
        // case 'float-full-left':
        //   return {
        //     x: 288,
        //     y: 90,
        //     width: 640,
        //     height: 360,
        //     borderRadius: 0,
        //   }
        case 'float-half-right':
          return {
            x: 64,
            y: 63,
            width: 736,
            height: 414,
            availableWidth: 630,
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
        // case 'padded-split':
        //   return {
        //     x: 40,
        //     y: 112.5,
        //     width: 560,
        //     height: 315,
        //     borderRadius: 0,
        //   }
        // case 'split':
        //   return {
        //     x: 0,
        //     y: 130,
        //     width: 480,
        //     height: 280,
        //     borderRadius: 0,
        //   }
        case 'full-left':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 0,
            borderColor: '#000000',
          }
        case 'full-right':
          return {
            x: 420,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 0,
            borderColor: '#000000',
          }
        default:
          return {
            x: 64,
            y: 36,
            width: 832,
            height: 468,
            borderRadius: 0,
          }
      }
    case 'Cassidoo':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 16,
          }
        case 'float-full-right':
          return {
            x: 40,
            y: 60,
            width: 540,
            height: 420,
            borderRadius: 16,
          }
        case 'float-full-left':
          return {
            x: 390,
            y: 60,
            width: 540,
            height: 420,
            borderRadius: 16,
          }
        case 'float-half-right':
          return {
            x: 32,
            y: 45,
            width: 780,
            height: 450,
            availableWidth: 630,
            borderRadius: 16,
          }
        // case 'padded-bottom-right-tile':
        case 'padded-bottom-right-circle':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            borderRadius: 16,
          }
        // case 'bottom-right-tile':
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
            width: 544,
            height: 315,
            borderRadius: 16,
          }
        case 'full-left':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 16,
          }
        case 'full-right':
          return {
            x: 420,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 16,
          }
        default:
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 16,
          }
      }
    case 'LambdaTest':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 16,
          }
        case 'float-full-right':
          return {
            x: 32,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 16,
          }
        case 'float-full-left':
          return {
            x: 288,
            y: 90,
            width: 640,
            height: 360,
            borderRadius: 16,
          }
        case 'float-half-right':
          return {
            x: 32,
            y: 45,
            width: 800,
            height: 450,
            availableWidth: 650,
            borderRadius: 16,
          }
        case 'padded-bottom-right-tile':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            borderRadius: 16,
          }
        case 'bottom-right-tile':
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
            borderRadius: 16,
          }
        case 'full-left':
          return {
            x: 40,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 16,
          }
        case 'full-right':
          return {
            x: 420,
            y: 120,
            width: 500,
            height: 300,
            borderRadius: 16,
          }
        default:
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 16,
          }
      }
    case 'LeeRob':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
        case 'float-full-right':
          return {
            x: 32,
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
            x: 32,
            y: 45,
            width: 800,
            height: 450,
            availableWidth: 650,
            borderRadius: 0,
          }
        case 'padded-bottom-right-tile':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            availableWidth: 750,
            borderRadius: 0,
          }
        case 'padded-split':
          return {
            x: 40,
            y: 80,
            width: 560,
            height: 380,
            borderRadius: 0,
          }
        case 'full-left':
          return {
            x: 40,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 0,
            surfaceColor: '#0000007B',
            borderColor: getCanvasGradient(
              [
                { color: '#DB1685', offset: 0.0 },
                { color: '#8165D6', offset: 0.5208 },
                { color: '#48A8F6', offset: 0.9583 },
              ],
              {
                x0: 40,
                y0: 90,
                x1: 500,
                y1: 360,
              }
            ),
          }
        case 'full-right':
          return {
            x: 420,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 0,
            surfaceColor: '#0000007B',
            borderColor: getCanvasGradient(
              [
                { color: '#DB1685', offset: 0.0 },
                { color: '#8165D6', offset: 0.5208 },
                { color: '#48A8F6', offset: 0.9583 },
              ],
              {
                x0: 40,
                y0: 90,
                x1: 500,
                y1: 360,
              }
            ),
          }
        default:
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
      }
    case 'Web3Auth':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
        case 'float-full-right':
          return {
            x: 32,
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
            x: 32,
            y: 45,
            width: 800,
            height: 450,
            availableWidth: 650,
            borderRadius: 0,
          }
        case 'padded-bottom-right-tile':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            availableWidth: 750,
            borderRadius: 0,
          }
        case 'padded-split':
          return {
            x: 40,
            y: 80,
            width: 560,
            height: 380,
            borderRadius: 0,
          }
        case 'full-left':
          return {
            x: 40,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 0,
            surfaceColor: '#27272A7B',
            borderColor: '#ffffff',
          }
        case 'full-right':
          return {
            x: 420,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 0,
            surfaceColor: '#27272A7B',
            borderColor: '#ffffff',
          }
        default:
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
      }
    case 'Whitep4nth3r':
      switch (layout) {
        case 'classic':
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
        case 'float-full-right':
          return {
            x: 32,
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
            x: 32,
            y: 45,
            width: 800,
            height: 450,
            availableWidth: 650,
            borderRadius: 0,
          }
        case 'padded-bottom-right-tile':
          return {
            x: 72,
            y: 41,
            width: 816,
            height: 459,
            availableWidth: 750,
            borderRadius: 0,
          }
        case 'padded-split':
          return {
            x: 40,
            y: 80,
            width: 560,
            height: 380,
            borderRadius: 0,
          }
        case 'full-left':
          return {
            x: 40,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 8,
          }
        case 'full-right':
          return {
            x: 420,
            y: 90,
            width: 500,
            height: 360,
            borderRadius: 8,
          }
        default:
          return {
            x: 56,
            y: 32,
            width: 848,
            height: 477,
            borderRadius: 0,
          }
      }
    case 'VetsWhoCode':
      switch (layout) {
        case 'classic':
          return {
            x: 64,
            y: 65,
            width: 832,
            height: 410,
            borderRadius: 0,
          }
        case 'float-full-right':
          return {
            x: 64,
            y: 65,
            width: 512,
            height: 408,
            borderRadius: 0,
          }
        case 'float-half-right':
          return {
            x: 64,
            y: 65,
            width: 632,
            height: 408,
            availableWidth: 570,
            borderRadius: 0,
          }
        case 'padded-bottom-right-circle':
          return {
            x: 64,
            y: 65,
            width: 832,
            height: 410,
            availableWidth: 600,
            borderRadius: 0,
          }
        case 'split':
          return {
            x: 64,
            y: 65,
            width: 554,
            height: 410,
            borderRadius: 0,
          }
        case 'full-left':
          return {
            x: 40,
            y: 83,
            width: 440,
            height: 373,
            borderRadius: 0,
            surfaceColor: '#fcfcfccc',
            textColor: '#383838',
          }
        case 'full-right':
          return {
            x: 460,
            y: 83,
            width: 440,
            height: 373,
            borderRadius: 0,
            surfaceColor: '#fcfcfccc',
            textColor: '#383838',
          }
        default:
          return {
            x: 64,
            y: 36,
            width: 832,
            height: 468,
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
