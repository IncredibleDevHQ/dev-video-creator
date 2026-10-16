// An episode's length window, as one set of rules for the slider, the
// planners and the checks: the stops the slider moves through, how a window
// reads, how many words it allows, and whether a running time fits it.
// The numbers follow HyperFrames: about 2.5 words a second with room to
// breathe (hyperframes-creative/references/narration.md), and a faceless
// explainer at its best between 30 and 90 seconds, rarely past 3 minutes.
import type { LengthGoal } from './storyboard'

/** The slider's stops, in seconds: fine where explainers live, coarser past
 * them. */
export const LENGTH_STOPS = [
  15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 420, 600, 900, 1200
]

export const DEFAULT_LENGTH: LengthGoal = { min: 45, max: 120, strict: false }

/** Where explainers hold a viewer best, and where they start to lose one. */
export const SWEET_SPOT: [number, number] = [30, 90]
export const EXPLAINER_CAP = 180

/** A script's pace for budgeting: a little under the 2.6 words a second the
 * checks expect, so a script that fits its budget fits its time. */
export const WORDS_PER_SECOND = 2.5

/** The stop nearest a length. */
export const stopOf = (seconds: number) =>
  LENGTH_STOPS.reduce(
    (best, stop, index) =>
      Math.abs(stop - seconds) < Math.abs(LENGTH_STOPS[best] - seconds)
        ? index
        : best,
    0
  )

/** A window's ends as stops: each at its nearest, the shorter one below the
 * longer, so every window has two ends the slider can show. */
export const windowStops = (goal: Pick<LengthGoal, 'min' | 'max'>) => {
  const from = Math.min(stopOf(goal.min), LENGTH_STOPS.length - 2)
  return [from, Math.max(from + 1, stopOf(goal.max))] as [number, number]
}

const minutes = (seconds: number) => {
  const value = Math.round((seconds / 60) * 2) / 2
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** A length as people say it: "45 s", "3 min", "1.5 min". */
export const lengthLabel = (seconds: number) =>
  seconds < 120 ? `${Math.round(seconds)} s` : `${minutes(seconds)} min`

/** A window as people say it: "60–120 s", "3–5 min", "90 s–3 min". */
export const windowLabel = (goal: Pick<LengthGoal, 'min' | 'max'>) =>
  goal.max <= 120
    ? `${goal.min}–${goal.max} s`
    : goal.min >= 120
      ? `${minutes(goal.min)}–${minutes(goal.max)} min`
      : `${lengthLabel(goal.min)}–${lengthLabel(goal.max)}`

/** The words a window allows in all, rounded to fives. */
export const wordBudget = (goal: Pick<LengthGoal, 'min' | 'max'>) =>
  [goal.min, goal.max].map(
    (seconds) => Math.round((seconds * WORDS_PER_SECOND) / 5) * 5
  ) as [number, number]

/** Whether a running time sits in the window, with the give the episode
 * plan has always allowed: a tenth under the shortest, a twentieth over the
 * longest. */
export const fitOf = (
  seconds: number,
  goal: Pick<LengthGoal, 'min' | 'max'>
): 'short' | 'within' | 'long' =>
  seconds > goal.max * 1.05
    ? 'long'
    : seconds < goal.min * 0.9
      ? 'short'
      : 'within'

/** What an episode speaks besides its cards, as measured on planned
 * series: a line into each card, about 6 s, and a closing line, about 9 s. */
export const SEGUE = { card: 6, close: 9 }

/** An episode's running time from its cards' own: each card, the line into
 * it, and the episode's close. */
export const withSegues = (cards: number[]) =>
  cards.length
    ? cards.reduce((sum, seconds) => sum + seconds + SEGUE.card, 0) +
      SEGUE.close
    : 0

/** About how many episodes cards make at this length, segues counted:
 * their running time over the middle of the window. */
export const episodesFor = (
  seconds: number,
  cards: number,
  goal: Pick<LengthGoal, 'min' | 'max'>
) => {
  const middle = (goal.min + goal.max) / 2
  return Math.max(
    1,
    Math.round(
      (seconds + cards * SEGUE.card) /
        Math.max(middle - SEGUE.close, middle / 2)
    )
  )
}
