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

export const shortsLayoutTypes = [
  'classic',
  'padded-bottom-right-circle',
  'padded-bottom-right-tile',
  'bottom-right-tile',
  'bottom-right-circle',
  'split',
  'full',
] as const

export type Layout = typeof allLayoutTypes[number]

export type TransitionDirection = 'left' | 'right'

export type TopLayerChildren =
  | `transition ${TransitionDirection}`
  | 'lowerThird'
  | ''

export interface Gradient {
  id: number
  angle: number
  values: (number | string)[]
  cssString: string
}

export interface GradientConfig {
  id: number
  cssString: string
  values: (string | number)[]
  startIndex: { x: number; y: number }
  endIndex: { x: number; y: number }
}

export enum CodeAnimation {
  TypeLines = 'Type lines',
  HighlightLines = 'Highlight lines',
}

export const enum CodeTheme {
  DarkPlus = 'dark_plus',
}

export interface CodeHighlightConfig {
  step?: string
  from?: number
  to?: number
  valid?: boolean
  fileIndex?: number
}

export interface CodeBlockViewProps {
  animation: CodeAnimation
  highlightSteps?: CodeHighlightConfig[]
  theme: CodeTheme
}

export interface CodeBlockView {
  type: 'codeBlock'
  code: CodeBlockViewProps
}

export interface ImageBlockView {
  type: 'imageBlock'
  image: never
}

export type BlockView = CodeBlockView | ImageBlockView

export type BlockProperties = {
  gradient?: GradientConfig
  layout?: Layout
  bgColor?: string
  bgOpacity?: number
  view?: BlockView
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

export enum ConfigType {
  CODEJAM = 'codejam',
  VIDEOJAM = 'videojam',
  TRIVIA = 'trivia',
  POINTS = 'points',
}
