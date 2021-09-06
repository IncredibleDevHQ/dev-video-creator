import { useRef } from 'react'
import Konva from 'konva'

export interface ComputedPoint {
  y: number
  text: string
  width: number
}

const usePoint = () => {
  const computedPointNumber = useRef(0)
  const lineNumber = useRef(0)
  const computedPoints = useRef<ComputedPoint[]>([])

  const initUsePoint = ({
    points,
    availableWidth,
    availableHeight,
    gutter,
    fontSize,
    fontFamily,
  }: {
    points: string[]
    availableWidth: number
    availableHeight: number
    gutter: number
    fontSize: number
    fontFamily?: string
  }) => {
    const layer = new Konva.Layer({ width: availableWidth })
    points.forEach((point, index) => {
      const text = new Konva.Text({ text: point, fontSize, fontFamily })
      layer.add(text)

      const width = text.textWidth

      const computedPoint: ComputedPoint = {
        y: (fontSize + gutter) * computedPointNumber.current,
        text: point,
        width,
      }

      // Check for wrapping...
      if (width > availableWidth) {
        // wrap
        computedPointNumber.current += 1
      }

      computedPointNumber.current += 1

      computedPoints.current.push(computedPoint)

      text.destroy()
    })
    const groupY = getGroupCoordinates({
      canvasHeight: availableHeight,
      fontSize,
      gutter,
    })
    return groupY
  }

  const getGroupCoordinates = ({
    canvasHeight,
    fontSize,
    gutter,
  }: {
    canvasHeight: number
    fontSize: number
    gutter: number
  }) => {
    return (
      (canvasHeight -
        (52 + (fontSize + gutter) * computedPointNumber.current)) /
      2
    )
  }

  return { initUsePoint, computedPoints, getGroupCoordinates }
}

export default usePoint
