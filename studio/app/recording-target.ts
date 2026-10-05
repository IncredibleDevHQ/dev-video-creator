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

/**
 * What a Record press records. The whole scene: every moment still waiting
 * for a take, or every moment again once all have one. One moment: the one
 * on show in practice, else the selected or next unfinished moment.
 */
export const recordingPlan = (
  moments: readonly Moment[],
  openIds: readonly string[],
  selected: number,
  options: {
    whole: boolean
    here: boolean
    needs: (moment: Moment) => boolean
  }
): Moment[] => {
  const recordable = moments.filter(options.needs),
    open = moments.filter((moment) => openIds.includes(moment.id))
  if (options.whole && recordable.length > 1)
    return open.length ? open : recordable
  const current = moments[selected]
  if (options.here && current && options.needs(current)) return [current]
  const target = recordingTarget(moments, openIds, selected)
  return target < 0 ? [] : [moments[target]]
}
