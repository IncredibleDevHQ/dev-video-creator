import Konva from 'konva'
import React from 'react'
import { Text, Rect, Group, Image } from 'react-konva'
import useImage from 'use-image'
import IncredibleLogo from '../../../assets/incredible-x-logo.svg'

const CommonLowerThirds = ({
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

export const IncredibleLowerThirds = ({
  x,
  y,
  displayName,
  username,
  width,
}: {
  x: number
  y: number
  displayName: string
  username: string
  width: number
}) => {
  const [incredibleLogo] = useImage(IncredibleLogo)

  return (
    <>
      <Rect
        x={x - width}
        y={y - 24}
        fill="#16A34A"
        cornerRadius={8}
        width={0}
        height={50}
        key="firstRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              x: x - width + 25,
              width: width + 45,
              duration: 0.6,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 3100)
              },
            })
          }, 1500)
        }
      />
      <Rect
        x={x - width + 10}
        y={y - 24}
        fill="#ffffff"
        cornerRadius={8}
        width={0}
        height={50}
        key="secondRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              x: x - width + 15,
              width: width + 35,
              duration: 0.6,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.2,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2900)
              },
            })
          }, 1700)
        }
      />
      <Text
        x={x - width + 30}
        y={y - 9}
        fill="#1F2937"
        text={displayName}
        fontSize={20}
        fontFamily="'Inter'"
        fontStyle="normal 500"
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
                }, 1000)
              },
            })
          }, 2000)
        }
      />
      <Text
        x={x - width + 30}
        y={y - 9}
        fill="#1F2937"
        text={username}
        fontSize={20}
        fontFamily="'Inter'"
        fontStyle="normal 500"
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
                }, 1200)
              },
            })
          }, 3300)
        }
      />
      <Image
        image={incredibleLogo}
        x={x}
        y={y}
        width={1}
        height={1}
        offsetX={1 / 2}
        offsetY={1 / 2}
        ref={(ref) => {
          ref?.to({
            scaleX: 100,
            scaleY: 100,
            duration: 0.4,
            easing: Konva.Easings.EaseIn,
            onFinish: () => {
              ref?.to({
                scaleX: 48,
                scaleY: 48,
                duration: 0.4,
                easing: Konva.Easings.EaseOut,
              })
              setTimeout(() => {
                ref?.to({
                  x: x - width - 10,
                  duration: 1,
                  easing: Konva.Easings.StrongEaseInOut,
                })
                setTimeout(() => {
                  ref?.to({
                    x: x - width - 20,
                    duration: 0.6,
                    onFinish: () => {
                      setTimeout(() => {
                        ref?.to({
                          x,
                          duration: 0.3,
                          onFinish: () => {
                            ref?.to({
                              scaleX: 100,
                              scaleY: 100,
                              duration: 0.2,
                              easing: Konva.Easings.EaseOut,
                              onFinish: () => {
                                ref?.to({
                                  scaleX: 0,
                                  scaleY: 0,
                                  duration: 0.2,
                                  easing: Konva.Easings.EaseIn,
                                })
                              },
                            })
                          },
                        })
                      }, 3500)
                    },
                  })
                }, 800)
              }, 200)
            },
          })
        }}
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

export default CommonLowerThirds
