import Konva from 'konva'
import React, { useRef } from 'react'
import { Circle, Group, Rect, Shape } from 'react-konva'
import { TopLayerChildren } from '../../../utils/configTypes'
import { CONFIG, SHORTS_CONFIG } from '../components/Concourse'

// Used for the DarkGradient theme
export const TrianglePathTransition = ({
  direction,
  performFinishAction,
  isShorts,
  color,
}: {
  direction: string
  performFinishAction?: () => void
  isShorts?: boolean
  color?: string
}) => {
  let stageConfig = { width: CONFIG.width, height: CONFIG.height }
  if (!isShorts) stageConfig = CONFIG
  else stageConfig = SHORTS_CONFIG
  let groupStartX = 0
  let groupEndX = 0
  let duration = 0
  switch (direction) {
    case 'left':
      groupStartX = stageConfig.width + stageConfig.width / 4 + 110
      groupEndX = -(stageConfig.width + stageConfig.width / 4 + 110)
      duration = 1
      break
    case 'right':
      groupStartX = -(stageConfig.width + stageConfig.width / 4 + 110)
      groupEndX = stageConfig.width + stageConfig.width / 4 + 110
      duration = 1
      break
    case 'moveIn':
      groupStartX = -(stageConfig.width + stageConfig.width / 4 + 110)
      groupEndX = -stageConfig.width / 10 + 100
      duration = 0.5
      break
    case 'moveAway':
      groupStartX = -stageConfig.width / 10 + 100
      groupEndX = stageConfig.width + stageConfig.width / 4 + 110
      duration = 0.5
      break
    default:
      break
  }
  if (!isShorts)
    return (
      <Group
        x={groupStartX}
        y={0}
        ref={(ref) =>
          ref?.to({
            x: groupEndX,
            duration,
            // easing: Konva.Easings.EaseOut,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 300)
            },
          })
        }
      >
        <Shape
          sceneFunc={(context, shape) => {
            context.beginPath()
            context.moveTo(0, -110)
            context.lineTo(stageConfig.width, -110)
            context.lineTo(
              stageConfig.width + stageConfig.width / 4 + 80,
              stageConfig.height / 2 - 50
            )
            context.quadraticCurveTo(
              stageConfig.width + stageConfig.width / 4 + 130,
              stageConfig.height / 2,
              stageConfig.width + stageConfig.width / 4 + 80,
              stageConfig.height / 2 + 50
            )
            context.lineTo(stageConfig.width, stageConfig.height + 110)
            context.lineTo(0, stageConfig.height + 110)
            context.lineTo(
              -stageConfig.width / 4 - 80,
              stageConfig.height / 2 + 50
            )
            context.quadraticCurveTo(
              -stageConfig.width / 4 - 130,
              stageConfig.height / 2,
              -stageConfig.width / 4 - 80,
              stageConfig.height / 2 - 50
            )
            // context.quadraticCurveTo(150, 100, 260, 170)
            context.closePath()
            context.fillStrokeShape(shape)
          }}
          fill={color || '#ffffff'}
          opacity={0.6}
        />
        <Shape
          sceneFunc={(context, shape) => {
            context.beginPath()
            context.moveTo(0, -50)
            context.lineTo(stageConfig.width, -50)
            context.lineTo(
              stageConfig.width + stageConfig.width / 4,
              stageConfig.height / 2 - 50
            )
            context.quadraticCurveTo(
              stageConfig.width + stageConfig.width / 4 + 50,
              stageConfig.height / 2,
              stageConfig.width + stageConfig.width / 4,
              stageConfig.height / 2 + 50
            )
            context.lineTo(stageConfig.width, stageConfig.height + 50)
            context.lineTo(0, stageConfig.height + 50)
            context.lineTo(-stageConfig.width / 4, stageConfig.height / 2 + 50)
            context.quadraticCurveTo(
              -stageConfig.width / 4 - 50,
              stageConfig.height / 2,
              -stageConfig.width / 4,
              stageConfig.height / 2 - 50
            )
            // context.quadraticCurveTo(150, 100, 260, 170)
            context.closePath()
            context.fillStrokeShape(shape)
          }}
          fill={color || '#ffffff'}
          opacity={0.8}
        />
        <Shape
          sceneFunc={(context, shape) => {
            context.beginPath()
            context.moveTo(0, 30)
            context.lineTo(stageConfig.width, 30)
            context.lineTo(
              stageConfig.width + stageConfig.width / 4 - 80,
              stageConfig.height / 2 - 50
            )
            context.quadraticCurveTo(
              stageConfig.width + stageConfig.width / 4 - 40,
              stageConfig.height / 2,
              stageConfig.width + stageConfig.width / 4 - 80,
              stageConfig.height / 2 + 50
            )
            context.lineTo(stageConfig.width, stageConfig.height - 30)
            context.lineTo(0, stageConfig.height - 30)
            context.lineTo(
              -stageConfig.width / 4 + 80,
              stageConfig.height / 2 + 50
            )
            context.quadraticCurveTo(
              -stageConfig.width / 4 + 40,
              stageConfig.height / 2,
              -stageConfig.width / 4 + 80,
              stageConfig.height / 2 - 50
            )
            // context.quadraticCurveTo(150, 100, 260, 170)
            context.closePath()
            context.fillStrokeShape(shape)
          }}
          fill={color || '#ffffff'}
          opacity={1}
        />
      </Group>
    )
  return (
    <Group
      x={groupStartX}
      ref={(ref) =>
        ref?.to({
          x: groupEndX,
          duration,
          // easing: Konva.Easings.EaseIn,
          onFinish: () => {
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 300)
          },
        })
      }
    >
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath()
          context.moveTo(0, -100)
          context.lineTo(stageConfig.width, -100)
          context.lineTo(
            stageConfig.width + stageConfig.width / 4 + 80,
            stageConfig.height / 2 - 50
          )
          context.quadraticCurveTo(
            stageConfig.width + stageConfig.width / 4 + 100,
            stageConfig.height / 2,
            stageConfig.width + stageConfig.width / 4 + 80,
            stageConfig.height / 2 + 50
          )
          context.lineTo(stageConfig.width, stageConfig.height + 100)
          context.lineTo(0, stageConfig.height + 100)
          context.lineTo(
            -stageConfig.width / 4 - 80,
            stageConfig.height / 2 + 50
          )
          context.quadraticCurveTo(
            -stageConfig.width / 4 - 100,
            stageConfig.height / 2,
            -stageConfig.width / 4 - 80,
            stageConfig.height / 2 - 50
          )
          // context.quadraticCurveTo(150, 100, 260, 170)
          context.closePath()
          context.fillStrokeShape(shape)
        }}
        fill={color || '#ffffff'}
        opacity={0.6}
      />
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath()
          context.moveTo(0, -50)
          context.lineTo(stageConfig.width, -50)
          context.lineTo(
            stageConfig.width + stageConfig.width / 4,
            stageConfig.height / 2 - 50
          )
          context.quadraticCurveTo(
            stageConfig.width + stageConfig.width / 4 + 16,
            stageConfig.height / 2,
            stageConfig.width + stageConfig.width / 4,
            stageConfig.height / 2 + 50
          )
          context.lineTo(stageConfig.width, stageConfig.height + 50)
          context.lineTo(0, stageConfig.height + 50)
          context.lineTo(-stageConfig.width / 4, stageConfig.height / 2 + 50)
          context.quadraticCurveTo(
            -stageConfig.width / 4 - 16,
            stageConfig.height / 2,
            -stageConfig.width / 4,
            stageConfig.height / 2 - 50
          )
          // context.quadraticCurveTo(150, 100, 260, 170)
          context.closePath()
          context.fillStrokeShape(shape)
        }}
        fill={color || '#ffffff'}
        opacity={0.8}
      />
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath()
          context.moveTo(0, 0)
          context.lineTo(stageConfig.width, 0)
          context.lineTo(
            stageConfig.width + stageConfig.width / 4 - 80,
            stageConfig.height / 2 - 50
          )
          context.quadraticCurveTo(
            stageConfig.width + stageConfig.width / 4 - 75,
            stageConfig.height / 2,
            stageConfig.width + stageConfig.width / 4 - 80,
            stageConfig.height / 2 + 50
          )
          context.lineTo(stageConfig.width, stageConfig.height)
          context.lineTo(0, stageConfig.height)
          context.lineTo(
            -stageConfig.width / 4 + 80,
            stageConfig.height / 2 + 50
          )
          context.quadraticCurveTo(
            -stageConfig.width / 4 + 75,
            stageConfig.height / 2,
            -stageConfig.width / 4 + 80,
            stageConfig.height / 2 - 50
          )
          // context.quadraticCurveTo(150, 100, 260, 170)
          context.closePath()
          context.fillStrokeShape(shape)
        }}
        fill={color || '#ffffff'}
        opacity={1}
      />
    </Group>
  )
}

