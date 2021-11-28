import { FragmentParticipantFragment } from '../generated/graphql'

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

export interface BaseBlockProps {
  id: string
  x: number
  y: number
  height: number
  width: number
  title: string
  description: string
  layout: Layout
  background: GradientConfig | string
  notes: string[]
}

export interface Explanation {
  from: number
  to: number
  text: string
}

export interface ColorCode {
  color: string
  lineNumber: number
  content: string
}

export interface Crop {
  height: number
  width: number
  x: number
  y: number
}

export interface Clip {
  start: number
  end: number
}

export interface AssetTransformType {
  crop?: Crop
  clip?: Clip
}

export interface VideoJamBlockProps extends BaseBlockProps {
  type: 'video'
  source: string
  transform: AssetTransformType
}

export interface CodeJamBlockProps extends BaseBlockProps {
  type: 'code'
  code: string
  language: string
  isAutomated: boolean
  colorCodes: ColorCode[]
  explanation: Explanation
}

export interface BulletPointBlockProps extends BaseBlockProps {
  type: 'points'
  points: string[]
}

export interface ImageBlockProps extends BaseBlockProps {
  type: 'image'
  source: string | string[]
}

export type Block =
  | VideoJamBlockProps
  | CodeJamBlockProps
  | ImageBlockProps
  | BulletPointBlockProps

export type BlockProperties = {
  gradient?: GradientConfig
  layout?: Layout
}

export interface ViewConfig {
  mode: 'Portrait' | 'Landscape'
  showTitleSplash: boolean
  speakers: FragmentParticipantFragment[]
  blocks: {
    [key: string]: BlockProperties
  }
}
