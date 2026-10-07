// What a scene's planner is told about the video's narrative: the story it
// tells, how this telling sounds, and the beats this scene carries. The
// planner decides the shots, the moments and where the words go.
import type { Presence } from '../model'
import { allocateBeats, assignBeats, speakerFor } from './allocate'
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

type NarrativeSettings = { narrative?: string; direction?: Direction }

/**
 * The video's narrative, its direction, and the beats the scene at one
 * place carries: the creator's choice for it, else its share in order.
 */
export const narrativeAt = (
  settings: NarrativeSettings,
  index: number,
  count: number,
  chosen?: string[] | null
) => {
  const narrative = narrativeById(settings.narrative)
  if (!narrative || index < 0 || index >= count) return null
  const direction = directionSettings(narrative, settings.direction)
  const plans = allocateBeats(narrative, direction)
  const assigned = assignBeats(plans, count)
  const own = (chosen || []).filter((id) =>
    plans.some((plan) => plan.beat.id === id)
  )
  const ids = own.length ? own : assigned[index]
  const planOf = (id: string) => plans.find((plan) => plan.beat.id === id)!
  // A beat split over several scenes gives each its part of the time; a
  // chosen beat this telling leaves out takes the scene's own share.
  const timeOf = (list: string[]) =>
    [0, 1].map((end) =>
      Math.round(
        list.reduce(
          (sum, id) =>
            sum +
            planOf(id).seconds[end] /
              Math.max(1, assigned.filter((item) => item.includes(id)).length),
          0
        )
      )
    ) as LengthRange
  const seconds = timeOf(ids)
  return {
    narrative,
    preset: presetFor(narrative, settings.direction?.preset),
    settings: direction,
    plans,
    beats: ids.map(planOf),
    seconds: seconds[1] ? seconds : timeOf(assigned[index]),
    index,
    count
  }
}

/** The narrative as one scene of a video carries it. */
export const sceneNarrative = (
  video:
    | {
        settings: NarrativeSettings
        scenes: Array<{ id: string; beats?: string[] | null }>
      }
    | null
    | undefined,
  sceneId: string
) => {
  const index = video?.scenes.findIndex((scene) => scene.id === sceneId) ?? -1
  return video && index >= 0
    ? narrativeAt(
        video.settings,
        index,
        video.scenes.length,
        video.scenes[index].beats
      )
    : null
}
export type SceneNarrative = NonNullable<ReturnType<typeof narrativeAt>>

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