export const PastelLinesTransition = ({
  direction,
  isShorts,
  color,
  setTopLayerChildren,
}: {
  direction: string
  isShorts?: boolean
  color?: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  let stageConfig = { width: CONFIG.width, height: CONFIG.height }
  if (!isShorts) stageConfig = CONFIG
  else stageConfig = SHORTS_CONFIG
  const rect2Ref = useRef<Konva.Rect>(null)

  let rect1StartX = 0
  let rect1StartY = 0
  let rectEndHeight = 0
  let rect2StartX = 0
  let rect2StartY = 0
  let duration = 0
  switch (direction) {
    case 'left':
    case 'right':
    case 'moveIn':
      rect1StartX = 0
      rect1StartY = 0
      rectEndHeight = stageConfig.height / 2
      rect2StartX = 0
      rect2StartY = stageConfig.height
      duration = 0.375
      break
    case 'moveAway':
      rect1StartX = 0
      rect1StartY = stageConfig.height / 2
      rect2StartX = 0
      rect2StartY = stageConfig.height / 2
      duration = 0.25
      break
    default:
      break
  }

  return (
    <Group>
      <Group>
        <Rect
          x={rect1StartX}
          y={rect1StartY}
          width={stageConfig.width}
          height={0}
          fill={color || '#E0D6ED'}
          stroke="#27272A"
          strokeWidth={1}
          ref={(ref) => {
            rect2Ref.current?.to({
              y: rect2StartY - rectEndHeight,
              height: rectEndHeight,
              duration,
            })
            ref?.to({
              height: rectEndHeight,
              duration,
              onFinish: () => {
                ref?.to({
                  strokeWidth: 0,
                })
                rect2Ref.current?.to({
                  strokeWidth: 0,
                })
                setTimeout(() => {
                  if (direction === 'left' || direction === 'right') {
                    ref?.to({
                      y: rect1StartY,
                      height: 0,
                      strokeWidth: 1,
                      duration,
                      onFinish: () => {
                        setTimeout(() => {
                          setTopLayerChildren?.({ id: '', state: '' })
                        }, 200)
                      },
                    })
                    rect2Ref.current?.to({
                      y: rect2StartY,
                      height: 0,
                      strokeWidth: 1,
                      duration,
                    })
                  }
                }, 100)
              },
            })
          }}
        />
      </Group>
      <Group>
        <Rect
          x={rect2StartX}
          y={rect2StartY}
          width={stageConfig.width}
          height={0}
          fill={color || '#E0D6ED'}
          stroke="#27272A"
          strokeWidth={1}
          ref={rect2Ref}
        />
      </Group>
    </Group>
  )
}

export const CassidooTransition = ({
  direction,
  isShorts,
  color,
  setTopLayerChildren,
}: {
  direction: string
  isShorts?: boolean
  color?: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  let rect1StartCoords = { x: 0, y: 0 }
  let rect2StartCoords = { x: 0, y: 0 }
  let rect3StartCoords = { x: 0, y: 0 }
  let rect4StartCoords = { x: 0, y: 0 }
  let rect1MidCoords = { x: 0, y: 0 }
  let rect2MidCoords = { x: 0, y: 0 }
  let rect3MidCoords = { x: 0, y: 0 }
  let rect4MidCoords = { x: 0, y: 0 }
  let rect1EndCoords = { x: 0, y: 0 }
  let rect2EndCoords = { x: 0, y: 0 }
  let rect3EndCoords = { x: 0, y: 0 }
  let rect4EndCoords = { x: 0, y: 0 }
  let duration = 0
  switch (direction) {
    case 'left':
    case 'right':
    case 'moveIn':
      if (!isShorts) {
        rect1StartCoords = { x: -272.91, y: 662.93 }
        rect2StartCoords = { x: 658, y: -300.16 }
        rect3StartCoords = { x: 287.09, y: 850.93 }
        rect4StartCoords = { x: 1169, y: -51.16 }
        rect1MidCoords = { x: 527.09, y: -137.07 }
        rect2MidCoords = { x: -142, y: 499.84 }
        rect3MidCoords = { x: 1087.09, y: 50.93 }
        rect4MidCoords = { x: 369, y: 748.84 }
        rect1EndCoords = { x: 1327.09, y: -937.07 }
        rect2EndCoords = { x: -942, y: 1299.84 }
        rect3EndCoords = { x: 1887.09, y: -749.07 }
        rect4EndCoords = { x: -431, y: 1548.84 }
      } else {
        rect1StartCoords = { x: -55.16, y: -209 }
        rect2StartCoords = { x: 850.93, y: 682.91 }
        rect3StartCoords = { x: -300.16, y: 302 }
        rect4StartCoords = { x: 662.93, y: 1232.91 }

        rect1MidCoords = { x: 744.84, y: 591 }
        rect2MidCoords = { x: 50.93, y: -117.09 }
        rect3MidCoords = { x: 499.84, y: 1102 }
        rect4MidCoords = { x: -137.07, y: 432.91 }

        rect1EndCoords = { x: 1544.84, y: 1391 }
        rect2EndCoords = { x: -749.07, y: -917.09 }
        rect3EndCoords = { x: 1299.84, y: 1902 }
        rect4EndCoords = { x: -937.07, y: -367.09 }
      }
      // rect1EndCoords = { x: 527.09, y: -137.07 }
      // rect2EndCoords = { x: -142, y: 499.84 }
      // rect3EndCoords = { x: 1087.09, y: 50.93 }
      // rect4EndCoords = { x: 369, y: 748.84 }
      duration = 0.75
      break
    case 'moveAway':
      rect1StartCoords = { x: 527.09, y: -137.07 }
      rect2StartCoords = { x: -142, y: 499.84 }
      rect3StartCoords = { x: 1077.09, y: 50.93 }
      rect4StartCoords = { x: 369, y: 748.84 }
      rect1EndCoords = { x: -172.91, y: 562.93 }
      rect2EndCoords = { x: 558, y: -200.16 }
      rect3EndCoords = { x: 377.09, y: 750.93 }
      rect4EndCoords = { x: 1069, y: 48.84 }
      duration = 0.25
      break
    default:
      break
  }
  if (!isShorts)
    return (
      <Group>
        <Rect
          x={rect1StartCoords.x}
          y={rect1StartCoords.y}
          width={1105}
          height={275}
          cornerRadius={134}
          rotation={135.4}
          fillLinearGradientColorStops={[
            0,
            color || '#E9BC3F',
            0.7725,
            color || '#E89DBB',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 134 }}
          fillLinearGradientEndPoint={{
            x: 1105,
            y: 134,
          }}
          shadowColor="#000000"
          shadowOffset={{ x: 0, y: -4 }}
          shadowOpacity={0.1}
          shadowBlur={6}
          ref={(ref) => {
            ref?.to({
              x: rect1MidCoords.x,
              y: rect1MidCoords.y,
              duration: duration / 2,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rect1EndCoords.x,
                    y: rect1EndCoords.y,
                    duration: duration / 2,
                  })
                }, 150)
              },
            })
          }}
        />
        <Rect
          x={rect2StartCoords.x}
          y={rect2StartCoords.y}
          width={1105}
          height={275}
          cornerRadius={134}
          rotation={-44.6}
          fillLinearGradientColorStops={[
            0,
            color || '#E9BC3F',
            0.7725,
            color || '#E89DBB',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 134 }}
          fillLinearGradientEndPoint={{
            x: 1105,
            y: 134,
          }}
          shadowColor="#000000"
          shadowOffset={{ x: 0, y: -4 }}
          shadowOpacity={0.1}
          shadowBlur={6}
          ref={(ref) => {
            ref?.to({
              x: rect2MidCoords.x,
              y: rect2MidCoords.y,
              duration: duration / 2,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rect2EndCoords.x,
                    y: rect2EndCoords.y,
                    duration: duration / 2,
                    onFinish: () => {
                      setTimeout(() => {
                        if (direction === 'left' || direction === 'right') {
                          setTopLayerChildren?.({ id: '', state: '' })
                        }
                      }, 200)
                    },
                  })
                }, 150)
              },
            })
          }}
        />
        <Rect
          x={rect3StartCoords.x}
          y={rect3StartCoords.y}
          width={1105}
          height={275}
          cornerRadius={134}
          rotation={135.4}
          fillLinearGradientColorStops={[
            0,
            color || '#E9BC3F',
            0.7725,
            color || '#E89DBB',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 134 }}
          fillLinearGradientEndPoint={{
            x: 1105,
            y: 134,
          }}
          shadowColor="#000000"
          shadowOffset={{ x: 0, y: -4 }}
          shadowOpacity={0.1}
          shadowBlur={6}
          ref={(ref) => {
            ref?.to({
              x: rect3MidCoords.x,
              y: rect3MidCoords.y,
              duration: duration / 2,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rect3EndCoords.x,
                    y: rect3EndCoords.y,
                    duration: duration / 2,
                  })
                }, 150)
              },
            })
          }}
        />
        <Rect
          x={rect4StartCoords.x}
          y={rect4StartCoords.y}
          width={1105}
          height={275}
          cornerRadius={134}
          rotation={-44.6}
          fillLinearGradientColorStops={[
            0,
            color || '#E9BC3F',
            0.7725,
            color || '#E89DBB',
          ]}
          fillLinearGradientStartPoint={{ x: 0, y: 134 }}
          fillLinearGradientEndPoint={{
            x: 1105,
            y: 134,
          }}
          shadowColor="#000000"
          shadowOffset={{ x: 0, y: -4 }}
          shadowOpacity={0.1}
          shadowBlur={6}
          ref={(ref) => {
            ref?.to({
              x: rect4MidCoords.x,
              y: rect4MidCoords.y,
              duration: duration / 2,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rect4EndCoords.x,
                    y: rect4EndCoords.y,
                    duration: duration / 2,
                  })
                }, 150)
              },
            })
          }}
        />
      </Group>
    )
  return (
    <Group>
      <Rect
        x={rect1StartCoords.x}
        y={rect1StartCoords.y}
        width={1105}
        height={275}
        cornerRadius={134}
        rotation={-134.6}
        fillLinearGradientColorStops={[
          0,
          color || '#E9BC3F',
          0.7725,
          color || '#E89DBB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 134 }}
        fillLinearGradientEndPoint={{
          x: 1105,
          y: 134,
        }}
        shadowColor="#000000"
        shadowOffset={{ x: 0, y: -4 }}
        shadowOpacity={0.1}
        shadowBlur={6}
        ref={(ref) => {
          ref?.to({
            x: rect1MidCoords.x,
            y: rect1MidCoords.y,
            duration: duration / 2,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: rect1EndCoords.x,
                  y: rect1EndCoords.y,
                  duration: duration / 2,
                })
              }, 150)
            },
          })
        }}
      />
      <Rect
        x={rect2StartCoords.x}
        y={rect2StartCoords.y}
        width={1105}
        height={275}
        cornerRadius={134}
        rotation={45.4}
        fillLinearGradientColorStops={[
          0,
          color || '#E9BC3F',
          0.7725,
          color || '#E89DBB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 134 }}
        fillLinearGradientEndPoint={{
          x: 1105,
          y: 134,
        }}
        shadowColor="#000000"
        shadowOffset={{ x: 0, y: -4 }}
        shadowOpacity={0.1}
        shadowBlur={6}
        ref={(ref) => {
          ref?.to({
            x: rect2MidCoords.x,
            y: rect2MidCoords.y,
            duration: duration / 2,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: rect2EndCoords.x,
                  y: rect2EndCoords.y,
                  duration: duration / 2,
                  onFinish: () => {
                    setTimeout(() => {
                      if (direction === 'left' || direction === 'right') {
                        setTopLayerChildren?.({ id: '', state: '' })
                      }
                    }, 200)
                  },
                })
              }, 150)
            },
          })
        }}
      />
      <Rect
        x={rect3StartCoords.x}
        y={rect3StartCoords.y}
        width={1105}
        height={275}
        cornerRadius={134}
        rotation={-134.6}
        fillLinearGradientColorStops={[
          0,
          color || '#E9BC3F',
          0.7725,
          color || '#E89DBB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 134 }}
        fillLinearGradientEndPoint={{
          x: 1105,
          y: 134,
        }}
        shadowColor="#000000"
        shadowOffset={{ x: 0, y: -4 }}
        shadowOpacity={0.1}
        shadowBlur={6}
        ref={(ref) => {
          ref?.to({
            x: rect3MidCoords.x,
            y: rect3MidCoords.y,
            duration: duration / 2,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: rect3EndCoords.x,
                  y: rect3EndCoords.y,
                  duration: duration / 2,
                })
              }, 150)
            },
          })
        }}
      />
      <Rect
        x={rect4StartCoords.x}
        y={rect4StartCoords.y}
        width={1105}
        height={275}
        cornerRadius={134}
        rotation={45.4}
        fillLinearGradientColorStops={[
          0,
          color || '#E9BC3F',
          0.7725,
          color || '#E89DBB',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 134 }}
        fillLinearGradientEndPoint={{
          x: 1105,
          y: 134,
        }}
        shadowColor="#000000"
        shadowOffset={{ x: 0, y: -4 }}
        shadowOpacity={0.1}
        shadowBlur={6}
        ref={(ref) => {
          ref?.to({
            x: rect4MidCoords.x,
            y: rect4MidCoords.y,
            duration: duration / 2,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: rect4EndCoords.x,
                  y: rect4EndCoords.y,
                  duration: duration / 2,
                })
              }, 150)
            },
          })
        }}
      />
    </Group>
  )
}

