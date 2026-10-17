// Storyboard production: an episode made as one Hyperframes project. The plan
// is Hyperframes' faceless-explainer structure for every scene (message,
// structure, frames with type, beat and key message); only how a scene is
// built differs by its type.

/** How a scene is built. Every type plans its frames the same way. */
export type BuildType = 'faceless' | 'motion' | 'camera' | 'screen'
export const BUILD_TYPES: BuildType[] = [
  'faceless',
  'motion',
  'camera',
  'screen'
]
export const BUILD_LABELS: Record<BuildType, string> = {
  faceless: 'Faceless',
  motion: 'Motion graphics',
  camera: 'On camera',
  screen: 'Screen demo'
}

/** Hyperframes' shared frame type enum, used for teaching (story-design.md). */
export const FRAME_TYPES = [
  'hook',
  'pain_point',
  'product_intro',
  'feature_showcase',
  'benefit_highlight',
  'social_proof',
  'branding',
  'cta'
] as const
export type FrameType = (typeof FRAME_TYPES)[number]

/** The four explainer structures; a compound names an outer and an inner. */
export const STRUCTURES = [
  'concept-explainer',
  'how-to-process',
  'listicle',
  'story-explainer'
] as const

/** The registry transitions a frame may enter with (story-design.md). */
export const TRANSITIONS = [
  'cut',
  'crossfade',
  'blur-crossfade',
  'push-slide LEFT',
  'push-slide RIGHT',
  'push-slide UP',
  'push-slide DOWN',
  'zoom-through',
  'squeeze'
] as const
export type FrameTransition = (typeof TRANSITIONS)[number]

/** How each transition reads on the page. */
export const TRANSITION_LABELS: Record<FrameTransition, string> = {
  cut: 'Cut',
  crossfade: 'Crossfade',
  'blur-crossfade': 'Blur crossfade',
  'push-slide LEFT': 'Push left',
  'push-slide RIGHT': 'Push right',
  'push-slide UP': 'Push up',
  'push-slide DOWN': 'Push down',
  'zoom-through': 'Zoom through',
  squeeze: 'Squeeze'
}

/** A crossfade where one scene gives way to the next runs this long, so the
 * change reads; within a scene the registry's own length holds. */
export const SCENE_CHANGE_SECONDS = 0.8

/** The `transition_in` Hyperframes is given for a frame. */
export const transitionIn = (
  transition: FrameTransition,
  opensScene: boolean
) =>
  opensScene && /crossfade$/.test(transition)
    ? `${transition} ${SCENE_CHANGE_SECONDS}s`
    : transition

/** The nine opening strategies (story-design.md § Hook strategy). */
export const HOOK_STRATEGIES = [
  'Shocking statistic',
  'Rhetorical question',
  'Counterintuitive claim',
  'Pain validation',
  'Visceral metaphor',
  'Concept announcement',
  'Direct address',
  'Imagine / scenario',
  'Stakes / consequence'
] as const

export type PlanFrame = {
  /** Its number across the episode, from 1. */
  number: number
  title: string
  /** One clear visual idea. */
  scene: string
  /** The words spoken over it: a piece of its page's script, or ''. */
  voiceover: string
  /** Seconds, an estimate until the voice is measured. */
  duration: number
  transition: FrameTransition
  /** Why a frame that opens a new scene enters with a cut, when it does. */
  transitionWhy?: string
  type: FrameType
  persuasion: string
  beat: string
  /** A candidate blueprint id, when a proven shape fits the beat. */
  blueprint?: string
  /** The brand's logo appears in this frame (an end card, a corner mark). */
  logo?: boolean
  narrativeRole: string
  keyMessage: string
}

export type PlanScene = {
  /** The page (wireframe) this scene tells. */
  pageId: string
  build: BuildType
  /** Why this build suits the scene, in a line. */
  buildReason: string
  frames: PlanFrame[]
}

/** `## Video direction`, written once for the episode (visual-design.md). */
export type VideoDirection = {
  palette: string
  motion: string
  held: string
  never: string
}

export type EpisodePlan = {
  message: string
  audience: string
  /** One structure, or a named compound ("concept-explainer with process"). */
  structure: string
  /** The opening strategy, one of HOOK_STRATEGIES. */
  hook: string
  /** How this episode carries the series: the callback in, the hand-off out. */
  continuity?: string
  direction: VideoDirection
  scenes: PlanScene[]
}

/** One window of a frame's time-coded shot (visual-design.md). */
export type ShotWindow = { from: number; to: number; text: string }
export type FrameShot = {
  number: number
  /** A blueprint id with its posture, "dataviz-countup (Adapt)", or "compose". */
  blueprint: string
  /** For an Adapt: what is kept and what changes, in one line. */
  adapt?: string
  focal: string
  roles: string
  windows: ShotWindow[]
}

