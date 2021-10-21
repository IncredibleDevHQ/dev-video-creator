import Konva from 'konva'
import React from 'react'
import { Group, Circle, Text, Rect } from 'react-konva'
import { CONFIG, SHORTS_CONFIG } from '../components/Concourse'

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

export const MultiCircleCenterGrow = ({
  performFinishAction,
}: {
  performFinishAction?: () => void
}) => {
  return (
    <>
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={150}
        scaleX={0}
        scaleY={0}
        fill="#0745F7"
        ref={(ref) =>
          ref?.to({
            scaleX: 10,
            scaleY: 10,
            duration: 0.5,
            // easing: Konva.Easings.EaseOut,
          })
        }
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={100}
        scaleX={0}
        scaleY={0}
        fill="#ffffff"
        ref={(ref) =>
          ref?.to({
            scaleX: 10,
            scaleY: 10,
            duration: 0.5,
            // easing: Konva.Easings.EaseOut,
          })
        }
      />
      <Circle
        x={CONFIG.width / 2}
        y={CONFIG.height / 2}
        radius={50}
        scaleX={0}
        scaleY={0}
        fill="#000000"
        ref={(ref) =>
          ref?.to({
            scaleX: 20,
            scaleY: 20,
            duration: 0.75,
            // easing: Konva.Easings.EaseIn,
            onFinish: () => {
              if (!performFinishAction) return
              setTimeout(() => {
                performFinishAction()
              }, 200)
            },
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
