import React, { SetStateAction } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { TitleSplashProps } from './Concourse'

const TitleSplash = ({
  titleSplashData,
  setIsTitleSplash,
  stageConfig,
  isShorts,
}: {
  titleSplashData: TitleSplashProps
  setIsTitleSplash: React.Dispatch<SetStateAction<boolean>>
  stageConfig: {
    width: number
    height: number
  }
  isShorts: boolean | undefined
}) => {
  return (
    <>
      <Group
        x={0}
        y={0}
        name="titleSplash"
        draggable
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            duration: 3,
            onFinish: () => {
              setIsTitleSplash(false)
            },
          })
        }
      >
        <Rect
          fillLinearGradientColorStops={[
            0,
            (titleSplashData &&
              titleSplashData?.bgRectColor &&
              titleSplashData?.bgRectColor[0]) ||
              '#1F2937',
            1,
            (titleSplashData &&
              titleSplashData?.bgRectColor &&
              titleSplashData?.bgRectColor[1]) ||
              '#1F2937',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{
            x: stageConfig.width,
            y: stageConfig.height,
          }}
          width={stageConfig.width}
          height={stageConfig.height}
        />
        <Rect
          fillLinearGradientColorStops={[
            0,
            (titleSplashData &&
              titleSplashData?.stripRectColor &&
              titleSplashData?.stripRectColor[0]) ||
              '#4ADE80',
            1,
            (titleSplashData &&
              titleSplashData?.stripRectColor &&
              titleSplashData?.stripRectColor[1]) ||
              '#16A34A',
          ]}
          fillLinearGradientStartPoint={{
            x: 0,
            y: stageConfig.height / 2 - 120,
          }}
          fillLinearGradientEndPoint={{
            x: stageConfig.width,
            y: stageConfig.height / 2 + 120,
          }}
          y={
            !isShorts
              ? stageConfig.height / 2 - 120
              : stageConfig.height / 2 - 90
          }
          width={stageConfig.width}
          height={!isShorts ? 240 : 180}
        />
        <Text
          x={0}
          y={stageConfig.height / 2 - 30}
          width={stageConfig.width}
          height={80}
          text={titleSplashData && titleSplashData.title}
          fillLinearGradientColorStops={[
            0,
            (titleSplashData &&
              titleSplashData?.textColor &&
              titleSplashData?.textColor[0]) ||
              '#ffffff',
            1,
            (titleSplashData &&
              titleSplashData?.textColor &&
              titleSplashData?.textColor[1]) ||
              '#ffffff',
          ]}
          fillLinearGradientStartPoint={{
            x: 0,
            y: stageConfig.height / 2 - 120,
          }}
          fillLinearGradientEndPoint={{
            x: stageConfig.width,
            y: stageConfig.height / 2 + 120,
          }}
          // fill={(titleSplashData && titleSplashData?.textColor) || '#ffffff'}
          textTransform="capitalize"
          fontStyle="normal 700"
          fontFamily="Poppins"
          fontSize={60}
          align="center"
        />
      </Group>
    </>
  )
}

export default TitleSplash
