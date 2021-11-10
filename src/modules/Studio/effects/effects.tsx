import React from 'react'
import { Rect, Text } from 'react-konva'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'
import { CONFIG } from '../components/Concourse'
import CustomSplash from './CustomSplash'
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
    case Fragment_Type_Enum_Enum.Outro:
      return getSplash(theme)
    default:
      throw Error('No effect found')
  }
}
