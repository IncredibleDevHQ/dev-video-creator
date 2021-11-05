export interface ColorCode {
  color: string
  lineNumber: number
  content: string
}

export interface CommentExplanations {
  explanation: string | undefined
  from: number | undefined
  to: number | undefined
  // code: ColorCode[] | undefined
}

export interface CodejamConfig {
  id: string
  type: ConfigType
  title: string
  value: {
    gistURL: string
    explanations?: CommentExplanations[]
    isAutomated: boolean
    language: string
    code: string
    colorCodes: ColorCode[]
  }
  notes?: string[]
}

export interface VideojamConfig {
  id: string
  title: string
  type: ConfigType
  value: {
    videoURL: string
    // time in seconds
    from?: number
    // time in seconds
    to?: number
    // crop details
    x?: number
    y?: number
    width?: number
    height?: number
  }
  notes?: string[]
}

export interface TriviaConfig {
  id: string
  type: ConfigType
  title: string
  value: {
    text: string
    image?: string
  }
  notes?: string[]
}

export interface PointsConfig {
  id: string
  type: ConfigType
  title: string
  value: {
    level?: number
    text: string
  }[]
  notes?: string[]
}

export interface GradientConfig {
  cssString: string
  values: (string | number)[]
  startIndex: { x: number; y: number }
  endIndex: { x: number; y: number }
}
export interface LayoutConfig {
  id: string
  type: ConfigType
  layoutNumber: number
  background: {
    type: 'color' | 'image'
    gradient?: GradientConfig
    image?: string
  }
}

export interface ViewConfig {
  hasTitleSplash: boolean
  configs: LayoutConfig[]
}

export interface Config {
  dataConfig: (CodejamConfig | VideojamConfig | TriviaConfig | PointsConfig)[]
  viewConfig: ViewConfig
}

export enum ConfigType {
  CODEJAM = 'codejam',
  VIDEOJAM = 'videojam',
  TRIVIA = 'trivia',
  POINTS = 'points',
}
