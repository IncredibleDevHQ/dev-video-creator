import React, { SetStateAction, useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import FragmentBackground from '../../components/FragmentBackground'
import VideoBackground from '../../components/VideoBackground'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'
import { getThemeTextColor } from '../../utils/ThemeConfig'

const LambdaTestSplash = ({
  isShorts,
  stageConfig,
  setIsTitleSplash,
}: {
  isShorts: boolean
  stageConfig: {
    width: number
    height: number
  }
  setIsTitleSplash?: React.Dispatch<SetStateAction<boolean>>
}) => {
  const { fragment, branding, theme } = useRecoilValue(studioStore)
  const [logo] = useImage(branding?.logo || '', 'anonymous')
  const { clipRect } = useEdit()

  const [imgDim, setImgDim] = useState<{
    width: number
    height: number
    x: number
    y: number
  }>({ width: 0, height: 0, x: 0, y: 0 })
  const { getImageDimensions } = useEdit()

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

  return (
    <Group>
      <VideoBackground
        theme={theme}
        stageConfig={stageConfig}
        isShorts={isShorts}
      />
      <Group
        clipFunc={(ctx: any) => {
          clipRect(
            ctx,
            !isShorts
              ? {
                  x: 56,
                  y: 32,
                  width: 848,
                  height: 477,
                  borderRadius: 16,
                }
              : {
                  x: 16,
                  y: 16,
                  width: 364,
                  height: 672,
                  borderRadius: 16,
                }
          )
        }}
      >
        <FragmentBackground
          theme={theme}
          objectConfig={
            !isShorts
              ? {
                  x: 56,
                  y: 32,
                  width: 848,
                  height: 477,
                  borderRadius: 16,
                }
              : {
                  x: 16,
                  y: 16,
                  width: 364,
                  height: 672,
                  borderRadius: 16,
                }
          }
          backgroundRectColor={
            branding?.colors?.primary ? branding?.colors?.primary : '#ffffff'
          }
        />
      </Group>
      <Text
        x={!isShorts ? 96 : 32}
        y={0}
        width={!isShorts ? 600 : 320}
        height={stageConfig.height}
        verticalAlign="middle"
        text={fragment?.flick.name || 'Hello Intro'}
        fill={branding?.colors?.text || getThemeTextColor(theme)}
        fontSize={64}
        fontFamily={branding?.font?.heading?.family || 'Gilroy'}
        fontStyle="normal 600"
        lineHeight={1.2}
        ref={(ref) => {
          ref?.to({
            duration: 3,
            onFinish: () => {
              setIsTitleSplash?.(false)
            },
          })
        }}
      />
      <Image
        x={!isShorts ? 96 : 32}
        y={!isShorts ? stageConfig.height - 120 : stageConfig.height - 90}
        width={imgDim.width}
        height={imgDim.height}
        image={logo}
      />
    </Group>
  )
}

export default LambdaTestSplash
