import { useRef } from 'react'
import Konva from 'konva'

export interface Coordinates {
  titleX: number
  titleY: number
  subTitleX: number
  subTitleY: number
  titleHeight: number
}

const useSplash = () => {
  const getInitCoordinates = ({
    title,
    subTitle,
    availableWidth,
    availableHeight,
    gutter,
    titleFontSize,
    subTitleFontSize,
    fontFamily,
    stageWidth,
    stageHeight,
  }: {
    title: string
    subTitle?: string
    availableWidth: number
    availableHeight?: number
    gutter: number
    titleFontSize: number
    subTitleFontSize: number
    fontFamily?: string
    stageWidth: number
    stageHeight: number
  }) => {
    // let width = konvaTitle.textWidth
    const layer = new Konva.Layer({ width: stageWidth })

    const konvaTitle = new Konva.Text({
      text: title,
      fontSize: titleFontSize,
      fontFamily,
      width: availableWidth,
    })
    layer.add(konvaTitle)

    const titleWidth = konvaTitle.textWidth

    const konvaSubTitle = new Konva.Text({
      text: subTitle,
      fontSize: subTitleFontSize,
      fontFamily,
      width: availableWidth,
    })
    layer.add(konvaTitle)

    const subTitleWidth = konvaSubTitle.textWidth

    const titleHeight: number =
      titleFontSize *
      getNoOfLinesOfText({
        text: title,
        availableWidth,
        fontFamily,
        fontSize: titleFontSize,
        stageWidth,
      })

    let subTitleHeight = 0

    if (subTitle) {
      subTitleHeight =
        subTitleFontSize *
        getNoOfLinesOfText({
          text: subTitle,
          availableWidth,
          fontFamily,
          fontSize: subTitleFontSize,
          stageWidth,
        })
    }

    const computedCoordinates: Coordinates = {
      titleX: (stageWidth - titleWidth) / 2 - 32,
      titleY: (stageHeight - (titleHeight + subTitleHeight + gutter)) / 2,
      titleHeight,
      subTitleX: (stageWidth - subTitleWidth) / 2 - 32,
      subTitleY:
        (stageHeight - (titleHeight + subTitleHeight + gutter)) / 2 +
        titleHeight +
        gutter,
    }

    return computedCoordinates
  }

  const getNoOfLinesOfText = ({
    text,
    availableWidth,
    fontSize: titleFontSize,
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

    const titleSplit = text.split(' ')
    titleSplit.forEach((subText) => {
      const word = new Konva.Text({
        text: subText,
        fontSize: titleFontSize,
        fontFamily,
        width: availableWidth,
      })
      layer.add(word)

      const width = word.textWidth
      console.log(width)
      if (width + currentWidth > availableWidth) {
        noOfLines += 1
        currentWidth = 0
      }
      currentWidth += width
    })
    return noOfLines
  }

  return { getInitCoordinates }
}

export default useSplash
