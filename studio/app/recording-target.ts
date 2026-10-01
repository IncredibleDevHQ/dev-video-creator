import type { Moment } from '../shared/model'
/** Prefer the user's selected unfinished moment, then offer the next missing take. */
export const recordingTarget = (
  moments: readonly Moment[],
  openIds: readonly string[],
  selected: number
) =>
  openIds.includes(moments[selected]?.id)
    ? selected
    : moments.findIndex((moment) => openIds.includes(moment.id))
