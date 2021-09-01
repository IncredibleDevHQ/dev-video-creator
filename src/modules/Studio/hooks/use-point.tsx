import { useRef } from 'react'
import Konva from 'konva'

export interface ComputedPoint {
  y: number
  text: string
  width: number
}

const usePoint = () => {
  /**
   *
   * 1 // 1 2
   * 2 // 3
   * 3 // 4 5
   * 4 // 6
   */

  const computedPointNumber = useRef(0)
  const lineNumber = useRef(0)
  const computedPoints = useRef<ComputedPoint[]>([])
  /**
   * 1. import
   * 2. now time
   * 3. this
   * 4. ;
   *
   * computedLineNumber = 0
   *
   * l=1 c=1
   * now l=2 c=2
   * time l=2 c=3
   * this l=3 c=4
   * ; l=4 c=5
   *
   */

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
