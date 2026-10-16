// How long each episode runs, as one slider with two ends: the shortest and
// the longest, on stops that are fine where explainers live. Under it, what
// the window means: the words it allows and, when the cards' running time
// is known, about how many episodes they make. Its seconds ride in hidden
// fields, so a form reads it like any other field.
import {
  DEFAULT_LENGTH,
  EXPLAINER_CAP,
  LENGTH_STOPS,
  SWEET_SPOT,
  episodesFor,
  lengthLabel,
  stopOf,
  windowLabel,
  wordBudget
} from '../shared/length'
import type { LengthGoal } from '../shared/storyboard'
import { escape } from './ui'

const LAST = LENGTH_STOPS.length - 1
/** Where a length sits along the track, 0 to 1, between its stops. */
const along = (seconds: number) => {
  const next = LENGTH_STOPS.findIndex((stop) => stop >= seconds)
  if (next <= 0) return next === 0 ? 0 : 1
  const [a, b] = [LENGTH_STOPS[next - 1], LENGTH_STOPS[next]]
  return (next - 1 + (seconds - a) / (b - a)) / LAST
}
const fraction = (index: number) => (index / LAST).toFixed(4)

export type LengthRangeOptions = {
  /** The hidden fields' names: shortest, longest, must fit. */
  names?: { min: string; max: string; strict: string }
  /** What the window is for, after its figures: "each episode". */
  label?: string
  /** The cards to share out: how many, and how long they run, spoken. */
  material?: Material
}
type Material = { cards: number; seconds: number }

/** What a window means, in a line or two. */
export const lengthSay = (goal: LengthGoal, material?: Material) => {
  const [few, many] = wordBudget(goal)
  const episodes = material?.cards
    ? episodesFor(material.seconds, material.cards, goal)
    : 0
  const lines = [
    `About ${few}–${many} words${
      episodes
        ? ` · ${material!.cards} card${material!.cards === 1 ? '' : 's'} make about ${episodes} episode${episodes === 1 ? '' : 's'}`
        : ''
    }`
  ]
  if (goal.max > EXPLAINER_CAP)
    lines.push('Past 3 minutes an explainer tends to lose people.')
  return lines.map((line) => `<span>${escape(line)}</span>`).join('')
}

export const lengthRange = (
  goal: LengthGoal = DEFAULT_LENGTH,
  options: LengthRangeOptions = {}
) => {
  const names = options.names || { min: 'min', max: 'max', strict: 'strict' }
  const from = stopOf(goal.min)
  const to = Math.max(from + 1, stopOf(goal.max))
  const shown = { ...goal, min: LENGTH_STOPS[from], max: LENGTH_STOPS[to] }
  const tick = (seconds: number, label: string) =>
    `<span style="--at:${along(seconds).toFixed(4)}">${label}</span>`
  const material = options.material
  return `<div class="length-range" data-length-range${material?.cards ? ` data-cards="${material.cards}" data-seconds="${Math.round(material.seconds)}"` : ''} style="--from:${fraction(from)};--to:${fraction(to)};--sweet-from:${along(SWEET_SPOT[0]).toFixed(4)};--sweet-to:${along(SWEET_SPOT[1]).toFixed(4)}">
<div class="length-head"><b data-length-label>${windowLabel(shown)}</b><span>${escape(options.label || 'each episode')}</span><label class="length-strict"><input type="checkbox" name="${names.strict}" ${goal.strict ? 'checked' : ''}>Must fit</label></div>
<div class="length-track"><i class="length-sweet" title="Explainers hold a viewer best at 30–90 s"></i><i class="length-fill"></i><input type="range" min="0" max="${LAST}" step="1" value="${from}" data-length-end="min" aria-label="Shortest" aria-valuetext="${lengthLabel(shown.min)}"><input type="range" min="0" max="${LAST}" step="1" value="${to}" data-length-end="max" aria-label="Longest" aria-valuetext="${lengthLabel(shown.max)}"></div>
<div class="length-scale" aria-hidden="true">${tick(15, '15 s')}${tick(60, '1 min')}${tick(180, '3 min')}${tick(1200, '20 min')}</div>
<p class="length-say" data-length-say>${lengthSay(shown, material)}</p>
<input type="hidden" name="${names.min}" value="${shown.min}"><input type="hidden" name="${names.max}" value="${shown.max}">
</div>`
}

/** Brings every length slider under root to life. onChange hears each
 * move (done false) and each settled choice (done true). */
export const wireLengthRanges = (
  root: ParentNode,
  onChange?: (goal: LengthGoal, done: boolean) => void
) => {
  for (const box of root.querySelectorAll<HTMLElement>('[data-length-range]')) {
    if (box.dataset.wired) continue
    box.dataset.wired = 'yes'
    const [low, high] =
      box.querySelectorAll<HTMLInputElement>('input[type=range]')
    const strict = box.querySelector<HTMLInputElement>('input[type=checkbox]')!
    const [min, max] =
      box.querySelectorAll<HTMLInputElement>('input[type=hidden]')
    const material = box.dataset.cards
      ? {
          cards: Number(box.dataset.cards),
          seconds: Number(box.dataset.seconds)
        }
      : undefined
    const sync = (moved?: HTMLInputElement) => {
      // The ends never cross: the one moved stops a stop short of the other.
      if (Number(low.value) >= Number(high.value)) {
        if (moved === low) low.value = String(Number(high.value) - 1)
        else high.value = String(Number(low.value) + 1)
      }
      const goal: LengthGoal = {
        min: LENGTH_STOPS[Number(low.value)],
        max: LENGTH_STOPS[Number(high.value)],
        strict: strict.checked
      }
      box.style.setProperty('--from', fraction(Number(low.value)))
      box.style.setProperty('--to', fraction(Number(high.value)))
      low.setAttribute('aria-valuetext', lengthLabel(goal.min))
      high.setAttribute('aria-valuetext', lengthLabel(goal.max))
      min.value = String(goal.min)
      max.value = String(goal.max)
      box.querySelector('[data-length-label]')!.textContent = windowLabel(goal)
      box.querySelector('[data-length-say]')!.innerHTML = lengthSay(
        goal,
        material
      )
      return goal
    }
    for (const end of [low, high])
      end.addEventListener('input', () => onChange?.(sync(end), false))
    for (const input of [low, high, strict])
      input.addEventListener('change', () => onChange?.(sync(), true))
  }
}
