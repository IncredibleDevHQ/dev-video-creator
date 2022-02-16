import { useRef } from 'react'
import Konva from 'konva'
import { ListItem } from '../../Flick/editor/utils/utils'

export interface ComputedPoint {
  y: number
  text: string
  width: number
  level: number
}

const usePoint = () => {
  const presentY = useRef(0)
  const noOfLines = useRef(0)
  const computedPoints = useRef<ComputedPoint[]>([])

  const initUsePoint = ({
    points,
    availableWidth,
    availableHeight,
    gutter,
    fontSize,
    fontFamily,
    fontStyle,
  }: {
    points: ListItem[]
    availableWidth: number
    availableHeight: number
    gutter: number
    fontSize: number
    fontFamily?: string
    fontStyle?: string
  }) => {
    const layer = new Konva.Layer({ width: availableWidth })
    computedPoints.current = []
    presentY.current = 0
    noOfLines.current = 0
    points.forEach((point, index) => {
      const text = new Konva.Text({
        text: point.text,
        fontSize,
        fontFamily,
        width: availableWidth,
      })
      layer.add(text)

      const width = text.textWidth

      const computedPoint: ComputedPoint = {
        y:
          noOfLines.current * (fontSize + fontSize * 0.3) +
          gutter +
          presentY.current,
        text: point.text || '',
        level: point.level || 1,
        width,
      }

      presentY.current +=
        noOfLines.current * (fontSize + fontSize * 0.3) + gutter

      noOfLines.current = getNoOfLinesOfText({
        text: point.text || '',
        availableWidth: availableWidth - (41 * ((point.level || 1) - 1) || 0),
        fontSize,
        fontFamily,
        fontStyle,
      })

      computedPoints.current.push(computedPoint)

      text.destroy()
    })
    return computedPoints.current
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
    return (canvasHeight - (52 + (fontSize + gutter) * presentY.current)) / 2
  }

  const getNoOfLinesOfText = ({
    text,
    availableWidth,
    fontSize,
    fontFamily,
    fontStyle,
  }: {
    text: string
    availableWidth: number
    fontSize: number
    fontFamily?: string
    fontStyle?: string
  }) => {
    const layer = new Konva.Layer({ width: availableWidth })
    let noOfLines = 1
    let currentWidth = 0

    const titleSplit = text?.split(' ')
    titleSplit?.forEach((subText) => {
      const word = new Konva.Text({
        text: `${subText} `,
        fontSize,
        fontFamily,
        fontStyle,
      })
      layer.add(word)
      const width = word.width()
      if (Math.floor(width) + Math.floor(currentWidth) > availableWidth) {
        noOfLines += 1
        currentWidth = 0
      }
      currentWidth += Math.floor(width)
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
