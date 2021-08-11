import React from 'react'
import { Fragment_Type_Enum_Enum } from '../../../generated/graphql'
import CodeJam from './CodeJam'
import VideoJam from './VideoJam'
import Intro from './Splash'

export interface Effect {
  controls: JSX.Element[]
  layerChildren: any[]
}

export const getEffect = (type: Fragment_Type_Enum_Enum) => {
  switch (type) {
    case Fragment_Type_Enum_Enum.Splash:
      return Intro
    case Fragment_Type_Enum_Enum.CodeJam:
      return CodeJam
    case Fragment_Type_Enum_Enum.Videoshow:
      return VideoJam
    default:
      throw Error('No effect found')
  }
}
