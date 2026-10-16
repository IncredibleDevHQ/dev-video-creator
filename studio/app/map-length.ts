// The series' length window on the map. A chip on the series (and in the
// plan bar) opens the slider; moving it marks at once which episodes run
// outside the window, and letting go saves it for every episode whose video
// hasn't started.
import type { MapView } from '../shared/content-map'
import { DEFAULT_LENGTH, fitOf, windowLabel } from '../shared/length'
import type { LengthGoal } from '../shared/storyboard'
import { lengthRange, wireLengthRanges } from './length-range'
import { mapApi } from './map-api'
import type { MapCanvas } from './map-canvas'
import { closePopover, openPopover } from './popover'

/** The episodes a window leaves outside, said once; '' with none to say. */
export const outsideLine = (view: MapView, goal: LengthGoal) => {
  const open = view.episodes.filter((e) => !e.made && e.seconds)
  if (!open.length) return ''
  const outside = open.filter((e) => fitOf(e.seconds!, goal) !== 'within')
  if (!outside.length) return 'Every episode runs inside it.'
  return `<b>${outside.map((e) => `Ep ${e.number}`).join(', ')}</b> ${outside.length === 1 ? 'runs' : 'run'} outside it.`
}

/** Marks each lane's running time against a window, without a repaint. */
export const markRuns = (root: ParentNode, goal: LengthGoal) => {
  for (const runs of root.querySelectorAll<HTMLElement>('[data-runs]')) {
    const fit = fitOf(Number(runs.dataset.runs), goal)
    runs.classList.toggle('is-long', fit === 'long')
    runs.classList.toggle('is-short', fit === 'short')
  }
}

export const openLength = (map: MapCanvas, anchor: HTMLElement) => {
  const view = map.view
  const series = view?.series
  if (!view || !series) return
  const goal = series.length || DEFAULT_LENGTH
  // From the plan bar the plan is already being asked for.
  const planned = series.lines.length > 0 && !map.askingPlan
  const outside = outsideLine(view, goal)
  const panel = openPopover(
    anchor,
    'series-length',
    `${lengthRange(goal, {
      label: 'each episode',
      ...(series.cards
        ? { material: { cards: series.cards, seconds: series.seconds || 0 } }
        : {})
    })}<p class="length-fit" data-length-fit ${outside ? '' : 'hidden'}>${outside}</p>${
      planned
        ? `<div class="length-acts" data-length-acts ${outside.includes('outside') ? '' : 'hidden'}><button type="button" class="quiet" data-length-plan>Plan again to fit</button></div>`
        : ''
    }`,
    'length-popover'
  )
  if (!panel) return
  // Saved once the hand settles: arrow keys change it a stop at a time.
  let timer = 0
  let pending: LengthGoal | null = null
  const save = () => {
    window.clearTimeout(timer)
    const next = pending
    pending = null
    return next
      ? map.run(
          () => mapApi.brief(series.id, { length: next }),
          `Each episode now runs ${windowLabel(next)}${next.strict ? ', and must fit' : ''}`
        )
      : Promise.resolve(true)
  }
  wireLengthRanges(panel, (next, done) => {
    markRuns(map.root, next)
    const line = outsideLine(view, next)
    const fit = panel.querySelector<HTMLElement>('[data-length-fit]')!
    fit.innerHTML = line
    fit.hidden = !line
    const acts = panel.querySelector<HTMLElement>('[data-length-acts]')
    if (acts) acts.hidden = !line.includes('outside')
    if (!done) return
    pending = next
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void save(), 500)
  })
  panel
    .querySelector('[data-length-plan]')
    ?.addEventListener('click', async () => {
      closePopover()
      // The plan reads the window as saved: a move not yet saved goes first.
      if (await save()) map.askPlan()
    })
}
