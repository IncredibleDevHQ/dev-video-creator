export interface CodejamConfig {
  type: string
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
  type: string
  value: {
    videoURL: string
    // time in seconds
    from: number
    // time in seconds
    to: number
    // crop details
    x?: number
    y?: number
    width?: number
    height?: number
  }
  notes?: string[]
}

export interface TriviaConfig {
  type: string
  value: {
    id: string
    text: string
    image?: string
  }[]
  notes?: string[]
}

export interface PointsConfig {
  type: string
  value: {
    level?: number
    text: string
  }[]
  notes?: string[]
}

export interface ViewConfig {
  hasTitleSplash: boolean
  layoutNumber: number
  background: {
    type: 'color' | 'image'
    gradient: {
      type: 'linear' | 'radial'
      direction: 'horizontal' | 'vertical' | 'diagonal'
      values: {
        percentage: number
        color: string
      }[]
    }
    image: string
  }
}

export interface Config {
  dataConfig: (CodejamConfig | VideojamConfig | TriviaConfig | PointsConfig)[]
  viewConfig: ViewConfig[]
}
