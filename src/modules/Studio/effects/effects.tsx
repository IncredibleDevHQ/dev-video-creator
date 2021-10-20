import React from 'react'
import { Rect, Text } from 'react-konva'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'
import { CONFIG } from '../components/Concourse'
import AstroCodeJam from './Astro/AstroCodeJam'
import AstroVideoJam from './Astro/AstroVideoJam'
import CodeJam from './CodeJamTemplates/CodeJam'
import CodeJamEight from './CodeJamTemplates/CodeJamEight'
import CodeJamEleven from './CodeJamTemplates/CodeJamEleven'
import CodeJamFive from './CodeJamTemplates/CodeJamFive'
import CodeJamNine from './CodeJamTemplates/CodeJamNine'
import CodeJamSeven from './CodeJamTemplates/CodeJamSeven'
import CodeJamTen from './CodeJamTemplates/CodeJamTen'
import CodeJamThree from './CodeJamTemplates/CodeJamThree'
import CodeJamTwelve from './CodeJamTemplates/CodeJamTwelve'
import CustomSplash from './CustomSplash'
import GraphQLCodeJam from './GraphQL/GraphQLCodeJam'
import GraphQLVideoJam from './GraphQL/GraphQLVideoJam'
import Outro from './Outro'
import Points from './Points'
import PointsEight from './PointsEight'
import PointsEleven from './PointsEleven'
import PointsFive from './PointsFive'
import PointsFour from './PointsFour'
import PointsNine from './PointsNine'
import PointsSeven from './PointsSeven'
import PointsSix from './PointsSix'
import PointsTen from './PointsTen'
import PointsThree from './PointsThree'
import PointsTwelve from './PointsTwelve'
import PointsTwo from './PointsTwo'
import Slides from './Slides'
import SlidesEleven from './SlidesEleven'
import SlidesFour from './SlidesFour'
import SlidesTen from './SlidesTen'
import SlidesThree from './SlidesThree'
import SlidesTwelve from './SlidesTwelve'
import SlidesTwo from './SlidesTwo'
import SplashEight from './SplashEight'
import SplashEighteen from './SplashEighteen'
import SplashEleven from './SplashEleven'
import SplashFifteen from './SplashFifteen'
import SplashFive from './SplashFive'
import SplashFour from './SplashFour'
import SplashFourteen from './SplashFourteen'
import SplashNine from './SplashNine'
import SplashNinteen from './SplashNinteen'
import SplashSeven from './SplashSeven'
import SplashSeventeen from './SplashSeventeen'
import SplashSix from './SplashSix'
import SplashSixteen from './SplashSixteen'
import SplashTen from './SplashTen'
import SplashThirteen from './SplashThirteen'
import SplashThree from './SplashThree'
import SplashTwelve from './SplashTwelve'
import SplashTwenty from './SplashTwenty'
import SplashTwentyOne from './SplashTwentyOne'
import StoryBook from './StoryBook'
import TensorFlowCodeJam from './TensorFlow/TensorFlowCodeJam'
import TensorFlowVideoJam from './TensorFlow/TensorFlowVideoJam'
import Trivia from './Trivia'
import TriviaEight from './TriviaEight'
import TriviaEleven from './TriviaEleven'
import TriviaFive from './TriviaFive'
import TriviaFour from './TriviaFour'
import TriviaNine from './TriviaNine'
import TriviaSeven from './TriviaSeven'
import TriviaSix from './TriviaSix'
import TriviaTen from './TriviaTen'
import TriviaThree from './TriviaThree'
import TriviaTwelve from './TriviaTwelve'
import TriviaTwo from './TriviaTwo'
import VideoJam from './VideoJamTemplates/VideoJam'
import VideoJamEleven from './VideoJamTemplates/VideoJamEleven'
import VideoJamFive from './VideoJamTemplates/VideoJamFive'
import VideoJamNine from './VideoJamTemplates/VideoJamNine'
import VideoJamSeven from './VideoJamTemplates/VideoJamSeven'
import VideoJamTen from './VideoJamTemplates/VideoJamTen'
import VideoJamThree from './VideoJamTemplates/VideoJamThree'
import VideoJamTwelve from './VideoJamTemplates/VideoJamTwelve'
import VideoJamTwo from './VideoJamTemplates/VideoJamTwo'

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
  if (theme.value === '3') return SplashFifteen
  if (theme.value === '4') return SplashSixteen
  if (theme.value === '5') return SplashSeventeen
  if (theme.value === '6') return SplashEighteen
  if (theme.value === '7') return SplashNine
  if (theme.value === '8') return SplashSeven
  if (theme.value === '9') return SplashNinteen
  if (theme.value === '10') return SplashTwenty
  if (theme.value === '11') return SplashTwentyOne
  if (theme.value === '12') return SplashTwelve
  if (theme.value === '13') return SplashThirteen
  if (theme.value === '14') return SplashFourteen
  if (theme.value === '15') return SplashFour
  if (theme.value === '16') return SplashEight
  if (theme.value === '17') return SplashSix
  if (theme.value === '18') return SplashEleven
  return CustomSplash
}

