import Konva from 'konva'
import React, { useRef, useState } from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useImage } from 'react-konva-utils'
import config from '../../../../config'
import { CONFIG } from '../../components/Concourse'
import { IntroState } from '../fragments/IntroFragment'

const SplashSeventeen = ({
  setFragmentState,
}: {
  setFragmentState: React.Dispatch<React.SetStateAction<IntroState>>
}) => {
  const [logo] = useImage(`${config.storage.baseUrl}idev-logo.svg`, 'anonymous')
  const [logoText] = useImage(
    `${config.storage.baseUrl}incredible.svg`,
    'anonymous'
  )
  const [secondaryLogo] = useImage(
    `${config.storage.baseUrl}100DaysOfTF.svg`,
    'anonymous'
  )

  const [imageDimensions, setImageDimensions] = useState({
    logoWidth: 60,
    logoHeight: 60,
    logoTextWidth: 158,
    logoTextHeight: 26,
    secondaryLogoWidth: 279,
    secondaryLogoHeight: 99,
  })

  const secondaryLogoRef = useRef<Konva.Image | null>(null)

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        fill="#ffffff"
        width={CONFIG.width}
        height={CONFIG.height}
      />
      <Group x={390} y={247}>
        <Image
          image={logoText}
          x={-imageDimensions.logoTextWidth}
          y={0}
          width={imageDimensions.logoTextWidth}
          height={imageDimensions.logoTextHeight}
          opacity={0}
          ref={(ref) =>
            ref?.to({
              x: 14,
              opacity: 1,
              duration: 0.4,
              easing: Konva.Easings.BackEaseInOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: -imageDimensions.logoTextWidth,
                    duration: 0.6,
                  })
                }, 600)
              },
            })
          }
        />
      </Group>
      <Rect
        x={0}
        y={0}
        width={460}
        height={CONFIG.height}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            width: 375,
            duration: 0.4,
            easing: Konva.Easings.BackEaseInOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  width: 460,
                  duration: 0.6,
                  easing: Konva.Easings.BackEaseInOut,
                })
              }, 600)
            },
          })
        }
      />
      <Image
        image={logo}
        x={CONFIG.width / 2}
        y={CONFIG.height / 2 - 10}
        width={imageDimensions.logoWidth}
        height={imageDimensions.logoHeight}
        offsetX={imageDimensions.logoWidth / 2}
        offsetY={imageDimensions.logoHeight / 2}
        ref={(ref) => {
          ref?.to({
            rotation: -90,
            x: 362,
            easing: Konva.Easings.BackEaseInOut,
            duration: 0.4,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: CONFIG.width / 2,
                  rotation: 90,
                  easing: Konva.Easings.BackEaseInOut,
                  duration: 0.6,
                  onFinish: () => {
                    ref?.to({
                      opacity: 0,
                      duration: 0.6,
                      onFinish: () => {
                        secondaryLogoRef.current?.to({
                          opacity: 1,
                          duration: 0.3,
                          onFinish: () => {
                            setTimeout(() => {
                              setFragmentState('discord')
                            }, 2000)
                          },
                        })
                      },
                    })
                    ref?.to({
                      scaleX: 24,
                      scaleY: 24,
                      easing: Konva.Easings.BackEaseInOut,
                      duration: 0.6,
                    })
                  },
                })
              }, 600)
            },
          })
        }}
      />
      <Image
        image={secondaryLogo}
        x={(CONFIG.width - imageDimensions.secondaryLogoWidth) / 2}
        y={(CONFIG.height - imageDimensions.secondaryLogoHeight) / 2}
        width={imageDimensions.secondaryLogoWidth}
        height={imageDimensions.secondaryLogoHeight}
        ref={secondaryLogoRef}
        opacity={0}
      />
    </Group>
  )
}

export default SplashSeventeen
