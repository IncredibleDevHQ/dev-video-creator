import { StudioFragmentFragment } from '../../../generated/graphql'
import { StudioUserConfig } from '../components/Concourse'
import { FragmentState } from '../components/RenderTokens'

export const StudioUserConfiguration = ({
  layoutNumber,
  fragment,
  fragmentState,
}: {
  layoutNumber: number
  fragment: StudioFragmentFragment | undefined
  fragmentState: FragmentState
}): StudioUserConfig[] => {
  if (fragmentState === 'onlyUserMedia') {
    switch (fragment?.participants.length) {
      case 2:
        return [
          {
            x: -40,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
          },
          {
            x: 420,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 100,
              y: 5,
              width: 400,
              height: 440,
              radius: 8,
            },
          },
        ]
      case 3:
        return [
          {
            x: -125,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
          },
          {
            x: 185,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
          },
          {
            x: 495,
            y: 25,
            width: 600,
            height: 450,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 160,
              y: 5,
              width: 280,
              height: 440,
              radius: 8,
            },
          },
        ]
      default:
        return [
          {
            x: 56,
            y: -45,
            width: 840,
            height: 630,
            clipTheme: 'rect',
            borderWidth: 0,
            studioUserClipConfig: {
              x: 0,
              y: 75,
              width: 840,
              height: 480,
              radius: 8,
            },
          },
        ]
    }
  } else
    switch (layoutNumber) {
      case 1:
        switch (fragment?.participants.length) {
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
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
                  radius: 0,
                },
              },
            ]
        }
      case 2:
        switch (fragment?.participants.length) {
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
                  radius: 8,
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
                  radius: 8,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 576,
                y: 90,
                width: 480,
                height: 360,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 128,
                  y: 0,
                  width: 224,
                  height: 360,
                  radius: 8,
                },
              },
            ]
        }
      case 3:
        switch (fragment?.participants.length) {
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
                  radius: 8,
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
                  radius: 8,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: -96,
                y: 90,
                width: 480,
                height: 360,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 128,
                  y: 0,
                  width: 224,
                  height: 360,
                  radius: 8,
                },
              },
            ]
        }
      case 4:
        switch (fragment?.participants.length) {
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
                  radius: 8,
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
                  radius: 8,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          default:
            return [
              {
                x: 620,
                y: 115,
                width: 416,
                height: 312,
                clipTheme: 'rect',
                borderWidth: 0,
                studioUserClipConfig: {
                  x: 108,
                  y: 0,
                  width: 200,
                  height: 312,
                  radius: 8,
                },
              },
            ]
        }
      case 5:
      case 7:
        switch (fragment?.participants.length) {
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
                  radius: 8,
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
                  radius: 8,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          default:
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
                  radius: 8,
                },
              },
            ]
        }
      case 6:
      case 8:
        switch (fragment?.participants.length) {
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
                  radius: 80,
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
                  radius: 80,
                },
              },
            ]
          case 3:
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
                  radius: 0,
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
                  radius: 0,
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
                  radius: 0,
                },
              },
            ]
          default:
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
                  radius: 80,
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
              radius: 0,
            },
          },
        ]
    }
}