const getVideoTheme = (theme: any) => {
  if (theme.value === '1') return GraphQLVideoJam
  if (theme.value === '2') return VideoJamFive
  if (theme.value === '3') return AstroVideoJam
  if (theme.value === '4') return VideoJamSeven
  if (theme.value === '5') return TensorFlowVideoJam
  if (theme.value === '6') return VideoJamNine
  if (theme.value === '7') return VideoJamTwo
  if (theme.value === '8') return VideoJamThree
  if (theme.value === '9') return VideoJamTen
  if (theme.value === '10') return VideoJamEleven
  if (theme.value === '11') return VideoJamTwelve
  return VideoJam
}

const getCodeJamTheme = (theme: any) => {
  if (theme.value === '1') return GraphQLCodeJam
  if (theme.value === '2') return CodeJamThree
  if (theme.value === '3') return AstroCodeJam
  if (theme.value === '4') return CodeJamFive
  if (theme.value === '5') return TensorFlowCodeJam
  if (theme.value === '6') return CodeJamSeven
  if (theme.value === '7') return CodeJamEight
  if (theme.value === '8') return CodeJamNine
  if (theme.value === '9') return CodeJamTen
  if (theme.value === '10') return CodeJamEleven
  if (theme.value === '11') return CodeJamTwelve
  return CodeJam
}

const getTriviaTheme = (theme: any) => {
  if (theme.value === '1') return TriviaTwo // default
  if (theme.value === '2') return TriviaThree // open Sauced
  if (theme.value === '3') return TriviaFour // astro
  if (theme.value === '4') return TriviaFive // wtf js
  if (theme.value === '5') return TriviaSix // tensorflow
  if (theme.value === '6') return TriviaSeven // next js
  if (theme.value === '7') return TriviaEight // elastic
  if (theme.value === '8') return TriviaNine // hasura
  if (theme.value === '9') return TriviaTen // ts
  if (theme.value === '10') return TriviaEleven // Py tourch
  if (theme.value === '11') return TriviaTwelve // svelte
  return Trivia
}

const getPointsTheme = (theme: any) => {
  if (theme.value === '1') return PointsTwo //
  if (theme.value === '2') return PointsThree
  if (theme.value === '3') return PointsFour
  if (theme.value === '4') return PointsFive
  if (theme.value === '5') return PointsSix
  if (theme.value === '6') return PointsSeven
  if (theme.value === '7') return PointsEight // elastic
  if (theme.value === '8') return PointsNine // hasura
  if (theme.value === '9') return PointsTen // ts
  if (theme.value === '10') return PointsEleven // py tourch
  if (theme.value === '11') return PointsTwelve // svelte
  return Points
}

const getSlideTheme = (theme: any) => {
  if (theme.value === '7') return SlidesTwo
  if (theme.value === '8') return SlidesFour
  if (theme.value === '9') return SlidesTen
  if (theme.value === '5') return SlidesThree
  if (theme.value === '10') return SlidesEleven
  if (theme.value === '11') return SlidesTwelve
  return Slides
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
    case Fragment_Type_Enum_Enum.Solo:
      return StoryBook
    case Fragment_Type_Enum_Enum.Slides:
      return getSlideTheme(theme)
    case Fragment_Type_Enum_Enum.Points:
      return getPointsTheme(theme)
    case Fragment_Type_Enum_Enum.Outro:
      return Outro
    default:
      throw Error('No effect found')
  }
}
