import { Rect, Text } from 'react-konva'
import React from 'react'
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
import CustomSplash from './CustomSplash'
import Discussion from './Discussion'
import SplashSix from './SplashSix'
import Outro from './Outro'
import SplashSeven from './SplashSeven'
import SplashEight from './SplashEight'
import SplashNine from './SplashNine'
import SplashEleven from './SplashEleven'
import VideoJamTwo from './VideoJamTwo'
import VideoJamThree from './VideoJamThree'
import SplashTwelve from './SplashTwelve'
import SplashThirteen from './SplashThirteen'
import SplashFourteen from './SplashFourteen'
import VideoJamFour from './VideoJamFour'
import SplashThree from './SplashThree'
import CodeJamTwo from './CodeJamTwo'
import SplashTen from './SplashTen'
import CodeJamThree from './CodeJamThree'
import VideoJamFive from './VideoJamFive'
import TriviaTwo from './TriviaTwo'
import PointsTwo from './PointsTwo'
import TriviaThree from './TriviaThree'
import PointsThree from './PointsThree'

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

const getSplash = (theme: any) => {
  if (theme.value === '0') return SplashFive
  if (theme.value === '1') return SplashThree
  if (theme.value === '2') return SplashTen
  if (theme.value === '3') return SplashSix
  if (theme.value === '4') return SplashSeven
  if (theme.value === '5') return SplashEight
  if (theme.value === '6') return SplashNine
  if (theme.value === '7') return SplashEleven
  if (theme.value === '8') return SplashTwelve
  if (theme.value === '9') return SplashThirteen
  if (theme.value === '10') return SplashFourteen
  if (theme.value === '11') return SplashFour
  return CustomSplash
}

const getVideoTheme = (theme: any) => {
  if (theme.value === '1') return VideoJamFour
  if (theme.value === '2') return VideoJamFive
  if (theme.value === '3') return VideoJamTwo
  if (theme.value === '4') return VideoJamThree
  return VideoJam
}

const getCodeJamTheme = (theme: any) => {
  if (theme.value === '1') return CodeJamTwo
  if (theme.value === '2') return CodeJamThree
  return CodeJam
}

const getTriviaTheme = (theme: any) => {
  if (theme.value === '1') return TriviaTwo
  if (theme.value === '2') return TriviaThree
  return Trivia
}

const getPointsTheme = (theme: any) => {
  if (theme.value === '1') return PointsTwo
  if (theme.value === '2') return PointsThree
  return Points
}

export const getDimensions = (
  img: { w: number; h: number },
  maxH: number,
  maxW: number,
  x: number,
  y: number,
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
    calX = x
    calHeight = maxW * (1 / aspectRatio)
    calWidth = maxW
  } else if (aspectRatio <= maxW / maxH) {
    // sqr or vertical image
    calY = y
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
      return getSplash(theme)
    case Fragment_Type_Enum_Enum.CodeJam:
      return getCodeJamTheme(theme)
    case Fragment_Type_Enum_Enum.Videoshow:
      return getVideoTheme(theme)
    case Fragment_Type_Enum_Enum.Trivia:
      return getTriviaTheme(theme)
    case Fragment_Type_Enum_Enum.Storybook:
      return StoryBook
    case Fragment_Type_Enum_Enum.Slides:
      return Slides
    case Fragment_Type_Enum_Enum.Points:
      return getPointsTheme(theme)
    case Fragment_Type_Enum_Enum.Discussion:
      return Discussion
    case Fragment_Type_Enum_Enum.Outro:
      return Outro
    default:
      throw Error('No effect found')
  }
}
