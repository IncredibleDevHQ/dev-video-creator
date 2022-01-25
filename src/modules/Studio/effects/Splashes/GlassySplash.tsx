import React, { SetStateAction, useEffect, useState } from 'react'
import { Group, Image, Text } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { useRecoilValue } from 'recoil'
import VideoBackground from '../../components/VideoBackground'
import useEdit from '../../hooks/use-edit'
import { studioStore } from '../../stores'

const GlassySplash = ({
  stageConfig,
  setIsTitleSplash,
}: {
  stageConfig: {
    width: number
    height: number
  }
  setIsTitleSplash?: React.Dispatch<SetStateAction<boolean>>
}) => {
  const { fragment, branding } = useRecoilValue(studioStore)
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
      <VideoBackground theme="glassy" stageConfig={stageConfig} />
      <Text
        x={40}
        y={180}
        width={400}
        text={fragment?.flick.name || 'Hello Intro'}
        fill="#ffffff"
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
        y={444}
        width={imgDim.width}
        height={imgDim.height}
        image={logo}
      />
    </Group>
  )
}

export default GlassySplash
