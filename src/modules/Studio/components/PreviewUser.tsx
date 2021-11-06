/* eslint-disable consistent-return */
import React from 'react'
import { Group, Image, Rect } from 'react-konva'
import { useImage } from 'react-konva-utils'
import { StudioUserConfig } from './Concourse'
import useEdit, { ClipConfig } from '../hooks/use-edit'

const PreviewUser = ({
  studioUserConfig,
}: {
  studioUserConfig: StudioUserConfig
}) => {
  const {
    x,
    y,
    width,
    height,
    clipTheme,
    borderColor,
    borderWidth,
    studioUserClipConfig,
    backgroundRectColor,
    backgroundRectX,
    backgroundRectY,
    backgroundRectBorderWidth,
    backgroundRectBorderColor,
  } = studioUserConfig
  const imageConfig = { width: width || 160, height: height || 120 }

  const { clipCircle, clipRect } = useEdit()
  const defaultStudioUserClipConfig: ClipConfig = {
    x: 0,
    y: 0,
    width: 160,
    height: 120,
    radius: 8,
  }

  const [image] = useImage('https://i.imgur.com/O90PONZ.jpeg')

  const getClipFunc = ({
    clipTheme,
    ctx,
    clipConfig,
  }: {
    clipTheme?: string
    ctx: any
    clipConfig: ClipConfig
  }) => {
    if (clipTheme === 'circle') return clipCircle(ctx, clipConfig)
    return clipRect(ctx, clipConfig)
  }

  return (
    <>
      <Rect
        x={backgroundRectX || 775}
        y={backgroundRectY || y}
        width={studioUserClipConfig?.width || defaultStudioUserClipConfig.width}
        height={
          studioUserClipConfig?.height || defaultStudioUserClipConfig.height
        }
        fill={backgroundRectColor}
        stroke={backgroundRectBorderColor}
        strokeWidth={backgroundRectBorderWidth || 0}
        cornerRadius={studioUserClipConfig?.radius || 0}
      />
      <Rect
        x={(studioUserClipConfig && studioUserClipConfig.x + x) || 775}
        y={y}
        width={studioUserClipConfig?.width || defaultStudioUserClipConfig.width}
        height={
          studioUserClipConfig?.height || defaultStudioUserClipConfig.height
        }
        stroke={borderColor}
        strokeWidth={borderWidth || 0}
        cornerRadius={studioUserClipConfig?.radius || 0}
      />
      <Group
        x={x}
        y={y}
        clipFunc={(ctx: any) => {
          getClipFunc({
            clipTheme,
            ctx,
            clipConfig: studioUserClipConfig || defaultStudioUserClipConfig,
          })
        }}
        offsetX={imageConfig.width}
        scaleX={-1}
      >
        <Image
          image={image}
          width={imageConfig.width}
          height={imageConfig.height}
        />
      </Group>
    </>
  )
}

export default PreviewUser
