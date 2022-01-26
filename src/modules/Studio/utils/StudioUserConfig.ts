import { StudioFragmentFragment } from '../../../generated/graphql'
import { Layout, VideoTheme } from '../../../utils/configTypes'
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
  theme: VideoTheme
}): StudioUserConfig[] => {
  switch (theme) {
    case 'glassy':
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
