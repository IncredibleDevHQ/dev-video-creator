import { ThemeFragment } from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { StudioUserConfig } from '../components/Concourse'
import { FragmentState } from '../components/RenderTokens'

interface ColorStop {
  color: string
  offset: number
}

export const getCanvasGradient = (
  colorstops: ColorStop[],
  gradientBoundary: { x0: number; y0: number; x1: number; y1: number }
) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const gradient = ctx?.createLinearGradient(
    gradientBoundary.x0,
    gradientBoundary.y0,
    gradientBoundary.x1,
    gradientBoundary.y1
  )
  if (!gradient) return undefined
  colorstops.forEach(({ color, offset }) => {
    gradient.addColorStop(offset, color)
  })
  return gradient
}

export const StudioUserConfiguration = ({
  layout,
  noOfParticipants,
  fragmentState,
  theme,
}: {
  layout: Layout
  noOfParticipants: number
  fragmentState: FragmentState
  theme: ThemeFragment
}): StudioUserConfig[] => {
  switch (theme.name) {
    case 'DarkGradient':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 392,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
                backgroundRectX: 496,
                backgroundRectY: 9,
                backgroundRectWidth: 432,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
              {
                x: -72,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
                backgroundRectX: 32,
                backgroundRectY: 9,
                backgroundRectWidth: 432,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 8,
                },
                backgroundRectX: 40,
                backgroundRectY: 14,
                backgroundRectWidth: 880,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 82,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 278,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 98,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 144,
                    y: 8,
                    width: 192,
                    height: 328,
                    borderRadius: 8,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 90,
                  backgroundRectWidth: 224,
                  backgroundRectHeight: 360,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                  backgroundRectX: 24,
                  backgroundRectY: 82,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                  backgroundRectX: 24,
                  backgroundRectY: 278,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 98,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 144,
                    y: 8,
                    width: 192,
                    height: 328,
                    borderRadius: 8,
                  },
                  backgroundRectX: 40,
                  backgroundRectY: 90,
                  backgroundRectWidth: 224,
                  backgroundRectHeight: 360,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 110,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 102,
                  backgroundRectWidth: 216,
                  backgroundRectHeight: 172,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                {
                  x: 724,
                  y: 302,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 294,
                  backgroundRectWidth: 216,
                  backgroundRectHeight: 172,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
            default:
              return [
                {
                  x: 620,
                  y: 120,
                  width: 400,
                  height: 300,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 116,
                    y: 10,
                    width: 168,
                    height: 280,
                    borderRadius: 8,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 114,
                  backgroundRectWidth: 200,
                  backgroundRectHeight: 312,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                  backgroundRectX: 776,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                  backgroundRectX: 588,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
            default:
              return [
                {
                  x: 740,
                  y: 347,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                  backgroundRectX: 752,
                  backgroundRectY: 332,
                  backgroundRectWidth: 192,
                  backgroundRectHeight: 192,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 776,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 588,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
            default:
              return [
                {
                  x: 740,
                  y: 347,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 752,
                  backgroundRectY: 332,
                  backgroundRectWidth: 192,
                  backgroundRectHeight: 192,
                  backgroundRectBorderRadius: 96,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 480,
                  y: -45,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 45,
                    width: 480,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 480,
                  y: 225,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 45,
                    width: 480,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 360,
                  y: 0,
                  width: 720,
                  height: 540,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 120,
                    y: 0,
                    width: 480,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 472,
                  y: 27,
                  width: 648,
                  height: 486,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 184,
                    y: 1,
                    width: 280,
                    height: 484,
                    borderRadius: 8,
                  },
                  backgroundRectX: 640,
                  backgroundRectY: 12,
                  backgroundRectWidth: 312,
                  backgroundRectHeight: 516,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'PastelLines':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 367.5,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 112.5,
                  y: 7,
                  width: 415,
                  height: 466,
                  borderRadius: 0,
                },
              },
              {
                x: -47.5,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 112.5,
                  y: 7,
                  width: 415,
                  height: 466,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 64,
                y: -42,
                width: 832,
                height: 624,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 1,
                  y: 79,
                  width: 830,
                  height: 466,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 708,
                  y: 104,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
                {
                  x: 708,
                  y: 274,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 708,
                  y: 189,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 684,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 12,
                    y: 2,
                    width: 200,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 684,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 12,
                    y: 2,
                    width: 200,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 588,
                  y: 114,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 108,
                    y: 0,
                    width: 200,
                    height: 312,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 521,
                  y: 329,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
                {
                  x: 694,
                  y: 329,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 684,
                  y: 319,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 521,
                  y: 329,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
                {
                  x: 694,
                  y: 329,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
            default:
              return [
                {
                  x: 684,
                  y: 319,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Cassidoo': {
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#E9BC3F', offset: 0.0 },
                    { color: '#EB4888', offset: 0.5469 },
                    { color: '#10A2F5', offset: 1.0 },
                  ],
                  {
                    x0: 0,
                    y0: 40,
                    x1: 400,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
              {
                x: -65,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#E9BC3F', offset: 0.0 },
                    { color: '#EB4888', offset: 0.5469 },
                    { color: '#10A2F5', offset: 1.0 },
                  ],
                  {
                    x0: 0,
                    y0: 40,
                    x1: 400,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#E9BC3F', offset: 0.0 },
                    { color: '#EB4888', offset: 0.5469 },
                    { color: '#10A2F5', offset: 1.0 },
                  ],
                  {
                    x0: 0,
                    y0: 40,
                    x1: 848,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 636,
                  y: 284,
                  width: 268,
                  height: 201,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 200,
                      y1: 200,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 34,
                    y: 0.5,
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                  },
                },
                {
                  x: 636,
                  y: 70,
                  width: 268,
                  height: 201,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 200,
                      y1: 200,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 34,
                    y: 0.5,
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 113.5,
                  width: 420,
                  height: 315,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 310,
                      y1: 310,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 55,
                    y: 2.5,
                    width: 310,
                    height: 310,
                    borderRadius: 155,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 61,
                  y: 284,
                  width: 268,
                  height: 201,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 200,
                      y1: 200,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 34,
                    y: 0.5,
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                  },
                },
                {
                  x: 61,
                  y: 70,
                  width: 268,
                  height: 201,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 200,
                      y1: 200,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 34,
                    y: 0.5,
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                  },
                },
              ]
            default:
              return [
                {
                  x: -15,
                  y: 113.5,
                  width: 420,
                  height: 315,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 310,
                      y1: 310,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 55,
                    y: 2.5,
                    width: 310,
                    height: 310,
                    borderRadius: 155,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 303,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 8,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
                {
                  x: 724,
                  y: 120,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 8,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
            default:
              return [
                {
                  x: 598,
                  y: 115.5,
                  width: 420,
                  height: 315,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 250,
                      y1: 250,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 85,
                    y: 32.5,
                    width: 250,
                    height: 250,
                    borderRadius: 125,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
            default:
              return [
                {
                  x: 740,
                  y: 360,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 320,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 320,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 456,
                  y: 39,
                  width: 616,
                  height: 462,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 312,
                      y1: 460,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 152,
                    y: 1,
                    width: 312,
                    height: 460,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    }
    case 'LambdaTest':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 16,
                },
              },
              {
                x: -65,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 16,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 16,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 16,
                  },
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 16,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 16,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 16,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 96,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 16,
                  },
                },
                {
                  x: 724,
                  y: 288,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 16,
                  },
                },
              ]
            default:
              return [
                {
                  x: 612,
                  y: 114,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 108,
                    y: 0,
                    width: 200,
                    height: 312,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 16,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 16,
                  },
                },
              ]
            default:
              return [
                {
                  x: 720,
                  y: 332,
                  width: 256,
                  height: 192,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 32,
                    y: 0,
                    width: 192,
                    height: 192,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 452,
                  y: 12,
                  width: 688,
                  height: 516,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 188,
                    y: 0,
                    width: 312,
                    height: 516,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'LeeRob':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#DB1685', offset: 0.0 },
                    { color: '#8165D6', offset: 0.5208 },
                    { color: '#48A8F6', offset: 0.9583 },
                  ],
                  {
                    x0: 0,
                    y0: 0,
                    x1: 400,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 0,
                },
              },
              {
                x: -65,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#DB1685', offset: 0.0 },
                    { color: '#8165D6', offset: 0.5208 },
                    { color: '#48A8F6', offset: 0.9583 },
                  ],
                  {
                    x0: 0,
                    y0: 0,
                    x1: 400,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#DB1685', offset: 0.0 },
                    { color: '#8165D6', offset: 0.5208 },
                    { color: '#48A8F6', offset: 0.9583 },
                  ],
                  {
                    x0: 0,
                    y0: 0,
                    x1: 848,
                    y1: 480,
                  }
                ),
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 164,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 164,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 360,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 164,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 164,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 224,
                      y1: 360,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 96,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 200,
                      y1: 156,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 0,
                  },
                },
                {
                  x: 724,
                  y: 288,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 200,
                      y1: 156,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 612,
                  y: 114,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 200,
                      y1: 312,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 108,
                    y: 0,
                    width: 200,
                    height: 312,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 720,
                  y: 332,
                  width: 256,
                  height: 192,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 192,
                      y1: 192,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 32,
                    y: 0,
                    width: 192,
                    height: 192,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 320,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 320,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 452,
                  y: 12,
                  width: 688,
                  height: 516,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 312,
                      y1: 516,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 188,
                    y: 0,
                    width: 312,
                    height: 516,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Web3Auth':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 392,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 12,
                },
                backgroundRectX: 496,
                backgroundRectY: 14,
                backgroundRectWidth: 432,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
              {
                x: -72,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 12,
                },
                backgroundRectX: 32,
                backgroundRectY: 14,
                backgroundRectWidth: 432,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 12,
                },
                backgroundRectX: 40,
                backgroundRectY: 14,
                backgroundRectWidth: 880,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
                backgroundRectBorderColor: '#ffffff',
                backgroundRectBorderWidth: 1,
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 94,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 12,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 88,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
                {
                  x: 704,
                  y: 290,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 12,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 284,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 98,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 144,
                    y: 8,
                    width: 192,
                    height: 328,
                    borderRadius: 12,
                  },
                  backgroundRectX: 696,
                  backgroundRectY: 90,
                  backgroundRectWidth: 224,
                  backgroundRectHeight: 360,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 94,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 12,
                  },
                  backgroundRectX: 24,
                  backgroundRectY: 88,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
                {
                  x: 32,
                  y: 290,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 12,
                  },
                  backgroundRectX: 24,
                  backgroundRectY: 284,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 180,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 98,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 144,
                    y: 8,
                    width: 192,
                    height: 328,
                    borderRadius: 12,
                  },
                  backgroundRectX: 40,
                  backgroundRectY: 90,
                  backgroundRectWidth: 224,
                  backgroundRectHeight: 360,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 110,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 12,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 102,
                  backgroundRectWidth: 216,
                  backgroundRectHeight: 172,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
                {
                  x: 724,
                  y: 302,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 12,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 294,
                  backgroundRectWidth: 216,
                  backgroundRectHeight: 172,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
            default:
              return [
                {
                  x: 620,
                  y: 120,
                  width: 400,
                  height: 300,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 116,
                    y: 10,
                    width: 168,
                    height: 280,
                    borderRadius: 12,
                  },
                  backgroundRectX: 720,
                  backgroundRectY: 114,
                  backgroundRectWidth: 200,
                  backgroundRectHeight: 312,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 12,
                  },
                  backgroundRectX: 776,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 12,
                  },
                  backgroundRectX: 588,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
            default:
              return [
                {
                  x: 740,
                  y: 347,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 12,
                  },
                  backgroundRectX: 752,
                  backgroundRectY: 332,
                  backgroundRectWidth: 192,
                  backgroundRectHeight: 192,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 776,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 588,
                  backgroundRectY: 357,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
            default:
              return [
                {
                  x: 740,
                  y: 347,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 752,
                  backgroundRectY: 332,
                  backgroundRectWidth: 192,
                  backgroundRectHeight: 192,
                  backgroundRectBorderRadius: 96,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 472,
                  y: 27,
                  width: 648,
                  height: 486,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 184,
                    y: 1,
                    width: 280,
                    height: 484,
                    borderRadius: 12,
                  },
                  backgroundRectX: 640,
                  backgroundRectY: 12,
                  backgroundRectWidth: 312,
                  backgroundRectHeight: 516,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'DevsForUkraine':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
              {
                x: -65,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 8,
                  },
                  themeName: 'DevsForUkraine',
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 8,
                  },
                  themeName: 'DevsForUkraine',
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 96,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                },
                {
                  x: 724,
                  y: 288,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 612,
                  y: 114,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 108,
                    y: 0,
                    width: 200,
                    height: 312,
                    borderRadius: 8,
                  },
                  themeName: 'DevsForUkraine',
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 720,
                  y: 332,
                  width: 256,
                  height: 192,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 32,
                    y: 0,
                    width: 192,
                    height: 192,
                    borderRadius: 8,
                  },
                  themeName: 'DevsForUkraine',
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 440,
                  y: 0,
                  width: 720,
                  height: 540,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 200,
                    y: 0,
                    width: 320,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Whitep4nth3r':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
              {
                x: -65,
                y: 25,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 94,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
                {
                  x: 704,
                  y: 290,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 96,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                },
                {
                  x: 724,
                  y: 288,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 612,
                  y: 114,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 108,
                    y: 0,
                    width: 200,
                    height: 312,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 720,
                  y: 332,
                  width: 256,
                  height: 192,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 32,
                    y: 0,
                    width: 192,
                    height: 192,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 440,
                  y: 0,
                  width: 720,
                  height: 540,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 200,
                    y: 0,
                    width: 320,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'outro':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 540,
                  y: 120,
                  width: 400,
                  height: 300,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 80,
                    y: 2,
                    width: 240,
                    height: 296,
                    borderRadius: 8,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'VetsWhoCode':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 385,
                y: 55,
                width: 576,
                height: 432,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 432,
                  borderRadius: 0,
                },
              },
              {
                x: -65,
                y: 55,
                width: 576,
                height: 432,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 120,
                  y: 0,
                  width: 400,
                  height: 432,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 54,
                y: -48.5,
                width: 852,
                height: 639,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 0,
                  y: 103.5,
                  width: 852,
                  height: 432,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 616,
                  y: 300,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                  },
                  backgroundRectX: 716,
                  backgroundRectY: 275,
                  backgroundRectWidth: 130,
                  backgroundRectHeight: 130,
                  backgroundRectBorderRadius: 75,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
                {
                  x: 616,
                  y: 90,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                  },
                  backgroundRectX: 716,
                  backgroundRectY: 65,
                  backgroundRectWidth: 130,
                  backgroundRectHeight: 130,
                  backgroundRectBorderRadius: 75,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 129,
                  width: 376,
                  height: 282,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 48,
                    y: 1,
                    width: 280,
                    height: 280,
                    borderRadius: 140,
                  },
                  // backgroundRectX: 720,
                  // backgroundRectY: 115,
                  // backgroundRectWidth: 180,
                  // backgroundRectHeight: 180,
                  // backgroundRectBorderRadius: 90,
                  // backgroundRectColor: '#C5203E',
                  // backgroundRectOpacity: 1,
                  backgroundRectX: 666,
                  backgroundRectY: 85,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 240,
                  backgroundRectBorderRadius: 120,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
              ]
          }
        case 'padded-bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 672,
                  y: 290,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 0,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 750,
                  backgroundRectY: 265,
                  backgroundRectWidth: 120,
                  backgroundRectHeight: 120,
                  backgroundRectBorderRadius: 60,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
                {
                  x: 672,
                  y: 120,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 0,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 750,
                  backgroundRectY: 95,
                  backgroundRectWidth: 120,
                  backgroundRectHeight: 120,
                  backgroundRectBorderRadius: 60,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
              ]
            default:
              return [
                {
                  x: 670,
                  y: 280,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                  },
                  backgroundRectX: 750,
                  backgroundRectY: 255,
                  backgroundRectWidth: 140,
                  backgroundRectHeight: 140,
                  backgroundRectBorderRadius: 70,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 617,
                  y: 268,
                  width: 280,
                  height: 210,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 1,
                    y: 5,
                    width: 278,
                    height: 200,
                    borderRadius: 0,
                  },
                },
                {
                  x: 617,
                  y: 58,
                  width: 280,
                  height: 210,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 1,
                    y: 5,
                    width: 278,
                    height: 200,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 481,
                  y: 61,
                  width: 552,
                  height: 414,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 137,
                    y: 2,
                    width: 278,
                    height: 410,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'outro':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 546,
                  y: 142,
                  width: 376,
                  height: 282,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 48,
                    y: 1,
                    width: 280,
                    height: 280,
                    borderRadius: 140,
                  },
                  backgroundRectX: 666,
                  backgroundRectY: 85,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 240,
                  backgroundRectBorderRadius: 120,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 546,
                  y: 142,
                  width: 376,
                  height: 282,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 48,
                    y: 1,
                    width: 280,
                    height: 280,
                    borderRadius: 140,
                  },
                  backgroundRectX: 645,
                  backgroundRectY: 100,
                  backgroundRectWidth: 240,
                  backgroundRectHeight: 240,
                  backgroundRectBorderRadius: 120,
                  backgroundRectColor: '#C5203E',
                  backgroundRectOpacity: 1,
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'ShrutiKapoor':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 390,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 210,
                    y0: 0,
                    x1: 210,
                    y1: 360,
                  }
                ),
                studioUserClipConfig: {
                  x: 110,
                  y: 0,
                  width: 420,
                  height: 480,
                  borderRadius: 0,
                },
              },
              {
                x: -70,
                y: 30,
                width: 640,
                height: 480,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 210,
                    y0: 0,
                    x1: 210,
                    y1: 360,
                  }
                ),
                studioUserClipConfig: {
                  x: 110,
                  y: 0,
                  width: 420,
                  height: 480,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 56,
                y: -45,
                width: 848,
                height: 636,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 424,
                    y0: 0,
                    x1: 424,
                    y1: 360,
                  }
                ),
                studioUserClipConfig: {
                  x: 0,
                  y: 75,
                  width: 848,
                  height: 480,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 100,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 100,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 100,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 100,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 92,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 80,
                      y0: 0,
                      x1: 80,
                      y1: 120,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 80,
                      y0: 0,
                      x1: 80,
                      y1: 120,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 720,
                  y: 332,
                  width: 256,
                  height: 192,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 96,
                      y0: 0,
                      x1: 96,
                      y1: 144,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 32,
                    y: 0,
                    width: 192,
                    height: 192,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 160,
                      y0: 0,
                      x1: 160,
                      y1: 202,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 160,
                      y0: 0,
                      x1: 160,
                      y1: 202,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 434,
                  y: 0,
                  width: 720,
                  height: 540,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 210,
                      y0: 0,
                      x1: 210,
                      y1: 360,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 194,
                    y: 0,
                    width: 332,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'outro':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 552,
                  y: 105,
                  width: 440,
                  height: 330,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 112,
                      y0: 0,
                      x1: 112,
                      y1: 270,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 100,
                    y: 0,
                    width: 240,
                    height: 330,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Mux':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: 416,
                y: 49.5,
                width: 588,
                height: 441,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 84,
                  y: 0.5,
                  width: 420,
                  height: 440,
                  borderRadius: 0,
                },
              },
              {
                x: -44,
                y: 49.5,
                width: 588,
                height: 441,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 84,
                  y: 0.5,
                  width: 420,
                  height: 440,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 40,
                y: -50,
                width: 880,
                height: 660,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 0,
                  y: 80,
                  width: 880,
                  height: 480,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'float-full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 704,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 704,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 568,
                  y: 91,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-full-left':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 32,
                  y: 88,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
                {
                  x: 32,
                  y: 284,
                  width: 224,
                  height: 168,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 2,
                    width: 224,
                    height: 164,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -88,
                  y: 91,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 128,
                    y: 0,
                    width: 224,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'float-half-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 724,
                  y: 96,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 0,
                  },
                },
                {
                  x: 724,
                  y: 288,
                  width: 208,
                  height: 156,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 4,
                    y: 0,
                    width: 200,
                    height: 156,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 608,
                  y: 108,
                  width: 432,
                  height: 324,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 104,
                    y: 0,
                    width: 224,
                    height: 324,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 698,
                  y: 285.5,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 0,
                  },
                },
                {
                  x: 698,
                  y: 90.5,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 698,
                  y: 285.5,
                  width: 240,
                  height: 180,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0,
                    width: 180,
                    height: 180,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 620,
                  y: 0,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
                {
                  x: 620,
                  y: 270,
                  width: 360,
                  height: 270,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 20,
                    y: 0,
                    width: 320,
                    height: 270,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 434,
                  y: 0,
                  width: 720,
                  height: 540,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 194,
                    y: 0,
                    width: 332,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 0,
                  y: -90,
                  width: 960,
                  height: 720,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 90,
                    width: 960,
                    height: 540,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'outro':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 516,
                  y: 90,
                  width: 480,
                  height: 360,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 100,
                    y: 0,
                    width: 280,
                    height: 360,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    default:
      return [
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            borderRadius: 0,
          },
        },
      ]
  }
}

