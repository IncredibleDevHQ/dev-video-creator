// What a scene's planner is told about the video's narrative: the story it
// tells, how this telling sounds, and the beats this scene carries. The
// planner decides the shots, the moments and where the words go.
import type { Presence } from '../model'
import {
  allocateBeats,
  assignBeats,
  speakerFor,
  type BeatPlan
} from './allocate'
import {
  directionSettings,
  narrativeById,
  presetById,
  presetFor
} from './catalog'
import {
  AUDIENCE_LABELS,
  EVIDENCE_LABELS,
  FUNCTION_LABELS,
  SPEAKER_LABELS,
  lengthLabel,
  type Direction,
  type Drama,
  type Elaboration,
  type LengthRange,
  type Structure
} from './model'

type NarratedVideo = {
  settings: { narrative?: string; direction?: Direction }
  scenes: Array<{ id: string; beats?: string[] | null }>
}

/**
 * The video's narrative, its direction, and the beats one scene carries:
 * the creator's choice for the scene, else its share in order.
 */
export const sceneNarrative = (
  video: NarratedVideo | null | undefined,
  sceneId: string
) => {
  const narrative = narrativeById(video?.settings.narrative)
  const index = video?.scenes.findIndex((scene) => scene.id === sceneId) ?? -1
  if (!video || !narrative || index < 0) return null
  const settings = directionSettings(narrative, video.settings.direction)
  const plans = allocateBeats(narrative, settings)
  const assigned = assignBeats(plans, video.scenes.length)
  const chosen = (video.scenes[index].beats || []).filter((id) =>
    plans.some((plan) => plan.beat.id === id)
  )
  const ids = chosen.length ? chosen : assigned[index]
  const beats = ids.map((id) => plans.find((plan) => plan.beat.id === id)!)
  // A beat split over several scenes gives each its part of the time.
  const share = (plan: BeatPlan, end: 0 | 1) =>
    plan.seconds[end] /
    Math.max(1, assigned.filter((list) => list.includes(plan.beat.id)).length)
  const seconds: LengthRange = [0, 1].map((end) =>
    Math.round(beats.reduce((sum, plan) => sum + share(plan, end as 0 | 1), 0))
  ) as LengthRange
  return {
    narrative,
    preset: presetFor(narrative, video.settings.direction?.preset),
    settings,
    plans,
    beats,
    seconds,
    index,
    count: video.scenes.length
  }
}
export type SceneNarrative = NonNullable<ReturnType<typeof sceneNarrative>>

const DRAMA_NOTES: Record<Drama, string> = {
  calm: 'calm and clear: steady pacing, no hype',
  lively: 'lively: brisk, with energy in the voice and the motion',
  dramatic: 'dramatic: tension first, sharp cuts and a reveal'
}
const ELABORATION_NOTES: Record<Elaboration, string> = {
  brief: 'brief: only what each beat needs',
  standard: 'standard: one example for each point',
  thorough: 'thorough: worked examples, and the reasons behind each step'
}
const STRUCTURE_NOTES: Record<Structure, string> = {
  chronological: 'told in order',
  'cold-open':
    'a cold open: the video opens on its most striking moment from later on, then goes back to the start',
  'result-first': 'result first: the end result, then how it came about',
  'question-led': 'question-led: each part opens on the question it answers'
}

/** What the planner is told about the narrative, for one scene. */
export type NarrativeBrief = {
  narrative: string
  line: string
  audience: string
  rules: string[]
  direction: string
  length: string
  drama: string
  elaboration: string
  structure: string
  leads: string[]
  /** Every beat this telling tells, in order: the video's spine. */
  spine: string[]
  beats: Array<{
    name: string
    function: string
    know: string
    evidence: string[]
    expansions: string[]
  }>
  position: string
  seconds: string
  speaker: string
}
export const narrativeBrief = (
  shape: SceneNarrative,
  presence: Presence
): NarrativeBrief => {
  const { narrative, settings } = shape
  const place =
    presence === 'off'
      ? 'off'
      : speakerFor(
          settings.onCamera,
          shape.beats.map((plan) => plan.beat),
          shape.index === 0,
          shape.index === shape.count - 1
        )
  return {
    narrative: narrative.name,
    line: narrative.line,
    audience: settings.audience
      ? AUDIENCE_LABELS[settings.audience]
      : narrative.audience,
    rules: narrative.rules,
    direction: presetById(shape.preset)!.name,
    length: lengthLabel(settings.length),
    drama: DRAMA_NOTES[settings.drama],
    elaboration: ELABORATION_NOTES[settings.elaboration],
    structure: STRUCTURE_NOTES[settings.structure],
    leads: settings.leads.map((kind) => EVIDENCE_LABELS[kind]),
    spine: shape.plans
      .filter((plan) => plan.told)
      .map((plan) => plan.beat.name),
    beats: shape.beats.map(({ beat, expanded }) => ({
      name: beat.name,
      function: FUNCTION_LABELS[beat.function],
      know: beat.know,
      evidence: beat.evidence.map((kind) => EVIDENCE_LABELS[kind]),
      expansions: expanded ? beat.expansions : []
    })),
    position: `${shape.index + 1} of ${shape.count}`,
    seconds: lengthLabel(shape.seconds),
    speaker: SPEAKER_LABELS[place]
  }
}
