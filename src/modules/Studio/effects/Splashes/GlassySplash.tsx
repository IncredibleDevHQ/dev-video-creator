import React, { SetStateAction, useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import VideoBackground from '../../components/VideoBackground'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'
import { getThemeTextColor } from '../../utils/ThemeConfig'

const GlassySplash = ({
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
      <Text
        x={40}
        y={0}
        width={!isShorts ? 400 : 350}
        height={stageConfig.height}
        verticalAlign="middle"
        text={fragment?.flick.name || 'Hello Intro'}
        fill={branding?.colors?.text || getThemeTextColor(theme)}
        fontSize={64}
        fontFamily="Gilroy"
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
        x={40}
        y={stageConfig.height - 90}
        width={imgDim.width}
        height={imgDim.height}
        image={logo}
      />
    </Group>
  )
}

export default GlassySplash