export const ShortsStudioUserConfiguration = ({
  layout,
  noOfParticipants,
  fragmentState,
  theme,
}: {
  layout: Layout
  noOfParticipants: number
  fragmentState: FragmentState
  theme: ThemeFragment
}): StudioUserConfig[] => {
  switch (theme.name) {
    case 'DarkGradient':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
                backgroundRectX: 16,
                backgroundRectY: 12,
                backgroundRectWidth: 364,
                backgroundRectHeight: 336,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
                backgroundRectX: 16,
                backgroundRectY: 356,
                backgroundRectWidth: 364,
                backgroundRectHeight: 336,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
            ]
          default:
            return [
              {
                x: -230,
                y: 31,
                width: 856,
                height: 642,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 262,
                  y: 1,
                  width: 332,
                  height: 640,
                  borderRadius: 8,
                },
                backgroundRectX: 16,
                backgroundRectY: 16,
                backgroundRectWidth: 364,
                backgroundRectHeight: 672,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                  backgroundRectX: 212,
                  backgroundRectY: 520,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
                // {
                //   x: 184,
                //   y: 519,
                //   width: 216,
                //   height: 162,
                //   clipTheme: 'rect',
                //   borderWidth: 0,
                //   studioUserClipConfig: {
                //     x: 28,
                //     y: 1,
                //     width: 160,
                //     height: 160,
                //     borderRadius: 8,
                //   },
                //   backgroundRectX: 196,
                //   backgroundRectY: 504,
                //   backgroundRectWidth: 192,
                //   backgroundRectHeight: 192,
                //   backgroundRectBorderRadius: 8,
                //   backgroundRectColor: '#ffffff',
                //   backgroundRectOpacity: 0.3,
                // },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 212,
                  backgroundRectY: 520,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -26,
                  y: 356,
                  width: 448,
                  height: 336,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 50,
                    y: 8,
                    width: 348,
                    height: 320,
                    borderRadius: 8,
                  },
                  backgroundRectX: 16,
                  backgroundRectY: 356,
                  backgroundRectWidth: 364,
                  backgroundRectHeight: 336,
                  backgroundRectBorderRadius: 8,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'PastelLines':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -218,
                y: 40,
                width: 832,
                height: 624,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 258,
                  y: 0,
                  width: 316,
                  height: 624,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -10,
                  y: 352,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 50,
                    y: 0,
                    width: 316,
                    height: 312,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Cassidoo': {
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#E9BC3F', offset: 0.0 },
                    { color: '#EB4888', offset: 0.5469 },
                    { color: '#10A2F5', offset: 1.0 },
                  ],
                  {
                    x0: 0,
                    y0: 40,
                    x1: 364,
                    y1: 672,
                  }
                ),
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 195,
                  y: 530,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 160,
                      y1: 160,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -24,
                  y: 356,
                  width: 448,
                  height: 336,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#E9BC3F', offset: 0.0 },
                      { color: '#EB4888', offset: 0.5469 },
                      { color: '#10A2F5', offset: 1.0 },
                    ],
                    {
                      x0: 0,
                      y0: 40,
                      x1: 360,
                      y1: 336,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 44,
                    y: 0,
                    width: 360,
                    height: 336,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    }
    case 'LambdaTest':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 16,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 16,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 16,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -26,
                  y: 356,
                  width: 448,
                  height: 336,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 42,
                    y: 0,
                    width: 364,
                    height: 336,
                    borderRadius: 16,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'LeeRob':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 0,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 8,
                borderColor: getCanvasGradient(
                  [
                    { color: '#DB1685', offset: 0.0 },
                    { color: '#8165D6', offset: 0.5208 },
                    { color: '#48A8F6', offset: 0.9583 },
                  ],
                  {
                    x0: 0,
                    y0: 0,
                    x1: 364,
                    y1: 672,
                  }
                ),
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 176,
                      y1: 176,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 176,
                      y1: 176,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -26,
                  y: 356,
                  width: 448,
                  height: 336,
                  clipTheme: 'rect',
                  borderWidth: 8,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#DB1685', offset: 0.0 },
                      { color: '#8165D6', offset: 0.5208 },
                      { color: '#48A8F6', offset: 0.9583 },
                    ],
                    {
                      x0: 0,
                      y0: 0,
                      x1: 364,
                      y1: 336,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 42,
                    y: 0,
                    width: 364,
                    height: 336,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Web3Auth':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 12,
                },
                backgroundRectX: 16,
                backgroundRectY: 12,
                backgroundRectWidth: 364,
                backgroundRectHeight: 336,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
                backgroundRectBorderColor: '#ffffff',
                backgroundRectBorderWidth: 1,
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 12,
                },
                backgroundRectX: 16,
                backgroundRectY: 356,
                backgroundRectWidth: 364,
                backgroundRectHeight: 336,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
                backgroundRectBorderColor: '#ffffff',
                backgroundRectBorderWidth: 1,
              },
            ]
          default:
            return [
              {
                x: -230,
                y: 31,
                width: 856,
                height: 642,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 262,
                  y: 1,
                  width: 332,
                  height: 640,
                  borderRadius: 12,
                },
                backgroundRectX: 16,
                backgroundRectY: 16,
                backgroundRectWidth: 364,
                backgroundRectHeight: 672,
                backgroundRectBorderRadius: 12,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
                backgroundRectBorderColor: '#ffffff',
                backgroundRectBorderWidth: 1,
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 12,
                  },
                  backgroundRectX: 212,
                  backgroundRectY: 520,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 192,
                  y: 527,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                  },
                  backgroundRectX: 212,
                  backgroundRectY: 520,
                  backgroundRectWidth: 176,
                  backgroundRectHeight: 176,
                  backgroundRectBorderRadius: 88,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -26,
                  y: 356,
                  width: 448,
                  height: 336,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 50,
                    y: 8,
                    width: 348,
                    height: 320,
                    borderRadius: 12,
                  },
                  backgroundRectX: 16,
                  backgroundRectY: 356,
                  backgroundRectWidth: 364,
                  backgroundRectHeight: 336,
                  backgroundRectBorderRadius: 12,
                  backgroundRectColor: '#ffffff',
                  backgroundRectOpacity: 0.3,
                  backgroundRectBorderColor: '#ffffff',
                  backgroundRectBorderWidth: 1,
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'DevsForUkraine':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -14,
                  y: 356,
                  width: 424,
                  height: 318,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 54,
                    y: 1,
                    width: 316,
                    height: 316,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Whitep4nth3r':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '#FFB626',
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -14,
                  y: 356,
                  width: 424,
                  height: 318,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 54,
                    y: 1,
                    width: 316,
                    height: 316,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'VetsWhoCode':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 6,
                borderColor: '',
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 8,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 8,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -14,
                  y: 356,
                  width: 424,
                  height: 318,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '',
                  studioUserClipConfig: {
                    x: 54,
                    y: 1,
                    width: 316,
                    height: 316,
                    borderRadius: 8,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'ShrutiKapoor':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 166,
                    y0: 0,
                    x1: 166,
                    y1: 228,
                  }
                ),
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 166,
                    y0: 0,
                    x1: 166,
                    y1: 228,
                  }
                ),
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 8,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 4,
                borderColor: getCanvasGradient(
                  [
                    { color: '#FAFAFABF', offset: 0.0 },
                    { color: '#FFFFFF00', offset: 1.0 },
                  ],
                  {
                    x0: 182,
                    y0: 0,
                    x1: 182,
                    y1: 504,
                  }
                ),
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        // case 'classic':
        //   switch (noOfParticipants) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 88,
                      y0: 0,
                      x1: 88,
                      y1: 132,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 88,
                      y0: 0,
                      x1: 88,
                      y1: 132,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 6,
                  borderColor: '#FFB626',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -14,
                  y: 356,
                  width: 424,
                  height: 318,
                  clipTheme: 'rect',
                  borderWidth: 4,
                  borderColor: getCanvasGradient(
                    [
                      { color: '#FAFAFABF', offset: 0.0 },
                      { color: '#FFFFFF00', offset: 1.0 },
                    ],
                    {
                      x0: 180,
                      y0: 0,
                      x1: 180,
                      y1: 237,
                    }
                  ),
                  studioUserClipConfig: {
                    x: 32,
                    y: 1,
                    width: 360,
                    height: 316,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    case 'Mux':
      if (fragmentState === 'onlyUserMedia') {
        switch (noOfParticipants) {
          case 2:
            return [
              {
                x: -6,
                y: 27,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 0,
                },
              },
              {
                x: -6,
                y: 371,
                width: 408,
                height: 306,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 38,
                  y: 1,
                  width: 332,
                  height: 304,
                  borderRadius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: -250,
                y: 16,
                width: 896,
                height: 672,
                clipTheme: 'rect',
                borderWidth: 2,
                borderColor: '#D4D4D8',
                studioUserClipConfig: {
                  x: 266,
                  y: 0,
                  width: 364,
                  height: 672,
                  borderRadius: 0,
                },
              },
            ]
        }
      }
      switch (layout) {
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'padded-bottom-right-circle':
        case 'bottom-right-circle':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 756,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
                {
                  x: 568,
                  y: 364,
                  width: 216,
                  height: 162,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 28,
                    y: 1,
                    width: 160,
                    height: 160,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: 182,
                  y: 519.5,
                  width: 236,
                  height: 177,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 30,
                    y: 0.5,
                    width: 176,
                    height: 176,
                    borderRadius: 88,
                  },
                },
              ]
          }
        case 'split':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -36,
                  y: 360,
                  width: 416,
                  height: 312,
                  clipTheme: 'rect',
                  borderWidth: 2,
                  borderColor: '#D4D4D8',
                  studioUserClipConfig: {
                    x: 52,
                    y: 0,
                    width: 364,
                    height: 312,
                    borderRadius: 0,
                  },
                },
              ]
          }
        case 'full-left':
        case 'full-right':
          switch (noOfParticipants) {
            case 2:
              return [
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
                {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    borderRadius: 0,
                  },
                },
              ]
            default:
              return [
                {
                  x: -272,
                  y: -0.5,
                  width: 940,
                  height: 705,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 272,
                    y: 0.5,
                    width: 396,
                    height: 704,
                    borderRadius: 0,
                  },
                },
              ]
          }
        default:
          return [
            {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              clipTheme: 'rect',
              borderWidth: 0,
              studioUserClipConfig: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                borderRadius: 0,
              },
            },
          ]
      }
    default:
      return [
        {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          clipTheme: 'rect',
          borderWidth: 0,
          studioUserClipConfig: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            borderRadius: 0,
          },
        },
      ]
  }
}
