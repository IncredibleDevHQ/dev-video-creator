import {
  StudioFragmentFragment,
  ThemeFragment,
} from '../../../generated/graphql'
import { Layout } from '../../../utils/configTypes'
import { StudioUserConfig } from '../components/Concourse'
import { FragmentState } from '../components/RenderTokens'

export const StudioUserConfiguration = ({
  layout,
  fragment,
  fragmentState,
  theme,
}: {
  layout: Layout
  fragment: StudioFragmentFragment | undefined
  fragmentState: FragmentState
  theme: ThemeFragment
}): StudioUserConfig[] => {
  switch (theme.name) {
    case 'DarkGradient':
      if (fragmentState === 'onlyUserMedia') {
        switch (fragment?.configuration?.speakers?.length) {
          case 2:
            return [
              {
                x: 400,
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
                backgroundRectX: 504,
                backgroundRectY: 9,
                backgroundRectWidth: 432,
                backgroundRectHeight: 512,
                backgroundRectBorderRadius: 8,
                backgroundRectColor: '#ffffff',
                backgroundRectOpacity: 0.3,
              },
              {
                x: -60,
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
                backgroundRectX: 44,
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
        //   switch (fragment?.configuration?.speakers?.length) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'float-full-right':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
        case 'full':
          switch (fragment?.configuration?.speakers?.length) {
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
        switch (fragment?.configuration?.speakers?.length) {
          case 2:
            return [
              {
                x: 400,
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
                  borderRadius: 0,
                },
              },
              {
                x: -60,
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
        //   switch (fragment?.configuration?.speakers?.length) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'float-full-right':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
                    borderRadius: 0,
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
        // case 'float-full-left':
        //   switch (fragment?.configuration?.speakers?.length) {
        //     case 2:
        //       return [
        //         {
        //           x: 32,
        //           y: 88,
        //           width: 224,
        //           height: 168,
        //           clipTheme: 'rect',
        //           borderWidth: 0,
        //           studioUserClipConfig: {
        //             x: 0,
        //             y: 2,
        //             width: 224,
        //             height: 164,
        //             borderRadius: 8,
        //           },
        //         },
        //         {
        //           x: 32,
        //           y: 284,
        //           width: 224,
        //           height: 168,
        //           clipTheme: 'rect',
        //           borderWidth: 0,
        //           studioUserClipConfig: {
        //             x: 0,
        //             y: 2,
        //             width: 224,
        //             height: 164,
        //             borderRadius: 8,
        //           },
        //         },
        //       ]
        //     default:
        //       return [
        //         {
        //           x: -96,
        //           y: 90,
        //           width: 480,
        //           height: 360,
        //           clipTheme: 'rect',
        //           borderWidth: 0,
        //           studioUserClipConfig: {
        //             x: 128,
        //             y: 0,
        //             width: 224,
        //             height: 360,
        //             borderRadius: 8,
        //           },
        //         },
        //       ]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
        case 'split':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
        case 'full':
          switch (fragment?.configuration?.speakers?.length) {
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
  fragment,
  fragmentState,
  theme,
}: {
  layout: Layout
  fragment: StudioFragmentFragment | undefined
  fragmentState: FragmentState
  theme: ThemeFragment
}): StudioUserConfig[] => {
  switch (theme.name) {
    case 'DarkGradient':
      if (fragmentState === 'onlyUserMedia') {
        switch (fragment?.configuration?.speakers?.length) {
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
        //   switch (fragment?.configuration?.speakers?.length) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
                  y: 362,
                  width: 432,
                  height: 324,
                  clipTheme: 'rect',
                  borderWidth: 0,
                  studioUserClipConfig: {
                    x: 38,
                    y: 2,
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
        case 'full':
          switch (fragment?.configuration?.speakers?.length) {
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
        switch (fragment?.configuration?.speakers?.length) {
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
        //   switch (fragment?.configuration?.speakers?.length) {
        //     case 2:
        //       return [{}, {}]
        //     default:
        //       return [{}]
        //   }
        case 'padded-bottom-right-tile':
        case 'bottom-right-tile':
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
          switch (fragment?.configuration?.speakers?.length) {
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
        case 'full':
          switch (fragment?.configuration?.speakers?.length) {
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
