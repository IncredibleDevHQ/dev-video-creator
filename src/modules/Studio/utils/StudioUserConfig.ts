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
  switch (layoutNumber) {
    case 1:
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
      }
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
