import Konva from 'konva'
import React from 'react'
import { Text, Rect, Group, Image } from 'react-konva'

const LowerThirds = ({
  x,
  y,
  userName,
  rectOneColors,
  rectTwoColors,
  rectThreeColors,
}: {
  x: number
  y: number
  userName: string
  rectOneColors: string[]
  rectTwoColors: string[]
  rectThreeColors: string[]
}) => {
  return (
    <>
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '#EE676D',
          1,
          rectOneColors[1] || '#CB56AF',
        ]}
        fillLinearGradientStartPoint={{ x, y }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        ref={(ref) =>
          ref?.to({
            width: 300,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  width: 0,
                  duration: 0.3,
                  easing: Konva.Easings.EaseOut,
                })
              }, 2800)
            },
          })
        }
      />
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '#ffffff',
          1,
          rectTwoColors[1] || '#ffffff',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        key="secondRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              width: 300,
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2400)
              },
            })
          }, 200)
        }
      />
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectThreeColors[0] || '#0093E9',
          1,
          rectThreeColors[1] || '#80D0C7',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        key="thirdRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              width: 300,
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2000)
              },
            })
          }, 400)
        }
      />
      <Text
        x={x + 10}
        y={y + 8}
        fill="#ffffff"
        text={userName}
        fontSize={24}
        opacity={0}
        key="username"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    opacity: 0,
                    duration: 0.3,
                  })
                }, 2000)
              },
            })
          }, 400)
        }
      />
    </>
  )
}

export const FragmentCard = ({
  x,
  y,
  fragmentTitle,
  rectOneColors,
  rectTwoColors,
  fragmentImage,
  fragmentImageDimensions,
}: {
  x: number
  y: number
  fragmentTitle: string
  rectOneColors: string[]
  rectTwoColors: string[]
  fragmentImage: HTMLImageElement | undefined
  fragmentImageDimensions: {
    width: number
    height: number
    x: number
    y: number
  }
}) => {
  return (
    <Group x={x} y={y}>
      <Rect
        x={15}
        y={15}
        width={400}
        height={350}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '#EE676D',
          1,
          rectOneColors[0] || '#CB56AF',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 415,
          y: 365,
        }}
        opacity={0}
        ref={(ref) =>
          ref?.to({
            opacity: 1,
            duration: 0.2,
          })
        }
        cornerRadius={8}
      />
      <Rect
        x={0}
        y={0}
        width={400}
        height={0}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '#ffffff',
          1,
          rectTwoColors[1] || '#ffffff',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 400,
          y: 350,
        }}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              height: 350,
              duration: 0.3,
            })
          }, 200)
        }
        cornerRadius={8}
      />
      <Text
        x={20}
        y={25}
        text={fragmentTitle}
        fill="#4B5563"
        fontSize={36}
        fontFamily="Roboto"
        fontStyle="normal 400"
        align="left"
        width={350}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
            })
          }, 600)
        }
      />
      <Image
        x={fragmentImageDimensions.x}
        y={fragmentImageDimensions.y}
        width={fragmentImageDimensions.width}
        height={fragmentImageDimensions.height}
        image={fragmentImage}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
            })
          }, 600)
        }
      />
    </Group>
  )
}

export default LowerThirds