export const RectanglesSlideTransition = ({
  direction,
  // colors,
  performFinishAction,
  isShorts,
}: {
  direction: string
  // colors?: string[]
  performFinishAction?: () => void
  isShorts?: boolean
}) => {
  let stageConfig = { width: CONFIG.width, height: CONFIG.height }
  if (!isShorts) stageConfig = CONFIG
  else stageConfig = SHORTS_CONFIG

  let rectStartX = 0
  let rectIntermediateX = 0
  let rectEndX = 0
  let duration = 0

  switch (direction) {
    case 'left':
      rectStartX = stageConfig.width + 100
      rectIntermediateX = 0
      rectEndX = -(stageConfig.width + 100)
      duration = 0.5
      break
    case 'right':
      rectStartX = -(stageConfig.width + 100)
      rectIntermediateX = 0
      rectEndX = stageConfig.width + 100
      duration = 0.5
      break
    case 'moveIn':
      rectStartX = -(stageConfig.width + 100)
      rectEndX = 0
      duration = 0.5
      break
    case 'moveAway':
      rectStartX = 0
      rectEndX = stageConfig.width + 100
      duration = 0.5
      break
    default:
      break
  }

  return (
    <Group>
      <Rect
        x={rectStartX}
        y={0}
        width={stageConfig.width}
        height={stageConfig.height / 3 + 10}
        fill="#ffffff"
        ref={(ref) => {
          ref?.to({
            x: rectIntermediateX,
            duration,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  x: rectEndX,
                  duration,
                })
              }, 1000)
            },
          })
        }}
      />
      <Rect
        x={rectStartX}
        y={stageConfig.height / 3}
        width={stageConfig.width}
        height={stageConfig.height / 3}
        fill="#ffffff"
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              x: rectIntermediateX,
              duration,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rectEndX,
                    duration,
                  })
                }, 600)
              },
            })
          }, 200)
        }}
      />
      <Rect
        x={rectStartX}
        y={(stageConfig.height / 3) * 2 - 10}
        width={stageConfig.width}
        height={stageConfig.height / 3 + 10}
        fill="#ffffff"
        ref={(ref) => {
          setTimeout(() => {
            ref?.to({
              x: rectIntermediateX,
              duration,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: rectEndX,
                    duration,
                    onFinish: () => {
                      if (!performFinishAction) return
                      setTimeout(() => {
                        performFinishAction()
                      }, 300)
                    },
                  })
                }, 200)
              },
            })
          }, 400)
        }}
      />
    </Group>
  )
}

