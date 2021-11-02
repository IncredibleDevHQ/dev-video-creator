export interface CodejamConfig {
  id: string
  type: ConfigType
  title: string
  value: {
    gistURL: string
    explanations?: {
      explanation: string
      from: number
      to: number
      id: string
    }[]
    isAutomated: boolean
    language: string
    code: string
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

export interface LayoutConfig {
  id: string
  type: ConfigType
  layoutNumber: number
  background: {
    type: 'color' | 'image'
    gradient?: {
      type: 'linear' | 'radial'
      direction: 'horizontal' | 'vertical' | 'diagonal'
      values: (string | number)[]
    }
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
