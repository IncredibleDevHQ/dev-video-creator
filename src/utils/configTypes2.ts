import { FlickParticipantsFragment } from '../generated/graphql'

export const allLayoutTypes = [
  'classic',
  'float-full-right',
  'float-full-left',
  'float-half-right',
  'padded-bottom-right-tile',
  'padded-bottom-right-circle',
  'bottom-right-tile',
  'bottom-right-circle',
  'padded-split',
  'split',
  'full',
] as const

export type Layout = typeof allLayoutTypes[number]

export interface Gradient {
  angle: number
  values: (number | string)[]
  cssString: string
}

export interface GradientConfig {
  cssString: string
  values: (string | number)[]
  startIndex: { x: number; y: number }
  endIndex: { x: number; y: number }
}

export type BlockProperties = {
  gradient?: GradientConfig
  layout?: Layout
}

export interface TitleSplashConfig {
  enable: boolean
  titleSplashConfig?: GradientConfig
}

export interface ViewConfig {
  mode: 'Portrait' | 'Landscape'
  titleSplash: TitleSplashConfig
  speakers: FlickParticipantsFragment[]
  blocks: {
    [key: string]: BlockProperties
  }
}