export const MultiCircleCenterGrow = ({
  performFinishAction,
  colors,
}: {
  performFinishAction?: () => void
  colors?: string[]
}) => {
  // const { reduceSplashAudioVolume } = useRecoilValue(studioStore)
  return (
    <>
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={150}
        scaleX={0}
        scaleY={0}
        fill={colors ? colors[0] : '#ffffff'}
        ref={(ref) => {
          // reduceSplashAudioVolume(0.01)
          ref?.to({
            scaleX: 5,
            scaleY: 5,
            duration: 0.5,
            // easing: Konva.Easings.EaseOut,
          })
        }}
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={100}
        scaleX={0}
        scaleY={0}
        fill={colors ? colors[1] : '#D1D5DB'}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              scaleX: 5,
              scaleY: 5,
              duration: 0.5,
              // easing: Konva.Easings.EaseOut,
            })
          }, 200)
        }
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={50}
        scaleX={0}
        scaleY={0}
        fill={colors ? colors[2] : '#4B5563'}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              scaleX: 5,
              scaleY: 5,
              duration: 0.5,
              // easing: Konva.Easings.EaseIn,
              onFinish: () => {
                if (!performFinishAction) return
                // reduceSplashAudioVolume(0.0)
                // setTimeout(() => {
                //   reduceSplashAudioVolume(0.0)
                // }, 200)
                setTimeout(() => {
                  performFinishAction()
                }, 400)
              },
            })
          }, 300)
        }
      />
    </>
  )
}

