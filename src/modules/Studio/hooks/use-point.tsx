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
    points: { level?: number; text: string }[]
    availableWidth: number
    availableHeight: number
    gutter: number
    fontSize: number
    fontFamily?: string
  }) => {
    const layer = new Konva.Layer({ width: availableWidth })
    points.forEach((point, index) => {
      const text = new Konva.Text({ text: point.text, fontSize, fontFamily })
      layer.add(text)

      const width = text.textWidth

      const computedPoint: ComputedPoint = {
        y: (fontSize + gutter) * computedPointNumber.current,
        text: point.text,
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

  const getNoOfLinesOfText = ({
    text,
    availableWidth,
    fontSize,
    fontFamily,
    stageWidth,
  }: {
    text: string
    availableWidth: number
    fontSize: number
    fontFamily?: string
    stageWidth: number
  }) => {
    const layer = new Konva.Layer({ width: stageWidth })

    let noOfLines = 1
    let currentWidth = 0

    const titleSplit = text?.split(' ')
    titleSplit?.forEach((subText) => {
      const word = new Konva.Text({
        text: subText,
        fontSize,
        fontFamily,
      })
      layer.add(word)

      const width = word.textWidth
      if (width + currentWidth > availableWidth) {
        noOfLines += 1
        currentWidth = 0
      }
      currentWidth += width
    })
    return noOfLines
  }

  return {
    initUsePoint,
    computedPoints,
    getGroupCoordinates,
    getNoOfLinesOfText,
  }
}

export default usePoint
