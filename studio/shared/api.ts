import type {
  ChatAnchor,
  Project,
  ProjectEvent,
  SceneView,
  VideoView,
  MomentView,
  Slide,
  Presence,
  Scene,
  Transition,
  StatusDisplay,
  ChangeTarget,
  SlideChange
} from './model'
export type SceneProgress = {
  stage: 'planning' | 'composition'
  active: boolean
  label: string
  updatedAt: string
}
export type Snapshot = {
  sceneProgress?: Record<string, SceneProgress>
  tokenUsage?: import('./usage').NotebookUsage
  stopping?: boolean
  readOnly?: boolean
  plannedSlides?: number
  /** The outline while its wireframes are drawn: titles and script first. */
  plan?: Array<{ id: string; title: string; narration: string }>
  /** Outline indexes of the pages the agent is drawing right now. */
  drawing?: number[]
  /** Wireframe changes waiting for, or with, the agent. */
  changes?: SlideChange[]
  progress?: { label: string; startedAt: string }
  project: Project
  status: 'reading' | 'draft' | 'building' | 'ready' | 'failed'
  sourceOnly?: boolean
  sourceFailure?: 'blocked'
  error: string | null
  events: ProjectEvent[]
  views?: {
    scenes: Record<string, SceneView>
    moments: Record<string, MomentView>
    video: VideoView
    presentation?: StatusDisplay
  }
  deletedSlide?: {
    slide: Slide
    index: number
    scene?: Scene
    seams?: Array<{ left: string; right: string; transition: Transition }>
  }
}
export type CreateProject = {
  sourceOnly?: boolean
  source: string
  harness?: import('./model').HarnessSelection
}
export type SlideEdit = {
  action: 'add' | 'duplicate' | 'delete' | 'move' | 'undo-delete' | 'script'
  slideId?: string
  index?: number
  /** The wireframe's script, for the 'script' action. */
  narration?: string
}
export type ChatRequest = {
  anchor: ChatAnchor
  instruction: string
  target?: ChangeTarget
}

export type ReplanPreview = {
  sceneId: string
  from: Presence
  to: Presence | null
  recordings: number
  message: string
}

export type RecordedPart = {
  momentId: string
  recordingKey: string
  from: number
  to: number
}

export type NotebookSummary = {
  id: string
  title: string
  status: Snapshot['status']
  hasVideo: boolean
  updatedAt: string | null
  site: string | null
  /** The first drawn slide, as the tile's picture. */
  preview: string | null
  slides: number
}

export type HarnessChoice = {
  id: import('./model').HarnessSelection['adapter']
  ok: boolean
  version?: string
  reason?: string
  models?: {
    source?: string
    default: string | null
    options: Array<{ id: string; label: string; unavailable?: string }>
  }
}
export type HarnessChoices = {
  selected: import('./model').HarnessSelection | null
  available: HarnessChoice[]
}