export const MultiCircleMoveDown = ({
  performFinishAction,
  colors,
}: {
  performFinishAction?: () => void
  colors?: string[]
}) => {
  return (
    <>
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={600}
        fill={colors ? colors[0] : '#ffffff'}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              y: CONFIG.height + 700,
              duration: 0.3,
              // easing: Konva.Easings.EaseOut,
              onFinish: () => {
                if (!performFinishAction) return
                setTimeout(() => {
                  performFinishAction()
                }, 300)
              },
            })
          }, 250)
        }
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={400}
        fill={colors ? colors[1] : '#D1D5DB'}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              y: CONFIG.height + 500,
              duration: 0.3,
              // easing: Konva.Easings.EaseOut,
            })
          }, 125)
        }
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={200}
        fill={colors ? colors[2] : '#4B5563'}
        ref={(ref) =>
          ref?.to({
            y: CONFIG.height + 300,
            duration: 0.3,
            // easing: Konva.Easings.EaseIn,
          })
        }
      />
    </>
  )
}

export const MutipleRectMoveRight = ({
  performFinishAction,
  rectOneColors,
  rectTwoColors,
  rectThreeColors,
  isShorts,
}: {
  performFinishAction?: () => void
  rectOneColors: string[]
  rectTwoColors: string[]
  rectThreeColors: string[]
  isShorts?: boolean
}) => {
  let stageConfig = { width: CONFIG.width, height: CONFIG.height }
  if (!isShorts) stageConfig = CONFIG
  else stageConfig = SHORTS_CONFIG
  return (
    <>
      <Rect
        x={-stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '#EE676D',
          1,
          rectOneColors[1] || '#CB56AF',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: stageConfig.width,
            duration: 1.5,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 200)
            },
          })
        }
      />
      <Rect
        x={-stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '',
          1,
          rectTwoColors[1] || '',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: stageConfig.width,
            duration: 1,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
      <Rect
        x={-stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectThreeColors[0] || '',
          1,
          rectThreeColors[1] || '',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: stageConfig.width,
            duration: 0.5,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
    </>
  )
}

