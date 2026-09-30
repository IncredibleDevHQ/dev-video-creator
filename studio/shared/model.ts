import type { Branding } from './settings'
export type Presence = 'off' | 'low' | 'high'
export type Voice = { kind: 'record' } | { kind: 'ai' | 'clone'; id: string }
export type HarnessSelection = { adapter: 'claude-code' | 'codex' | 'kimi'; model?: string }
export type VideoSettings = { presence: Presence; voice: Voice; harness?: HarnessSelection }
export type CameraWindow = 'none' | 'full' | 'start' | 'end' | 'both'
export type MomentSegment = { id: string; lines: string; camera: boolean; estimate: number }
export type MediaClip = { start: number; end: number; camera: boolean; videoKey?: string; videoFrom?: number }
export type Moment = {
  id: string
  lines: string
  title?: string
  cue?: string
  plannedSeconds?: number
  segments?: MomentSegment[]
  media?: { inputKey: string; clips: MediaClip[] }
  start: number
  end: number
  camera: CameraWindow
  layout: 'full-screen' | 'corner' | 'beside-slide'
  overlay: 'title-card' | 'lower-third' | 'end-card' | null
  // A take is usable only for the exact recording inputs it was made for.
  recordingKey: string
  take: { id: string; recordingKey: string; objectKey: string; duration?: number } | null
  audio: { inputKey: string; objectKey: string; duration?: number } | null
  audioKey: string
}
export type ScenePhase = 'queued' | 'writing' | 'waiting' | 'producing' | 'produced' | 'changing' | 'replanning' | 'failed'
export type Scene = {
  id: string
  slideId: string
  phase: ScenePhase
  presence: Presence | null
  moments: Moment[]
  inputKey: string
  animationKey?: string
  animation?: {inputKey:string;objectKey:string;posterKey?:string;moments:Array<{id:string;start:number;end:number}>}
  planKey?: string
  creativePlan?: { recordId: string; inputKey: string }
  preview?: { planKey: string; objectKey: string; moments: Array<{id:string;start:number;end:number}> }
  editMomentId?: string
  instructions?: Array<{ momentId: string; second: number; instruction: string }>
  produced: { inputKey: string; objectKey: string; posterKey?: string } | null
  error: string | null
  failure?: 'planning' | 'production'
}
export type Slide = { draft?:boolean; id: string; title: string; svg: string | null; narration?: string; idea?: string; evidence?: string[] }
export type Transition = 'none' | 'crossfade' | 'push-left' | 'push-right' | 'push-up' | 'wipe' | 'zoom'
export type SceneInterval = { sceneId: string; start: number; duration: number }
export type Project = {
  harness?: HarnessSelection
  branding?: Branding
  id: string
  title: string
  source: string
  sourceUrl?: string
  slides: Slide[]
  video: {
    settings: VideoSettings
    phase?: 'idle' | 'preparing' | 'joining' | 'failed'
    error?: string | null
    scenes: Scene[]
    transitions: Transition[]
    inputKey: string
    produced: { inputKey: string; objectKey: string; posterKey?: string; clock?: SceneInterval[] } | null
  } | null
}
export type ChatAnchor = { stage: 'presentation'; slideId: string } | {
  stage: 'video'; sceneId: string; momentId: string; second: number
} | { stage: 'notebook' }
export type SceneAction = 'wait' | 'retry' | 'record' | 'produce' | 'download'
export type SceneView = {
  state: string
  action: SceneAction
  openMomentIds: string[]
  produced: boolean
}
export type ProjectEvent = {
  activity?: 'processing' | 'failed' | 'complete'
  sequence: number
  projectId: string
  time: string
  kind: 'scene' | 'slide' | 'chat' | 'video'
  sceneId?: string
  anchor?: ChatAnchor
  message: string
}

export type VideoView = { action: 'make-video' | 'produce-video' | 'export'; enabled: boolean; producedScenes: number; state?: string }
export type MomentView = { id: string; state: 'auto' | 'to record' | 'recorded' }

// Moment IDs are semantic within their scene; UI state uses the full scope.
export const momentViewKey=(sceneId:string,momentId:string)=>`${sceneId}/${momentId}`
