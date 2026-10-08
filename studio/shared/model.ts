import type { Branding } from './settings'
import type {
  Direction,
  EvidenceAnswer,
  EvidenceNeed
} from './narratives/model'
export type Presence = 'off' | 'low' | 'high'
export type Voice = { kind: 'record' } | { kind: 'ai' | 'clone'; id: string }
export type HarnessSelection = {
  adapter: 'claude-code' | 'codex' | 'kimi'
  model?: string
}
export type VideoSettings = {
  presence: Presence
  voice: Voice
  harness?: HarnessSelection
  /** The story the video tells (shared/narratives), when one is chosen. */
  narrative?: string
  /** How this telling sounds and how long it runs, with the narrative. */
  direction?: Direction
}
export type CameraWindow = 'none' | 'full' | 'start' | 'end' | 'both'
export type MomentSegment = {
  id: string
  lines: string
  camera: boolean
  estimate: number
}
export type MediaClip = {
  start: number
  end: number
  camera: boolean
  videoKey?: string
  videoFrom?: number
}
export type Moment = {
  id: string
  lines: string
  extension?: {
    baseLines: string
    baseSeconds: number
    baseCamera?: CameraWindow
    baseSegments?: MomentSegment[]
    text: string
    seconds: number
  }
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
  take: {
    id: string
    number?: number
    uploadId?: string
    recordingKey: string
    objectKey: string
    duration?: number
  } | null
  audio: { inputKey: string; objectKey: string; duration?: number } | null
  audioKey: string
}
export type ScenePhase =
  // Not made yet: the creator left it out, so no agent works on it and
  // finishing the video leaves it out.
  | 'idle'
  | 'queued'
  | 'writing'
  | 'waiting'
  | 'producing'
  | 'produced'
  | 'changing'
  | 'replanning'
  | 'failed'
export type Scene = {
  id: string
  slideId: string
  phase: ScenePhase
  presence: Presence | null
  /** The narrative's beats the creator gave this scene; else its share. */
  beats?: string[] | null
  /** The shot the creator chose for this scene; else the orchestrator's. */
  shot?: string | null
  /** Asked for while its wireframe was still drawn: it starts once done. */
  afterDrawing?: true
  moments: Moment[]
  inputKey: string
  animationKey?: string
  animation?: {
    inputKey: string
    objectKey: string
    posterKey?: string
    moments: Array<{ id: string; start: number; end: number }>
  }
  planKey?: string
  creativePlan?: { recordId: string; inputKey: string }
  preview?: {
    planKey: string
    objectKey: string
    moments: Array<{ id: string; start: number; end: number }>
  }
  editMomentId?: string
  instructions?: Array<{
    momentId: string
    second: number
    instruction: string
  }>
  produced: { inputKey: string; objectKey: string; posterKey?: string } | null
  error: string | null
  failure?: 'planning' | 'production'
}
export type Slide = {
  draft?: boolean
  id: string
  title: string
  svg: string | null
  narration?: string
  idea?: string
  evidence?: string[]
  /** What the page is (title, list, diagram, numbers, quote, close) and
   * the parts it shows, as the story planned it. */
  pageKind?: string
  parts?: string[]
  /** The beats of the notebook's narrative this page carries. */
  beats?: string[]
  /** The evidence the page needs, and the creator's answers where the
   * source did not hold it. */
  needs?: EvidenceNeed[]
  answers?: EvidenceAnswer[]
  /** A product demo captured for this page's product-capture shot. */
  capture?: import('./release').ProductCapture
  /** On the map: the note this page came from, its topic, and whether the
   * creator set it aside or cut it into one episode only. */
  fromNote?: string
  topic?: string
  aside?: boolean
  onlyIn?: string
  /** In an episode: the map's page this is a copy of, the map's script it
   * started from, and the episode's own lines into and out of it. */
  copyOf?: import('./content-map').SlideCopy
  base?: string
  bridge?: string
  outro?: string
  /** What the line in and the line out were written for: kept until a
   * neighbouring page, or the episode before or after, changes. */
  bridgeFor?: string
  outroFor?: string
}
export type Transition =
  | 'none'
  | 'crossfade'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'wipe'
  | 'zoom'
