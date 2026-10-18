import { expect, it } from 'vitest'
import {
  LENGTH_STOPS,
  episodesFor,
  fitOf,
  withSegues,
  lengthLabel,
  stopOf,
  windowLabel,
  wordBudget
} from '../shared/length'
import { lengthRange, lengthSay, wireLengthRanges } from '../app/length-range'
import { parseHTML } from 'linkedom'

it('updates the visible and submitted duration without an optional change callback', () => {
  const { document, window } = parseHTML(
    `<form>${lengthRange({ min: 45, max: 120, strict: false })}</form>`
  )
  wireLengthRanges(document)
  const low = document.querySelector<HTMLInputElement>(
    '[data-length-end="min"]'
  )!
  const high = document.querySelector<HTMLInputElement>(
    '[data-length-end="max"]'
  )!
  low.value = '0'
  low.dispatchEvent(new window.Event('input'))
  high.value = '2'
  high.dispatchEvent(new window.Event('change'))
  expect(document.querySelector('[data-length-label]')?.textContent).toBe(
    '15–30 s'
  )
  expect(document.querySelector<HTMLInputElement>('[name="min"]')?.value).toBe(
    '15'
  )
  expect(document.querySelector<HTMLInputElement>('[name="max"]')?.value).toBe(
    '30'
  )
  expect(high.getAttribute('aria-valuetext')).toBe('30 s')
})

it('reads a window as people say it, and budgets its words at HyperFrames’ pace', () => {
  expect(windowLabel({ min: 60, max: 90 })).toBe('60–90 s')
  expect(windowLabel({ min: 180, max: 300 })).toBe('3–5 min')
  expect(windowLabel({ min: 90, max: 180 })).toBe('90 s–3 min')
  expect(lengthLabel(150)).toBe('2.5 min')
  expect(wordBudget({ min: 60, max: 90 })).toEqual([150, 225])
  expect(stopOf(62)).toBe(LENGTH_STOPS.indexOf(60))
})

it('says whether a running time fits, with the plan’s give, and how many episodes cards make', () => {
  const goal = { min: 60, max: 90 }
  expect(fitOf(55, goal)).toBe('within')
  expect(fitOf(53, goal)).toBe('short')
  expect(fitOf(94, goal)).toBe('within')
  expect(fitOf(95, goal)).toBe('long')
  // Segues counted: 12 cards of 30 s, 72 s of lines into them, a close each.
  expect(episodesFor(360, 12, goal)).toBe(7)
  expect(episodesFor(10, 1, goal)).toBe(1)
  expect(withSegues([30, 30])).toBe(81)
  expect(withSegues([])).toBe(0)
})

it('draws the slider on its stops, with fields a form reads and what the window means', () => {
  const html = lengthRange(
    { min: 60, max: 90, strict: true },
    {
      names: { min: 'length-min', max: 'length-max', strict: 'length-strict' },
      material: { cards: 12, seconds: 360 },
      label: 'this video'
    }
  )
  expect(html).toContain('name="length-min" value="60"')
  expect(html).toContain('name="length-max" value="90"')
  expect(html).toMatch(/name="length-strict" checked/)
  expect(html).toContain('>60–90 s<')
  expect(html).toContain('About 150–225 words · 12 cards make about 7 episodes')
  // A window set between stops shows on the nearest ones.
  expect(lengthRange({ min: 40, max: 100, strict: false })).toContain(
    '>45–90 s<'
  )
  expect(lengthSay({ min: 120, max: 300, strict: false })).toContain(
    'Past 3 minutes an explainer tends to lose people.'
  )
  expect(lengthSay({ min: 60, max: 90, strict: false })).not.toContain(
    'Past 3 minutes'
  )
})