/** The length the creator asked for: a range, and whether it must fit. */
export type LengthGoal = { min: number; max: number; strict: boolean }

export type StoryboardStage =
  | 'plan'
  | 'review'
  | 'stills'
  | 'board'
  | 'voice'
  | 'shots'
  | 'frames'
  | 'assemble'
  | 'render'
  | 'done'

export const STAGE_LABELS: Record<StoryboardStage, string> = {
  plan: 'Planning the episode',
  review: 'Waiting for your approval',
  stills: 'Posing the stills',
  board: 'Waiting for your go on the stills',
  voice: 'Recording the voice',
  shots: 'Designing the shots',
  frames: 'Building the frames',
  assemble: 'Assembling and checking',
  render: 'Rendering',
  done: 'Made'
}

/** A frame's state as Hyperframes names it: `built` once its still is posed
 * (its layout, at its key moment), `animated` once its motion is built. */
export type FrameStatus = 'outline' | 'built' | 'animated' | 'failed'

/** The frame as the creator sees it in the plan. */
export type FrameSummary = Pick<
  PlanFrame,
  | 'number'
  | 'title'
  | 'scene'
  | 'voiceover'
  | 'duration'
  | 'transition'
  | 'transitionWhy'
  | 'type'
  | 'beat'
  | 'narrativeRole'
  | 'keyMessage'
> & {
  status: FrameStatus
  problem?: string
  /** Its own words still promise past the creator's after one rewrite:
   * what to check, until the creator keeps them or asks again (review 8). */
  claim?: string
  /** When its still was posed: the still exists, and this names its version. */
  still?: string
}

export type SceneSummary = {
  pageId: string
  build: BuildType
  buildReason: string
  frames: FrameSummary[]
  /** A camera scene's take: waiting until recorded or uploaded. */
  take?: { objectKey: string; duration: number } | null
}

/** The files a take may be, and the extension each is kept with: a camera
 * scene's take is a video, a spoken scene's may be its sound alone. */
export const TAKE_TYPES: Record<string, string> = {
  'video/webm': '.webm',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav'
}

/** A storyboard video's state, kept on the notebook (project.video). */
export type Storyboard = {
  /** The wireframes changed after this production began. */
  stale?: boolean
  /** The wireframes changed while its first plan was being made: it plans
   * again with them before anything waits for approval. */
  replan?: boolean
  /** The creator stopped it: the work in flight ends and what is made stays. */
  stopping?: boolean
  /** The production: one Hyperframes project on disk. */
  id: string
  /** The pages this episode tells, in order. */
  pages: string[]
  length?: LengthGoal
  stage: StoryboardStage
  status: 'working' | 'waiting' | 'failed' | 'done'
  /** What it waits for: the creator's approval, or a camera scene's take. */
  waitingFor?: 'approval' | 'takes'
  error?: string
  /** The approved (or proposed) plan, in the creator's terms. */
  plan?: {
    message: string
    audience: string
    structure: string
    hook: string
    continuity?: string
    scenes: SceneSummary[]
  }
  /** The creator's own build for a page, when they changed the agent's. */
  builds?: Record<string, BuildType>
  /** A change the creator asked the plan to take, before approving it. */
  note?: string
  /** The creator's note on a still, by frame number: that frame is posed
   * again with it, and the note goes once it is. */
  frameNotes?: Record<number, string>
  /** Frames whose flagged words the creator kept as they are. */
  keptClaims?: number[]
  /** Pages whose take was replaced after they were voiced: made again. */
  redo?: string[]
  approved?: boolean
  contactSheetKey?: string
  /** The made video's poster: its hook, built. */
  posterKey?: string
  produced?: { objectKey: string; duration: number; posterKey?: string }
  /** Where the cut landed against the length asked for. */
  lengthNote?: string
  updatedAt: string
}

export const frameCount = (storyboard: Storyboard) =>
  (storyboard.plan?.scenes || []).reduce(
    (total, scene) => total + scene.frames.length,
    0
  )

/** Frames whose still is posed. */
export const framesPosed = (storyboard: Storyboard) =>
  (storyboard.plan?.scenes || []).reduce(
    (total, scene) =>
      total + scene.frames.filter((frame) => frame.still).length,
    0
  )

export const framesDone = (storyboard: Storyboard) =>
  (storyboard.plan?.scenes || []).reduce(
    (total, scene) =>
      total +
      scene.frames.filter((frame) => frame.status === 'animated').length,
    0
  )

/** A frame's id and file: `f03-the-hook`. Hyperframes names frames
 * `NN-name`, but its own lint refuses an id that starts with a digit (it
 * breaks `#id` selectors), and workers prefix their ids with the frame's. */
export const frameId = (frame: Pick<PlanFrame, 'number' | 'title'>) => {
  const slug =
    frame.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)
      .replace(/-+$/g, '') || 'frame'
  return `f${String(frame.number).padStart(2, '0')}-${slug}`
}