export type SceneInterval = { sceneId: string; start: number; duration: number }
/** How long the creator wants the story: about 6, 10 or 14 wireframes. */
export type StoryLength = 'short' | 'medium' | 'long'
export const STORY_SCENES: Record<StoryLength, number> = {
  short: 6,
  medium: 10,
  long: 14
}
export type Project = {
  harness?: HarnessSelection
  branding?: Branding
  length?: StoryLength
  /** The story the wireframes are planned for, and how it is told. */
  narrative?: string
  direction?: Direction
  /** Linked repos: the local agent answers the pages' requests from them. */
  repos?: import('./repos').RepoLink[]
  /** The series this notebook is an episode of. */
  episode?: import('./series').EpisodeRef
  /** Product pages a demo can be captured from. */
  productUrls?: string[]
  /** What goes out once it is made: teasers, posts, the campaign. */
  release?: import('./release').Release
  /** Notes added after the wireframes, sorted into them as a content map. */
  notes?: import('./content-map').MapNote[]
  /** The map's topics, in order, when the creator grouped its pages. */
  topics?: string[]
  /** The series whose episodes copy this notebook's wireframes. */
  mapSeries?: string
  /** An episode: the map notebook its pages are copies from. */
  copyOfMap?: string
  /** The map's topics being grouped by the agent, or why they were not. */
  grouping?: { state: 'grouping' | 'failed'; error?: string }
  /** An episode's segues: being written, or why they could not be. */
  segues?: { state: 'writing' | 'failed'; error?: string }
  /** An episode whose pages the agent is choosing from what it is about. */
  picking?: {
    state: 'picking' | 'failed'
    about: string
    /** The creator named it: the agent's title does not replace theirs. */
    titled?: boolean
    error?: string
  }
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
    produced: {
      inputKey: string
      objectKey: string
      posterKey?: string
      clock?: SceneInterval[]
    } | null
  } | null
}
/** The part of a wireframe a change points at (review 5: pin a change). */
export type ChangeTarget = { id: string; label: string; kind: string }
/** A requested wireframe change, queued until the agent is free. */
export type SlideChange = {
  id: string
  slideId: string
  instruction: string
  target?: ChangeTarget
  state: 'queued' | 'working' | 'failed'
  at: string
  startedAt?: string
  message?: string
}
export type ChatAnchor =
  | { stage: 'presentation'; slideId: string }
  | {
      stage: 'video'
      sceneId: string
      momentId: string
      second: number
    }
  | { stage: 'notebook' }
export type SceneAction =
  | 'wait'
  | 'retry'
  | 'record'
  | 'produce'
  | 'download'
  | 'make'
export type StatusDisplay = { label: string; active: boolean }
export type SceneDisplay = StatusDisplay & {
  busy: boolean
  queued: boolean
  failed: boolean
  canRecord: boolean
  actionLabel: string
  railLabel: string
  needsAnimation: boolean
  /** False when the creator left the scene out of the video. */
  inVideo?: boolean
}
export type VideoDisplay = StatusDisplay & { actionLabel: string }
export type SceneView = {
  display?: SceneDisplay
  state: string
  action: SceneAction
  openMomentIds: string[]
  produced: boolean
}
export type SceneStage =
  | 'artwork'
  | 'brief'
  | 'planning'
  | 'script'
  | 'recordings'
  | 'voice'
  | 'composition'
  | 'animation-render'
  | 'render'
  | 'save'
export type SceneProgressReporter = (
  message: string,
  stage: SceneStage
) => Promise<unknown>
export type ProjectEvent = {
  stage?: SceneStage
  activity?: 'processing' | 'failed' | 'complete'
  sequence: number
  projectId: string
  time: string
  kind: 'scene' | 'slide' | 'chat' | 'video'
  sceneId?: string
  anchor?: ChatAnchor
  message: string
}

export type VideoView = {
  display?: VideoDisplay
  action: 'make-video' | 'produce-video' | 'export'
  enabled: boolean
  producedScenes: number
  /** The scenes in the video: every scene but those left out. */
  madeScenes?: number
  state?: string
}
export type MomentView = {
  id: string
  state: 'auto' | 'to record' | 'recorded'
}

// Moment IDs are semantic within their scene; UI state uses the full scope.
export const momentViewKey = (sceneId: string, momentId: string) =>
  `${sceneId}/${momentId}`
