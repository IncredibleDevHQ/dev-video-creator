import Konva from 'konva'
import React from 'react'
import { Group, Circle, Text, Rect } from 'react-konva'
import { CONFIG } from '../components/Concourse'

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
}: {
  performFinishAction?: () => void
}) => {
  return (
    <Circle
      x={CONFIG.width / 2}
      y={CONFIG.height / 2}
      radius={600}
      fill="#16A34A"
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
      zIndex={100}
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
      zIndex={100}
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
