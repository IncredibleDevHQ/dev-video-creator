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
export const getEffect = (
  type: Fragment_Type_Enum_Enum,
  config: { properties: any }
) => {
  switch (type) {
    case Fragment_Type_Enum_Enum.Splash:
      return config.properties[2].value === '0' ? SplashFive : SplashFour
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
