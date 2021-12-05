import Konva from 'konva'
import React from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import useImage from 'use-image'
import DiscordLogo from '../../../assets/DiscordLogo.svg'
import { DiscordConfig } from '../../Flick/components/IntroOutroView'
import { CONFIG } from '../components/Concourse'
import { IntroState } from './fragments/IntroFragment'

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

const DiscordSplash = ({
  setFragmentState,
  viewMode,
  discordConfig,
}: {
  setFragmentState: React.Dispatch<React.SetStateAction<IntroState>>
  viewMode: boolean
  discordConfig: DiscordConfig
}) => {
  const [discordLogo] = useImage(DiscordLogo)

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        fill={discordConfig.backgroundColor}
        width={CONFIG.width}
        height={CONFIG.height}
      />
      <Group x={346} y={248}>
        <Text
          x={-346}
          y={0}
          text="Join Discord Community"
          fontSize={40}
          opacity={0}
          fill={discordConfig.textColor}
          ref={(ref) =>
            ref?.to({
              x: 0,
              opacity: 1,
              duration: 0.4,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    opacity: 0,
                    duration: 0.1,
                  })
                }, 800)
              },
            })
          }
        />
      </Group>
      <Text
        x={240}
        y={248}
        // text="https://discord.gg/49gkp63r"
        text="Link in description"
        fontSize={40}
        opacity={0}
        fill={discordConfig.textColor}
        ref={(ref) => {
          ref?.opacity(0)
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.4,
            })
          }, 1100)
        }}
      />
      <Rect
        x={-CONFIG.width + 460}
        y={0}
        width={CONFIG.width}
        height={CONFIG.height}
        fill={discordConfig.backgroundColor}
        ref={(ref) =>
          ref?.to({
            x: -CONFIG.width + 340,
            duration: 0.4,
            easing: Konva.Easings.BackEaseInOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: CONFIG.width - 200,
                  width: CONFIG.width,
                  duration: 0.4,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        x: 0,
                        duration: 0.2,
                      })
                    }, 1500)
                  },
                })
              }, 600)
            },
          })
        }
      />
      <Image
        image={discordLogo}
        x={CONFIG.width / 2}
        y={CONFIG.height / 2 - 10}
        width={124}
        height={96}
        offsetX={62}
        offsetY={48}
        filters={[Konva.Filters.RGB]}
        ref={(ref) => {
          const rgb = hexToRgb(discordConfig.textColor)
          if (rgb) {
            ref?.cache()
            ref?.red(rgb.r)
            ref?.green(rgb.g)
            ref?.blue(rgb.b)
          }
          ref?.to({
            x: 250,
            duration: 0.4,
            easing: Konva.Easings.BackEaseInOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: CONFIG.width - 310,
                  duration: 0.3,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        x: CONFIG.width / 2,
                        duration: 0.3,
                        onFinish: () => {
                          setTimeout(() => {
                            if (!viewMode) setFragmentState('onlyUserMedia')
                          }, 200)
                        },
                      })
                    }, 1600)
                  },
                })
              }, 600)
            },
          })
        }}
      />
    </Group>
  )
}
export default DiscordSplash