export const MutipleRectMoveLeft = ({
  performFinishAction,
  rectOneColors,
  rectTwoColors,
  rectThreeColors,
  isShorts,
}: {
  performFinishAction?: () => void
  rectOneColors: string[]
  rectTwoColors: string[]
  rectThreeColors: string[]
  isShorts?: boolean
}) => {
  let stageConfig = { width: CONFIG.width, height: CONFIG.height }
  if (!isShorts) stageConfig = CONFIG
  else stageConfig = SHORTS_CONFIG
  return (
    <>
      <Rect
        x={stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '',
          1,
          rectOneColors[1] || '',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: -stageConfig.width,
            duration: 1.5,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 300)
            },
          })
        }
      />
      <Rect
        x={stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '',
          1,
          rectTwoColors[1] || '',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: -stageConfig.width,
            duration: 1,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
      <Rect
        x={stageConfig.width}
        y={0}
        fillLinearGradientColorStops={[
          0,
          rectThreeColors[0] || '',
          1,
          rectThreeColors[1] || '',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: stageConfig.height,
        }}
        width={stageConfig.width}
        height={stageConfig.height}
        ref={(ref) =>
          ref?.to({
            x: -stageConfig.width,
            duration: 0.5,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
    </>
  )
}

export const CircleShrink = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Circle
      x={-200}
      y={CONFIG.height / 2}
      radius={100}
      scaleX={18}
      scaleY={18}
      fill="#16A34A"
      ref={(ref) =>
        ref?.to({
          scaleX: 0,
          scaleY: 0,
          duration: 1,
          onFinish: () => {
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const CircleGrow = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Circle
      x={CONFIG.width + 100}
      y={CONFIG.height / 2}
      radius={100}
      fill="#16A34A"
      ref={(ref) =>
        ref?.to({
          scaleX: 20,
          scaleY: 20,
          duration: 1,
          onFinish: () => {
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const CircleCenterShrink = ({
  performFinishAction,
  color,
}: {
  performFinishAction?: () => void
  color?: string
}) => {
  return (
    <Circle
      x={CONFIG.width / 2}
      y={CONFIG.height / 2}
      radius={600}
      fill={!color ? '#16A34A' : color}
      ref={(ref) =>
        ref?.to({
          scaleX: 0,
          scaleY: 0,
          duration: 0.3,
          onFinish: () => {
            ref?.to({ opacity: 0 })
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const CircleCenterGrow = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Circle
      x={CONFIG.width / 2}
      y={CONFIG.height / 2}
      radius={100}
      scaleX={0}
      scaleY={0}
      fill="#16A34A"
      ref={(ref) =>
        ref?.to({
          scaleX: 10,
          scaleY: 10,
          duration: 0.15,
          onFinish: () => {
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const RectCenterGrow = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Rect
      x={0}
      y={CONFIG.height / 2}
      fill="#16A34A"
      width={CONFIG.width}
      height={1}
      ref={(ref) =>
        ref?.to({
          height: CONFIG.height,
          y: 0,
          duration: 0.2,
          easing: Konva.Easings.EaseOut,
          onFinish: () => {
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const RectCenterShrink = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Rect
      x={0}
      y={0}
      fill="#16A34A"
      width={CONFIG.width}
      height={CONFIG.height}
      opacity={1}
      ref={(ref) =>
        ref?.to({
          height: 240,
          y: CONFIG.height / 2 - 120,
          duration: 0.2,
          easing: Konva.Easings.EaseOut,
          onFinish: () => {
            ref?.to({ opacity: 0 })
            if (!performFinishAction) return
            setTimeout(() => {
              performFinishAction()
            }, 200)
          },
        })
      }
    />
  )
}

export const MutipleRectMoveCenter = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <>
      <Rect
        x={-CONFIG.width / 2}
        y={0}
        fillLinearGradientColorStops={[0, '#EE676D', 1, '#CB56AF']}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: CONFIG.height,
        }}
        width={CONFIG.width / 2}
        height={CONFIG.height}
        ref={(ref) =>
          ref?.to({
            x: 0,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 300)
            },
          })
        }
      />
      <Rect
        x={CONFIG.width}
        y={0}
        // fill="#558FF6"
        fillLinearGradientColorStops={[0, '#0093E9', 1, '#80D0C7']}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: CONFIG.height,
        }}
        width={CONFIG.width / 2}
        height={CONFIG.height}
        ref={(ref) =>
          ref?.to({
            x: CONFIG.width / 2,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
    </>
  )
}

export const MutipleRectMoveAway = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <>
      <Rect
        x={0}
        y={0}
        fillLinearGradientColorStops={[0, '#EE676D', 1, '#CB56AF']}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 0,
          y: CONFIG.height,
        }}
        width={CONFIG.width / 2}
        height={CONFIG.height}
        ref={(ref) =>
          ref?.to({
            x: -CONFIG.width / 2,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 300)
            },
          })
        }
      />
      <Rect
        x={CONFIG.width / 2}
        y={0}
        fill="#558FF6"
        width={CONFIG.width / 2}
        height={CONFIG.height}
        ref={(ref) =>
          ref?.to({
            x: CONFIG.width,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
          })
        }
      />
    </>
  )
}
