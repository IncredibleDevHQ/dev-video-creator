// What Jev suggests for a notebook from its source: the template, how to
// tell it, and what the source holds. Above the confidence threshold the
// template is preselected; below it the creator sees the top few to pick.
import { allowedPresets, directionSettings, narrativeById } from './catalog'
import { LENGTHS } from './presets'
import type {
  Audience,
  Direction,
  Drama,
  Elaboration,
  EvidenceKind,
  LengthRange,
  PresetId
} from './model'

/** Preselect only when Jev is at least this sure. */
export const SUGGEST_CONFIDENCE = 0.6

export type TemplateSuggestion = {
  at: string
  /** The likeliest templates, best first, with their probabilities. */
  narratives: Array<{ id: string; p: number }>
  confidence: number
  preset: PresetId
  length: LengthRange | null
  audience: Audience | null
  /** How likely the source holds each kind of evidence. */
  evidence: Partial<Record<EvidenceKind, number>>
  elaboration: Elaboration
  drama: Drama
  /** Whether the top template was set on the notebook. */
  preselected: boolean
  /** Made before the notes were last edited; a new one is on its way. */
  stale?: boolean
}

/** What Jev reads a wireframe as: the beat it carries, and how sure. */
export type CoverageReading = {
  at: string
  pages: Record<string, { beat: string; confidence: number }>
}

/** The direction a suggestion gives one template: only what differs. */
export const suggestedDirection = (
  narrativeId: string,
  suggestion: TemplateSuggestion
): Direction => {
  const narrative = narrativeById(narrativeId)!
  const preset = allowedPresets(narrative).some(
    (item) => item.id === suggestion.preset
  )
    ? suggestion.preset
    : narrative.preset
  const base = directionSettings(narrative, { preset })
  return {
    preset,
    ...(suggestion.length && suggestion.length.join() !== base.length.join()
      ? { length: suggestion.length }
      : {}),
    ...(suggestion.audience ? { audience: suggestion.audience } : {})
  }
}

/**
 * The length a source supports by its size, when Jev is unsure: about four
 * fifths of a second of video for each word (narration at 150 a minute,
 * with room to show things), as the longest range that starts below it.
 */
export const lengthForWords = (words: number): LengthRange => {
  const seconds = words * 0.8
  return (
    [...LENGTHS].reverse().find((range) => range[0] <= seconds) || LENGTHS[0]
  )
}
