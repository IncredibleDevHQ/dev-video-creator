import { IntroState } from '../effects/fragments/IntroFragment'

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
  'full-left',
  'full-right',
  'split-without-media',
  'outro',
] as const

export const shortsLayoutTypes = [
  'classic',
  'padded-bottom-right-circle',
  'padded-bottom-right-tile',
  'bottom-right-tile',
  'bottom-right-circle',
  'split',
  'full-left',
  'full-right',
] as const

export const outroLayoutTypes = [
  'classic',
  'float-full-right',
  // 'float-full-left',
  'split-without-media',
] as const

export const introLayoutTypes = [
  'bottom-right-tile',
  'float-full-right',
] as const

export const shortsOutroLayoutTypes = ['classic', 'split'] as const

export type IntroLayout = typeof introLayoutTypes[number]

export type OutroLayout = typeof outroLayoutTypes[number]

export type Layout = typeof allLayoutTypes[number]

export type TransitionDirection = 'left' | 'right' | 'moveIn' | 'moveAway'

export type TopLayerChildren =
  | `transition ${TransitionDirection}`
  | 'lowerThird'
  | ''

export type Gradient = {
  id: number
  angle: number
  values: (number | string)[]
  cssString: string
}

export type GradientConfig = {
  id: number
  cssString: string
  values: (string | number)[]
  startIndex: { x: number; y: number }
  endIndex: { x: number; y: number }
}

export type CodeBlockView = {
  type: 'codeBlock'
  code: CodeBlockViewProps
}

export type CodeBlockViewProps = {
  animation: CodeAnimation
  highlightSteps?: CodeHighlightConfig[]
  theme: CodeTheme
  fontSize?: number
  codeStyle?: CodeStyle
}

export enum CodeAnimation {
  TypeLines = 'Type lines',
  HighlightLines = 'Highlight lines',
  // InsertInBetween = 'Insert in between',
}

export const enum CodeTheme {
  Light = 'light_vs',
  LightPlus = 'light_plus',
  QuietLight = 'quietlight',
  SolarizedLight = 'solarized_light',
  Abyss = 'abyss',
  Dark = 'dark_vs',
  DarkPlus = 'dark_plus',
  KimbieDark = 'kimbie_dark',
  Monokai = 'monokai',
  MonokaiDimmed = 'monokai_dimmed',
  Red = 'red',
  SolarizedDark = 'solarized_dark',
  TomorrowNightBlue = 'tomorrow_night_blue',
  HighContrast = 'hc_black',
}

export type CodeHighlightConfig = {
  step?: string
  from?: number
  to?: number
  valid?: boolean
  fileIndex?: number
  lineNumbers?: number[]
}

export enum CodeStyle {
  Editor = 'editor',
  Terminal = 'terminal',
}

export type ImageBlockView = {
  type: 'imageBlock'
  image: ImageBlockViewProps
}

export type ImageBlockViewProps = {
  captionTitleView?: CaptionTitleView
}

export type CaptionTitleView =
  | 'titleOnly'
  | 'captionOnly'
  | 'none'
  | 'titleAndCaption'

export type VideoBlockView = {
  type: 'videoBlock'
  video: VideoBlockViewProps
}

export type VideoBlockViewProps = {
  captionTitleView?: CaptionTitleView
}
export type ListBlockView = {
  type: 'listBlock'
  list: ListBlockViewProps
}

export type ListBlockViewProps = {
  viewStyle?: ListViewStyle
  appearance?: ListAppearance
  orientation?: ListOrientation
  displayTitle?: boolean
}

export type ListAppearance = 'stack' | 'replace' | 'allAtOnce'
export type ListViewStyle = 'none' | 'bullet' | 'number'
export type ListOrientation = 'horizontal' | 'vertical'

export type HeadingBlockView = {
  type: 'headingBlock'
}

export type HandleDetails = {
  enabled: boolean
  handle: string
}

export type OutroState = 'outroVideo' | 'titleSplash'
export type OutroBlockViewProps = {
  title?: string
  twitter?: HandleDetails
  discord?: HandleDetails
  youtube?: HandleDetails
  website?: HandleDetails
  linkedin?: HandleDetails
  noOfSocialHandles?: number
  order?: { enabled: boolean; state: OutroState }[]
}

export type OutroBlockView = {
  type: 'outroBlock'
  outro: OutroBlockViewProps
}

export type IntroBlockViewProps = {
  heading?: string
  name?: string
  designation?: string
  organization?: string
  displayPicture?: string
  order?: { enabled: boolean; state: IntroState }[]
}
export type IntroBlockView = {
  type: 'introBlock'
  intro: IntroBlockViewProps
}

export type BlockView =
  | CodeBlockView
  | ImageBlockView
  | VideoBlockView
  | ListBlockView
  | HeadingBlockView
  | OutroBlockView
  | IntroBlockView

export type BlockProperties = {
  gradient?: GradientConfig
  layout?: Layout
  bgColor?: string
  bgOpacity?: number
  view?: BlockView
}

export type TitleSplashConfig = {
  enable: boolean
  titleSplashConfig?: GradientConfig
}

export type ViewConfig = {
  mode: 'Portrait' | 'Landscape'
  titleSplash: TitleSplashConfig
  speakers: any[]
  blocks: {
    [key: string]: BlockProperties
  }
  selectedBlocks: { blockId: string; pos: number }[] // used to store blockids of selected blocks from timeline
  continuousRecording: boolean
}

export enum ConfigType {
  CODEJAM = 'codejam',
  VIDEOJAM = 'videojam',
  TRIVIA = 'trivia',
  POINTS = 'points',
}

export interface IFont {
  family: string
  type: 'google' | 'custom'
  url?: string
}

export interface BrandingJSON {
  colors?: {
    primary?: string
    secondary?: string
    tertiary?: string
    transition?: string
    text?: string
  }
  background?: {
    type?: 'image' | 'video' | 'color'
    url?: string
    color?: {
      primary?: string
      secondary?: string
      tertiary?: string
    }
  }
  logo?: string
  companyName?: string
  font?: {
    heading?: IFont
    body?: IFont
  }
  introVideoUrl?: string
  outroVideoUrl?: string
}
