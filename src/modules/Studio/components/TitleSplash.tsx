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
  setIsTitleSplash?: React.Dispatch<SetStateAction<boolean>>
  stageConfig: {
    width: number
    height: number
  }
  isShorts: boolean | undefined
}) => {
  const colorStops = [0, '#1F2937', 1, '#1F2937']
  const startPoint = { x: 0, y: 0 }
  const endPoint = { x: stageConfig.width, y: stageConfig.height }
  return (
    <>
      <Group
        x={0}
        y={0}
        name="titleSplash"
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            duration: 3,
            onFinish: () => {
              setIsTitleSplash?.(false)
            },
          })
        }
      >
        <Rect
          fillLinearGradientColorStops={
            titleSplashData.titleSplashConfig?.values || colorStops
          }
          fillLinearGradientStartPoint={
            titleSplashData.titleSplashConfig?.startIndex || startPoint
          }
          fillLinearGradientEndPoint={
            titleSplashData.titleSplashConfig?.endIndex || endPoint
          }
          width={stageConfig.width}
          height={stageConfig.height}
        />
        <Rect
          fillLinearGradientColorStops={[0, '#ffffff4c', 1, '#ffffff56']}
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
          fillLinearGradientColorStops={[0, '#ffffff', 1, '#ffffff']}
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
