import React, { useEffect, useState } from 'react'
import { Group, Image, Rect, Text } from 'react-konva'
import { useRecoilValue } from 'recoil'
import useImage from 'use-image'
import incredibleLogo from '../../../../assets/incredible_logo.svg'
import outroPattern from '../../../../assets/outroPattern.svg'
import Concourse, { CONFIG, SHORTS_CONFIG } from '../../components/Concourse'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'
import { StudioUserConfiguration } from '../../utils/StudioUserConfig'
import { getThemeTextColor } from '../../utils/ThemeConfig'

const OutroFragment = ({ isShorts }: { isShorts: boolean }) => {
  const { fragment, branding, theme } = useRecoilValue(studioStore)
  const [logo] = useImage(branding?.logo || '', 'anonymous')

  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  const { getImageDimensions } = useEdit()

  const [stageConfig, setStageConfig] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  useEffect(() => {
    if (!isShorts) setStageConfig(CONFIG)
    else setStageConfig(SHORTS_CONFIG)
  }, [isShorts])

  useEffect(() => {
    setImgDim(
      getImageDimensions(
        {
          w: (logo && logo.width) || 0,
          h: (logo && logo.height) || 0,
        },
        60,
        60,
        60,
        60,
        0,
        0
      )
    )
  }, [logo])

  const layerChildren = [
    <Group>
      <Text
        width={stageConfig.width}
        height={stageConfig.height}
        align="center"
        verticalAlign="middle"
        text="Thanks for watching"
        fill={branding?.colors?.text || getThemeTextColor(theme)}
        fontSize={64}
        fontFamily={branding?.font?.heading?.family || 'Gilroy'}
        fontStyle="normal 600"
        lineHeight={1.2}
      />
      <Image
        x={40}
        y={stageConfig.height - 90}
        width={imgDim.width}
        height={imgDim.height}
        image={logo}
      />
    </Group>,
  ]

  const studioUserConfig = StudioUserConfiguration({
    layout: 'classic',
    fragment,
    fragmentState: 'customLayout',
    theme,
  })

  return (
    <Concourse
      layerChildren={layerChildren}
      blockType="outroBlock"
      studioUserConfig={studioUserConfig}
      isShorts={isShorts}
    />
  )
}

export default OutroFragment

export const ShortsOutro = ({
  performFinishAction,
}: {
  performFinishAction: () => void
}) => {
  const [incredibleLogoImage] = useImage(incredibleLogo)
  const [outroPatternImage] = useImage(outroPattern)
  return (
    <Group x={0} y={0}>
      <Rect
        x={-SHORTS_CONFIG.width}
        y={0}
        width={SHORTS_CONFIG.width}
        height={SHORTS_CONFIG.height}
        fill="#1F2937"
        ref={(ref) =>
          ref?.to({
            x: 0,
            duration: 0.2,
          })
        }
      />
      <Rect
        x={-SHORTS_CONFIG.width}
        y={SHORTS_CONFIG.height - 70}
        width={SHORTS_CONFIG.width}
        height={70}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            x: 0,
            duration: 0.2,
          })
        }
      />
      <Image
        image={outroPatternImage}
        x={SHORTS_CONFIG.width - 385}
        y={SHORTS_CONFIG.height - 225}
        width={380}
        height={150}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={40}
        y={245}
        text="Thanks for watching"
        fill="#ffffff"
        fontSize={32}
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        fontFamily="Inter"
        fontStyle="bold"
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={44}
        y={290}
        text="To create incredible videos like these"
        fill="#ffffff"
        fontSize={16}
        fontFamily="Inter"
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={45}
        y={315}
        text="Sign up on"
        fill="#ffffff"
        fontSize={16}
        fontFamily="Inter"
        width={SHORTS_CONFIG.width}
        lineHeight={1.2}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
      <Text
        x={131}
        y={315}
        text="incredible.dev"
        fill="#16A34A"
        fontSize={16}
        fontFamily="Inter"
        width={(SHORTS_CONFIG.width * 2) / 3}
        lineHeight={1.2}
        opacity={0}
        fontStyle="bold"
        textDecoration="underline"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
              onFinish: () => {
                setTimeout(() => {
                  performFinishAction()
                }, 2000)
              },
            })
          }, 100)
        }
      />
      <Image
        image={incredibleLogoImage}
        x={SHORTS_CONFIG.width - 140}
        y={SHORTS_CONFIG.height - 50}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.2,
            })
          }, 100)
        }
      />
    </Group>
  )
}
