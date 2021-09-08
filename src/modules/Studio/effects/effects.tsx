import { Rect, Text } from 'react-konva'
import React, { useEffect } from 'react'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'
import CodeJam from './CodeJam'
import VideoJam from './VideoJam'
import SplashFour from './SplashFour'
import SplashFive from './SplashFive'
import Trivia from './Trivia'
import StoryBook from './StoryBook'
import Slides from './Slides'
import Points from './Points'
import { CONFIG } from '../components/Concourse'

const themeEnum = 'theme'
export interface Effect {
  controls: JSX.Element[]
  layerChildren: any[]
}

export const titleSplash = (title: string): JSX.Element => {
  const titleSplashChildern: JSX.Element = (
    <>
      <Rect fill="#E5E5E5" width={CONFIG.width} height={CONFIG.height} />
      <Rect fill="#FFFFFF" y={513 / 2 - 40} width={CONFIG.width} height={80} />
      <Text
        x={0}
        y={513 / 2 - 30}
        width={912}
        height={80}
        text={title}
        fill="#374151"
        textTransform="capitalize"
        fontStyle="normal 600"
        fontFamily="Poppins"
        fontSize={60}
        align="center"
      />
    </>
  )
  return titleSplashChildern
}

export const getDimensions = (
  img: { w: number; h: number },
  maxH: number,
  maxW: number,
  setImageDim: React.Dispatch<
    React.SetStateAction<{
      width: number
      height: number
      x: number
      y: number
    }>
  >
) => {
  let calWidth = 0
  let calHeight = 0
  let calX = 0
  let calY = 0
  const aspectRatio = img.w / img.h
  if (aspectRatio > maxW / maxH) {
    // horizontal img
    calY = Math.max((540 - maxW * (1 / aspectRatio)) / 2 - 30, 0)
    calX = 0
    calHeight = maxW * (1 / aspectRatio)
    calWidth = maxW
  } else if (aspectRatio <= maxW / maxH) {
    // sqr or vertical image
    calY = 0
    calX = (maxW - maxH * aspectRatio) / 2
    calHeight = maxH
    calWidth = maxH * aspectRatio
  }
  setImageDim({ width: calWidth, height: calHeight, x: calX, y: calY })
}

export const getEffect = (
  type: Fragment_Type_Enum_Enum,
  config: { properties: any }
) => {
  const theme = config.properties.find(
    (property: any) => property.key === themeEnum
  )
  switch (type) {
    case Fragment_Type_Enum_Enum.Splash:
      return theme.value === '0' ? SplashFive : SplashFour
    case Fragment_Type_Enum_Enum.CodeJam:
      return CodeJam
    case Fragment_Type_Enum_Enum.Videoshow:
      return VideoJam
    case Fragment_Type_Enum_Enum.Trivia:
      return Trivia
    case Fragment_Type_Enum_Enum.Storybook:
      return StoryBook
    case Fragment_Type_Enum_Enum.Slides:
      return Slides
    case Fragment_Type_Enum_Enum.Points:
      return Points
    default:
      throw Error('No effect found')
  }
}
